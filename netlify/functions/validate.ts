/**
 * Netlify Function: POST /.netlify/functions/validate
 * DSL validation endpoint for the code editor.
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { validate } from '../../src/domain/dsl-validator.js';
import type { OutputFormat } from '../../src/types/index.js';

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

  const { code, format } = JSON.parse(event.body || '{}') as { code: string; format?: OutputFormat };
  const result = validate(code, format ?? 'node-graph');

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result),
  };
};
