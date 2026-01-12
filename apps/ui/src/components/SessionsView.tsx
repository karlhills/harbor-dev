import type { SessionInfo } from '../lib/api';
import { formatDateTime } from '../lib/format';

type SessionsViewProps = {
  activeSessionId: string | null;
  activeSessionStartedAt: string | null;
  sessions: SessionInfo[];
  onStart: () => void;
  onSelect: (sessionId: string) => void;
};

export default function SessionsView({
  activeSessionId,
  activeSessionStartedAt,
  sessions,
  onStart,
  onSelect,
}: SessionsViewProps) {
  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-canvas-800/70 bg-canvas-900/30 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-400">Active session</div>
            <div className="text-lg font-semibold text-white">{activeSessionId ?? '...'}</div>
            <div className="text-xs text-slate-500">
              {activeSessionStartedAt ? formatDateTime(activeSessionStartedAt) : ''}
            </div>
          </div>
          <button
            onClick={onStart}
            className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-2 text-xs text-accent-500 hover:border-accent-500/70"
          >
            Start new session
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="text-sm font-semibold text-slate-200">Recent sessions</div>
        {sessions.length === 0 ? (
          <div className="text-sm text-slate-400">No sessions recorded yet.</div>
        ) : (
          <div className="grid gap-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                className="flex items-center justify-between rounded-xl border border-canvas-800/60 bg-canvas-900/30 px-4 py-3 text-left text-sm text-slate-200 hover:border-accent-500/60"
              >
                <div>
                  <div className="text-sm font-medium text-slate-100">{session.id}</div>
                  <div className="text-xs text-slate-500">{formatDateTime(session.startedAt)}</div>
                </div>
                <div className="text-xs text-slate-400">{session.count} requests</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
