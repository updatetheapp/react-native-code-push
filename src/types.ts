/**
 * CodePush Type Definitions
 *
 * This module contains all type definitions, interfaces, and enums
 * used throughout the CodePush library.
 *
 * @module types
 */

// =============================================================================
// ENUMS - Install Mode
// =============================================================================

/**
 * Defines when an installed update should be applied.
 */
export enum InstallMode {
  /** Restart the app immediately after installing */
  IMMEDIATE = 0,
  /** Apply on next app restart */
  ON_NEXT_RESTART = 1,
  /** Apply when app resumes from background */
  ON_NEXT_RESUME = 2,
  /** Apply while app is in background (after minimumBackgroundDuration) */
  ON_NEXT_SUSPEND = 3,
}

// =============================================================================
// ENUMS - Sync Status
// =============================================================================

/**
 * Represents the current status of a sync operation.
 */
export enum SyncStatus {
  /** App is up-to-date with the CodePush server */
  UP_TO_DATE = 0,
  /** Update was downloaded and is about to be installed */
  UPDATE_INSTALLED = 1,
  /** User chose to ignore an optional update */
  UPDATE_IGNORED = 2,
  /** An unknown error occurred during sync */
  UNKNOWN_ERROR = 3,
  /** A sync operation is already in progress */
  SYNC_IN_PROGRESS = 4,
  /** Querying the CodePush server for an update */
  CHECKING_FOR_UPDATE = 5,
  /** Waiting for user action on update dialog */
  AWAITING_USER_ACTION = 6,
  /** Downloading update from server */
  DOWNLOADING_PACKAGE = 7,
  /** Installing the downloaded update */
  INSTALLING_UPDATE = 8,
}

// =============================================================================
// ENUMS - Check Frequency
// =============================================================================

/**
 * Defines when to check for updates from the CodePush server.
 */
export enum CheckFrequency {
  /** Check when the app starts (root component mounts) */
  ON_APP_START = 0,
  /** Check when the app returns to foreground */
  ON_APP_RESUME = 1,
  /** Only check when sync() is manually called */
  MANUAL = 2,
}

// =============================================================================
// ENUMS - Update State
// =============================================================================

/**
 * Represents the state of an installed update.
 */
export enum UpdateState {
  /** The currently running update */
  RUNNING = 0,
  /** Update is installed but awaiting app restart */
  PENDING = 1,
  /** The latest available update (running or pending) */
  LATEST = 2,
}

// =============================================================================
// ENUMS - Deployment Status
// =============================================================================

/**
 * Indicates whether a deployment succeeded or failed.
 */
export enum DeploymentStatus {
  FAILED = 'DeploymentFailed',
  SUCCEEDED = 'DeploymentSucceeded',
}

// =============================================================================
// INTERFACES - Download Progress
// =============================================================================

/**
 * Represents download progress for an update.
 */
export interface DownloadProgress {
  /** Total bytes expected for this update */
  readonly totalBytes: number;
  /** Bytes downloaded so far */
  readonly receivedBytes: number;
}

// =============================================================================
// INTERFACES - Package
// =============================================================================

/**
 * Base interface for CodePush packages.
 */
export interface Package {
  /** App binary version this update depends on */
  readonly appVersion: string;
  /** Deployment key used to download this update */
  readonly deploymentKey: string;
  /** Update description from the CLI release */
  readonly description: string;
  /** Whether this update was previously rolled back */
  readonly failedInstall: boolean;
  /** Whether this is the first run after installation */
  readonly isFirstRun: boolean;
  /** Whether the update is mandatory */
  readonly isMandatory: boolean;
  /** Whether the update is pending (installed but not applied) */
  isPending: boolean;
  /** Internal label from CodePush server */
  readonly label: string;
  /** SHA hash of the update */
  readonly packageHash: string;
  /** Size of the update in bytes */
  readonly packageSize: number;
}

/**
 * A package available for download from the server.
 */
export interface RemotePackage extends Package {
  /** URL to download the update from */
  readonly downloadUrl: string;
  /** Downloads the update and returns a LocalPackage */
  download(progressCallback?: DownloadProgressCallback): Promise<LocalPackage>;
}

/**
 * A package that has been downloaded locally.
 */
export interface LocalPackage extends Package {
  /** Installs the update */
  install(
    installMode?: InstallMode,
    minimumBackgroundDuration?: number,
    updateInstalledCallback?: () => void
  ): Promise<void>;
}

// =============================================================================
// INTERFACES - Configuration
// =============================================================================

/**
 * Native CodePush configuration.
 */
export interface CodePushConfiguration {
  readonly appVersion: string;
  readonly deploymentKey: string;
  readonly serverUrl?: string;
  readonly packageHash?: string;
  clientUniqueId?: string;
}

// =============================================================================
// INTERFACES - Update Dialog
// =============================================================================

