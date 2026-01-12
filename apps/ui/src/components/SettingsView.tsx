import { useEffect, useState } from 'react';
import type { BeaconConfig } from '../lib/api';
import { openDataFolder } from '../lib/api';

type SettingsViewProps = {
  config: BeaconConfig | null;
  onSave: (config: BeaconConfig) => void;
};

export default function SettingsView({ config, onSave }: SettingsViewProps) {
  const [localConfig, setLocalConfig] = useState<BeaconConfig | null>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  if (!localConfig) {
    return <div className="text-sm text-slate-400">Loading settings...</div>;
  }

  const headerKeys = localConfig.redaction.headers.join('\n');
  const jsonKeys = localConfig.redaction.jsonKeys.join('\n');

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-canvas-800/70 bg-canvas-900/30 p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">Redaction</div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={localConfig.redaction.enabled}
              onChange={(event) =>
                setLocalConfig({
                  ...localConfig,
                  redaction: { ...localConfig.redaction, enabled: event.target.checked },
                })
              }
              className="h-4 w-4 accent-accent-500"
            />
            Enabled
          </label>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-slate-400">Header keys (one per line)</label>
            <textarea
              rows={6}
              value={headerKeys}
              onChange={(event) =>
                setLocalConfig({
                  ...localConfig,
                  redaction: {
                    ...localConfig.redaction,
                    headers: event.target.value.split('\n'),
                  },
                })
              }
              className="mt-2 w-full rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">JSON keys (one per line)</label>
            <textarea
              rows={6}
              value={jsonKeys}
              onChange={(event) =>
                setLocalConfig({
                  ...localConfig,
                  redaction: {
                    ...localConfig.redaction,
                    jsonKeys: event.target.value.split('\n'),
                  },
                })
              }
              className="mt-2 w-full rounded-lg border border-canvas-800/70 bg-canvas-950/60 px-3 py-2 text-xs text-slate-100 outline-none"
            />
          </div>
        </div>
        <button
          onClick={() => onSave(localConfig)}
          className="mt-4 rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-3 py-2 text-xs text-slate-100 hover:border-accent-500/60"
        >
          Save settings
        </button>
      </div>

      <div className="rounded-2xl border border-canvas-800/70 bg-canvas-900/30 p-5 text-sm text-slate-300">
        <div className="text-slate-400">Storage</div>
        <div className="text-slate-100">apps/server/data</div>
        <div className="mt-1 text-xs text-slate-500">Exports: apps/server/data/exports</div>
        <button
          onClick={() => openDataFolder()}
          className="mt-4 rounded-lg border border-canvas-800/70 bg-canvas-900/40 px-3 py-2 text-xs text-slate-100 hover:border-accent-500/60"
        >
          Open data folder
        </button>
      </div>
    </div>
  );
}
