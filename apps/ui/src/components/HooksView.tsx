import { useEffect, useState } from 'react';
import type { BeaconConfig, HookInfo } from '../lib/api';
import { formatDateTime } from '../lib/format';

function HookRow({
  hook,
  config,
  onView,
  onDelete,
  onEdit,
}: {
  hook: HookInfo;
  config: BeaconConfig;
  onView: (hookName: string) => void;
  onDelete: (hookName: string) => void;
  onEdit: (hook: HookInfo) => void;
}) {
  return (
    <div className="rounded-xl border border-canvas-800/60 bg-canvas-900/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{hook.hookName}</div>
          <div className="text-xs text-slate-500">
            {hook.count} requests ·
            {hook.latestReceivedAt ? ` Last ${formatDateTime(hook.latestReceivedAt)}` : ' No data'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onView(hook.hookName)}
            className="rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-3 py-2 text-xs text-slate-100 hover:border-accent-500/60"
          >
            View requests
          </button>
          <button
            onClick={() => onEdit(hook)}
            className="rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-3 py-2 text-xs text-slate-100 hover:border-accent-500/60"
          >
            Edit
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-xs text-slate-400 md:grid-cols-2">
        <div>
          <div className="uppercase tracking-wide text-slate-500">Forwarding URL</div>
          <div className="mt-1 text-slate-200">
            {hook.forwardTo ? hook.forwardTo : 'Not set'}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wide text-slate-500">Redaction</div>
          <div className="mt-1 text-slate-200">
            {hook.redactionEnabled ?? config.redaction.enabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
      </div>
    </div>
  );
}

type HooksViewProps = {
  hooks: HookInfo[];
  config: BeaconConfig | null;
  onSaveHook: (hookName: string, forwardTo: string, redactionEnabled: boolean) => void;
  onViewHook: (hookName: string) => void;
  onDeleteHook: (hookName: string) => void;
  onEditHook: (
    hookName: string,
    nextName: string,
    forwardTo: string,
    redactionEnabled: boolean,
  ) => void;
};

export default function HooksView({
  hooks,
  config,
  onSaveHook,
  onViewHook,
  onDeleteHook,
  onEditHook,
}: HooksViewProps) {
  const [newHookName, setNewHookName] = useState('');
  const [newForwardTo, setNewForwardTo] = useState('');
  const [newRedactionEnabled, setNewRedactionEnabled] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editHookName, setEditHookName] = useState('');
  const [editForwardTo, setEditForwardTo] = useState('');
  const [editRedactionEnabled, setEditRedactionEnabled] = useState(true);
  const [editOriginalName, setEditOriginalName] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    if (config) {
      setNewRedactionEnabled(config.redaction.enabled);
    }
  }, [config]);

  if (!config) {
    return <div className="text-sm text-slate-400">Loading config...</div>;
  }

  const trimmedHook = newHookName.trim();
  const isValidHook = trimmedHook.length > 0 && /^[a-z0-9-_]+$/i.test(trimmedHook);
  const trimmedEditName = editHookName.trim();
  const isValidEdit = trimmedEditName.length > 0 && /^[a-z0-9-_]+$/i.test(trimmedEditName);

  const handleCreate = () => {
    if (!isValidHook) return;
    onSaveHook(trimmedHook, newForwardTo.trim(), newRedactionEnabled);
    setNewHookName('');
    setNewForwardTo('');
    setNewRedactionEnabled(config.redaction.enabled);
    setIsModalOpen(false);
  };

  const openEdit = (hook: HookInfo) => {
    setEditOriginalName(hook.hookName);
    setEditHookName(hook.hookName);
    setEditForwardTo(hook.forwardTo ?? '');
    setEditRedactionEnabled(hook.redactionEnabled ?? config.redaction.enabled);
    setIsEditOpen(true);
  };

  const handleEditSave = () => {
    if (!isValidEdit || !editOriginalName) return;
    onEditHook(editOriginalName, trimmedEditName, editForwardTo.trim(), editRedactionEnabled);
    setIsEditOpen(false);
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-3 py-2 text-xs text-slate-100 hover:border-accent-500/60"
        >
          Add hook
        </button>
      </div>

      {hooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-canvas-800/60 bg-canvas-900/20 p-8 text-sm text-slate-400">
          No hooks captured yet.
        </div>
      ) : null}

      {hooks.map((hook) => (
        <HookRow
          key={hook.hookName}
          hook={hook}
          config={config}
          onView={onViewHook}
          onDelete={onDeleteHook}
          onEdit={openEdit}
        />
      ))}

      {isModalOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-canvas-800/70 bg-canvas-900/95 p-6 shadow-glow">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-white">Add hook</div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-canvas-800/70 px-2 py-1 text-xs text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs text-slate-300">
                Hook name
                <input
                  value={newHookName}
                  onChange={(event) => setNewHookName(event.target.value)}
                  placeholder="hook-name"
                  className="rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-300">
                Forwarding URL
                <input
                  value={newForwardTo}
                  onChange={(event) => setNewForwardTo(event.target.value)}
                  placeholder="https://example.com"
                  className="rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={newRedactionEnabled}
                  onChange={(event) => setNewRedactionEnabled(event.target.checked)}
                  className="h-4 w-4 accent-accent-500"
                />
                Redaction enabled
              </label>
            </div>
            {!isValidHook && newHookName ? (
              <div className="mt-2 text-xs text-amber-300">
                Hook names can include letters, numbers, dashes, and underscores.
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-3 py-2 text-xs text-slate-100 hover:border-accent-500/60"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!isValidHook}
                className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-2 text-xs text-accent-500 hover:border-accent-500/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save hook
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-canvas-800/70 bg-canvas-900/95 p-6 shadow-glow">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-white">Edit hook</div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="rounded-full border border-canvas-800/70 px-2 py-1 text-xs text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs text-slate-300">
                Hook name
                <input
                  value={editHookName}
                  onChange={(event) => setEditHookName(event.target.value)}
                  placeholder="hook-name"
                  className="rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-300">
                Forwarding URL
                <input
                  value={editForwardTo}
                  onChange={(event) => setEditForwardTo(event.target.value)}
                  placeholder="https://example.com"
                  className="rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={editRedactionEnabled}
                  onChange={(event) => setEditRedactionEnabled(event.target.checked)}
                  className="h-4 w-4 accent-accent-500"
                />
                Redaction enabled
              </label>
            </div>
            {!isValidEdit && editHookName ? (
              <div className="mt-2 text-xs text-amber-300">
                Hook names can include letters, numbers, dashes, and underscores.
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  if (editOriginalName) {
                    onDeleteHook(editOriginalName);
                    setIsEditOpen(false);
                  }
                }}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:border-rose-500/70"
              >
                Delete hook
              </button>
              <button
                onClick={() => setIsEditOpen(false)}
                className="rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-3 py-2 text-xs text-slate-100 hover:border-accent-500/60"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={!isValidEdit}
                className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-2 text-xs text-accent-500 hover:border-accent-500/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
