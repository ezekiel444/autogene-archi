/**
 * Vercel Serverless Function: PUT/DELETE /api/templates/:templateId
 * Updates (PUT) or deletes (DELETE) a custom template.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TemplateManagerRedis } from '../../src/application/template-manager-redis.js';
import { ErrorCode } from '../../src/types/index.js';

const templateManager = new TemplateManagerRedis();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const templateId = req.query.templateId as string;

  // PUT /api/templates/:templateId — update template structure
  if (req.method === 'PUT') {
    try {
      const updated = await templateManager.updateTemplate(templateId, req.body);
      return res.status(200).json(updated);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = (err.code as ErrorCode) ?? ErrorCode.TEMPLATE_INVALID;
      let statusCode = 400;
      if (code === ErrorCode.TEMPLATE_NOT_FOUND) statusCode = 404;
      if (code === ErrorCode.TEMPLATE_BUILTIN_READONLY) statusCode = 403;
      return res.status(statusCode).json({
        error: { code, message: err.message ?? 'Template update failed' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // DELETE /api/templates/:templateId — delete custom template
  if (req.method === 'DELETE') {
    try {
      await templateManager.deleteTemplate(templateId);
      return res.status(204).end();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = (err.code as ErrorCode) ?? ErrorCode.TEMPLATE_INVALID;
      let statusCode = 400;
      if (code === ErrorCode.TEMPLATE_NOT_FOUND) statusCode = 404;
      if (code === ErrorCode.TEMPLATE_BUILTIN_READONLY) statusCode = 403;
      return res.status(statusCode).json({
        error: { code, message: err.message ?? 'Template deletion failed' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only PUT and DELETE are allowed' } });
}
