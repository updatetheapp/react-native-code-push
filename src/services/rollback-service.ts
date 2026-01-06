/**
 * Rollback Service Module
 *
 * Handles rollback detection and retry logic for failed updates.
 * Determines whether a previously rolled-back update should be retried.
 *
 * @module services/rollback-service
 */

import { log } from '../utils/logging';
import {
  DEFAULT_ROLLBACK_RETRY_OPTIONS,
  isValidRollbackInfo,
} from '../types';
import type {
  RemotePackage,
  SyncOptions,
  RollbackRetryOptions,
  NativeCodePushModule,
} from '../types';

// =============================================================================
// CONSTANTS
// =============================================================================

const HOURS_TO_MILLISECONDS = 1000 * 60 * 60;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validates the rollback retry options.
 *
 * @param options - The rollback retry options to validate
 * @returns True if the options are valid
 */
function validateRollbackRetryOptions(options: Required<RollbackRetryOptions>): boolean {
  if (typeof options.delayInHours !== 'number') {
    log("The 'delayInHours' rollback retry parameter must be a number.");
    return false;
  }

  if (typeof options.maxRetryAttempts !== 'number') {
    log("The 'maxRetryAttempts' rollback retry parameter must be a number.");
    return false;
  }

  if (options.maxRetryAttempts < 1) {
    log("The 'maxRetryAttempts' rollback retry parameter cannot be less then 1.");
    return false;
  }

  return true;
}

/**
 * Calculates hours since the latest rollback.
 *
 * @param rollbackTime - The timestamp of the rollback
 * @returns Hours since the rollback
 */
function calculateHoursSinceRollback(rollbackTime: number): number {
  return (Date.now() - rollbackTime) / HOURS_TO_MILLISECONDS;
}

/**
 * Normalizes rollback retry options, applying defaults as needed.
 *
 * @param options - The options to normalize (can be boolean, object, or null)
 * @returns Normalized options or null if retry should not occur
 */
function normalizeRollbackRetryOptions(
  options: RollbackRetryOptions | boolean | null | undefined
): Required<RollbackRetryOptions> | null {
  if (!options) {
    return null;
  }

  if (typeof options !== 'object') {
    return { ...DEFAULT_ROLLBACK_RETRY_OPTIONS };
  }

  return {
    delayInHours: options.delayInHours ?? DEFAULT_ROLLBACK_RETRY_OPTIONS.delayInHours,
    maxRetryAttempts: options.maxRetryAttempts ?? DEFAULT_ROLLBACK_RETRY_OPTIONS.maxRetryAttempts,
  };
}

// =============================================================================
// ROLLBACK SERVICE
// =============================================================================

/**
 * Determines whether an update should be ignored based on rollback history.
 *
 * An update should be ignored if:
 * 1. It previously failed and ignoreFailedUpdates is true
 * 2. Rollback retry conditions have not been met
 *
 * @param remotePackage - The remote package to check
 * @param syncOptions - The sync options
 * @param nativeModule - The native CodePush module
 * @returns True if the update should be ignored
 */
export async function shouldUpdateBeIgnored(
  remotePackage: RemotePackage | null,
  syncOptions: SyncOptions,
  nativeModule: NativeCodePushModule
): Promise<boolean> {
  // No package to ignore
  if (!remotePackage) {
    return false;
  }

  const isFailedPackage = remotePackage.failedInstall;

  // Not a failed package or we're not ignoring failed updates
  if (!isFailedPackage || !syncOptions.ignoreFailedUpdates) {
    return false;
  }

  const rollbackRetryOptions = normalizeRollbackRetryOptions(syncOptions.rollbackRetryOptions);

  // No retry options configured - always ignore failed updates
  if (!rollbackRetryOptions) {
    return true;
  }

  // Validate retry options
  if (!validateRollbackRetryOptions(rollbackRetryOptions)) {
    return true;
  }

  // Check rollback info
  const latestRollbackInfo = await nativeModule.getLatestRollbackInfo();

  if (!isValidRollbackInfo(latestRollbackInfo, remotePackage.packageHash)) {
    log('The latest rollback info is not valid.');
    return true;
  }

  // Check if retry conditions are met
  const { delayInHours, maxRetryAttempts } = rollbackRetryOptions;
  const hoursSinceRollback = calculateHoursSinceRollback(latestRollbackInfo.time);

  if (hoursSinceRollback >= delayInHours && maxRetryAttempts >= latestRollbackInfo.count) {
    log('Previous rollback should be ignored due to rollback retry options.');
    return false;
  }

  return true;
}

export default {
  shouldUpdateBeIgnored,
};
