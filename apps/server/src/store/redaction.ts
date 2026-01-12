import type { BeaconConfig, StoredRequest } from './types.js';

const DEFAULT_HEADER_KEYS = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
const DEFAULT_JSON_KEYS = ['password', 'token', 'secret', 'apikey', 'email'];

function normalizeKeys(keys: string[]) {
  return keys
    .map((key) => key.trim().toLowerCase())
    .filter((key) => key.length > 0);
}

export function getDefaultRedactionConfig() {
  return {
    headers: DEFAULT_HEADER_KEYS,
    jsonKeys: DEFAULT_JSON_KEYS,
  };
}

function redactHeaders(headers: Record<string, string>, keys: string[]) {
  const redactedKeys = new Set(normalizeKeys(keys));
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (redactedKeys.has(key.toLowerCase())) {
      next[key] = '[REDACTED]';
    } else {
      next[key] = value;
    }
  }
  return next;
}

function redactJson(value: unknown, keys: string[]): unknown {
  const redactedKeys = new Set(normalizeKeys(keys));
  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item, keys));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (redactedKeys.has(key.toLowerCase())) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactJson(val, keys);
      }
    }
    return result;
  }
  return value;
}

export function applyRedaction(
  request: StoredRequest,
  config: BeaconConfig,
  hookOverride?: { redactionEnabled?: boolean },
) {
  const enabled = hookOverride?.redactionEnabled ?? config.redaction.enabled;
  if (!enabled) {
    return { redacted: false, request };
  }

  const redactedHeaders = redactHeaders(request.headers, config.redaction.headers);
  const redactedJson = request.parsedJson
    ? redactJson(request.parsedJson, config.redaction.jsonKeys)
    : null;

  const redactedRawBody = request.parsedJson ? JSON.stringify(redactedJson) : request.rawBody;

  return {
    redacted: true,
    request: {
      ...request,
      headers: redactedHeaders,
      parsedJson: redactedJson,
      rawBody: redactedRawBody,
    },
  };
}