/**
 * Configuration for the update confirmation dialog.
 */
export interface UpdateDialog {
  /** Append release description to the message */
  readonly appendReleaseDescription?: boolean;
  /** Prefix for the release description */
  readonly descriptionPrefix?: string;
  /** Button text for mandatory updates */
  readonly mandatoryContinueButtonLabel?: string;
  /** Message for mandatory updates */
  readonly mandatoryUpdateMessage?: string;
  /** Ignore button text for optional updates */
  readonly optionalIgnoreButtonLabel?: string;
  /** Install button text for optional updates */
  readonly optionalInstallButtonLabel?: string;
  /** Message for optional updates */
  readonly optionalUpdateMessage?: string;
  /** Dialog title */
  readonly title?: string;
}

/**
 * Default update dialog configuration.
 */
export const DEFAULT_UPDATE_DIALOG: Required<UpdateDialog> = {
  appendReleaseDescription: false,
  descriptionPrefix: ' Description: ',
  mandatoryContinueButtonLabel: 'Continue',
  mandatoryUpdateMessage: 'An update is available that must be installed.',
  optionalIgnoreButtonLabel: 'Ignore',
  optionalInstallButtonLabel: 'Install',
  optionalUpdateMessage: 'An update is available. Would you like to install it?',
  title: 'Update available',
} as const;

// =============================================================================
// INTERFACES - Rollback Retry Options
// =============================================================================

/**
 * Configuration for rollback retry behavior.
 */
export interface RollbackRetryOptions {
  /** Hours to wait before retrying a rolled-back package */
  readonly delayInHours?: number;
  /** Maximum retry attempts (must be >= 1) */
  readonly maxRetryAttempts?: number;
}

/**
 * Default rollback retry configuration.
 */
export const DEFAULT_ROLLBACK_RETRY_OPTIONS: Required<RollbackRetryOptions> = {
  delayInHours: 24,
  maxRetryAttempts: 1,
} as const;

// =============================================================================
// INTERFACES - Sync Options
// =============================================================================

/**
 * Options for the sync operation.
 */
export interface SyncOptions {
  /** Override deployment key for this sync */
  readonly deploymentKey?: string | null;
  /** Ignore previously failed updates */
  readonly ignoreFailedUpdates?: boolean;
  /** Rollback retry configuration */
  readonly rollbackRetryOptions?: RollbackRetryOptions | null;
  /** Install mode for optional updates */
  readonly installMode?: InstallMode;
  /** Install mode for mandatory updates */
  readonly mandatoryInstallMode?: InstallMode;
  /** Minimum background duration for ON_NEXT_RESUME mode */
  readonly minimumBackgroundDuration?: number;
  /** Update dialog configuration (null to disable) */
  readonly updateDialog?: UpdateDialog | boolean | null;
}

/**
 * Default sync options.
 */
export const DEFAULT_SYNC_OPTIONS: Required<Omit<SyncOptions, 'updateDialog' | 'rollbackRetryOptions'>> & Pick<SyncOptions, 'updateDialog' | 'rollbackRetryOptions'> = {
  deploymentKey: null,
  ignoreFailedUpdates: true,
  rollbackRetryOptions: null,
  installMode: InstallMode.ON_NEXT_RESTART,
  mandatoryInstallMode: InstallMode.IMMEDIATE,
  minimumBackgroundDuration: 0,
  updateDialog: null,
} as const;

// =============================================================================
// INTERFACES - CodePush Options
// =============================================================================

/**
 * Options for the CodePush decorator/wrapper.
 */
export interface CodePushOptions extends SyncOptions {
  /** When to check for updates */
  readonly checkFrequency?: CheckFrequency;
}

// =============================================================================
// INTERFACES - Status Report
// =============================================================================

/**
 * Status report for deployment tracking.
 */
export interface StatusReport {
  /** Deployment status */
  readonly status?: DeploymentStatus | string;
  /** App version (for native updates) */
  readonly appVersion?: string;
  /** Package details */
  readonly package?: Package;
  /** Previous deployment key */
  readonly previousDeploymentKey?: string;
  /** Previous label or app version */
  readonly previousLabelOrAppVersion?: string;
}

// =============================================================================
// INTERFACES - Rollback Info
// =============================================================================

/**
 * Information about the latest rollback.
 */
export interface RollbackInfo {
  /** Timestamp of the rollback */
  readonly time: number;
  /** Number of rollback attempts */
  readonly count: number;
  /** Hash of the rolled-back package */
  readonly packageHash: string;
}

// =============================================================================
// INTERFACES - Query Package
// =============================================================================

/**
 * Package information for update queries.
 */
export interface QueryPackage {
  readonly appVersion: string;
  readonly packageHash?: string;
  readonly deploymentKey?: string;
  readonly label?: string;
}

