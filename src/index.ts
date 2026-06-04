/**
 * Application entry point and Express server configuration.
 * Mounts API routes, middleware, static files, and startup checks.
 *
 * Requirements: 12.1
 */

import express from 'express';
import type { Express } from 'express';
import { join } from 'path';
import { loadEnvConfig } from './env.js';
import { requestIdMiddleware, errorHandler } from './api/error-handler.js';
import router from './api/routes.js';
import { validate } from './domain/dsl-validator.js';
import type { OutputFormat } from './types/index.js';

const app: Express = express();
const PORT = process.env.PORT || 3000;

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
app.use(express.static(join(process.cwd(), 'public')));

// Mount API routes
app.use(router);

// DSL validation endpoint for the code editor
app.post('/api/validate', (req, res) => {
  const { code, format } = req.body as { code: string; format: OutputFormat };
  const result = validate(code, format);
  res.json(result);
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

app.listen(PORT, () => {
  console.log(`AI Diagram & Document Generator running on http://localhost:${PORT}`);
});

export default app;
