/**
 * Sync Service Module
 *
 * Orchestrates the complete sync process including:
 * - Checking for updates
 * - Showing update dialogs
 * - Downloading and installing updates
 *
 * @module syncService
 */

import { log } from './logging';
import { Alert } from './alertAdapter';
import { checkForUpdate, getCurrentPackage } from './updateService';
import { shouldUpdateBeIgnored } from './rollbackService';
import {
  SyncStatus,
  InstallMode,
  DEFAULT_SYNC_OPTIONS,
  DEFAULT_UPDATE_DIALOG,
  isUpdateDialog,
} from './types';
import type {
  SyncOptions,
  UpdateDialog,
  RemotePackage,
  NativeCodePushModule,
  HttpAdapter,
  SyncStatusChangedCallback,
  DownloadProgressCallback,
  HandleBinaryVersionMismatchCallback,
  DialogButton,
} from './types';
import type { PackageMixins } from './packageOperations';

// =============================================================================
// STATE
// =============================================================================

let syncInProgress = false;

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * Creates a safe sync status callback wrapper that catches and logs errors.
 */
function createSafeStatusCallback(
  callback: SyncStatusChangedCallback | undefined,
  errorMessage: string
): SyncStatusChangedCallback | undefined {
  if (typeof callback !== 'function') {
    return undefined;
  }

  return (status: SyncStatus) => {
    try {
      callback(status);
    } catch (error) {
      const errorObj = error as Error;
      log(`${errorMessage}: ${errorObj.stack ?? errorObj.message}`);
    }
  };
}

/**
 * Creates a safe download progress callback wrapper that catches and logs errors.
 */
function createSafeProgressCallback(
  callback: DownloadProgressCallback | undefined,
  errorMessage: string
): DownloadProgressCallback | undefined {
  if (typeof callback !== 'function') {
    return undefined;
  }

  return (progress) => {
    try {
      callback(progress);
    } catch (error) {
      const errorObj = error as Error;
      log(`${errorMessage}: ${errorObj.stack ?? errorObj.message}`);
    }
  };
}

/**
 * Creates the default sync status callback that logs status changes.
 */
function createDefaultStatusCallback(
  resolvedInstallMode: () => InstallMode | undefined,
  minimumBackgroundDuration: number
): SyncStatusChangedCallback {
  return (syncStatus: SyncStatus) => {
    const statusMessages: Record<SyncStatus, string | (() => string)> = {
      [SyncStatus.CHECKING_FOR_UPDATE]: 'Checking for update.',
      [SyncStatus.AWAITING_USER_ACTION]: 'Awaiting user action.',
      [SyncStatus.DOWNLOADING_PACKAGE]: 'Downloading package.',
      [SyncStatus.INSTALLING_UPDATE]: 'Installing update.',
      [SyncStatus.UP_TO_DATE]: 'App is up to date.',
      [SyncStatus.UPDATE_IGNORED]: 'User cancelled the update.',
      [SyncStatus.UPDATE_INSTALLED]: () => getUpdateInstalledMessage(resolvedInstallMode(), minimumBackgroundDuration),
      [SyncStatus.UNKNOWN_ERROR]: 'An unknown error occurred.',
      [SyncStatus.SYNC_IN_PROGRESS]: 'Sync already in progress.',
    };

    const message = statusMessages[syncStatus];
    if (message) {
      log(typeof message === 'function' ? message() : message);
    }
  };
}

/**
 * Gets the appropriate message for UPDATE_INSTALLED status.
 */
function getUpdateInstalledMessage(
  installMode: InstallMode | undefined,
  minimumBackgroundDuration: number
): string {
  switch (installMode) {
    case InstallMode.ON_NEXT_RESTART:
      return 'Update is installed and will be run on the next app restart.';
    case InstallMode.ON_NEXT_RESUME:
      if (minimumBackgroundDuration > 0) {
        return `Update is installed and will be run after the app has been in the background for at least ${minimumBackgroundDuration} seconds.`;
      }
      return 'Update is installed and will be run when the app next resumes.';
    default:
      return 'Update installed.';
  }
}

/**
 * Normalizes sync options with defaults.
 */
function normalizeSyncOptions(options: SyncOptions = {}): Required<Omit<SyncOptions, 'updateDialog' | 'rollbackRetryOptions'>> & Pick<SyncOptions, 'updateDialog' | 'rollbackRetryOptions'> {
  return {
    ...DEFAULT_SYNC_OPTIONS,
    ...options,
  };
}

/**
 * Normalizes update dialog options.
 */
