/**
 * Vercel Serverless Function: POST /api/validate
 * DSL validation endpoint for the code editor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validate } from '../src/domain/dsl-validator.js';
import type { OutputFormat } from '../src/types/index.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed' } });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const { code, format } = req.body as { code: string; format?: OutputFormat };
  const result = validate(code, format ?? 'node-graph');
  return res.status(200).json(result);
}
