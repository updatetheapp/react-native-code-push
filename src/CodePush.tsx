/**
 * CodePush Main Module
 *
 * The main entry point for the CodePush library.
 * Provides the CodePush HOC/decorator and all public API methods.
 *
 * @module CodePush
 */

import React, { Component, createRef, RefObject, ComponentType } from 'react';
import { AppState, AppStateStatus, NativeModules } from 'react-native';
import hoistStatics from 'hoist-non-react-statics';
import { AcquisitionManager as Sdk } from 'code-push/script/acquisition-sdk';

import { log } from './logging';
import { httpClient } from './httpClient';
import { createPackageMixins, PackageMixins } from './packageOperations';
import { setTestConfiguration, getConfiguration } from './configurationService';
import { tryReportStatus } from './statusReportService';
import { checkForUpdate as checkForUpdateService, getUpdateMetadata as getUpdateMetadataService, getCurrentPackage as getCurrentPackageService } from './updateService';
import { sync as syncService } from './syncService';
import { setSdkConstructor, getSdkConstructor } from './sdkService';
import {
  InstallMode,
  SyncStatus,
  CheckFrequency,
  UpdateState,
  DeploymentStatus,
  DEFAULT_UPDATE_DIALOG,
  DEFAULT_ROLLBACK_RETRY_OPTIONS,
} from './types';
import type {
  CodePushOptions,
  SyncOptions,
  LocalPackage,
  RemotePackage,
  StatusReport,
  NativeCodePushModule,
  CodePushConfiguration,
  SyncStatusChangedCallback,
  DownloadProgressCallback,
  HandleBinaryVersionMismatchCallback,
} from './types';

// =============================================================================
// NATIVE MODULE INITIALIZATION
// =============================================================================

let NativeCodePush: NativeCodePushModule | null =
  (NativeModules as { CodePush?: NativeCodePushModule }).CodePush ?? null;

let packageMixins: PackageMixins | null = NativeCodePush
  ? createPackageMixins(NativeCodePush)
  : null;

// =============================================================================
// APPLICATION READY NOTIFICATION
// =============================================================================

let notifyApplicationReadyPromise: Promise<StatusReport | void> | null = null;

/**
 * Notifies the CodePush runtime that the app is ready.
 * This confirms that a previous update was successful.
 * Only executes once per app session.
 */
async function notifyApplicationReadyInternal(): Promise<StatusReport | void> {
  if (!NativeCodePush) {
    return;
  }

  await NativeCodePush.notifyApplicationReady();
  const statusReport = await NativeCodePush.getNewStatusReport();

  if (statusReport) {
    // Report status asynchronously (don't wait)
    tryReportStatus(statusReport, NativeCodePush, httpClient);
  }

  return statusReport ?? undefined;
}

/**
 * Notifies the CodePush runtime that the app has started successfully.
 * This should be called after the app has rendered its first view.
 */
function notifyApplicationReady(): Promise<StatusReport | void> {
  if (!notifyApplicationReadyPromise) {
    notifyApplicationReadyPromise = notifyApplicationReadyInternal();
  }
  return notifyApplicationReadyPromise;
}

/**
 * Internal wrapper that returns void for sync service compatibility.
 */
async function notifyApplicationReadyVoid(): Promise<void> {
  await notifyApplicationReady();
}

// =============================================================================
// PUBLIC API FUNCTIONS
// =============================================================================

/**
 * Checks for available updates from the CodePush server.
 *
 * @param deploymentKey - Optional deployment key override
 * @param handleBinaryVersionMismatch - Optional callback for version mismatch
 * @returns The remote package if an update is available, null otherwise
 */
async function checkForUpdate(
  deploymentKey?: string | null,
  handleBinaryVersionMismatch?: HandleBinaryVersionMismatchCallback | null
): Promise<RemotePackage | null> {
  if (!NativeCodePush || !packageMixins) {
    return null;
  }

  return checkForUpdateService(
    NativeCodePush,
    httpClient,
    packageMixins,
    () => getCurrentPackage(),
    deploymentKey,
    handleBinaryVersionMismatch
  );
}

/**
 * Gets the metadata for an installed update.
 *
 * @param updateState - The state of update to retrieve (default: RUNNING)
 * @returns The local package if available, null otherwise
 */
async function getUpdateMetadata(updateState?: UpdateState): Promise<LocalPackage | null> {
  if (!NativeCodePush || !packageMixins) {
    return null;
  }

  return getUpdateMetadataService(NativeCodePush, packageMixins, updateState);
}

/**
 * Gets the currently installed package.
 *
 * @returns The current package if available, null otherwise
 */