function normalizeUpdateDialog(dialog: UpdateDialog | boolean | null | undefined): Required<UpdateDialog> | null {
  if (!dialog) {
    return null;
  }

  if (!isUpdateDialog(dialog)) {
    return { ...DEFAULT_UPDATE_DIALOG };
  }

  return {
    ...DEFAULT_UPDATE_DIALOG,
    ...dialog,
  };
}

/**
 * Creates dialog buttons for the update confirmation dialog.
 */
function createDialogButtons(
  remotePackage: RemotePackage,
  dialogConfig: Required<UpdateDialog>,
  onInstall: () => void,
  onIgnore: () => void
): { buttons: DialogButton[]; message: string; installButtonText: string } {
  const buttons: DialogButton[] = [];
  let message: string;
  let installButtonText: string;

  if (remotePackage.isMandatory) {
    message = dialogConfig.mandatoryUpdateMessage;
    installButtonText = dialogConfig.mandatoryContinueButtonLabel;
  } else {
    message = dialogConfig.optionalUpdateMessage;
    installButtonText = dialogConfig.optionalInstallButtonLabel;

    // Add ignore button for optional updates
    buttons.push({
      text: dialogConfig.optionalIgnoreButtonLabel,
      onPress: onIgnore,
    });
  }

  // Add install button (placed last/right)
  buttons.push({
    text: installButtonText,
    onPress: onInstall,
  });

  return { buttons, message, installButtonText };
}

/**
 * Appends release description to message if configured.
 */
function appendReleaseDescription(
  message: string,
  dialogConfig: Required<UpdateDialog>,
  remotePackage: RemotePackage
): string {
  if (dialogConfig.appendReleaseDescription && remotePackage.description) {
    return `${message}${dialogConfig.descriptionPrefix}${remotePackage.description}`;
  }
  return message;
}

// =============================================================================
// SYNC SERVICE
// =============================================================================

/**
 * Performs the complete sync operation.
 * Only one sync operation can run at a time.
 *
 * @param nativeModule - The native CodePush module
 * @param httpAdapter - The HTTP adapter for requests
 * @param packageMixins - The package mixins
 * @param notifyApplicationReady - Function to notify app is ready
 * @param options - Sync options
 * @param syncStatusChangeCallback - Optional status change callback
 * @param downloadProgressCallback - Optional download progress callback
 * @param handleBinaryVersionMismatch - Optional version mismatch callback
 * @returns The final sync status
 */
export async function sync(
  nativeModule: NativeCodePushModule,
  httpAdapter: HttpAdapter,
  packageMixins: PackageMixins,
  notifyApplicationReady: () => Promise<void>,
  options: SyncOptions = {},
  syncStatusChangeCallback?: SyncStatusChangedCallback,
  downloadProgressCallback?: DownloadProgressCallback,
  handleBinaryVersionMismatch?: HandleBinaryVersionMismatchCallback
): Promise<SyncStatus> {
  // Wrap callbacks with error handling
  const safeStatusCallback = createSafeStatusCallback(
    syncStatusChangeCallback,
    'An error has occurred'
  );
  const safeProgressCallback = createSafeProgressCallback(
    downloadProgressCallback,
    'An error has occurred'
  );

  // Check if sync is already in progress
  if (syncInProgress) {
    safeStatusCallback?.(SyncStatus.SYNC_IN_PROGRESS);
    if (!safeStatusCallback) {
      log('Sync already in progress.');
    }
    return SyncStatus.SYNC_IN_PROGRESS;
  }

  syncInProgress = true;

  try {
    const result = await syncInternal(
      nativeModule,
      httpAdapter,
      packageMixins,
      notifyApplicationReady,
      options,
      safeStatusCallback,
      safeProgressCallback,
      handleBinaryVersionMismatch
    );
    return result;
  } finally {
    syncInProgress = false;
  }
}

/**
 * Internal sync implementation.
 */
