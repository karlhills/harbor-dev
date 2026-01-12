import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BeaconState, SessionInfo, StoredRequest } from './types.js';
import { createSessionId } from '../utils/id.js';

const dataDir = path.join(process.cwd(), 'data');
const stateFile = path.join(dataDir, 'state.json');

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function writeState(state: BeaconState) {
  await ensureDataDir();
  const tmpFile = path.join(dataDir, `state.${Date.now()}-${randomUUID()}.tmp`);
  await fs.writeFile(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tmpFile, stateFile);
}

async function readStateFile(): Promise<BeaconState | null> {
  try {
    const data = await fs.readFile(stateFile, 'utf8');
    return JSON.parse(data) as BeaconState;
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') return null;
    if (error.name === 'SyntaxError') return null;
    throw err;
  }
}

function createInitialState(): BeaconState {
  const sessionId = createSessionId();
  const startedAt = new Date().toISOString();
  return {
    activeSessionId: sessionId,
    activeSessionStartedAt: startedAt,
    sessions: [{ id: sessionId, startedAt, count: 0 }],
  };
}

export async function getState(): Promise<BeaconState> {
  const existing = await readStateFile();
  if (existing) return existing;
  const initial = createInitialState();
  await writeState(initial);
  return initial;
}

export async function startNewSession(): Promise<BeaconState> {
  const state = await getState();
  const sessionId = createSessionId();
  const startedAt = new Date().toISOString();
  const updated: BeaconState = {
    activeSessionId: sessionId,
    activeSessionStartedAt: startedAt,
    sessions: [{ id: sessionId, startedAt, count: 0 }, ...state.sessions].slice(0, 20),
  };
  await writeState(updated);
  return updated;
}

export async function recordSessionHit(sessionId: string, receivedAt: string) {
  const state = await getState();
  const sessions = [...state.sessions];
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index >= 0) {
    const session = sessions[index];
    sessions[index] = { ...session, count: session.count + 1, startedAt: session.startedAt };
  } else {
    sessions.unshift({ id: sessionId, startedAt: receivedAt, count: 1 });
  }

  const updated: BeaconState = {
    ...state,
    sessions: sessions.slice(0, 20),
  };
  await writeState(updated);
  return updated;
}

export function pruneSessions(sessions: SessionInfo[]) {
  return sessions.slice(0, 20);
}

export async function syncSessionsFromRequests(requests: StoredRequest[]) {
  const state = await getState();
  const sessionMap = new Map<string, SessionInfo>();

  for (const request of requests) {
    const existing = sessionMap.get(request.sessionId);
    if (!existing) {
      sessionMap.set(request.sessionId, {
        id: request.sessionId,
        startedAt: request.receivedAt,
        count: 1,
      });
    } else {
      const startedAt =
        existing.startedAt < request.receivedAt ? existing.startedAt : request.receivedAt;
      sessionMap.set(request.sessionId, {
        ...existing,
        startedAt,
        count: existing.count + 1,
      });
    }
  }

  if (!sessionMap.has(state.activeSessionId)) {
    sessionMap.set(state.activeSessionId, {
      id: state.activeSessionId,
      startedAt: state.activeSessionStartedAt,
      count: 0,
    });
  }

  const sessions = Array.from(sessionMap.values()).sort((a, b) =>
    a.startedAt < b.startedAt ? 1 : -1,
  );

  const updated: BeaconState = {
    ...state,
    sessions: sessions.slice(0, 20),
  };
  await writeState(updated);
  return updated;
}
