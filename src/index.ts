/**
 * Application entry point and Express server configuration.
 * Mounts API routes, middleware, static files, and startup checks.
 *
 * Requirements: 12.1
 */

import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { loadEnvConfig } from './env.js';
import { requestIdMiddleware, errorHandler } from './api/error-handler.js';
import router from './api/routes.js';
import { validate } from './domain/dsl-validator.js';
import type { OutputFormat } from './types/index.js';

const app: Express = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(process.cwd(), 'public');
const INDEX_HTML = join(PUBLIC_DIR, 'index.html');

// Body parsing with larger limit for base64 attachments
app.use(express.json({ limit: '50mb' }));

// Request ID middleware
app.use(requestIdMiddleware);

// Author signature header (embedded in all responses)
app.use((_req, res, next) => {
  res.setHeader('X-Powered-By', 'AI Diagram Generator by Ezekiel Matomi Lucky');
  res.setHeader('X-Author', 'Ezekiel Matomi Lucky');
  next();
});

// Serve static files from public/ directory for the web UI
app.use(express.static(PUBLIC_DIR));

// Mount API routes
app.use(router);

// DSL validation endpoint for the code editor
app.post('/api/validate', (req, res) => {
  const { code, format } = req.body as { code: string; format: OutputFormat };
  const result = validate(code, format);
  res.json(result);
});

// SPA fallback: serve index.html only for navigation requests (no file extension).
// Asset-like paths (e.g. .css, .js, .ico) get a clean 404 instead of HTML, so
// browsers don't trip strict MIME checking when a build is missing or stale.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/')) return next();

  const looksLikeAsset = /\.[a-zA-Z0-9]+$/.test(req.path);
  if (looksLikeAsset) {
    res.status(404).type('text/plain').send('Not Found');
    return;
  }

  if (existsSync(INDEX_HTML)) {
    res.sendFile(INDEX_HTML);
    return;
  }

  res
    .status(503)
    .type('text/plain')
    .send(
      'Frontend build not found. Run `pnpm build:frontend` (or `pnpm build`) ' +
        'to generate public/index.html and public/assets/, then reload.',
    );
});

// Global error handler (must be registered last)
app.use(errorHandler);

// Startup: check for API keys availability
try {
  loadEnvConfig();
  console.log('API keys loaded successfully');
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Warning:', message);
  console.error('AI generation will fail until API keys are configured.');
}

// Startup: warn if the frontend build is missing
if (!existsSync(INDEX_HTML)) {
  console.warn(
    '[startup] public/index.html is missing — the web UI will not load.',
  );
  console.warn(
    '[startup] Run `pnpm build:frontend` (or `pnpm build`) to build the frontend.',
  );
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`AI Diagram & Document Generator running on http://localhost:${PORT}`);
});

export default app;
