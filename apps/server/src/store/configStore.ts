import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDefaultRedactionConfig } from './redaction.js';
import type { BeaconConfig } from './types.js';

const dataDir = path.join(process.cwd(), 'data');
const configFile = path.join(dataDir, 'config.json');

const configSchema = z.object({
  redaction: z.object({
    enabled: z.boolean(),
    headers: z.array(z.string()),
    jsonKeys: z.array(z.string()),
  }),
  hooks: z.record(
    z.object({
      forwardTo: z.string().url().optional(),
      redactionEnabled: z.boolean().optional(),
    }),
  ),
});

const partialConfigSchema = configSchema.partial({
  redaction: true,
  hooks: true,
});

function normalizeList(values: string[]) {
  return values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

export function getDefaultConfig(): BeaconConfig {
  const defaults = getDefaultRedactionConfig();
  return {
    redaction: {
      enabled: true,
      headers: defaults.headers,
      jsonKeys: defaults.jsonKeys,
    },
    hooks: {},
  };
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readConfigFile(): Promise<BeaconConfig | null> {
  try {
    const data = await fs.readFile(configFile, 'utf8');
    const parsed = JSON.parse(data) as unknown;
    const validated = configSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
    return null;
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') return null;
    if (error.name === 'SyntaxError') return null;
    throw err;
  }
}

async function writeConfig(config: BeaconConfig) {
  await ensureDataDir();
  const tmpFile = path.join(dataDir, `config.${Date.now()}-${randomUUID()}.tmp`);
  await fs.writeFile(tmpFile, JSON.stringify(config, null, 2), 'utf8');
  await fs.rename(tmpFile, configFile);
}

export async function getConfig(): Promise<BeaconConfig> {
  const existing = await readConfigFile();
  if (existing) return existing;
  const defaults = getDefaultConfig();
  await writeConfig(defaults);
  return defaults;
}

export async function updateConfig(patch: unknown): Promise<BeaconConfig> {
  const parsedPatch = partialConfigSchema.safeParse(patch);
  if (!parsedPatch.success) {
    throw new Error('Invalid config');
  }
  const current = await getConfig();
  const merged: BeaconConfig = {
    redaction: {
      ...current.redaction,
      ...parsedPatch.data.redaction,
    },
    hooks: {
      ...current.hooks,
      ...parsedPatch.data.hooks,
    },
  };

  merged.redaction.headers = normalizeList(merged.redaction.headers);
  merged.redaction.jsonKeys = normalizeList(merged.redaction.jsonKeys);

  await writeConfig(merged);
  return merged;
}

export async function deleteHookConfig(hookName: string): Promise<BeaconConfig> {
  const current = await getConfig();
  if (hookName in current.hooks) {
    const nextHooks = { ...current.hooks };
    delete nextHooks[hookName];
    const updated: BeaconConfig = {
      ...current,
      hooks: nextHooks,
    };
    await writeConfig(updated);
    return updated;
  }
  return current;
}

export { configSchema };
