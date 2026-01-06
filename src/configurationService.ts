/**
 * Configuration Service Module
 *
 * Manages CodePush configuration retrieval and caching.
 * Provides a single source of truth for configuration across the app.
 *
 * @module configurationService
 */

import type { CodePushConfiguration, NativeCodePushModule } from './types';

// =============================================================================
// STATE
// =============================================================================

let cachedConfig: CodePushConfiguration | null = null;
let testConfig: CodePushConfiguration | null = null;

// =============================================================================
// CONFIGURATION SERVICE
// =============================================================================

/**
 * Gets the CodePush configuration, using cache when available.
 * Configuration is retrieved from the native module and cached for performance.
 *
 * @param nativeModule - The native CodePush module
 * @returns The CodePush configuration
 */
export async function getConfiguration(
  nativeModule: NativeCodePushModule
): Promise<CodePushConfiguration> {
  // Return test configuration if set (for testing purposes)
  if (testConfig) {
    return testConfig;
  }

  // Return cached configuration if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // Fetch and cache configuration from native module
  cachedConfig = await nativeModule.getConfiguration();
  return cachedConfig;
}

/**
 * Sets a test configuration for testing purposes.
 * When set, this configuration will be returned instead of the native configuration.
 *
 * @param config - The test configuration to use
 */
export function setTestConfiguration(config: CodePushConfiguration | null): void {
  testConfig = config;
}

/**
 * Clears the cached configuration.
 * Useful for testing or when configuration needs to be refreshed.
 */
export function clearConfigurationCache(): void {
  cachedConfig = null;
}

/**
 * Creates a merged configuration with an optional deployment key override.
 *
 * @param baseConfig - The base configuration
 * @param deploymentKey - Optional deployment key override
 * @returns The merged configuration
 */
export function createMergedConfiguration(
  baseConfig: CodePushConfiguration,
  deploymentKey?: string | null
): CodePushConfiguration {
  if (deploymentKey) {
    return { ...baseConfig, deploymentKey };
  }
  return baseConfig;
}

export default {
  getConfiguration,
  setTestConfiguration,
  clearConfigurationCache,
  createMergedConfiguration,
};
