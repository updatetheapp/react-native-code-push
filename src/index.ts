/**
 * React Native CodePush
 *
 * A React Native plugin for the CodePush service, enabling over-the-air
 * updates to your React Native applications.
 *
 * @packageDocumentation
 */

// =============================================================================
// MAIN EXPORT
// =============================================================================

export { default } from './CodePush';
export { CodePush } from './CodePush';

// =============================================================================
// PUBLIC API
// =============================================================================

export {
  checkForUpdate,
  getCurrentPackage,
  getUpdateMetadata,
  notifyApplicationReady,
  restartApp,
  sync,
} from './CodePush';

// =============================================================================
// ENUMS
// =============================================================================

export {
  InstallMode,
  SyncStatus,
  CheckFrequency,
  UpdateState,
  DeploymentStatus,
} from './types';

// =============================================================================
// DEFAULTS
// =============================================================================

export {
  DEFAULT_UPDATE_DIALOG,
  DEFAULT_ROLLBACK_RETRY_OPTIONS,
  DEFAULT_SYNC_OPTIONS,
} from './types';

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Package types
  Package,
  LocalPackage,
  RemotePackage,

  // Options types
  CodePushOptions,
  SyncOptions,
  UpdateDialog,
  RollbackRetryOptions,

  // Progress and status types
  DownloadProgress,
  StatusReport,
  RollbackInfo,

  // Callback types
  DownloadProgressCallback,
  SyncStatusChangedCallback,
  HandleBinaryVersionMismatchCallback,
  UpdateInstalledCallback,

  // Configuration types
  CodePushConfiguration,
  QueryPackage,
  UpdateInfo,

  // Native module type
  NativeCodePushModule,

  // HTTP types
  HttpMethod,
  HttpResponse,
  HttpRequestCallback,
  HttpAdapter,

  // Alert types
  DialogButton,
  AlertService,
} from './types';

// =============================================================================
// UTILITIES (for advanced usage)
// =============================================================================

export { log } from './logging';
export { httpClient } from './httpClient';
export { Alert } from './alertAdapter';

// =============================================================================
// TYPE GUARDS
// =============================================================================

export {
  isRollbackRetryOptions,
  isUpdateDialog,
  isValidRollbackInfo,
} from './types';
