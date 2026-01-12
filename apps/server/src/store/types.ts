export type StoredRequest = {
  id: string;
  sessionId: string;
  hookName: string;
  fullPath: string;
  path: string;
  receivedAt: string;
  createdAt?: string;
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
  forward?: {
    enabled: boolean;
    targetUrl?: string;
    attemptedAt?: string;
    status?: number;
    ok?: boolean;
    durationMs?: number;
    error?: string;
    responseSnippet?: string;
  };
};

export type SessionInfo = {
  id: string;
  startedAt: string;
  count: number;
};

export type BeaconState = {
  activeSessionId: string;
  activeSessionStartedAt: string;
  sessions: SessionInfo[];
};

export type BeaconConfig = {
  redaction: {
    enabled: boolean;
    headers: string[];
    jsonKeys: string[];
  };
  hooks: Record<string, { forwardTo?: string; redactionEnabled?: boolean }>;
};