async function getCurrentPackage(): Promise<LocalPackage | null> {
  if (!NativeCodePush || !packageMixins) {
    return null;
  }

  return getCurrentPackageService(NativeCodePush, packageMixins);
}

/**
 * Synchronizes the app with the CodePush server.
 * Checks for updates, downloads, and installs them based on options.
 *
 * @param options - Sync configuration options
 * @param syncStatusChangeCallback - Optional callback for status changes
 * @param downloadProgressCallback - Optional callback for download progress
 * @param handleBinaryVersionMismatch - Optional callback for version mismatch
 * @returns The final sync status
 */
function sync(
  options: SyncOptions = {},
  syncStatusChangeCallback?: SyncStatusChangedCallback,
  downloadProgressCallback?: DownloadProgressCallback,
  handleBinaryVersionMismatch?: HandleBinaryVersionMismatchCallback
): Promise<SyncStatus> {
  if (!NativeCodePush || !packageMixins) {
    return Promise.resolve(SyncStatus.UNKNOWN_ERROR);
  }

  return syncService(
    NativeCodePush,
    httpClient,
    packageMixins,
    notifyApplicationReadyVoid,
    options,
    syncStatusChangeCallback,
    downloadProgressCallback,
    handleBinaryVersionMismatch
  );
}

/**
 * Restarts the app.
 *
 * @param onlyIfUpdateIsPending - Only restart if there's a pending update
 */
function restartApp(onlyIfUpdateIsPending = false): void {
  NativeCodePush?.restartApp(onlyIfUpdateIsPending);
}

/**
 * Sets up test dependencies for unit testing.
 *
 * @param testSdk - Test SDK constructor
 * @param testConfig - Test configuration
 * @param testNativeBridge - Test native module
 */
function setUpTestDependencies(
  testSdk?: typeof Sdk | null,
  testConfig?: CodePushConfiguration | null,
  testNativeBridge?: NativeCodePushModule | null
): void {
  if (testSdk) {
    setSdkConstructor(testSdk);
  }
  if (testConfig !== undefined) {
    setTestConfiguration(testConfig);
  }
  if (testNativeBridge !== undefined) {
    NativeCodePush = testNativeBridge;
    packageMixins = testNativeBridge ? createPackageMixins(testNativeBridge) : null;
  }
}

// =============================================================================
// CODEPUSH HIGHER-ORDER COMPONENT
// =============================================================================

/**
 * Props for components using CodePush callbacks.
 */
interface CodePushCallbackProps {
  codePushStatusDidChange?: SyncStatusChangedCallback;
  codePushDownloadDidProgress?: DownloadProgressCallback;
  codePushOnBinaryVersionMismatch?: HandleBinaryVersionMismatchCallback;
}

/**
 * Creates a CodePush-wrapped component that automatically syncs on mount.
 *
 * @param options - CodePush options or the component to wrap
 * @returns A higher-order component function or the wrapped component
 */
function codePushify<P extends object>(
  options: CodePushOptions | ComponentType<P> = {}
): ComponentType<P> | ((RootComponent: ComponentType<P>) => ComponentType<P>) {
  const decorator = (RootComponent: ComponentType<P>): ComponentType<P> => {
    class CodePushComponent extends Component<P> {
      private rootComponentRef: RefObject<Component<P> & CodePushCallbackProps>;
      private appStateSubscription?: { remove(): void };

      constructor(props: P) {
        super(props);
        this.rootComponentRef = createRef();
      }

      override componentDidMount(): void {
        const opts = typeof options === 'function' ? {} : options;

        if (opts.checkFrequency === CheckFrequency.MANUAL) {
          notifyApplicationReady();
          return;
        }

        const rootInstance = this.rootComponentRef.current as (Component<P> & CodePushCallbackProps) | null;

        const syncStatusCallback = rootInstance?.codePushStatusDidChange?.bind(rootInstance);
        const downloadProgressCallback = rootInstance?.codePushDownloadDidProgress?.bind(rootInstance);
        const binaryVersionMismatchCallback = rootInstance?.codePushOnBinaryVersionMismatch?.bind(rootInstance);

        sync(opts, syncStatusCallback, downloadProgressCallback, binaryVersionMismatchCallback);

        if (opts.checkFrequency === CheckFrequency.ON_APP_RESUME) {
          this.appStateSubscription = AppState.addEventListener(
            'change',
            (newState: AppStateStatus) => {
              if (newState === 'active') {
                sync(opts, syncStatusCallback, downloadProgressCallback);
              }
            }
          );
        }
      }

      override componentWillUnmount(): void {
        this.appStateSubscription?.remove();
      }

      override render(): React.ReactNode {
        const props = { ...this.props } as P & { ref?: RefObject<Component<P>> };

        // Only set ref on class components (not stateless/functional)
        const RootComponentPrototype = RootComponent.prototype as { render?: () => React.ReactNode } | undefined;
        if (RootComponentPrototype?.render) {
          props.ref = this.rootComponentRef as RefObject<Component<P>>;
        }

        return <RootComponent {...props} />;
      }
    }

    // Type assertion needed for hoist-non-react-statics compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return hoistStatics(CodePushComponent as any, RootComponent as any) as ComponentType<P>;
  };

  // Support both @codePush and @codePush(options) decorator syntax
  if (typeof options === 'function') {
    return decorator(options as ComponentType<P>);
  }

  return decorator;
}

