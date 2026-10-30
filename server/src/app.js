import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { HttpError } from './lib/errors.js';
import { log } from './lib/log.js';
import { createStatusService } from './lib/mc.js';
import { createApiRouter } from './routes/api.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..');

export function createApp({ statusService = createStatusService() } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  const connectSrc = ["'self'", ...config.origins];
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'font-src': ["'self'"],
          'connect-src': connectSrc,
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'object-src': ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: config.origins.length ? config.origins : false,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '16kb' }));

  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      if (req.path === '/api/health') return;
      log('info', 'http', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - started,
      });
    });
    next();
  });

  app.use('/api', createApiRouter({ statusService }));

  if (config.serveDashboard) {
    const indexHtml = join(projectRoot, 'index.html');
    if (!existsSync(indexHtml)) {
      log('warn', 'dashboard index.html not found; API-only mode', { projectRoot });
    } else {
      const staticOpts = { index: false, dotfiles: 'deny', maxAge: '1h', etag: true };
      app.use('/assets', express.static(join(projectRoot, 'assets'), staticOpts));
      app.use('/vendor', express.static(join(projectRoot, 'vendor'), staticOpts));

      app.get('/', (_req, res) => res.sendFile(indexHtml));
      app.get('/index.html', (_req, res) => res.sendFile(indexHtml));
      app.get('/favicon.ico', (_req, res) => res.status(204).end());
    }
  }

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    return next();
  });

  app.use((_req, res) => res.status(404).send('Not found'));

  // Generic error handler: internals never reach the browser.
  app.use((err, req, res, _next) => {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) {
      log('error', 'request failed', {
        method: req.method,
        path: req.path,
        error: err?.message,
        code: err?.code,
      });
    }
    if (res.headersSent) return;
    res.status(status).json({
      error: err?.expose ? err.message : 'Something went wrong on the server.',
      code: err?.expose ? err.code : undefined,
    });
  });

  return app;
}
