/**
 * Vercel Serverless Function: GET/POST /api/templates
 * Lists templates (GET) or creates a new custom template (POST).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TemplateManagerRedis } from '../../src/application/template-manager-redis.js';
import type { TemplateFilter } from '../../src/types/index.js';
import { ErrorCode } from '../../src/types/index.js';

const templateManager = new TemplateManagerRedis();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET /api/templates — list with optional filters
  if (req.method === 'GET') {
    const filter: TemplateFilter = {};

    if (req.query.type) {
      filter.type = req.query.type as 'diagram' | 'document';
    }
    if (req.query.subType) {
      filter.subType = req.query.subType as TemplateFilter['subType'];
    }
    if (req.query.isBuiltIn !== undefined) {
      filter.isBuiltIn = req.query.isBuiltIn === 'true';
    }

    const templates = await templateManager.listTemplates(
      Object.keys(filter).length > 0 ? filter : undefined,
    );

    return res.status(200).json(templates);
  }

  // POST /api/templates — create a new template
  if (req.method === 'POST') {
    try {
      const template = await templateManager.createTemplate(req.body);
      return res.status(201).json(template);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = (err.code as ErrorCode) ?? ErrorCode.TEMPLATE_INVALID;
      return res.status(400).json({
        error: { code, message: err.message ?? 'Template creation failed' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET and POST are allowed' } });
}
