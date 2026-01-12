import type { StoredRequest } from '../store/types.js';
import { stripHopByHopHeaders } from './headers.js';

export type ForwardOutcome = {
  ok: boolean;
  status?: number;
  durationMs: number;
  error?: string;
  responseSnippet?: string;
  forward: StoredRequest['forward'];
};

function joinUrl(base: string, subPath: string) {
  if (!subPath || subPath === '/') return base;
  if (base.endsWith('/') && subPath.startsWith('/')) {
    return `${base.slice(0, -1)}${subPath}`;
  }
  if (!base.endsWith('/') && !subPath.startsWith('/')) {
    return `${base}/${subPath}`;
  }
  return `${base}${subPath}`;
}

export async function performForward(request: StoredRequest, targetUrl: string): Promise<ForwardOutcome> {
  const url = joinUrl(targetUrl, request.path);
  const headers = stripHopByHopHeaders(request.headers);
  const startedAt = Date.now();
  const baseForward = {
    enabled: true,
    targetUrl,
    attemptedAt: new Date().toISOString(),
  } as const;

  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: request.rawBody ? request.rawBody : undefined,
    });
    const text = await response.text();
    const durationMs = Date.now() - startedAt;
    return {
      ok: response.ok,
      status: response.status,
      durationMs,
      responseSnippet: text.slice(0, 500),
      forward: {
        ...baseForward,
        ok: response.ok,
        status: response.status,
        durationMs,
        responseSnippet: text.slice(0, 500),
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'Forward failed';
    return {
      ok: false,
      durationMs,
      error: message,
      forward: {
        ...baseForward,
        ok: false,
        durationMs,
        error: message,
      },
    };
  }
}
