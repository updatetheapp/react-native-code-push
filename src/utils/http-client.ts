/**
 * HTTP Client Module
 *
 * Provides a fetch-based HTTP adapter for communicating with the CodePush server.
 * Includes proper headers for plugin identification and version tracking.
 *
 * @module utils/http-client
 */

import { HttpMethod, HttpAdapter, HttpRequestCallback, HttpResponse } from '../types';

// =============================================================================
// CONSTANTS
// =============================================================================

const HTTP_METHOD_NAMES: readonly string[] = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'TRACE',
  'OPTIONS',
  'CONNECT',
  'PATCH',
] as const;

// Plugin information (loaded at runtime to avoid circular dependencies)
const PLUGIN_NAME = 'react-native-code-push';
const PLUGIN_VERSION = '9.0.1';
const SDK_VERSION = '4.2.3';

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * Converts an HttpMethod enum value to its string representation.
 */
function getHttpMethodName(verb: HttpMethod): string {
  return HTTP_METHOD_NAMES[verb] ?? 'GET';
}

/**
 * Creates the default headers for CodePush requests.
 */
function createRequestHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-CodePush-Plugin-Name': PLUGIN_NAME,
    'X-CodePush-Plugin-Version': PLUGIN_VERSION,
    'X-CodePush-SDK-Version': SDK_VERSION,
  };
}

/**
 * Serializes the request body to JSON if it's an object.
 * If body is already a string, passes it through.
 * If body is null/undefined, returns undefined.
 */
function serializeRequestBody(body: unknown): string | null | undefined {
  if (body && typeof body === 'object') {
    return JSON.stringify(body);
  }
  // Pass through strings or null/undefined as-is (matches original behavior)
  return body as string | null | undefined;
}

// =============================================================================
// HTTP CLIENT IMPLEMENTATION
// =============================================================================

/**
 * Makes an HTTP request using the fetch API.
 *
 * @param verb - The HTTP method to use
 * @param url - The URL to request
 * @param requestBody - The request body (object or callback)
 * @param callback - The callback to invoke with the response
 */
async function request(
  verb: HttpMethod,
  url: string,
  requestBody: object | HttpRequestCallback | null,
  callback?: HttpRequestCallback
): Promise<void> {
  // Handle overloaded function signature where requestBody is actually the callback
  let actualCallback: HttpRequestCallback | undefined = callback;
  let actualBody: object | null = null;

  if (typeof requestBody === 'function') {
    actualCallback = requestBody as HttpRequestCallback;
    actualBody = null;
  } else {
    actualBody = requestBody;
  }

  if (!actualCallback) {
    return;
  }

  const headers = createRequestHeaders();
  const method = getHttpMethodName(verb);
  const body = serializeRequestBody(actualBody);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    const statusCode = response.status;
    const responseBody = await response.text();

    const httpResponse: HttpResponse = {
      statusCode,
      body: responseBody,
    };

    actualCallback(null, httpResponse);
  } catch (error) {
    // Pass error directly to match original behavior
    actualCallback(error as Error);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * HTTP adapter instance for making requests to the CodePush server.
 */
export const httpClient: HttpAdapter = {
  request,
};

export default httpClient;
