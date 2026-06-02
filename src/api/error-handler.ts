/**
 * Express middleware for API error handling.
 * Maps domain error codes to HTTP status codes and returns structured ErrorResponse JSON.
 */

import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ErrorCode, type ErrorResponse } from '../types/errors.js';

// ─── Request ID Middleware ───────────────────────────────────────────────────

/**
 * Middleware that attaches a unique request ID to each incoming request.
 * The ID is stored on `req.headers['x-request-id']` and also set as a response header.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

// ─── Error Code to HTTP Status Mapping ───────────────────────────────────────

/**
 * Maps a domain ErrorCode to the appropriate HTTP status code.
 *
 * - 400: Validation/input errors
 * - 403: Permission errors (built-in template readonly)
 * - 404: Resource not found
 * - 408: Timeout errors
 * - 409: Conflict/limit errors
 * - 500: Internal/system errors
 */
export function getHttpStatusForErrorCode(code: ErrorCode): number {
  switch (code) {
    // 400 Bad Request — validation/input errors
    case ErrorCode.PROMPT_EMPTY:
    case ErrorCode.PROMPT_TOO_LONG:
    case ErrorCode.FORMAT_UNSUPPORTED:
    case ErrorCode.DIAGRAM_TYPE_UNSUPPORTED:
    case ErrorCode.ATTACHMENT_TOO_LARGE:
    case ErrorCode.ATTACHMENT_TYPE_UNSUPPORTED:
    case ErrorCode.ATTACHMENT_EMPTY:
    case ErrorCode.ATTACHMENT_CORRUPT:
    case ErrorCode.ATTACHMENT_LIMIT_EXCEEDED:
    case ErrorCode.TEMPLATE_INVALID:
    case ErrorCode.TEMPLATE_INCOMPATIBLE:
    case ErrorCode.TEMPLATE_LIMIT_REACHED:
    case ErrorCode.DOCUMENT_TOO_LONG:
      return 400;

    // 403 Forbidden — permission errors
    case ErrorCode.TEMPLATE_BUILTIN_READONLY:
      return 403;

    // 404 Not Found — resource not found
    case ErrorCode.SESSION_NOT_FOUND:
    case ErrorCode.TEMPLATE_NOT_FOUND:
      return 404;

    // 408 Request Timeout
    case ErrorCode.GENERATION_TIMEOUT:
      return 408;

    // 409 Conflict — limit/state errors
    case ErrorCode.SESSION_LIMIT_REACHED:
    case ErrorCode.UNDO_NOT_AVAILABLE:
      return 409;

    // 500 Internal Server Error — system/generation failures
    case ErrorCode.INTERNAL_ERROR:
    case ErrorCode.GENERATION_FAILED:
    case ErrorCode.RENDER_SYNTAX_ERROR:
    case ErrorCode.RENDER_FAILED:
      return 500;

    default:
      return 500;
  }
}

// ─── Error Handler Middleware ────────────────────────────────────────────────

/**
 * Express error-handling middleware.
 * Catches errors thrown in route handlers and returns a structured ErrorResponse.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const timestamp = new Date().toISOString();

  // Extract error details
  const error = err as {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };

  const errorCode: ErrorCode =
    error.code && Object.values(ErrorCode).includes(error.code as ErrorCode)
      ? (error.code as ErrorCode)
      : ErrorCode.INTERNAL_ERROR;

  const message = error.message || 'An unexpected error occurred';
  const details = error.details;
  const statusCode = getHttpStatusForErrorCode(errorCode);

  const response: ErrorResponse = {
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {}),
    },
    timestamp,
    requestId,
  };

  res.status(statusCode).json(response);
}
