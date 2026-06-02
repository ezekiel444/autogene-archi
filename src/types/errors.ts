/**
 * Error codes for the AI Diagram & Document Generator.
 * Maps to specific validation failures and system errors.
 */
export enum ErrorCode {
  // Prompt errors
  PROMPT_EMPTY = 'PROMPT_EMPTY',
  PROMPT_TOO_LONG = 'PROMPT_TOO_LONG',

  // Format errors
  FORMAT_UNSUPPORTED = 'FORMAT_UNSUPPORTED',
  DIAGRAM_TYPE_UNSUPPORTED = 'DIAGRAM_TYPE_UNSUPPORTED',

  // Generation errors
  GENERATION_TIMEOUT = 'GENERATION_TIMEOUT',
  GENERATION_FAILED = 'GENERATION_FAILED',

  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_LIMIT_REACHED = 'SESSION_LIMIT_REACHED',
  UNDO_NOT_AVAILABLE = 'UNDO_NOT_AVAILABLE',

  // Attachment errors
  ATTACHMENT_TOO_LARGE = 'ATTACHMENT_TOO_LARGE',
  ATTACHMENT_TYPE_UNSUPPORTED = 'ATTACHMENT_TYPE_UNSUPPORTED',
  ATTACHMENT_EMPTY = 'ATTACHMENT_EMPTY',
  ATTACHMENT_CORRUPT = 'ATTACHMENT_CORRUPT',
  ATTACHMENT_LIMIT_EXCEEDED = 'ATTACHMENT_LIMIT_EXCEEDED',

  // Template errors
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  TEMPLATE_INCOMPATIBLE = 'TEMPLATE_INCOMPATIBLE',
  TEMPLATE_INVALID = 'TEMPLATE_INVALID',
  TEMPLATE_LIMIT_REACHED = 'TEMPLATE_LIMIT_REACHED',
  TEMPLATE_BUILTIN_READONLY = 'TEMPLATE_BUILTIN_READONLY',

  // Document errors
  DOCUMENT_TOO_LONG = 'DOCUMENT_TOO_LONG',

  // Rendering errors
  RENDER_SYNTAX_ERROR = 'RENDER_SYNTAX_ERROR',
  RENDER_FAILED = 'RENDER_FAILED',

  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Structured error response returned by the API.
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  requestId: string;
}
