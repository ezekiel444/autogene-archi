/**
 * Netlify Function: GET/POST /.netlify/functions/templates
 * Lists templates (GET) or creates a new custom template (POST).
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { TemplateManagerRedis } from '../../src/application/template-manager-redis.js';
import type { TemplateFilter } from '../../src/types/index.js';
import { ErrorCode } from '../../src/types/index.js';

const templateManager = new TemplateManagerRedis();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // GET — list with optional filters
  if (event.httpMethod === 'GET') {
    const filter: TemplateFilter = {};
    const params = event.queryStringParameters || {};

    if (params.type) {
      filter.type = params.type as 'diagram' | 'document';
    }
    if (params.subType) {
      filter.subType = params.subType as TemplateFilter['subType'];
    }
    if (params.isBuiltIn !== undefined) {
      filter.isBuiltIn = params.isBuiltIn === 'true';
    }

    const templates = await templateManager.listTemplates(
      Object.keys(filter).length > 0 ? filter : undefined,
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(templates),
    };
  }

  // POST — create a new template
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const template = await templateManager.createTemplate(body);
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(template),
      };
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = (err.code as ErrorCode) ?? ErrorCode.TEMPLATE_INVALID;
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: { code, message: err.message ?? 'Template creation failed' },
          timestamp: new Date().toISOString(),
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: { ...corsHeaders, Allow: 'GET, POST' },
    body: JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET and POST are allowed' } }),
  };
};
