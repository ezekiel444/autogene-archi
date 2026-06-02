import { describe, it, expect } from 'vitest';
import { validate, validateAll, process, getSupportedTypes, ProcessingError } from '../../src/domain/attachment-processor.js';
import {
  type Attachment,
  ErrorCode,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS_PER_PROMPT,
  SUPPORTED_FILE_EXTENSIONS,
} from '../../src/types/index.js';

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    filename: 'test.txt',
    mimeType: 'text/plain',
    size: 100,
    content: Buffer.from('hello'),
    ...overrides,
  };
}

describe('AttachmentProcessor - validate', () => {
  it('accepts a valid text file', () => {
    const result = validate(makeAttachment());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts all supported file extensions', () => {
    for (const ext of SUPPORTED_FILE_EXTENSIONS) {
      const result = validate(makeAttachment({ filename: `file.${ext}` }));
      expect(result.isValid).toBe(true);
    }
  });

  it('rejects an empty (0-byte) file', () => {
    const result = validate(makeAttachment({ size: 0 }));
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe(ErrorCode.ATTACHMENT_EMPTY);
  });

  it('rejects a file exceeding 10 MB', () => {
    const result = validate(makeAttachment({ size: MAX_ATTACHMENT_SIZE + 1 }));
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe(ErrorCode.ATTACHMENT_TOO_LARGE);
  });

  it('accepts a file exactly at the 10 MB limit', () => {
    const result = validate(makeAttachment({ size: MAX_ATTACHMENT_SIZE }));
    expect(result.isValid).toBe(true);
  });

  it('rejects an unsupported file type', () => {
    const result = validate(makeAttachment({ filename: 'file.exe' }));
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe(ErrorCode.ATTACHMENT_TYPE_UNSUPPORTED);
  });

  it('rejects a file with no extension', () => {
    const result = validate(makeAttachment({ filename: 'README' }));
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe(ErrorCode.ATTACHMENT_TYPE_UNSUPPORTED);
  });

  it('handles case-insensitive extensions', () => {
    const result = validate(makeAttachment({ filename: 'image.PNG' }));
    expect(result.isValid).toBe(true);
  });
});

