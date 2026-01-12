import express, { Router } from 'express';
import { addRequest, updateRequest } from '../store/requestStore.js';
import type { StoredRequest } from '../store/types.js';
import { createId } from '../utils/id.js';
import { safeParseJson } from '../utils/safeJson.js';
import { normalizeHeaders } from '../utils/headers.js';
import { getState } from '../store/stateStore.js';
import { getConfig } from '../store/configStore.js';
import { performForward } from '../utils/forward.js';

const router = Router();
const rawParser = express.raw({ type: '*/*', limit: '1mb' });

function toSimpleQuery(query: Record<string, unknown>) {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      result[key] = value.map((item) => String(item));
    } else if (value === undefined) {
      continue;
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

function resolveSubPath(param: string | undefined) {
  if (!param) return '/';
  return `/${param}`;
}

async function handleHook(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const id = createId();
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const contentType = req.headers['content-type'] ?? '';
    const parsedJson =
      typeof contentType === 'string' && contentType.includes('json')
        ? safeParseJson(rawBody)
        : null;

    const hookName = req.params.hookName || 'unknown';
    const subPath = resolveSubPath(req.params[0]);
    const fullPath = req.originalUrl.split('?')[0] ?? `/hooks/${hookName}${subPath}`;

    const state = await getState();
    const config = await getConfig();

    const record: StoredRequest = {
      id,
      sessionId: state.activeSessionId,
      hookName,
      fullPath,
      path: subPath,
      receivedAt: new Date().toISOString(),
      method: req.method,
      query: toSimpleQuery(req.query as Record<string, unknown>),
      headers: normalizeHeaders(req.headers),
      rawBody,
      parsedJson,
      client: {
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
      redacted: false,
    };

    const stored = await addRequest(record, config);

    const forwardTarget = config.hooks[hookName]?.forwardTo;
    if (forwardTarget) {
      void (async () => {
        const outcome = await performForward(stored, forwardTarget);
        await updateRequest(stored.id, { forward: outcome.forward });
      })();
    }
    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
}

router.all('/:hookName/*', rawParser, handleHook);
router.all('/:hookName', rawParser, handleHook);

export default router;
