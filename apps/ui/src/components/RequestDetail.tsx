import { useEffect, useMemo, useState } from 'react';
import type { StoredRequest } from '../lib/api';
import { formatDateTime } from '../lib/format';
import EmptyState from './EmptyState';
import JsonViewer from './JsonViewer';
import SignaturePanel from './SignaturePanel';

function formatHeaderValue(value: string) {
  return value;
}

type RequestDetailProps = {
  request: StoredRequest | null;
  defaultTarget: string;
  onReplay: (id: string, targetUrl: string) => Promise<void>;
  onCopyCurl: (targetUrl: string) => void;
  onExport: (id: string) => Promise<void>;
};

export default function RequestDetail({
  request,
  defaultTarget,
  onReplay,
  onCopyCurl,
  onExport,
}: RequestDetailProps) {
  const [targetUrl, setTargetUrl] = useState(defaultTarget);

  useEffect(() => {
    setTargetUrl(defaultTarget);
  }, [defaultTarget]);

  const forwardInfo = request?.forward;

  const headersCount = useMemo(() => (request ? Object.keys(request.headers).length : 0), [request]);

  if (!request) {
    return (
      <EmptyState title="Select a request" subtitle="Click on any request to inspect it." />
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto rounded-2xl border border-canvas-800/70 bg-canvas-900/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-accent-500/40 bg-accent-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-500">
            {request.method}
          </span>
          <div className="text-lg font-semibold text-white">
            {request.hookName}
            <span className="text-slate-500"> · {request.path}</span>
          </div>
        </div>
        <div className="text-xs text-slate-500">{request.id}</div>
      </div>

      <div className="grid gap-3 text-sm text-slate-300">
        <div>
          <span className="text-slate-400">Received</span>
          <div className="text-slate-100">{formatDateTime(request.receivedAt)}</div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <span className="text-slate-400">Client IP</span>
            <div className="text-slate-100">{request.client.ip ?? 'Unknown'}</div>
          </div>
          <div>
            <span className="text-slate-400">User Agent</span>
            <div className="text-slate-100">{request.client.userAgent ?? 'Unknown'}</div>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <span className="text-slate-400">Session</span>
            <div className="text-slate-100">{request.sessionId}</div>
          </div>
          <div>
            <span className="text-slate-400">Redacted</span>
            <div className="text-slate-100">{request.redacted ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-canvas-800/60 bg-canvas-900/30 p-4">
        <div className="text-sm font-semibold text-slate-200">Replay / Export</div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Target URL</label>
          <input
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            className="rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100 outline-none"
            placeholder="https://example.com"
          />
        </div>
        {!targetUrl.trim() ? (
          <div className="text-xs text-amber-300">
            Add a target URL to enable replay and curl export.
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onCopyCurl(targetUrl)}
            disabled={!targetUrl.trim()}
            className="rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-3 py-2 text-xs text-slate-100 hover:border-accent-500/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Copy as curl
          </button>
          <button
            onClick={() => onReplay(request.id, targetUrl)}
            disabled={!targetUrl.trim()}
            className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-2 text-xs text-accent-500 hover:border-accent-500/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Replay
          </button>
          <button
            onClick={() => onExport(request.id)}
            className="rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-3 py-2 text-xs text-slate-100 hover:border-accent-500/60"
          >
            Export
          </button>
        </div>
        {forwardInfo?.attemptedAt ? (
          <div className="rounded-lg border border-canvas-800/60 bg-canvas-950/60 px-3 py-2 text-xs text-slate-300">
            <div>
              Forward: {forwardInfo.ok ? 'Success' : 'Failed'}
              {forwardInfo.status ? ` · ${forwardInfo.status}` : ''}
              {forwardInfo.durationMs ? ` · ${forwardInfo.durationMs}ms` : ''}
            </div>
            {forwardInfo.error ? <div className="text-rose-300">{forwardInfo.error}</div> : null}
          </div>
        ) : null}
      </div>

      <details className="rounded-xl border border-canvas-800/60 bg-canvas-900/30 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-200">
          Headers ({headersCount})
        </summary>
        <div className="mt-3 grid gap-2 text-xs text-slate-300">
          {Object.entries(request.headers).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="uppercase tracking-wide text-slate-500">{key}</span>
              <span className="text-slate-100">{formatHeaderValue(value)}</span>
            </div>
          ))}
        </div>
      </details>

      <div className="grid gap-3">
        <div className="text-sm font-semibold text-slate-200">Body</div>
        {request.parsedJson !== null ? (
          <JsonViewer value={request.parsedJson} />
        ) : request.rawBody ? (
          <pre className="whitespace-pre-wrap rounded-xl border border-canvas-800/60 bg-canvas-900/30 p-4 text-xs text-slate-200">
            {request.rawBody}
          </pre>
        ) : (
          <div className="rounded-xl border border-dashed border-canvas-800/60 bg-canvas-900/20 p-6 text-sm text-slate-400">
            No body captured.
          </div>
        )}
      </div>

      <SignaturePanel request={request} />
    </div>
  );
}
