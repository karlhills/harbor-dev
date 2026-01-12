import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import {
  clearRequests,
  getRequestById,
  listRequests,
  listRequestsForSearch,
  updateHookName,
  updateRequest,
} from '../store/requestStore.js';
import { deleteHookConfig, getConfig, updateConfig } from '../store/configStore.js';
import { getState, startNewSession, syncSessionsFromRequests } from '../store/stateStore.js';
import { performForward } from '../utils/forward.js';

const router = Router();
const version = process.env.npm_package_version ?? '0.0.0';
const dataDir = path.join(process.cwd(), 'data');
const exportsDir = path.join(dataDir, 'exports');

const limitSchema = z.coerce.number().int().positive().max(1000).optional();

router.get('/health', (_req, res) => {
  res.json({ ok: true, name: 'harbor', version });
});

router.get('/state', async (_req, res, next) => {
  try {
    const requests = await listRequests();
    const [state, config] = await Promise.all([
      syncSessionsFromRequests(requests),
      getConfig(),
    ]);
    res.json({
      activeSessionId: state.activeSessionId,
      activeSessionStartedAt: state.activeSessionStartedAt,
      config: {
        redaction: config.redaction.enabled,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/config', async (_req, res, next) => {
  try {
    const config = await getConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.patch('/config', async (req, res, next) => {
  try {
    const updated = await updateConfig(req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get('/sessions', async (_req, res, next) => {
  try {
    const requests = await listRequests();
    const state = await syncSessionsFromRequests(requests);
    res.json(state.sessions);
  } catch (err) {
    next(err);
  }
});

router.post('/sessions', async (_req, res, next) => {
  try {
    const state = await startNewSession();
    res.json({ sessionId: state.activeSessionId });
  } catch (err) {
    next(err);
  }
});

router.get('/hooks', async (_req, res, next) => {
  try {
    const [requests, config] = await Promise.all([listRequests(), getConfig()]);
    const hookMap = new Map<string, { count: number; latest: string | null }>();
    for (const request of requests) {
      const entry = hookMap.get(request.hookName) ?? { count: 0, latest: null };
      entry.count += 1;
      entry.latest = entry.latest
        ? entry.latest > request.receivedAt
          ? entry.latest
          : request.receivedAt
        : request.receivedAt;
      hookMap.set(request.hookName, entry);
    }

    for (const hookName of Object.keys(config.hooks)) {
      if (!hookMap.has(hookName)) {
        hookMap.set(hookName, { count: 0, latest: null });
      }
    }

    const hooks = Array.from(hookMap.entries()).map(([hookName, info]) => ({
      hookName,
      count: info.count,
      latestReceivedAt: info.latest,
      forwardTo: config.hooks[hookName]?.forwardTo,
      redactionEnabled: config.hooks[hookName]?.redactionEnabled,
    }));

    res.json(hooks);
  } catch (err) {
    next(err);
  }
});

router.delete('/hooks/:hookName', async (req, res, next) => {
  try {
    const hookName = req.params.hookName;
    const updated = await deleteHookConfig(hookName);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const hookUpdateSchema = z.object({
  hookName: z.string().min(1).optional(),
  forwardTo: z.union([z.string().url(), z.literal('')]).optional(),
  redactionEnabled: z.boolean().optional(),
});

router.patch('/hooks/:hookName', async (req, res, next) => {
  try {
    const parsed = hookUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid hook payload' });
      return;
    }
    const oldName = req.params.hookName;
    const nextName = parsed.data.hookName?.trim() || oldName;

    const current = await getConfig();
    const existing = current.hooks[oldName] ?? {};
    const shouldClearForward = parsed.data.forwardTo === '';
    const hookPayload = {
      ...(parsed.data.forwardTo && !shouldClearForward ? { forwardTo: parsed.data.forwardTo } : {}),
      ...(parsed.data.redactionEnabled !== undefined
        ? { redactionEnabled: parsed.data.redactionEnabled }
        : {}),
      ...(parsed.data.forwardTo === undefined && existing.forwardTo && !shouldClearForward
        ? { forwardTo: existing.forwardTo }
        : {}),
      ...(parsed.data.redactionEnabled === undefined && existing.redactionEnabled !== undefined
        ? { redactionEnabled: existing.redactionEnabled }
        : {}),
    };

    const shouldReplace = nextName !== oldName || shouldClearForward;
    if (shouldReplace) {
      await deleteHookConfig(oldName);
    }

    const updated = await updateConfig({
      hooks: {
        [nextName]: hookPayload,
      },
    });
    if (nextName !== oldName) {
      await updateHookName(oldName, nextName);
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get('/requests', async (req, res, next) => {
  try {
    const parsed = limitSchema.safeParse(req.query.limit);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid limit' });
      return;
    }
    const requests = await listRequests(parsed.data);
    res.json(requests);
  } catch (err) {
    next(err);
  }
});

router.get('/requests/search', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : '';
    const hookName = typeof req.query.hookName === 'string' ? req.query.hookName : '';
    const method = typeof req.query.method === 'string' ? req.query.method : '';
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
    const headerKey = typeof req.query.headerKey === 'string' ? req.query.headerKey : '';
    const headerValue = typeof req.query.headerValue === 'string' ? req.query.headerValue : '';

    const requests = await listRequestsForSearch(500);
    const filtered = requests.filter((request) => {
      if (hookName && request.hookName !== hookName) return false;
      if (method && request.method !== method) return false;
      if (sessionId && request.sessionId !== sessionId) return false;
      if (headerKey) {
        const found = Object.entries(request.headers).some(([key, value]) => {
          if (key.toLowerCase() !== headerKey.toLowerCase()) return false;
          if (headerValue) {
            return value.toLowerCase().includes(headerValue.toLowerCase());
          }
          return true;
        });
        if (!found) return false;
      }
      if (!q) return true;
      const haystack = [
        request.fullPath,
        request.path,
        JSON.stringify(request.query),
        JSON.stringify(request.headers),
        request.rawBody,
        request.parsedJson ? JSON.stringify(request.parsedJson) : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

router.get('/requests/:id', async (req, res, next) => {
  try {
    const request = await getRequestById(req.params.id);
    if (!request) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }
    res.json(request);
  } catch (err) {
    next(err);
  }
});

router.delete('/requests', async (_req, res, next) => {
  try {
    await clearRequests();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const forwardSchema = z.object({
  targetUrl: z.string().url().optional(),
});

router.post('/forward/:id', async (req, res, next) => {
  try {
    const parsed = forwardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid payload' });
      return;
    }
    const request = await getRequestById(req.params.id);
    if (!request) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }
    const config = await getConfig();
    const hookConfig = config.hooks[request.hookName];
    const target = parsed.data.targetUrl ?? hookConfig?.forwardTo;
    if (!target) {
      res.status(400).json({ ok: false, error: 'Missing targetUrl' });
      return;
    }

    const outcome = await performForward(request, target);
    await updateRequest(request.id, { forward: outcome.forward });
    if (!outcome.ok) {
      res.status(500).json({ ok: false, durationMs: outcome.durationMs, error: outcome.error });
      return;
    }
    res.json({ ok: true, status: outcome.status, durationMs: outcome.durationMs });
  } catch (err) {
    next(err);
  }
});

const exportSchema = z.object({
  ids: z.array(z.string()).min(1),
  format: z.enum(['json', 'fixtures']),
  hookName: z.string().optional(),
});

router.post('/export', async (req, res, next) => {
  try {
    const parsed = exportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid export payload' });
      return;
    }
    const requests = await listRequests();
    const selection = requests.filter((request) => parsed.data.ids.includes(request.id));
    if (parsed.data.format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="harbor-export.json"');
      res.send(JSON.stringify(selection, null, 2));
      return;
    }

    const exportId = `export_${Date.now()}`;
    const exportPath = path.join(exportsDir, exportId);
    await fs.mkdir(exportPath, { recursive: true });

    const manifest = {
      exportId,
      createdAt: new Date().toISOString(),
      hookName: parsed.data.hookName ?? null,
      count: selection.length,
      files: [] as string[],
    };

    for (const item of selection) {
      const fileName = `${item.id}.json`;
      const filePath = path.join(exportPath, fileName);
      await fs.writeFile(filePath, JSON.stringify(item, null, 2), 'utf8');
      manifest.files.push(fileName);
    }

    await fs.writeFile(
      path.join(exportPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8',
    );

    res.json({ ok: true, exportId, path: exportPath, count: selection.length });
  } catch (err) {
    next(err);
  }
});

router.get('/exports/:exportId/manifest.json', async (req, res, next) => {
  try {
    const exportId = req.params.exportId;
    const filePath = path.join(exportsDir, exportId, 'manifest.json');
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

router.get('/exports/:exportId/file/:name', async (req, res, next) => {
  try {
    const exportId = req.params.exportId;
    const name = path.basename(req.params.name);
    const filePath = path.join(exportsDir, exportId, name);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

router.post('/open-data', async (_req, res, next) => {
  try {
    const platform = process.platform;
    let command = 'xdg-open';
    const args = [dataDir];
    if (platform === 'darwin') {
      command = 'open';
    } else if (platform === 'win32') {
      command = 'explorer';
    }
    execFile(command, args, (error) => {
      if (error) {
        res.status(500).json({ ok: false, error: 'Failed to open folder' });
        return;
      }
      res.json({ ok: true });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
