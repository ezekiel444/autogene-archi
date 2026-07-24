/**
 * Vercel Serverless Function: POST /api/sessions/:sessionId/undo
 * Undoes the last exchange in a session.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SessionManagerRedis } from '../../../src/application/session-manager-redis.js';
import { ErrorCode } from '../../../src/types/index.js';

const sessionManager = new SessionManagerRedis();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed' } });
  }

  const sessionId = req.query.sessionId as string;

  const result = await sessionManager.undo(sessionId);

  if (!result.success) {
    const statusCode = result.error!.code === ErrorCode.SESSION_NOT_FOUND ? 404 : 400;
    return res.status(statusCode).json({
      error: {
        code: result.error!.code,
        message: result.error!.message,
      },
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(200).json({
    undoneExchange: result.data,
    message: 'Last exchange undone successfully',
  });
}
