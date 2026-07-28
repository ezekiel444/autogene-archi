/**
 * Netlify Function: POST /.netlify/functions/sessions-undo?sessionId=xxx
 * Undoes the last exchange in a session.
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { SessionManagerRedis } from '../../src/application/session-manager-redis.js';
import { ErrorCode } from '../../src/types/index.js';

const sessionManager = new SessionManagerRedis();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, Allow: 'POST' },
      body: JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed' } }),
    };
  }

  const sessionId = event.queryStringParameters?.sessionId;

  if (!sessionId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'sessionId query parameter is required' } }),
    };
  }

  const result = await sessionManager.undo(sessionId);

  if (!result.success) {
    const statusCode = result.error!.code === ErrorCode.SESSION_NOT_FOUND ? 404 : 400;
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        error: {
          code: result.error!.code,
          message: result.error!.message,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      undoneExchange: result.data,
      message: 'Last exchange undone successfully',
    }),
  };
};
