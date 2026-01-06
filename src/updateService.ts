/**
 * Update Service Module
 *
 * Handles checking for updates from the CodePush server and
 * retrieving update metadata from installed packages.
 *
 * @module updateService
 */

import { Platform } from 'react-native';
import { log } from './logging';
import { createPromisifiedSdk } from './sdkService';
import { getConfiguration, createMergedConfiguration } from './configurationService';
import type { PackageMixins } from './packageOperations';
import type {
  NativeCodePushModule,
  HttpAdapter,
  RemotePackage,
  LocalPackage,
  Package,
  QueryPackage,
  UpdateInfo,
  UpdateState,
  HandleBinaryVersionMismatchCallback,
} from './types';

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * Creates a query package from a local package or configuration.
 * Note: When localPackage exists, we pass it directly to match original behavior
 * as the SDK may use additional fields beyond the typed interface.
 */
function createQueryPackage(
  localPackage: Package | null,
  appVersion: string,
  packageHash?: string
): QueryPackage | Package {
  // If local package exists, use the entire package (matches original behavior)
  if (localPackage) {
    return localPackage;
  }

  // No local package - create minimal query with app version
  const queryPackage: QueryPackage = { appVersion };

  // On iOS, include packageHash for binary version comparison
  if (Platform.OS === 'ios' && packageHash) {
    return { ...queryPackage, packageHash };
  }

  return queryPackage;
}

/**
 * Determines if an update should be skipped based on various conditions.
 */
function shouldSkipUpdate(
  update: UpdateInfo | null,
  localPackage: (Package & { _isDebugOnly?: boolean }) | null,
  configPackageHash?: string
): boolean {
  // No update available
  if (!update) {
    return true;
  }

  // Server says update requires newer binary version
  if (update.updateAppVersion) {
    return true;
  }

  // Update hash matches currently installed update
  if (localPackage && update.packageHash === localPackage.packageHash) {
    return true;
  }

  // Update hash matches binary version (Android case)
  if ((!localPackage || localPackage._isDebugOnly) && configPackageHash === update.packageHash) {
    return true;
  }

  return false;
}

// =============================================================================
// UPDATE SERVICE
// =============================================================================

/**
 * Checks for available updates from the CodePush server.
 *
 * @param nativeModule - The native CodePush module
 * @param httpAdapter - The HTTP adapter for requests
 * @param packageMixins - The package mixins for augmenting packages
 * @param getCurrentPackage - Function to get current package
 * @param deploymentKey - Optional deployment key override
 * @param handleBinaryVersionMismatch - Optional callback for version mismatch
 * @returns The remote package if an update is available, null otherwise
 */
export async function checkForUpdate(
  nativeModule: NativeCodePushModule,
  httpAdapter: HttpAdapter,
  packageMixins: PackageMixins,
  getCurrentPackage: () => Promise<LocalPackage | null>,
  deploymentKey?: string | null,
  handleBinaryVersionMismatch?: HandleBinaryVersionMismatchCallback | null
): Promise<RemotePackage | null> {
  // Get configuration
  const nativeConfig = await getConfiguration(nativeModule);
  const config = createMergedConfiguration(nativeConfig, deploymentKey);

  // Create SDK instance
  const sdk = createPromisifiedSdk(httpAdapter, config);

  // Get current installed package
  const localPackage = await getCurrentPackage() as (Package & { _isDebugOnly?: boolean }) | null;

  // Create query package for server request
  const queryPackage = createQueryPackage(
    localPackage,
    config.appVersion,
    config.packageHash
  );

  // Query server for update
  const update = await sdk.queryUpdateWithCurrentPackage(queryPackage);

  // Check if update should be skipped
  if (shouldSkipUpdate(update, localPackage, config.packageHash)) {
    if (update?.updateAppVersion) {
      log('An update is available but it is not targeting the binary version of your app.');
      handleBinaryVersionMismatch?.(update);
    }
    return null;
  }

  // Create remote package with download capability
  const remotePackage: RemotePackage = {
    ...update!,
    ...packageMixins.remote(sdk.reportStatusDownload),
    failedInstall: await nativeModule.isFailedUpdate(update!.packageHash),
    deploymentKey: deploymentKey ?? nativeConfig.deploymentKey,
    isFirstRun: false,
    isPending: false,
  } as RemotePackage;

  return remotePackage;
}

/**
 * Gets the currently installed update package.
 *
 * @param nativeModule - The native CodePush module
 * @param packageMixins - The package mixins for augmenting packages
 * @param updateState - The state of update to retrieve
 * @returns The local package if available, null otherwise
 */
export async function getUpdateMetadata(
  nativeModule: NativeCodePushModule,
  packageMixins: PackageMixins,
  updateState?: UpdateState
): Promise<LocalPackage | null> {
  const state = updateState ?? nativeModule.codePushUpdateStateRunning;
  const updateMetadata = await nativeModule.getUpdateMetadata(state);

  if (!updateMetadata) {
    return null;
  }

  // Augment with local package capabilities and additional metadata
  const localPackage: LocalPackage = {
    ...packageMixins.local,
    ...updateMetadata,
    failedInstall: await nativeModule.isFailedUpdate(updateMetadata.packageHash),
    isFirstRun: await nativeModule.isFirstRun(updateMetadata.packageHash),
  };

  return localPackage;
}

/**
 * Gets the currently running package.
 *
 * @param nativeModule - The native CodePush module
 * @param packageMixins - The package mixins for augmenting packages
 * @returns The current package if available, null otherwise
 */
export async function getCurrentPackage(
  nativeModule: NativeCodePushModule,
  packageMixins: PackageMixins
): Promise<LocalPackage | null> {
  // Use LATEST state to get the most recent package (running or pending)
  return getUpdateMetadata(nativeModule, packageMixins, nativeModule.codePushUpdateStateLatest as UpdateState);
}

export default {
  checkForUpdate,
  getUpdateMetadata,
  getCurrentPackage,
};
