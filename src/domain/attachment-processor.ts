/**
 * Attachment Processor - validates and processes file attachments.
 * Handles file type, size, count, and empty file validation.
 * Also extracts content from attachments for AI generation context.
 */

import {
  type Attachment,
  type AttachmentContext,
  type ValidationResult,
  type ValidationError,
  SUPPORTED_FILE_EXTENSIONS,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS_PER_PROMPT,
  ErrorCode,
} from '../types/index.js';
import { analyzeImage, type ImageInput } from '../infrastructure/ai-client.js';

/**
 * Extracts the file extension from a filename (without the leading dot), lowercased.
 * Returns an empty string if no extension is found.
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Validates a single attachment for type, size, and emptiness.
 */
export function validate(attachment: Attachment): ValidationResult {
  const errors: ValidationError[] = [];

  // Check for empty file (0 bytes)
  if (attachment.size === 0) {
    errors.push({
      code: ErrorCode.ATTACHMENT_EMPTY,
      message: 'File is empty (0 bytes). Please attach a file with content.',
    });
    return { isValid: false, errors };
  }

  // Check file size (must be ≤ 10 MB)
  if (attachment.size > MAX_ATTACHMENT_SIZE) {
    errors.push({
      code: ErrorCode.ATTACHMENT_TOO_LARGE,
      message: `File exceeds the maximum allowed size of ${MAX_ATTACHMENT_SIZE / (1024 * 1024)} MB.`,
      details: {
        filename: attachment.filename,
        size: attachment.size,
        maxSize: MAX_ATTACHMENT_SIZE,
      },
    });
    return { isValid: false, errors };
  }

  // Check file type (extension must be in supported list)
  const extension = getFileExtension(attachment.filename);
  if (!extension || !SUPPORTED_FILE_EXTENSIONS.includes(extension)) {
    errors.push({
      code: ErrorCode.ATTACHMENT_TYPE_UNSUPPORTED,
      message: `File type "${extension || '(none)'}" is not supported. Supported types: ${SUPPORTED_FILE_EXTENSIONS.join(', ')}.`,
      details: {
        filename: attachment.filename,
        extension: extension || null,
        supportedExtensions: SUPPORTED_FILE_EXTENSIONS,
      },
    });
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validates an array of attachments, checking the count limit
 * and then validating each individual attachment.
 */
export function validateAll(attachments: Attachment[]): ValidationResult {
  const errors: ValidationError[] = [];

  // Check attachment count limit
  if (attachments.length > MAX_ATTACHMENTS_PER_PROMPT) {
    errors.push({
      code: ErrorCode.ATTACHMENT_LIMIT_EXCEEDED,
      message: `Too many attachments. Maximum ${MAX_ATTACHMENTS_PER_PROMPT} attachments per prompt allowed.`,
      details: {
        count: attachments.length,
        maxCount: MAX_ATTACHMENTS_PER_PROMPT,
      },
    });
    return { isValid: false, errors };
  }

  // Validate each attachment individually
  for (const attachment of attachments) {
    const result = validate(attachment);
    if (!result.isValid) {
      errors.push(...result.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ─── File Category Helpers ───────────────────────────────────────────────────

/** Image file extensions that should be passed as binary data. */
const IMAGE_EXTENSIONS = ['png', 'jpeg', 'jpg'];

/** Text-based file extensions (plain text, markdown, source code). */
const TEXT_EXTENSIONS = [
  'txt', 'md',
  'py', 'js', 'ts', 'java', 'c', 'cpp', 'go', 'rb', 'rs',
  'html', 'css', 'json', 'yaml', 'yml', 'xml', 'sh',
];

/** PDF file extension. */
const PDF_EXTENSIONS = ['pdf'];

/**
 * Checks if a file extension corresponds to an image file.
 */
function isImageFile(extension: string): boolean {
  return IMAGE_EXTENSIONS.includes(extension);
}

/**
 * Checks if a file extension corresponds to a text-based file.
 */
function isTextFile(extension: string): boolean {
  return TEXT_EXTENSIONS.includes(extension);
}

/**
 * Checks if a file extension corresponds to a PDF file.
 */
function isPdfFile(extension: string): boolean {
  return PDF_EXTENSIONS.includes(extension);
}

/**
 * Validates that a buffer contains valid UTF-8 text content.
 * Returns true if the buffer can be decoded as valid UTF-8 without replacement characters
 * that weren't in the original buffer.
 */
function isValidUtf8(buffer: Buffer): boolean {
  // Check for common binary indicators: null bytes in the first chunk
  // (text files rarely contain null bytes)
  const checkLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) {
      return false;
    }
  }
  return true;
}

// ─── Processing ──────────────────────────────────────────────────────────────

/**
 * Processes a single attachment and extracts context for AI generation.
 *
 * - Text files (.txt, .md, source code): Decoded as UTF-8 text → extractedText
 * - Image files (.png, .jpeg, .jpg): Stored as binary data → imageData
 * - PDF files: MVP approach — attempt text extraction from buffer, otherwise metadata-only
 * - Handles corrupt, encoding-error, and password-protected files with ATTACHMENT_CORRUPT error
 *
 * @throws Error with code ATTACHMENT_CORRUPT for files that cannot be processed
 */
export async function process(attachment: Attachment): Promise<AttachmentContext> {
  const extension = getFileExtension(attachment.filename);

  // Image files: pass binary data for AI model context and attempt vision analysis
  if (isImageFile(extension)) {
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
    const imageInput: ImageInput = { data: attachment.content, mimeType };

    let extractedText: string | undefined;
    try {
      extractedText = await analyzeImage(
        'Describe this image in detail, including any diagrams, architecture, text labels, and relationships visible.',
        imageInput,
      );
    } catch {
      // If vision analysis fails, fall back to imageData only (no extractedText)
    }

    return {
      filename: attachment.filename,
      extractedText,
      imageData: attachment.content,
      metadata: {
        type: 'image',
        extension,
        mimeType: attachment.mimeType,
        size: String(attachment.size),
      },
    };
  }

  // Text-based files: decode as UTF-8
  if (isTextFile(extension)) {
    return processTextFile(attachment, extension);
  }

  // PDF files: MVP text extraction attempt
  if (isPdfFile(extension)) {
    return processPdfFile(attachment);
  }

  // Fallback: return metadata-only for any other supported type
  return {
    filename: attachment.filename,
    metadata: {
      type: 'unknown',
      extension,
      mimeType: attachment.mimeType,
      size: String(attachment.size),
    },
  };
}

/**
 * Processes a text-based file by decoding its content as UTF-8.
 * Throws an error with ATTACHMENT_CORRUPT code if the file contains invalid encoding.
 */
function processTextFile(attachment: Attachment, extension: string): AttachmentContext {
  try {
    // Validate the buffer contains valid UTF-8 text
    if (!isValidUtf8(attachment.content)) {
      throw new ProcessingError(
        ErrorCode.ATTACHMENT_CORRUPT,
        `File "${attachment.filename}" appears to be binary or contains invalid encoding and cannot be processed as text.`,
        { filename: attachment.filename, reason: 'encoding-error' }
      );
    }

    const text = attachment.content.toString('utf-8');

    return {
      filename: attachment.filename,
      extractedText: text,
      metadata: {
        type: 'text',
        extension,
        mimeType: attachment.mimeType,
        size: String(attachment.size),
        charCount: String(text.length),
      },
    };
  } catch (error) {
    if (error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(
      ErrorCode.ATTACHMENT_CORRUPT,
      `File "${attachment.filename}" could not be processed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      { filename: attachment.filename, reason: 'corrupt' }
    );
  }
}

/**
 * Processes a PDF file. For MVP, attempts to detect if the PDF contains
 * readable text in its buffer. Full PDF extraction requires additional dependencies.
 * If the PDF appears to be password-protected or binary-only, returns metadata.
 */
function processPdfFile(attachment: Attachment): AttachmentContext {
  try {
    const bufferStr = attachment.content.toString('utf-8');

    // Check for PDF header magic bytes
    if (!bufferStr.startsWith('%PDF')) {
      throw new ProcessingError(
        ErrorCode.ATTACHMENT_CORRUPT,
        `File "${attachment.filename}" is not a valid PDF file.`,
        { filename: attachment.filename, reason: 'corrupt' }
      );
    }

    // Check for encryption/password protection indicators
    if (bufferStr.includes('/Encrypt')) {
      throw new ProcessingError(
        ErrorCode.ATTACHMENT_CORRUPT,
        `File "${attachment.filename}" is password-protected and cannot be processed.`,
        { filename: attachment.filename, reason: 'password-protected' }
      );
    }

    // MVP: Try to extract simple text streams from the PDF buffer.
    // This works for text-based PDFs but not for scanned/image PDFs.
    const extractedText = extractPdfTextStreams(bufferStr);

    if (extractedText) {
      return {
        filename: attachment.filename,
        extractedText,
        metadata: {
          type: 'pdf',
          extension: 'pdf',
          mimeType: attachment.mimeType,
          size: String(attachment.size),
          extractionMethod: 'buffer-text-stream',
          charCount: String(extractedText.length),
        },
      };
    }

    // If no text could be extracted, return metadata-only result
    return {
      filename: attachment.filename,
      metadata: {
        type: 'pdf',
        extension: 'pdf',
        mimeType: attachment.mimeType,
        size: String(attachment.size),
        extractionMethod: 'metadata-only',
        note: 'PDF text extraction requires specialized processing. Content may be image-based.',
      },
    };
  } catch (error) {
    if (error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(
      ErrorCode.ATTACHMENT_CORRUPT,
      `File "${attachment.filename}" could not be processed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      { filename: attachment.filename, reason: 'corrupt' }
    );
  }
}

/**
 * Attempts to extract text content from PDF text streams.
 * This is a simple MVP approach that looks for BT...ET (Begin Text / End Text) blocks
 * and extracts parenthesized text strings.
 * Returns null if no meaningful text is found.
 */
function extractPdfTextStreams(pdfContent: string): string | null {
  const textBlocks: string[] = [];

  // Match text between parentheses in BT...ET blocks (PDF text objects)
  const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
  let btMatch: RegExpExecArray | null;

  while ((btMatch = btEtRegex.exec(pdfContent)) !== null) {
    const block = btMatch[1];
    // Extract text strings from Tj and TJ operators
    const textRegex = /\(([^)]*)\)/g;
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textRegex.exec(block)) !== null) {
      const text = textMatch[1].trim();
      if (text.length > 0) {
        textBlocks.push(text);
      }
    }
  }

  if (textBlocks.length === 0) {
    return null;
  }

  return textBlocks.join(' ');
}

// ─── Error Class ─────────────────────────────────────────────────────────────

/**
 * Custom error class for attachment processing failures.
 * Includes an error code and optional details for structured error handling.
 */
export class ProcessingError extends Error {
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ProcessingError';
    this.code = code;
    this.details = details;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Returns the list of supported file extensions for attachments.
 */
export function getSupportedTypes(): string[] {
  return SUPPORTED_FILE_EXTENSIONS;
}
