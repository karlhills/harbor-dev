import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout';
import RequestList from './components/RequestList';
import RequestDetail from './components/RequestDetail';
import type { BeaconConfig, HookInfo, SessionInfo, StoredRequest } from './lib/api';
import {
  API_BASE,
  clearRequests,
  deleteHook,
  exportRequestsFile,
  updateHook,
  fetchConfig,
  fetchHooks,
  fetchSessions,
  fetchState,
  forwardRequest,
  searchRequests,
  startSession,
  updateConfig,
} from './lib/api';
import { buildCurl } from './lib/curl';
import HooksView from './components/HooksView';
import SessionsView from './components/SessionsView';
import SettingsView from './components/SettingsView';
import Tooltip from './components/Tooltip';

const REFRESH_INTERVAL = 2000;
const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

type Filters = {
  sessionId: string;
  hookName: string;
  method: string;
  q: string;
};

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    view: params.get('view') || 'requests',
    sessionId: params.get('sessionId') || '',
    hookName: params.get('hookName') || '',
    method: params.get('method') || '',
    q: params.get('q') || '',
  };
}

function setQueryParams(next: { view: string } & Filters) {
  const params = new URLSearchParams();
  params.set('view', next.view);
  if (next.sessionId) params.set('sessionId', next.sessionId);
  if (next.hookName) params.set('hookName', next.hookName);
  if (next.method) params.set('method', next.method);
  if (next.q) params.set('q', next.q);
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}