// =============================================================================
// INTERFACES - Update Info (from server)
// =============================================================================

/**
 * Update information returned from the server.
 */
export interface UpdateInfo {
  readonly downloadUrl: string;
  readonly description: string;
  readonly appVersion: string;
  readonly packageHash: string;
  readonly packageSize: number;
  readonly label: string;
  readonly isMandatory: boolean;
  readonly updateAppVersion?: boolean;
}

// =============================================================================
// CALLBACK TYPES
// =============================================================================

/** Callback for download progress updates */
export type DownloadProgressCallback = (progress: DownloadProgress) => void;

/** Callback for sync status changes */
export type SyncStatusChangedCallback = (status: SyncStatus) => void;

/** Callback for binary version mismatch */
export type HandleBinaryVersionMismatchCallback = (update: RemotePackage | UpdateInfo) => void;

/** Callback for update installation */
export type UpdateInstalledCallback = () => void;

// =============================================================================
// INTERFACES - Native Module
// =============================================================================

/**
 * Native CodePush module interface.
 * Represents the bridge to native iOS/Android code.
 */
export interface NativeCodePushModule {
  // Install mode constants
  readonly codePushInstallModeImmediate: number;
  readonly codePushInstallModeOnNextRestart: number;
  readonly codePushInstallModeOnNextResume: number;
  readonly codePushInstallModeOnNextSuspend: number;

  // Update state constants
  readonly codePushUpdateStateRunning: number;
  readonly codePushUpdateStatePending: number;
  readonly codePushUpdateStateLatest: number;

  // Methods
  getConfiguration(): Promise<CodePushConfiguration>;
  getUpdateMetadata(updateState: number): Promise<Package | null>;
  downloadUpdate(updatePackage: object, notifyProgress: boolean): Promise<Package>;
  installUpdate(updatePackage: object, installMode: number, minimumBackgroundDuration: number): Promise<void>;
  notifyApplicationReady(): Promise<void>;
  isFailedUpdate(packageHash: string): Promise<boolean>;
  isFirstRun(packageHash: string): Promise<boolean>;
  getNewStatusReport(): Promise<StatusReport | null>;
  recordStatusReported(statusReport: StatusReport): void;
  saveStatusReportForRetry(statusReport: StatusReport): void;
  getLatestRollbackInfo(): Promise<RollbackInfo | null>;
  setLatestRollbackInfo(packageHash: string): Promise<void>;
  restartApp(onlyIfUpdateIsPending: boolean): void;
  disallow(): void;
  allow(): void;
  clearUpdates(): void;
  clearPendingRestart(): void;
}

// =============================================================================
// INTERFACES - HTTP Adapter
// =============================================================================

/**
 * HTTP method verb enumeration.
 */
export enum HttpMethod {
  GET = 0,
  HEAD = 1,
  POST = 2,
  PUT = 3,
  DELETE = 4,
  TRACE = 5,
  OPTIONS = 6,
  CONNECT = 7,
  PATCH = 8,
}

/**
 * HTTP response interface.
 */
export interface HttpResponse {
  readonly statusCode: number;
  readonly body: string;
}

/**
 * HTTP request callback type.
 */
export type HttpRequestCallback = (error: Error | null, response?: HttpResponse) => void;

/**
 * HTTP adapter interface for making requests.
 */
export interface HttpAdapter {
  request(
    verb: HttpMethod,
    url: string,
    requestBody: object | HttpRequestCallback | null,
    callback?: HttpRequestCallback
  ): Promise<void>;
}

// =============================================================================
// INTERFACES - Dialog Button
// =============================================================================

/**
 * Dialog button configuration.
 */
export interface DialogButton {
  readonly text: string;
  readonly onPress?: () => void;
}

/**
 * Alert service interface.
 */
export interface AlertService {
  alert(title: string, message: string, buttons: DialogButton[]): void;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a value is a valid RollbackRetryOptions object.
 */
export function isRollbackRetryOptions(value: unknown): value is RollbackRetryOptions {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const options = value as Record<string, unknown>;
  const hasValidDelay = options['delayInHours'] === undefined || typeof options['delayInHours'] === 'number';
  const hasValidAttempts = options['maxRetryAttempts'] === undefined || typeof options['maxRetryAttempts'] === 'number';
  return hasValidDelay && hasValidAttempts;
}

/**
 * Type guard to check if a value is a valid UpdateDialog object.
 */
export function isUpdateDialog(value: unknown): value is UpdateDialog {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a valid RollbackInfo object.
 */
export function isValidRollbackInfo(
  info: RollbackInfo | null,
  packageHash: string
): info is RollbackInfo {
  return (
    info !== null &&
    typeof info.time === 'number' &&
    typeof info.count === 'number' &&
    typeof info.packageHash === 'string' &&
    info.packageHash === packageHash
  );
}
