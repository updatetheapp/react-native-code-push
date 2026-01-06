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

export { default } from './core/code-push';
export { CodePush } from './core/code-push';

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
} from './core/code-push';

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

export { log } from './utils/logging';
export { httpClient } from './utils/http-client';
export { Alert } from './adapters/alert-adapter';

// =============================================================================
// TYPE GUARDS
// =============================================================================

export {
  isRollbackRetryOptions,
  isUpdateDialog,
  isValidRollbackInfo,
} from './types';
