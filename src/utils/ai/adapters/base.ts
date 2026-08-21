/**
 * @file base.ts
 * @description Base utilities, secret redaction, client spoofing, and stream decoding for AI provider adapters.
 */

import type { AIConfig } from '../types';

/**
 * Redacts secret keys, bearer tokens, and credentials from text strings and error traces.
 *
 * @param text - The raw string that may contain sensitive credentials.
 * @returns Sanitized string with redacted secrets.
 */
export function redactSecrets(text: string): string {
  if (!text) return '';
  return text
    .replace(/sk-[a-zA-Z0-9_-]{12,}/g, 'sk-***[REDACTED]***')
    .replace(/x-api-key['"]?\s*[:=]\s*['"]?[a-zA-Z0-9_-]{10,}['"]?/gi, 'x-api-key: [REDACTED]')
    .replace(/x-goog-api-key['"]?\s*[:=]\s*['"]?[a-zA-Z0-9_-]{10,}['"]?/gi, 'x-goog-api-key: [REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]{10,}/gi, 'Bearer [REDACTED]');
}

/**
 * Builds HTTP headers for client spoofing (e.g. Kilo Code, Cursor, Continue, VSCode, or custom headers).
 * Available for all providers.
 *
 * @param config - Current {@link AIConfig}
 * @returns Dictionary of HTTP headers to inject into the request.
 */
export function getClientSpoofHeaders(config: AIConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  const spoof = config.clientSpoof || 'none';

  switch (spoof) {
    case 'kilocode':
      headers['User-Agent'] = 'KiloCode/1.0.0 (AetherMind Client)';
      headers['X-Client-Name'] = 'KiloCode';
      headers['X-Title'] = 'AetherMind Knowledge Agent';
      break;
    case 'cursor':
      headers['User-Agent'] = 'Cursor/0.40.0';
      headers['X-Cursor-Client'] = 'true';
      headers['X-Client-Name'] = 'Cursor';
      break;
    case 'continue':
      headers['User-Agent'] = 'Continue/0.8.0';
      headers['X-Continue-Client'] = 'true';
      break;
    case 'vscode':
      headers['User-Agent'] = 'VSCode/1.90.0';
      headers['X-Client-Name'] = 'VSCode-Copilot';
      break;
    case 'custom':
      if (config.customClientHeaders && typeof config.customClientHeaders === 'object') {
        Object.assign(headers, config.customClientHeaders);
      }
      break;
    case 'none':
    default:
      // Standard AetherMind client header
      headers['X-Title'] = 'AetherMind';
      break;
  }

  return headers;
}

/**
 * Resolves the target endpoint URL with optional CORS proxy routing.
 *
 * @param baseUrl - Configured base URL
 * @param defaultPath - Route path if baseUrl doesn't already contain it
 * @param proxyUrl - Optional CORS proxy forwarder
 * @returns Fully qualified endpoint URL string
 */
export function resolveEndpoint(baseUrl: string, defaultPath: string, proxyUrl?: string): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  let endpoint = cleanBase.endsWith(defaultPath.replace(/^\//, ''))
    ? cleanBase
    : `${cleanBase}${defaultPath}`;

  if (proxyUrl && proxyUrl.trim()) {
    const cleanProxy = proxyUrl.trim().replace(/\/+$/, '');
    endpoint = `${cleanProxy}?url=${encodeURIComponent(endpoint)}`;
  }

  return endpoint;
}

/**
 * Decodes Server-Sent Events (SSE) from a response stream and invokes a line/chunk callback.
 *
 * @param response - Fetch {@link Response}
 * @param onData - Callback invoked with the parsed `data:` payload content
 * @param signal - Optional {@link AbortSignal}
 */
export async function processSseStream(
  response: Response,
  onData: (dataJsonStr: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is null or streaming is unsupported.');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataContent = trimmed.slice(6).trim();
          if (dataContent === '[DONE]') return;
          onData(dataContent);
        }
      }
    }

    if (buffer.trim().startsWith('data: ')) {
      const dataContent = buffer.trim().slice(6).trim();
      if (dataContent !== '[DONE]') {
        onData(dataContent);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
