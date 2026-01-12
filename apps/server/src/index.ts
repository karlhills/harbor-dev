import express from 'express';
import cors from 'cors';
import path from 'node:path';
import apiRouter from './routes/api.js';
import hooksRouter from './routes/hooks.js';

const app = express();
const port = Number(process.env.PORT) || 5178;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', true);

if (!isProd) {
  app.use(cors({ origin: 'http://localhost:5173' }));
}

app.use('/hooks', hooksRouter);
app.use('/api', express.json({ limit: '1mb' }));
app.use('/api', apiRouter);

if (isProd) {
  const uiDist = path.resolve(process.cwd(), '../ui/dist');
  app.use(express.static(uiDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/hooks')) {
      next();
      return;
    }
    res.sendFile(path.join(uiDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      ok: false,
      error: 'UI runs on http://localhost:5173 in dev',
    });
  });
}

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const error = err as { type?: string; message?: string };
  if (error.type === 'entity.too.large') {
    res.status(413).json({ ok: false, error: 'Payload too large' });
    return;
  }
  res.status(400).json({ ok: false, error: error.message ?? 'Bad request' });
});

app.listen(port, () => {
  console.log(`Harbor server listening on http://localhost:${port}`);
});
