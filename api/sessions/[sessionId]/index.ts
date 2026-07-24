/**
 * Vercel Serverless Function: GET /api/sessions/:sessionId
 * Retrieves a session by ID.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SessionManagerRedis } from '../../../src/application/session-manager-redis.js';
import { ErrorCode } from '../../../src/types/index.js';

const sessionManager = new SessionManagerRedis();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' } });
  }

  const sessionId = req.query.sessionId as string;

  const result = await sessionManager.getSession(sessionId);

  if (!result.success) {
    return res.status(404).json({
      error: {
        code: ErrorCode.SESSION_NOT_FOUND,
        message: `Session '${sessionId}' not found`,
      },
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(200).json(result.data);
}
