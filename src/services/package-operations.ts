/**
 * Package Operations Module
 *
 * Provides download and install functionality for CodePush packages.
 * Implements the package mixin pattern to augment remote and local packages
 * with additional capabilities.
 *
 * @module services/package-operations
 */

import { NativeEventEmitter, NativeModule } from 'react-native';
import { log } from '../utils/logging';
import type {
  NativeCodePushModule,
  LocalPackage,
  Package,
  DownloadProgressCallback,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

type ReportStatusDownloadFn = (pkg: Package) => Promise<void>;

interface RemotePackageMixin {
  download(downloadProgressCallback?: DownloadProgressCallback): Promise<LocalPackage>;
  isPending: boolean;
}

interface LocalPackageMixin {
  install(
    installMode?: number,
    minimumBackgroundDuration?: number,
    updateInstalledCallback?: () => void
  ): Promise<void>;
  isPending: boolean;
}

export interface PackageMixins {
  remote(reportStatusDownload: ReportStatusDownloadFn): RemotePackageMixin;
  local: LocalPackageMixin;
}

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * Removes function properties from an object.
 * This is necessary because native modules can't handle function properties.
 */
function stripFunctionProperties<T extends object>(obj: T): Partial<T> {
  const copy = { ...obj };
  Object.keys(copy).forEach((key) => {
    if (typeof (copy as Record<string, unknown>)[key] === 'function') {
      delete (copy as Record<string, unknown>)[key];
    }
  });
  return copy;
}

// =============================================================================
// PACKAGE OPERATIONS FACTORY
// =============================================================================

/**
 * Creates package mixins for the given native module.
 * These mixins provide download and install functionality to packages.
 *
 * @param nativeModule - The native CodePush module
 * @returns Package mixins for remote and local packages
 */
export function createPackageMixins(nativeModule: NativeCodePushModule): PackageMixins {
  /**
   * Creates the local package mixin with install capability.
   */
  const local: LocalPackageMixin = {
    async install(
      installMode: number = nativeModule.codePushInstallModeOnNextRestart,
      minimumBackgroundDuration: number = 0,
      updateInstalledCallback?: () => void
    ): Promise<void> {
      // In dev mode, React Native deep freezes objects, so we need a copy
      const localPackageCopy = stripFunctionProperties(this as unknown as Package);

      await nativeModule.installUpdate(localPackageCopy, installMode, minimumBackgroundDuration);

      updateInstalledCallback?.();

      if (installMode === nativeModule.codePushInstallModeImmediate) {
        nativeModule.restartApp(false);
      } else {
        nativeModule.clearPendingRestart();
        (this as LocalPackageMixin).isPending = true;
      }
    },

    isPending: false,
  };

  /**
   * Creates the remote package mixin with download capability.
   *
   * @param reportStatusDownload - Function to report download status
   */
  function remote(reportStatusDownload: ReportStatusDownloadFn): RemotePackageMixin {
    return {
      async download(downloadProgressCallback?: DownloadProgressCallback): Promise<LocalPackage> {
        const self = this as unknown as Package & { downloadUrl?: string };

        if (!self.downloadUrl) {
          throw new Error('Cannot download an update without a download url');
        }

        let downloadProgressSubscription: { remove(): void } | undefined;

        if (downloadProgressCallback) {
          const codePushEventEmitter = new NativeEventEmitter(
            nativeModule as unknown as NativeModule
          );
          downloadProgressSubscription = codePushEventEmitter.addListener(
            'CodePushDownloadProgress',
            downloadProgressCallback
          );
        }

        try {
          const updatePackageCopy = stripFunctionProperties(self);
          const downloadedPackage = await nativeModule.downloadUpdate(
            updatePackageCopy,
            !!downloadProgressCallback
          );

          if (reportStatusDownload) {
            reportStatusDownload(self).catch((err: unknown) => {
              log(`Report download status failed: ${err}`);
            });
          }

          // Combine downloaded package with local mixin
          return {
            ...downloadedPackage,
            ...local,
          } as LocalPackage;
        } finally {
          downloadProgressSubscription?.remove();
        }
      },

      isPending: false,
    };
  }

  return { local, remote };
}

export default createPackageMixins;
