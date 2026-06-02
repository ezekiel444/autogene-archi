/**
 * Unit tests for the API error handler middleware.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '../../src/types/errors.js';
import {
  errorHandler,
  requestIdMiddleware,
  getHttpStatusForErrorCode,
} from '../../src/api/error-handler.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockRequest(headers: Record<string, string> = {}): Partial<Request> {
  return {
    headers: { ...headers },
  };
}

function createMockResponse(): Partial<Response> & {
  statusCode: number;
  body: unknown;
  headersSet: Record<string, string>;
} {
  const res: Partial<Response> & {
    statusCode: number;
    body: unknown;
    headersSet: Record<string, string>;
  } = {
    statusCode: 200,
    body: undefined,
    headersSet: {},
    status(code: number) {
      res.statusCode = code;
      return res as unknown as Response;
    },
    json(data: unknown) {
      res.body = data;
      return res as unknown as Response;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      res.headersSet[name as string] = String(value);
      return res as unknown as Response;
    },
  };
  return res;
}

// ─── Tests: getHttpStatusForErrorCode ────────────────────────────────────────

describe('getHttpStatusForErrorCode', () => {
  it('maps validation errors to 400', () => {
    const codes400: ErrorCode[] = [
      ErrorCode.PROMPT_EMPTY,
      ErrorCode.PROMPT_TOO_LONG,
      ErrorCode.FORMAT_UNSUPPORTED,
      ErrorCode.DIAGRAM_TYPE_UNSUPPORTED,
      ErrorCode.ATTACHMENT_TOO_LARGE,
      ErrorCode.ATTACHMENT_TYPE_UNSUPPORTED,
      ErrorCode.ATTACHMENT_EMPTY,
      ErrorCode.ATTACHMENT_CORRUPT,
      ErrorCode.ATTACHMENT_LIMIT_EXCEEDED,
      ErrorCode.TEMPLATE_INVALID,
      ErrorCode.TEMPLATE_INCOMPATIBLE,
      ErrorCode.TEMPLATE_LIMIT_REACHED,
      ErrorCode.DOCUMENT_TOO_LONG,
    ];

    for (const code of codes400) {
      expect(getHttpStatusForErrorCode(code)).toBe(400);
    }
  });

  it('maps TEMPLATE_BUILTIN_READONLY to 403', () => {
    expect(getHttpStatusForErrorCode(ErrorCode.TEMPLATE_BUILTIN_READONLY)).toBe(403);
  });

  it('maps not-found errors to 404', () => {
    expect(getHttpStatusForErrorCode(ErrorCode.SESSION_NOT_FOUND)).toBe(404);
    expect(getHttpStatusForErrorCode(ErrorCode.TEMPLATE_NOT_FOUND)).toBe(404);
  });

  it('maps GENERATION_TIMEOUT to 408', () => {
    expect(getHttpStatusForErrorCode(ErrorCode.GENERATION_TIMEOUT)).toBe(408);
  });

  it('maps conflict/limit errors to 409', () => {
    expect(getHttpStatusForErrorCode(ErrorCode.SESSION_LIMIT_REACHED)).toBe(409);
    expect(getHttpStatusForErrorCode(ErrorCode.UNDO_NOT_AVAILABLE)).toBe(409);
  });

  it('maps internal/system errors to 500', () => {
    const codes500: ErrorCode[] = [
      ErrorCode.INTERNAL_ERROR,
      ErrorCode.GENERATION_FAILED,
      ErrorCode.RENDER_SYNTAX_ERROR,
      ErrorCode.RENDER_FAILED,
    ];

    for (const code of codes500) {
      expect(getHttpStatusForErrorCode(code)).toBe(500);
    }
  });
});

// ─── Tests: requestIdMiddleware ──────────────────────────────────────────────

describe('requestIdMiddleware', () => {
  it('generates a request ID when none is provided', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    requestIdMiddleware(req as Request, res as unknown as Response, next);

    expect(req.headers!['x-request-id']).toBeDefined();
    expect(typeof req.headers!['x-request-id']).toBe('string');
    expect(res.headersSet['x-request-id']).toBe(req.headers!['x-request-id']);
    expect(next).toHaveBeenCalledOnce();
  });

  it('preserves an existing request ID from the incoming request', () => {
    const existingId = 'existing-request-id-123';
    const req = createMockRequest({ 'x-request-id': existingId });
    const res = createMockResponse();
    const next = vi.fn();

    requestIdMiddleware(req as Request, res as unknown as Response, next);

    expect(req.headers!['x-request-id']).toBe(existingId);
    expect(res.headersSet['x-request-id']).toBe(existingId);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ─── Tests: errorHandler ─────────────────────────────────────────────────────

describe('errorHandler', () => {
  it('returns structured ErrorResponse with correct status code for known error codes', () => {
    const err = {
      code: ErrorCode.PROMPT_EMPTY,
      message: 'Prompt must contain non-whitespace content',
    };
    const req = createMockRequest({ 'x-request-id': 'test-req-id' });
    const res = createMockResponse();
    const next = vi.fn();

    errorHandler(err, req as Request, res as unknown as Response, next);

    expect(res.statusCode).toBe(400);
    const body = res.body as ErrorResponse;
    expect(body.error.code).toBe(ErrorCode.PROMPT_EMPTY);
    expect(body.error.message).toBe('Prompt must contain non-whitespace content');
    expect(body.requestId).toBe('test-req-id');
    expect(body.timestamp).toBeDefined();
  });

  it('defaults to INTERNAL_ERROR and 500 for unknown error codes', () => {
    const err = {
      code: 'SOME_UNKNOWN_CODE',
      message: 'Something went wrong',
    };
    const req = createMockRequest({ 'x-request-id': 'req-456' });
    const res = createMockResponse();
    const next = vi.fn();

    errorHandler(err, req as Request, res as unknown as Response, next);

    expect(res.statusCode).toBe(500);
    const body = res.body as ErrorResponse;
    expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(body.error.message).toBe('Something went wrong');
  });

  it('includes details when provided in the error', () => {
    const err = {
      code: ErrorCode.PROMPT_TOO_LONG,
      message: 'Prompt exceeds maximum length',
      details: { maxLength: 10000, actualLength: 12000 },
    };
    const req = createMockRequest({ 'x-request-id': 'req-789' });
    const res = createMockResponse();
    const next = vi.fn();

    errorHandler(err, req as Request, res as unknown as Response, next);

    expect(res.statusCode).toBe(400);
    const body = res.body as ErrorResponse;
    expect(body.error.details).toEqual({ maxLength: 10000, actualLength: 12000 });
  });

  it('generates a request ID if none is on the request', () => {
    const err = { code: ErrorCode.INTERNAL_ERROR, message: 'Oops' };
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    errorHandler(err, req as Request, res as unknown as Response, next);

    const body = res.body as ErrorResponse;
    expect(body.requestId).toBeDefined();
    expect(body.requestId.length).toBeGreaterThan(0);
  });

  it('provides a default message for errors without a message', () => {
    const err = { code: ErrorCode.INTERNAL_ERROR };
    const req = createMockRequest({ 'x-request-id': 'req-no-msg' });
    const res = createMockResponse();
    const next = vi.fn();

    errorHandler(err, req as Request, res as unknown as Response, next);

    const body = res.body as ErrorResponse;
    expect(body.error.message).toBe('An unexpected error occurred');
  });

  it('handles completely unknown error objects gracefully', () => {
    const err = 'string error';
    const req = createMockRequest({ 'x-request-id': 'req-str' });
    const res = createMockResponse();
    const next = vi.fn();

    errorHandler(err, req as Request, res as unknown as Response, next);

    expect(res.statusCode).toBe(500);
    const body = res.body as ErrorResponse;
    expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it('returns valid ISO timestamp', () => {
    const err = { code: ErrorCode.SESSION_NOT_FOUND, message: 'Not found' };
    const req = createMockRequest({ 'x-request-id': 'req-time' });
    const res = createMockResponse();
    const next = vi.fn();

    errorHandler(err, req as Request, res as unknown as Response, next);

    const body = res.body as ErrorResponse;
    const parsed = new Date(body.timestamp);
    expect(parsed.toISOString()).toBe(body.timestamp);
  });
});