async function syncInternal(
  nativeModule: NativeCodePushModule,
  httpAdapter: HttpAdapter,
  packageMixins: PackageMixins,
  notifyApplicationReady: () => Promise<void>,
  options: SyncOptions,
  syncStatusChangeCallback?: SyncStatusChangedCallback,
  downloadProgressCallback?: DownloadProgressCallback,
  handleBinaryVersionMismatch?: HandleBinaryVersionMismatchCallback
): Promise<SyncStatus> {
  let resolvedInstallMode: InstallMode | undefined;
  const syncOptions = normalizeSyncOptions(options);

  // Use provided callback or create default logging callback
  const statusCallback = syncStatusChangeCallback ??
    createDefaultStatusCallback(() => resolvedInstallMode, syncOptions.minimumBackgroundDuration);

  try {
    // Notify that the app is ready (confirms previous update was successful)
    await notifyApplicationReady();

    // Check for updates
    statusCallback(SyncStatus.CHECKING_FOR_UPDATE);

    const remotePackage = await checkForUpdate(
      nativeModule,
      httpAdapter,
      packageMixins,
      () => getCurrentPackage(nativeModule, packageMixins),
      syncOptions.deploymentKey,
      handleBinaryVersionMismatch
    );

    // Check if update should be ignored (rollback protection)
    const updateShouldBeIgnored = await shouldUpdateBeIgnored(
      remotePackage,
      syncOptions,
      nativeModule
    );

    // No update available or should be ignored
    if (!remotePackage || updateShouldBeIgnored) {
      if (updateShouldBeIgnored) {
        log('An update is available, but it is being ignored due to having been previously rolled back.');
      }

      // Check for pending update
      const currentPackage = await getCurrentPackage(nativeModule, packageMixins);
      if (currentPackage?.isPending) {
        statusCallback(SyncStatus.UPDATE_INSTALLED);
        return SyncStatus.UPDATE_INSTALLED;
      }

      statusCallback(SyncStatus.UP_TO_DATE);
      return SyncStatus.UP_TO_DATE;
    }

    // Handle update dialog
    const dialogConfig = normalizeUpdateDialog(syncOptions.updateDialog);

    if (dialogConfig) {
      return await handleUpdateWithDialog(
        remotePackage,
        dialogConfig,
        syncOptions,
        statusCallback,
        downloadProgressCallback,
        (mode) => { resolvedInstallMode = mode; }
      );
    }

    // No dialog - download and install immediately
    return await downloadAndInstall(
      remotePackage,
      syncOptions,
      statusCallback,
      downloadProgressCallback,
      (mode) => { resolvedInstallMode = mode; }
    );
  } catch (error) {
    statusCallback(SyncStatus.UNKNOWN_ERROR);
    const errorObj = error as Error;
    log(errorObj.message);
    throw error;
  }
}

/**
 * Handles update with confirmation dialog.
 */
async function handleUpdateWithDialog(
  remotePackage: RemotePackage,
  dialogConfig: Required<UpdateDialog>,
  syncOptions: ReturnType<typeof normalizeSyncOptions>,
  statusCallback: SyncStatusChangedCallback,
  downloadProgressCallback?: DownloadProgressCallback,
  setInstallMode?: (mode: InstallMode) => void
): Promise<SyncStatus> {
  return new Promise((resolve, reject) => {
    const onInstall = () => {
      downloadAndInstall(
        remotePackage,
        syncOptions,
        statusCallback,
        downloadProgressCallback,
        setInstallMode
      ).then(resolve, reject);
    };

    const onIgnore = () => {
      statusCallback(SyncStatus.UPDATE_IGNORED);
      resolve(SyncStatus.UPDATE_IGNORED);
    };

    const { buttons, message: baseMessage } = createDialogButtons(
      remotePackage,
      dialogConfig,
      onInstall,
      onIgnore
    );

    const message = appendReleaseDescription(baseMessage, dialogConfig, remotePackage);

    statusCallback(SyncStatus.AWAITING_USER_ACTION);
    Alert.alert(dialogConfig.title, message, buttons);
  });
}

/**
 * Downloads and installs an update.
 */
async function downloadAndInstall(
  remotePackage: RemotePackage,
  syncOptions: ReturnType<typeof normalizeSyncOptions>,
  statusCallback: SyncStatusChangedCallback,
  downloadProgressCallback?: DownloadProgressCallback,
  setInstallMode?: (mode: InstallMode) => void
): Promise<SyncStatus> {
  // Download the update
  statusCallback(SyncStatus.DOWNLOADING_PACKAGE);
  const localPackage = await remotePackage.download(downloadProgressCallback);

  // Determine install mode based on whether update is mandatory
  const resolvedInstallMode = localPackage.isMandatory
    ? syncOptions.mandatoryInstallMode
    : syncOptions.installMode;

  setInstallMode?.(resolvedInstallMode);

  // Install the update
  statusCallback(SyncStatus.INSTALLING_UPDATE);
  await localPackage.install(
    resolvedInstallMode,
    syncOptions.minimumBackgroundDuration,
    () => statusCallback(SyncStatus.UPDATE_INSTALLED)
  );

  return SyncStatus.UPDATE_INSTALLED;
}

/**
 * Resets the sync in progress flag (for testing).
 */
export function resetSyncState(): void {
  syncInProgress = false;
}

export default {
  sync,
  resetSyncState,
};
