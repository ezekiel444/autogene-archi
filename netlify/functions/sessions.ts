/**
 * Netlify Function: GET /.netlify/functions/sessions?sessionId=xxx
 * Retrieves a session by ID.
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { SessionManagerRedis } from '../../src/application/session-manager-redis.js';
import { ErrorCode } from '../../src/types/index.js';

const sessionManager = new SessionManagerRedis();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, Allow: 'GET' },
      body: JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' } }),
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

  const result = await sessionManager.getSession(sessionId);

  if (!result.success) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        error: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: `Session '${sessionId}' not found`,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.data),
  };
};
