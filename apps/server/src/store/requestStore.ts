import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BeaconConfig, StoredRequest } from './types.js';
import { safeParseJson } from '../utils/safeJson.js';
import { applyRedaction } from './redaction.js';
import { getConfig } from './configStore.js';
import { recordSessionHit } from './stateStore.js';

const MAX_REQUESTS = 1000;
const dataDir = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'requests.json');

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

function normalizeHeaders(headers: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      result[key] = value.map((item) => String(item)).join(', ');
    } else if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }
  return result;
}

function migrateRequest(raw: StoredRequest | Record<string, unknown>): StoredRequest {
  const record = raw as StoredRequest & {
    createdAt?: string;
    receivedAt?: string;
    headers?: Record<string, unknown>;
    hookName?: string;
    sessionId?: string;
    fullPath?: string;
    path?: string;
    redacted?: boolean;
    query?: Record<string, string | string[]>;
    client?: { ip?: string | null; userAgent?: string | null };
  };

  const receivedAt = record.receivedAt ?? record.createdAt ?? new Date().toISOString();
  const hookName = record.hookName ?? 'unknown';
  const fullPath = record.fullPath ?? record.path ?? '';
  const pathValue = record.path ?? fullPath ?? '/';

  return {
    id: record.id,
    sessionId: record.sessionId ?? 'legacy',
    hookName,
    fullPath,
    path: pathValue,
    receivedAt,
    createdAt: record.createdAt,
    method: record.method,
    query: record.query ?? {},
    headers: normalizeHeaders(record.headers ?? {}),
    rawBody: record.rawBody ?? '',
    parsedJson: record.parsedJson ?? null,
    client: {
      ip: record.client?.ip ?? null,
      userAgent: record.client?.userAgent ?? null,
    },
    redacted: record.redacted ?? false,
    forward: record.forward,
  };
}

async function readAll(): Promise<StoredRequest[]> {
  try {
    const data = await fs.readFile(dataFile, 'utf8');
    const parsed = safeParseJson(data);
    if (!Array.isArray(parsed)) return [];
    return (parsed as StoredRequest[]).map((item) => migrateRequest(item));
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeAll(requests: StoredRequest[]) {
  await ensureDataDir();
  const tmpFile = path.join(dataDir, `requests.${Date.now()}-${randomUUID()}.tmp`);
  await fs.writeFile(tmpFile, JSON.stringify(requests, null, 2), 'utf8');
  await fs.rename(tmpFile, dataFile);
}

export async function listRequests(limit?: number) {
  const requests = await readAll();
  return typeof limit === 'number' ? requests.slice(0, limit) : requests;
}

export async function listRequestsForSearch(limit = 500) {
  const requests = await readAll();
  return requests.slice(0, limit);
}

export async function getRequestById(id: string) {
  const requests = await readAll();
  return requests.find((item) => item.id === id) ?? null;
}

export async function addRequest(request: StoredRequest, config?: BeaconConfig) {
  const requests = await readAll();
  const resolvedConfig = config ?? (await getConfig());
  const hookConfig = resolvedConfig.hooks[request.hookName];
  const redactionResult = applyRedaction(request, resolvedConfig, hookConfig);
  const stored = { ...redactionResult.request, redacted: redactionResult.redacted };

  requests.unshift(stored);
  if (requests.length > MAX_REQUESTS) {
    requests.length = MAX_REQUESTS;
  }

  await writeAll(requests);
  await recordSessionHit(stored.sessionId, stored.receivedAt);

  return stored;
}

export async function updateRequest(id: string, update: Partial<StoredRequest>) {
  const requests = await readAll();
  const index = requests.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const updated = { ...requests[index], ...update };
  requests[index] = updated;
  await writeAll(requests);
  return updated;
}

export async function updateHookName(oldHookName: string, newHookName: string) {
  const requests = await readAll();
  let updatedCount = 0;
  const next = requests.map((request) => {
    if (request.hookName !== oldHookName) return request;
    updatedCount += 1;
    return {
      ...request,
      hookName: newHookName,
      fullPath: request.fullPath.replace(`/hooks/${oldHookName}`, `/hooks/${newHookName}`),
    };
  });
  if (updatedCount > 0) {
    await writeAll(next);
  }
  return updatedCount;
}

export async function clearRequests() {
  await writeAll([]);
}