export default function App() {
  const initial = getQueryParams();
  const [view, setView] = useState(initial.view);
  const [filters, setFilters] = useState<Filters>({
    sessionId: initial.sessionId,
    hookName: initial.hookName,
    method: initial.method,
    q: initial.q,
  });
  const [requests, setRequests] = useState<StoredRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [hooks, setHooks] = useState<HookInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [state, setState] = useState<{ id: string; startedAt: string } | null>(null);
  const [config, setConfig] = useState<BeaconConfig | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const loadMeta = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchHooks(),
      fetchSessions(),
      fetchState(),
      fetchConfig(),
    ]);

    const errors: string[] = [];

    const [hooksResult, sessionsResult, stateResult, configResult] = results;
    if (hooksResult.status === 'fulfilled') {
      setHooks(hooksResult.value);
    } else {
      errors.push('Failed to load hooks');
    }

    if (sessionsResult.status === 'fulfilled') {
      setSessions(sessionsResult.value);
    } else {
      errors.push('Failed to load sessions');
    }

    if (stateResult.status === 'fulfilled') {
      setState({
        id: stateResult.value.activeSessionId,
        startedAt: stateResult.value.activeSessionStartedAt,
      });
    } else {
      errors.push('Failed to load state');
    }

    if (configResult.status === 'fulfilled') {
      setConfig(configResult.value);
    } else {
      errors.push('Failed to load config');
    }

    setError(errors.length > 0 ? errors[0] : null);
  }, []);

  const loadRequests = useCallback(
    async (mode: 'auto' | 'manual' = 'auto') => {
      if (mode === 'manual') {
        setIsLoading(true);
      }
      try {
        const data = await searchRequests(filters);
        setRequests(data);
        setLastUpdated(new Date().toLocaleTimeString());
        setError(null);
        if (data.length > 0 && !data.some((item) => item.id === selectedId)) {
          setSelectedId(data[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load requests');
      } finally {
        if (mode === 'manual') {
          setIsLoading(false);
        }
      }
    },
    [filters, selectedId],
  );

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    setQueryParams({ view, ...filters });
    loadRequests('manual');
  }, [filters, view, loadRequests]);

  useEffect(() => {
    let intervalId: number | undefined;

    const start = () => {
      if (intervalId) return;
      intervalId = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          loadRequests('auto');
        }
      }, REFRESH_INTERVAL);
    };

    const stop = () => {
      if (!intervalId) return;
      window.clearInterval(intervalId);
      intervalId = undefined;
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadRequests('auto');
        start();
      } else {
        stop();
      }
    };

    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadRequests]);

  useEffect(() => {
    const handlePop = () => {
      const next = getQueryParams();
      setView(next.view);
      setFilters({
        sessionId: next.sessionId,
        hookName: next.hookName,
        method: next.method,
        q: next.q,
      });
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    if (view !== 'hooks') return;
    let intervalId: number | undefined;

    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const data = await fetchHooks();
        setHooks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load hooks');
      }
    };

    tick();
    intervalId = window.setInterval(tick, 4000);
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [view]);

  useEffect(() => {
    if (view !== 'sessions') return;
    let intervalId: number | undefined;

    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const data = await fetchSessions();
        setSessions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
      }
    };

    tick();
    intervalId = window.setInterval(tick, 4000);
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [view]);

  useEffect(() => {
    if (requests.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !requests.some((item) => item.id === selectedId)) {
      setSelectedId(requests[0].id);
    }
  }, [requests, selectedId]);

  const selectedRequest = requests.find((item) => item.id === selectedId) ?? null;

  const hookForwardTo = selectedRequest
    ? config?.hooks[selectedRequest.hookName]?.forwardTo ?? ''
    : '';

  const defaultTarget = useMemo(() => {
    if (!selectedRequest) return '';
    if (hookForwardTo) return hookForwardTo;
    const base = API_BASE || window.location.origin;
    return `${base}/hooks/${selectedRequest.hookName}${
      selectedRequest.path === '/' ? '' : selectedRequest.path
    }`;
  }, [selectedRequest, hookForwardTo]);

  const handleClear = async () => {
    try {
      await clearRequests();
      setRequests([]);
      setSelectedId(null);
      setToast('Requests cleared');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear requests');
    }
  };

  const handleCopyCurl = async (targetUrl: string) => {
    if (!selectedRequest) return;
    const command = buildCurl(selectedRequest, targetUrl);
    await navigator.clipboard.writeText(command);
    setToast('Curl command copied');
  };

  const handleReplay = async (id: string, targetUrl: string) => {
    try {
      await forwardRequest(id, targetUrl);
      await loadRequests('manual');
      setToast('Replay sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Replay failed');
    }
  };

  const handleExport = async (id: string) => {
    try {
      const { blob, filename } = await exportRequestsFile({ ids: [id] });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setToast('Export downloaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleDeleteHook = async (hookName: string) => {
    const shouldDelete = window.confirm(`Delete hook "${hookName}"?`);
    if (!shouldDelete) return;
    try {
      const updated = await deleteHook(hookName);
      setConfig(updated);
      setToast('Hook deleted');
      loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete hook');
    }
  };

  const handleSaveHook = async (hookName: string, forwardTo: string, redaction: boolean) => {
    try {
      const updated = await updateConfig({
        hooks: {
          [hookName]: {
            forwardTo: forwardTo || undefined,
            redactionEnabled: redaction,
          },
        },
      });
      setConfig(updated);
      setToast('Hook added');
      loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add hook');
    }
  };

  const handleEditHook = async (
    hookName: string,
    nextName: string,
    forwardTo: string,
    redaction: boolean,
  ) => {
    try {
      const updated = await updateHook(hookName, {
        hookName: nextName,
        forwardTo,
        redactionEnabled: redaction,
      });
      setConfig(updated);
      setToast('Hook updated');
      loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update hook');
    }
  };

  const handleSaveSettings = async (nextConfig: BeaconConfig) => {
    try {
      const updated = await updateConfig(nextConfig);
      setConfig(updated);
      setToast('Settings saved');
      loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  const handleStartSession = async () => {
    try {
      await startSession();
      await loadMeta();
      setToast('New session started');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setFilters({ ...filters, sessionId });
    setView('requests');
  };

  const clearFilters = () => {
    setFilters({ sessionId: '', hookName: '', method: '', q: '' });
  };

  return (
    <Layout
      activeView={view}
      onNavigate={(nextView) => setView(nextView)}
    >
      {toast ? (
        <div className="mb-4 rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-4 py-2 text-xs text-slate-200">
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {view === 'requests' ? (
        <section className="flex flex-1 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-white">Requests</h1>
                <Tooltip label="Captured webhooks. Filter by session, hook, method, or search." />
              </div>
              <p className="text-sm text-slate-400">
                Catch webhooks on <span className="text-slate-200">/hooks/*</span> and inspect
                them in real time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadRequests('manual')}
                className="rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-4 py-2 text-sm text-slate-100 hover:border-accent-500/60"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={handleClear}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 hover:border-rose-500/70"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-canvas-800/70 bg-canvas-900/30 p-4 text-sm text-slate-300 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)_auto]">
            <select
              value={filters.sessionId}
              onChange={(event) => setFilters({ ...filters, sessionId: event.target.value })}
              className="rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100"
            >
              <option value="">All sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.id}
                </option>
              ))}
            </select>
            <select
              value={filters.hookName}
              onChange={(event) => setFilters({ ...filters, hookName: event.target.value })}
              className="rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100"
            >
              <option value="">All hooks</option>
              {hooks.map((hook) => (
                <option key={hook.hookName} value={hook.hookName}>
                  {hook.hookName}
                </option>
              ))}
            </select>
            <select
              value={filters.method}
              onChange={(event) => setFilters({ ...filters, method: event.target.value })}
              className="rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100"
            >
              <option value="">All methods</option>
              {METHOD_OPTIONS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <input
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              placeholder="Search path, headers, or body"
              className="rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500"
            />
            <button
              onClick={clearFilters}
              className="rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-3 py-2 text-xs text-slate-100 hover:border-accent-500/60"
            >
              Clear filters
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>{requests.length} shown</span>
            <span>{lastUpdated ? `Updated ${lastUpdated}` : 'Idle'}</span>
          </div>

          <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <RequestList requests={requests} selectedId={selectedId} onSelect={setSelectedId} />
            <RequestDetail
              request={selectedRequest}
              defaultTarget={defaultTarget}
              onCopyCurl={handleCopyCurl}
              onReplay={handleReplay}
              onExport={handleExport}
            />
          </div>
        </section>
      ) : null}

      {view === 'hooks' ? (
        <section className="grid gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-white">Hooks</h1>
              <Tooltip label="Per-hook forwarding target and redaction overrides." />
            </div>
            <p className="text-sm text-slate-400">Manage hook-specific forwarding and redaction.</p>
          </div>
          <HooksView
            hooks={hooks}
            config={config}
            onSaveHook={handleSaveHook}
            onViewHook={(hookName) => {
              setFilters({ ...filters, hookName });
              setView('requests');
            }}
            onDeleteHook={handleDeleteHook}
            onEditHook={handleEditHook}
          />
        </section>
      ) : null}

      {view === 'sessions' ? (
        <section className="grid gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-white">Sessions</h1>
              <Tooltip label="Group requests into sessions. Clicking a session filters Requests." />
            </div>
            <p className="text-sm text-slate-400">
              Start new sessions to group incoming requests.
            </p>
          </div>
          <SessionsView
            activeSessionId={state?.id ?? null}
            activeSessionStartedAt={state?.startedAt ?? null}
            sessions={sessions}
            onStart={handleStartSession}
            onSelect={handleSelectSession}
          />
        </section>
      ) : null}

      {view === 'settings' ? (
        <section className="grid gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-white">Settings</h1>
              <Tooltip label="Global defaults for redaction." />
            </div>
            <p className="text-sm text-slate-400">Global defaults for redaction.</p>
          </div>
          <SettingsView config={config} onSave={handleSaveSettings} />
        </section>
      ) : null}

      {view === 'about' ? (
        <section className="rounded-2xl border border-canvas-800/70 bg-canvas-900/20 p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">About Harbor</h2>
            <Tooltip label="Local-only webhook capture and inspection." />
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Harbor keeps your webhook debugging local. No accounts, no cloud, just a fast way to
            capture and inspect requests right from your machine.
          </p>
          <div className="mt-3 text-sm text-slate-400">
            Open source under the MIT license.
          </div>
          <div className="mt-4 text-sm text-slate-300">
            Made by{' '}
            <a
              href="https://www.84boxes.com"
              target="_blank"
              rel="noreferrer"
              className="text-accent-500 hover:text-accent-400"
            >
              84boxes
            </a>
            .
          </div>
          <div className="mt-4">
            <a
              href="https://buymeacoffee.com/84boxes"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200 hover:border-amber-400/70"
            >
              Buy me a coffee
            </a>
          </div>
        </section>
      ) : null}
    </Layout>
  );
}