// =============================================================================
// CODEPUSH OBJECT CONSTRUCTION
// =============================================================================

interface CodePushStatic {
  // Decorator/HOC
  <P extends object>(options?: CodePushOptions): (component: ComponentType<P>) => ComponentType<P>;
  <P extends object>(component: ComponentType<P>): ComponentType<P>;

  // SDK (for testing)
  AcquisitionSdk: typeof Sdk;

  // Public API
  checkForUpdate: typeof checkForUpdate;
  getConfiguration: (nativeModule?: NativeCodePushModule) => Promise<CodePushConfiguration>;
  getCurrentPackage: typeof getCurrentPackage;
  getUpdateMetadata: typeof getUpdateMetadata;
  log: typeof log;
  notifyAppReady: typeof notifyApplicationReady;
  notifyApplicationReady: typeof notifyApplicationReady;
  restartApp: typeof restartApp;
  setUpTestDependencies: typeof setUpTestDependencies;
  sync: typeof sync;

  // Native bridge methods
  disallowRestart: () => void;
  allowRestart: () => void;
  clearUpdates: () => void;

  // Enums
  InstallMode: typeof InstallMode;
  SyncStatus: typeof SyncStatus;
  CheckFrequency: typeof CheckFrequency;
  UpdateState: {
    RUNNING: number;
    PENDING: number;
    LATEST: number;
  };
  DeploymentStatus: typeof DeploymentStatus;

  // Defaults
  DEFAULT_UPDATE_DIALOG: typeof DEFAULT_UPDATE_DIALOG;
  DEFAULT_ROLLBACK_RETRY_OPTIONS: typeof DEFAULT_ROLLBACK_RETRY_OPTIONS;
}

// =============================================================================
// MODULE INITIALIZATION
// =============================================================================

let CodePush: CodePushStatic | undefined;

if (NativeCodePush) {
  CodePush = Object.assign(codePushify, {
    // SDK (for testing)
    AcquisitionSdk: getSdkConstructor(),

    // Public API
    checkForUpdate,
    getConfiguration: (module?: NativeCodePushModule) => getConfiguration(module ?? NativeCodePush!),
    getCurrentPackage,
    getUpdateMetadata,
    log,
    notifyAppReady: notifyApplicationReady,
    notifyApplicationReady,
    restartApp,
    setUpTestDependencies,
    sync,

    // Native bridge methods
    disallowRestart: NativeCodePush.disallow,
    allowRestart: NativeCodePush.allow,
    clearUpdates: NativeCodePush.clearUpdates,

    // Enums with native values
    InstallMode: {
      IMMEDIATE: NativeCodePush.codePushInstallModeImmediate,
      ON_NEXT_RESTART: NativeCodePush.codePushInstallModeOnNextRestart,
      ON_NEXT_RESUME: NativeCodePush.codePushInstallModeOnNextResume,
      ON_NEXT_SUSPEND: NativeCodePush.codePushInstallModeOnNextSuspend,
    } as unknown as typeof InstallMode,

    SyncStatus,
    CheckFrequency,

    UpdateState: {
      RUNNING: NativeCodePush.codePushUpdateStateRunning,
      PENDING: NativeCodePush.codePushUpdateStatePending,
      LATEST: NativeCodePush.codePushUpdateStateLatest,
    },

    DeploymentStatus,

    // Defaults
    DEFAULT_UPDATE_DIALOG,
    DEFAULT_ROLLBACK_RETRY_OPTIONS,
  }) as CodePushStatic;
} else {
  log("The CodePush module doesn't appear to be properly installed. Please double-check that everything is setup correctly.");
}

export default CodePush;
export {
  CodePush,
  checkForUpdate,
  getCurrentPackage,
  getUpdateMetadata,
  notifyApplicationReady,
  restartApp,
  sync,
  InstallMode,
  SyncStatus,
  CheckFrequency,
  UpdateState,
  DeploymentStatus,
  DEFAULT_UPDATE_DIALOG,
  DEFAULT_ROLLBACK_RETRY_OPTIONS,
};
export * from './types';
