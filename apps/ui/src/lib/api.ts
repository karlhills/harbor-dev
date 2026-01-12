export type ForwardResult = {
  enabled: boolean;
  targetUrl?: string;
  attemptedAt?: string;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  error?: string;
  responseSnippet?: string;
};

export type StoredRequest = {
  id: string;
  sessionId: string;
  hookName: string;
  fullPath: string;
  path: string;
  receivedAt: string;
  method: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  rawBody: string;
  parsedJson: unknown | null;
  client: {
    ip: string | null;
    userAgent: string | null;
  };
  redacted: boolean;
  forward?: ForwardResult;
};

export type HookInfo = {
  hookName: string;
  count: number;
  latestReceivedAt: string | null;
  forwardTo?: string;
  redactionEnabled?: boolean;
};

export type SessionInfo = {
  id: string;
  startedAt: string;
  count: number;
};

export type BeaconConfig = {
  redaction: {
    enabled: boolean;
    headers: string[];
    jsonKeys: string[];
  };
  hooks: Record<string, { forwardTo?: string; redactionEnabled?: boolean }>;
};

export type BeaconState = {
  activeSessionId: string;
  activeSessionStartedAt: string;
  config: {
    redaction: boolean;
  };
};

const apiBase = import.meta.env.PROD
  ? ''
  : import.meta.env.VITE_API_BASE || 'http://localhost:5178';

export const API_BASE = apiBase;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchRequests(limit = 100) {
  const query = limit ? `?limit=${limit}` : '';
  return requestJson<StoredRequest[]>(`/api/requests${query}`);
}

export async function searchRequests(params: {
  q?: string;
  hookName?: string;
  method?: string;
  sessionId?: string;
}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.hookName) search.set('hookName', params.hookName);
  if (params.method) search.set('method', params.method);
  if (params.sessionId) search.set('sessionId', params.sessionId);
  const query = search.toString();
  return requestJson<StoredRequest[]>(`/api/requests/search${query ? `?${query}` : ''}`);
}

export async function fetchRequest(id: string) {
  return requestJson<StoredRequest>(`/api/requests/${id}`);
}

export async function clearRequests() {
  await requestJson('/api/requests', { method: 'DELETE' });
}

export async function fetchHooks() {
  return requestJson<HookInfo[]>('/api/hooks');
}

export async function deleteHook(hookName: string) {
  return requestJson<BeaconConfig>(`/api/hooks/${encodeURIComponent(hookName)}`, {
    method: 'DELETE',
  });
}

export async function updateHook(
  hookName: string,
  payload: { hookName?: string; forwardTo?: string; redactionEnabled?: boolean },
) {
  return requestJson<BeaconConfig>(`/api/hooks/${encodeURIComponent(hookName)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchSessions() {
  return requestJson<SessionInfo[]>('/api/sessions');
}

export async function startSession() {
  return requestJson<{ sessionId: string }>('/api/sessions', { method: 'POST' });
}

export async function fetchConfig() {
  return requestJson<BeaconConfig>('/api/config');
}

export async function updateConfig(payload: Partial<BeaconConfig>) {
  return requestJson<BeaconConfig>('/api/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchState() {
  return requestJson<BeaconState>('/api/state');
}

export async function forwardRequest(id: string, targetUrl?: string) {
  return requestJson<{ ok: boolean; status?: number; durationMs?: number }>(`/api/forward/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUrl }),
  });
}

export async function exportRequests(payload: {
  ids: string[];
  format: 'json' | 'fixtures';
  hookName?: string;
}) {
  return requestJson<{ ok: boolean; exportId?: string; path?: string; count?: number }>(
    '/api/export',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
}

export async function exportRequestsFile(payload: { ids: string[] }) {
  const response = await fetch(`${apiBase}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: payload.ids, format: 'json' }),
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
  const filename = match?.[1] ?? 'harbor-export.json';
  return { blob, filename };
}

export async function openDataFolder() {
  await requestJson<{ ok: boolean }>('/api/open-data', { method: 'POST' });
}
