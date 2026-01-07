/**
 * SDK Service Module
 *
 * Handles communication with the CodePush server through the acquisition SDK.
 * Provides promisified wrappers around the callback-based SDK methods.
 *
 * @module services/sdk-service
 */

import { AcquisitionManager as Sdk } from 'code-push/script/acquisition-sdk';
import type {
  CodePushConfiguration,
  HttpAdapter,
  QueryPackage,
  UpdateInfo,
  Package,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface AcquisitionSdk {
  queryUpdateWithCurrentPackage(
    queryPackage: QueryPackage,
    callback: (error: Error | null, update?: UpdateInfo | null) => void
  ): void;
  reportStatusDeploy(
    deployedPackage: Package | null,
    status: string | null,
    previousLabelOrAppVersion: string | undefined,
    previousDeploymentKey: string | undefined,
    callback: (error: Error | null) => void
  ): void;
  reportStatusDownload(
    downloadedPackage: Package,
    callback: (error: Error | null) => void
  ): void;
}

export interface PromisifiedSdk {
  queryUpdateWithCurrentPackage(queryPackage: QueryPackage): Promise<UpdateInfo | null>;
  reportStatusDeploy(
    deployedPackage: Package | null,
    status: string | null,
    previousLabelOrAppVersion?: string,
    previousDeploymentKey?: string
  ): Promise<void>;
  reportStatusDownload(downloadedPackage: Package): Promise<void>;
}

// Store the SDK constructor for testing purposes
let SdkConstructor: typeof Sdk = Sdk;

// =============================================================================
// SDK SERVICE
// =============================================================================

/**
 * Creates a promisified SDK instance for communicating with the CodePush server.
 *
 * @param httpAdapter - The HTTP adapter to use for requests
 * @param config - The CodePush configuration
 * @returns A promisified SDK instance
 */
export function createPromisifiedSdk(
  httpAdapter: HttpAdapter,
  config: CodePushConfiguration
): PromisifiedSdk {
  const sdk = new SdkConstructor(httpAdapter, config) as AcquisitionSdk;

  return {
    /**
     * Queries the CodePush server for available updates.
     */
    queryUpdateWithCurrentPackage(queryPackage: QueryPackage): Promise<UpdateInfo | null> {
      return new Promise((resolve, reject) => {
        sdk.queryUpdateWithCurrentPackage(queryPackage, (error, update) => {
          if (error) {
            reject(error);
          } else {
            resolve(update ?? null);
          }
        });
      });
    },

    /**
     * Reports deployment status to the CodePush server.
     */
    reportStatusDeploy(
      deployedPackage: Package | null,
      status: string | null,
      previousLabelOrAppVersion?: string,
      previousDeploymentKey?: string
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        sdk.reportStatusDeploy(
          deployedPackage,
          status,
          previousLabelOrAppVersion,
          previousDeploymentKey,
          (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          }
        );
      });
    },

    /**
     * Reports download status to the CodePush server.
     */
    reportStatusDownload(downloadedPackage: Package): Promise<void> {
      return new Promise((resolve, reject) => {
        sdk.reportStatusDownload(downloadedPackage, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  };
}

/**
 * Sets a custom SDK constructor for testing purposes.
 *
 * @param testSdk - The test SDK constructor
 */
export function setSdkConstructor(testSdk: typeof Sdk): void {
  SdkConstructor = testSdk;
}

/**
 * Gets the current SDK constructor.
 */
export function getSdkConstructor(): typeof Sdk {
  return SdkConstructor;
}

export default createPromisifiedSdk;
