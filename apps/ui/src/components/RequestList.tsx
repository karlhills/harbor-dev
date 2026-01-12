import type { StoredRequest } from '../lib/api';
import { formatTime } from '../lib/format';
import EmptyState from './EmptyState';

const methodStyles: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  POST: 'bg-sky-500/15 text-sky-200 border-sky-500/40',
  PUT: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  PATCH: 'bg-purple-500/15 text-purple-200 border-purple-500/40',
  DELETE: 'bg-rose-500/15 text-rose-200 border-rose-500/40',
};

function forwardIndicator(request: StoredRequest) {
  if (!request.forward?.attemptedAt) return null;
  const ok = request.forward.ok;
  return (
    <span
      className={`inline-flex h-2 w-2 rounded-full ${
        ok ? 'bg-emerald-400' : 'bg-rose-400'
      }`}
      title={ok ? 'Forwarded' : 'Forward failed'}
    />
  );
}

type RequestListProps = {
  requests: StoredRequest[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
};

export default function RequestList({ requests, selectedId, onSelect }: RequestListProps) {
  if (requests.length === 0) {
    return (
      <div className="h-full">
        <EmptyState
          title="No requests yet"
          subtitle="Send a webhook to /hooks/your-path to see it here."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto pr-2">
      {requests.map((request) => {
        const isSelected = request.id === selectedId;
        const methodClass = methodStyles[request.method] ?? 'bg-slate-500/20 text-slate-200';
        return (
          <button
            key={request.id}
            onClick={() => onSelect(request.id)}
            className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-left transition hover:border-accent-500/60 hover:bg-canvas-900/40 ${
              isSelected
                ? 'border-accent-500/60 bg-canvas-900/60 shadow-glow'
                : 'border-canvas-800/70 bg-canvas-900/20'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${methodClass}`}
                >
                  {request.method}
                </span>
                {forwardIndicator(request)}
                <span className="text-slate-500">{request.hookName}</span>
              </div>
              <span>{formatTime(request.receivedAt)}</span>
            </div>
            <div className="text-sm text-slate-100">{request.path}</div>
          </button>
        );
      })}
    </div>
  );
}
