/**
 * CodePush Logging Module
 *
 * Provides a centralized logging utility for the CodePush library.
 * All log messages are prefixed with [CodePush] for easy identification.
 *
 * @module logging
 */

const LOG_PREFIX = '[CodePush]' as const;

/**
 * Logs a message to the console with the CodePush prefix.
 *
 * @param message - The message to log
 *
 * @example
 * log('Update available');
 * // Output: [CodePush] Update available
 */
export function log(message: string): void {
  console.log(`${LOG_PREFIX} ${message}`);
}

export default log;
