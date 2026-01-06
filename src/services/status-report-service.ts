/**
 * Status Report Service Module
 *
 * Handles reporting deployment status to the CodePush server.
 * Includes retry logic for failed reports when the app resumes.
 *
 * @module services/status-report-service
 */

import { AppState, AppStateStatus } from 'react-native';
import { log } from '../utils/logging';
import { createPromisifiedSdk } from './sdk-service';
import { getConfiguration } from './configuration-service';
import type {
  StatusReport,
  NativeCodePushModule,
  HttpAdapter,
  CodePushConfiguration,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface AppStateSubscription {
  remove(): void;
}

// =============================================================================
// STATUS REPORT SERVICE
// =============================================================================

/**
 * Attempts to report deployment status to the CodePush server.
 * If the report fails, it will retry when the app resumes.
 *
 * @param statusReport - The status report to send
 * @param nativeModule - The native CodePush module
 * @param httpAdapter - The HTTP adapter for requests
 * @param retrySubscription - Optional existing retry subscription
 */
export async function tryReportStatus(
  statusReport: StatusReport,
  nativeModule: NativeCodePushModule,
  httpAdapter: HttpAdapter,
  retrySubscription?: AppStateSubscription
): Promise<void> {
  const config = await getConfiguration(nativeModule);
  const previousLabelOrAppVersion = statusReport.previousLabelOrAppVersion;
  const previousDeploymentKey = statusReport.previousDeploymentKey ?? config.deploymentKey;

  try {
    if (statusReport.appVersion) {
      await reportBinaryUpdate(statusReport, config, httpAdapter, previousLabelOrAppVersion, previousDeploymentKey);
    } else {
      await reportCodePushUpdate(statusReport, config, nativeModule, httpAdapter, previousLabelOrAppVersion, previousDeploymentKey);
    }

    nativeModule.recordStatusReported(statusReport);
    retrySubscription?.remove();
  } catch (error) {
    handleReportFailure(statusReport, nativeModule, httpAdapter, retrySubscription);
  }
}

/**
 * Reports a binary (native app) update to the server.
 */
async function reportBinaryUpdate(
  statusReport: StatusReport,
  config: CodePushConfiguration,
  httpAdapter: HttpAdapter,
  previousLabelOrAppVersion?: string,
  previousDeploymentKey?: string
): Promise<void> {
  log(`Reporting binary update (${statusReport.appVersion})`);

  if (!config.deploymentKey) {
    throw new Error('Deployment key is missing');
  }

  const sdk = createPromisifiedSdk(httpAdapter, config);
  await sdk.reportStatusDeploy(null, null, previousLabelOrAppVersion, previousDeploymentKey);
}

/**
 * Reports a CodePush update status to the server.
 */
async function reportCodePushUpdate(
  statusReport: StatusReport,
  config: CodePushConfiguration,
  nativeModule: NativeCodePushModule,
  httpAdapter: HttpAdapter,
  previousLabelOrAppVersion?: string,
  previousDeploymentKey?: string
): Promise<void> {
  if (!statusReport.package) {
    throw new Error('Package information is missing from status report');
  }

  const label = statusReport.package.label;

  if (statusReport.status === 'DeploymentSucceeded') {
    log(`Reporting CodePush update success (${label})`);
  } else {
    log(`Reporting CodePush update rollback (${label})`);
    await nativeModule.setLatestRollbackInfo(statusReport.package.packageHash);
  }

  const updatedConfig: CodePushConfiguration = {
    ...config,
    deploymentKey: statusReport.package.deploymentKey,
  };

  const sdk = createPromisifiedSdk(httpAdapter, updatedConfig);
  await sdk.reportStatusDeploy(
    statusReport.package,
    statusReport.status ?? null,
    previousLabelOrAppVersion,
    previousDeploymentKey
  );
}

/**
 * Handles a failed status report by saving it for retry.
 */
function handleReportFailure(
  statusReport: StatusReport,
  nativeModule: NativeCodePushModule,
  httpAdapter: HttpAdapter,
  existingSubscription?: AppStateSubscription
): void {
  log(`Report status failed: ${JSON.stringify(statusReport)}`);
  nativeModule.saveStatusReportForRetry(statusReport);

  // Set up retry on app resume if not already subscribed
  if (!existingSubscription) {
    const resumeListener = AppState.addEventListener(
      'change',
      async (newState: AppStateStatus) => {
        if (newState !== 'active') {
          return;
        }

        const refreshedStatusReport = await nativeModule.getNewStatusReport();
        if (refreshedStatusReport) {
          tryReportStatus(refreshedStatusReport, nativeModule, httpAdapter, resumeListener);
        } else {
          resumeListener.remove();
        }
      }
    );
  }
}

export default {
  tryReportStatus,
};
