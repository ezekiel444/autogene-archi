/**
 * Netlify Function: PUT/DELETE /.netlify/functions/templates-by-id?templateId=xxx
 * Updates (PUT) or deletes (DELETE) a custom template.
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { TemplateManagerRedis } from '../../src/application/template-manager-redis.js';
import { ErrorCode } from '../../src/types/index.js';

const templateManager = new TemplateManagerRedis();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const templateId = event.queryStringParameters?.templateId;

  if (!templateId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'templateId query parameter is required' } }),
    };
  }

  // PUT — update template
  if (event.httpMethod === 'PUT') {
    try {
      const body = JSON.parse(event.body || '{}');
      const updated = await templateManager.updateTemplate(templateId, body);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(updated),
      };
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = (err.code as ErrorCode) ?? ErrorCode.TEMPLATE_INVALID;
      let statusCode = 400;
      if (code === ErrorCode.TEMPLATE_NOT_FOUND) statusCode = 404;
      if (code === ErrorCode.TEMPLATE_BUILTIN_READONLY) statusCode = 403;
      return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify({
          error: { code, message: err.message ?? 'Template update failed' },
          timestamp: new Date().toISOString(),
        }),
      };
    }
  }

  // DELETE — delete custom template
  if (event.httpMethod === 'DELETE') {
    try {
      await templateManager.deleteTemplate(templateId);
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: '',
      };
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = (err.code as ErrorCode) ?? ErrorCode.TEMPLATE_INVALID;
      let statusCode = 400;
      if (code === ErrorCode.TEMPLATE_NOT_FOUND) statusCode = 404;
      if (code === ErrorCode.TEMPLATE_BUILTIN_READONLY) statusCode = 403;
      return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify({
          error: { code, message: err.message ?? 'Template deletion failed' },
          timestamp: new Date().toISOString(),
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: { ...corsHeaders, Allow: 'PUT, DELETE' },
    body: JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only PUT and DELETE are allowed' } }),
  };
};