describe('AttachmentProcessor - validateAll', () => {
  it('accepts 0 attachments', () => {
    const result = validateAll([]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts up to 5 valid attachments', () => {
    const attachments = Array.from({ length: MAX_ATTACHMENTS_PER_PROMPT }, (_, i) =>
      makeAttachment({ filename: `file${i}.txt` })
    );
    const result = validateAll(attachments);
    expect(result.isValid).toBe(true);
  });

  it('rejects more than 5 attachments', () => {
    const attachments = Array.from({ length: MAX_ATTACHMENTS_PER_PROMPT + 1 }, (_, i) =>
      makeAttachment({ filename: `file${i}.txt` })
    );
    const result = validateAll(attachments);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe(ErrorCode.ATTACHMENT_LIMIT_EXCEEDED);
  });

  it('reports individual attachment errors', () => {
    const attachments = [
      makeAttachment({ filename: 'valid.ts' }),
      makeAttachment({ filename: 'bad.exe' }),
    ];
    const result = validateAll(attachments);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe(ErrorCode.ATTACHMENT_TYPE_UNSUPPORTED);
  });

  it('collects errors from multiple invalid attachments', () => {
    const attachments = [
      makeAttachment({ size: 0 }),
      makeAttachment({ filename: 'bad.zip' }),
    ];
    const result = validateAll(attachments);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

describe('AttachmentProcessor - process', () => {
  describe('text file extraction', () => {
    it('extracts text content from a .txt file', async () => {
      const content = 'Hello, world!';
      const attachment = makeAttachment({
        filename: 'readme.txt',
        mimeType: 'text/plain',
        size: Buffer.byteLength(content),
        content: Buffer.from(content, 'utf-8'),
      });

      const result = await process(attachment);

      expect(result.filename).toBe('readme.txt');
      expect(result.extractedText).toBe(content);
      expect(result.imageData).toBeUndefined();
      expect(result.metadata.type).toBe('text');
      expect(result.metadata.extension).toBe('txt');
    });

    it('extracts text content from a .md file', async () => {
      const content = '# Title\n\nSome markdown content.';
      const attachment = makeAttachment({
        filename: 'doc.md',
        mimeType: 'text/markdown',
        size: Buffer.byteLength(content),
        content: Buffer.from(content, 'utf-8'),
      });

      const result = await process(attachment);

      expect(result.filename).toBe('doc.md');
      expect(result.extractedText).toBe(content);
      expect(result.metadata.type).toBe('text');
      expect(result.metadata.extension).toBe('md');
    });

    it('extracts text content from source code files', async () => {
      const content = 'function hello() { return "world"; }';
      const attachment = makeAttachment({
        filename: 'index.js',
        mimeType: 'application/javascript',
        size: Buffer.byteLength(content),
        content: Buffer.from(content, 'utf-8'),
      });

      const result = await process(attachment);

      expect(result.filename).toBe('index.js');
      expect(result.extractedText).toBe(content);
      expect(result.metadata.type).toBe('text');
      expect(result.metadata.extension).toBe('js');
    });

    it('handles multi-line text content correctly', async () => {
      const content = 'line1\nline2\nline3\n';
      const attachment = makeAttachment({
        filename: 'data.txt',
        mimeType: 'text/plain',
        size: Buffer.byteLength(content),
        content: Buffer.from(content, 'utf-8'),
      });

      const result = await process(attachment);

      expect(result.extractedText).toBe(content);
    });

    it('throws ProcessingError for binary content in text file', async () => {
      // Create a buffer with null bytes (binary indicator)
      const binaryContent = Buffer.alloc(100);
      binaryContent[0] = 0x48; // 'H'
      binaryContent[1] = 0x00; // null byte - binary indicator

      const attachment = makeAttachment({
        filename: 'corrupt.txt',
        mimeType: 'text/plain',
        size: binaryContent.length,
        content: binaryContent,
      });

      await expect(process(attachment)).rejects.toThrow(ProcessingError);
      await expect(process(attachment)).rejects.toMatchObject({
        code: ErrorCode.ATTACHMENT_CORRUPT,
      });
    });
  });

  describe('image file handling', () => {
    it('passes PNG image as binary data in imageData field', async () => {
      const imageBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A]);
      const attachment = makeAttachment({
        filename: 'diagram.png',
        mimeType: 'image/png',
        size: imageBuffer.length,
        content: imageBuffer,
      });

      const result = await process(attachment);

      expect(result.filename).toBe('diagram.png');
      expect(result.imageData).toBe(imageBuffer);
      expect(result.extractedText).toBeUndefined();
      expect(result.metadata.type).toBe('image');
      expect(result.metadata.extension).toBe('png');
    });

    it('passes JPEG image as binary data in imageData field', async () => {
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const attachment = makeAttachment({
        filename: 'photo.jpeg',
        mimeType: 'image/jpeg',
        size: imageBuffer.length,
        content: imageBuffer,
      });

      const result = await process(attachment);

      expect(result.filename).toBe('photo.jpeg');
      expect(result.imageData).toBe(imageBuffer);
      expect(result.extractedText).toBeUndefined();
      expect(result.metadata.type).toBe('image');
      expect(result.metadata.extension).toBe('jpeg');
    });

    it('passes JPG image as binary data in imageData field', async () => {
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]);
      const attachment = makeAttachment({
        filename: 'screenshot.jpg',
        mimeType: 'image/jpeg',
        size: imageBuffer.length,
        content: imageBuffer,
      });

      const result = await process(attachment);

      expect(result.filename).toBe('screenshot.jpg');
      expect(result.imageData).toBe(imageBuffer);
      expect(result.metadata.type).toBe('image');
      expect(result.metadata.extension).toBe('jpg');
    });
  });

  describe('PDF file handling', () => {
    it('extracts text from a simple PDF with text streams', async () => {
      const pdfContent = '%PDF-1.4\nBT\n(Hello PDF World) Tj\nET\n%%EOF';
      const attachment = makeAttachment({
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        size: Buffer.byteLength(pdfContent),
        content: Buffer.from(pdfContent, 'utf-8'),
      });

      const result = await process(attachment);

      expect(result.filename).toBe('document.pdf');
      expect(result.extractedText).toBe('Hello PDF World');
      expect(result.metadata.type).toBe('pdf');
      expect(result.metadata.extension).toBe('pdf');
    });

    it('returns metadata-only for PDFs without extractable text', async () => {
      const pdfContent = '%PDF-1.4\nsome binary image data\n%%EOF';
      const attachment = makeAttachment({
        filename: 'scanned.pdf',
        mimeType: 'application/pdf',
        size: Buffer.byteLength(pdfContent),
        content: Buffer.from(pdfContent, 'utf-8'),
      });

      const result = await process(attachment);

      expect(result.filename).toBe('scanned.pdf');
      expect(result.extractedText).toBeUndefined();
      expect(result.metadata.type).toBe('pdf');
      expect(result.metadata.extractionMethod).toBe('metadata-only');
    });

    it('throws ProcessingError for invalid PDF (missing header)', async () => {
      const invalidPdf = 'This is not a PDF file';
      const attachment = makeAttachment({
        filename: 'fake.pdf',
        mimeType: 'application/pdf',
        size: Buffer.byteLength(invalidPdf),
        content: Buffer.from(invalidPdf, 'utf-8'),
      });

      await expect(process(attachment)).rejects.toThrow(ProcessingError);
      await expect(process(attachment)).rejects.toMatchObject({
        code: ErrorCode.ATTACHMENT_CORRUPT,
      });
    });

    it('throws ProcessingError for password-protected PDF', async () => {
      const encryptedPdf = '%PDF-1.4\n/Encrypt some encryption dict\n%%EOF';
      const attachment = makeAttachment({
        filename: 'protected.pdf',
        mimeType: 'application/pdf',
        size: Buffer.byteLength(encryptedPdf),
        content: Buffer.from(encryptedPdf, 'utf-8'),
      });

      await expect(process(attachment)).rejects.toThrow(ProcessingError);
      await expect(process(attachment)).rejects.toMatchObject({
        code: ErrorCode.ATTACHMENT_CORRUPT,
      });
    });
  });

  describe('error handling', () => {
    it('ProcessingError has correct code and details', async () => {
      const binaryContent = Buffer.alloc(50);
      binaryContent[5] = 0x00; // null byte

      const attachment = makeAttachment({
        filename: 'broken.txt',
        mimeType: 'text/plain',
        size: binaryContent.length,
        content: binaryContent,
      });

      try {
        await process(attachment);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessingError);
        const procError = error as InstanceType<typeof ProcessingError>;
        expect(procError.code).toBe(ErrorCode.ATTACHMENT_CORRUPT);
        expect(procError.details.filename).toBe('broken.txt');
      }
    });
  });
});

describe('AttachmentProcessor - getSupportedTypes', () => {
  it('returns the list of supported file extensions', () => {
    const types = getSupportedTypes();
    expect(types).toEqual(SUPPORTED_FILE_EXTENSIONS);
  });

  it('includes image extensions', () => {
    const types = getSupportedTypes();
    expect(types).toContain('png');
    expect(types).toContain('jpeg');
    expect(types).toContain('jpg');
  });

  it('includes text and markdown extensions', () => {
    const types = getSupportedTypes();
    expect(types).toContain('txt');
    expect(types).toContain('md');
  });

  it('includes source code extensions', () => {
    const types = getSupportedTypes();
    expect(types).toContain('py');
    expect(types).toContain('js');
    expect(types).toContain('ts');
    expect(types).toContain('java');
  });

  it('includes pdf extension', () => {
    const types = getSupportedTypes();
    expect(types).toContain('pdf');
  });
});
