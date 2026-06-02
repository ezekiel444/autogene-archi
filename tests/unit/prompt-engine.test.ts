import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateInput, classifyPrompt, extractCodeStructure, submitRequest, PromptEngineError } from '@/application/prompt-engine.js';
import { ErrorCode, MAX_PROMPT_LENGTH, CLASSIFICATION_CONFIDENCE_THRESHOLD } from '@/types/index.js';

// Mock the AI client module
vi.mock('@/infrastructure/ai-client.js', () => ({
  generateText: vi.fn(),
}));

import { generateText } from '@/infrastructure/ai-client.js';
const mockGenerateText = vi.mocked(generateText);

describe('PromptEngine - validateInput', () => {
  describe('valid prompts', () => {
    it('accepts a simple valid prompt', () => {
      const result = validateInput({ prompt: 'Create a flowchart' });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a prompt at exactly the max length', () => {
      const prompt = 'a'.repeat(MAX_PROMPT_LENGTH);
      const result = validateInput({ prompt });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a single non-whitespace character', () => {
      const result = validateInput({ prompt: 'x' });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a prompt with leading/trailing whitespace but non-whitespace content', () => {
      const result = validateInput({ prompt: '  hello  ' });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('empty/whitespace-only prompts', () => {
    it('rejects an empty string', () => {
      const result = validateInput({ prompt: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ErrorCode.PROMPT_EMPTY);
    });

    it('rejects a whitespace-only string (spaces)', () => {
      const result = validateInput({ prompt: '     ' });
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.PROMPT_EMPTY);
    });

    it('rejects a whitespace-only string (tabs and newlines)', () => {
      const result = validateInput({ prompt: '\t\n\r\n\t  ' });
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.PROMPT_EMPTY);
    });
  });

  describe('prompt too long', () => {
    it('rejects a prompt exceeding max length', () => {
      const prompt = 'a'.repeat(MAX_PROMPT_LENGTH + 1);
      const result = validateInput({ prompt });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ErrorCode.PROMPT_TOO_LONG);
      expect(result.errors[0].details?.maxLength).toBe(MAX_PROMPT_LENGTH);
      expect(result.errors[0].details?.actualLength).toBe(MAX_PROMPT_LENGTH + 1);
    });
  });

  describe('output format validation', () => {
    it('accepts valid output format "mermaid"', () => {
      const result = validateInput({ prompt: 'Draw a diagram', outputFormat: 'mermaid' });
      expect(result.isValid).toBe(true);
    });

    it('accepts valid output format "plantuml"', () => {
      const result = validateInput({ prompt: 'Draw a diagram', outputFormat: 'plantuml' });
      expect(result.isValid).toBe(true);
    });

    it('rejects an unsupported output format', () => {
      const result = validateInput({
        prompt: 'Draw a diagram',
        outputFormat: 'graphviz' as any,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ErrorCode.FORMAT_UNSUPPORTED);
    });

    it('does not validate output format if not provided', () => {
      const result = validateInput({ prompt: 'Draw a diagram' });
      expect(result.isValid).toBe(true);
    });
  });

  describe('diagram type validation', () => {
    it('accepts valid diagram type "flowchart"', () => {
      const result = validateInput({ prompt: 'Draw a diagram', diagramType: 'flowchart' });
      expect(result.isValid).toBe(true);
    });

    it('accepts valid diagram type "er-diagram"', () => {
      const result = validateInput({ prompt: 'Draw a diagram', diagramType: 'er-diagram' });
      expect(result.isValid).toBe(true);
    });

    it('rejects an unsupported diagram type', () => {
      const result = validateInput({
        prompt: 'Draw a diagram',
        diagramType: 'pie-chart' as any,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ErrorCode.DIAGRAM_TYPE_UNSUPPORTED);
    });

    it('does not validate diagram type if not provided', () => {
      const result = validateInput({ prompt: 'Draw a diagram' });
      expect(result.isValid).toBe(true);
    });
  });

  describe('multiple validation errors', () => {
    it('returns multiple errors for an oversized prompt with invalid format and type', () => {
      const result = validateInput({
        prompt: 'a'.repeat(MAX_PROMPT_LENGTH + 1),
        outputFormat: 'invalid' as any,
        diagramType: 'invalid' as any,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain(ErrorCode.PROMPT_TOO_LONG);
      expect(codes).toContain(ErrorCode.FORMAT_UNSUPPORTED);
      expect(codes).toContain(ErrorCode.DIAGRAM_TYPE_UNSUPPORTED);
    });

    it('returns only PROMPT_EMPTY for empty prompt even with invalid format', () => {
      // Empty prompt short-circuits — only PROMPT_EMPTY is returned
      const result = validateInput({
        prompt: '',
        outputFormat: 'invalid' as any,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ErrorCode.PROMPT_EMPTY);
    });
  });
});


describe('PromptEngine - classifyPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('diagram classification', () => {
    it('classifies a diagram prompt correctly', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'diagram',
          confidence: 0.95,
          inferredDiagramType: 'flowchart',
          inferredDocumentType: null,
        }),
      );

      const result = await classifyPrompt('Create a flowchart showing user login process');

      expect(result.type).toBe('diagram');
      expect(result.confidence).toBe(0.95);
      expect(result.inferredDiagramType).toBe('flowchart');
      expect(result.inferredDocumentType).toBeUndefined();
    });

    it('classifies a sequence diagram prompt', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'diagram',
          confidence: 0.9,
          inferredDiagramType: 'sequence',
          inferredDocumentType: null,
        }),
      );

      const result = await classifyPrompt('Show the interaction between client and server');

      expect(result.type).toBe('diagram');
      expect(result.inferredDiagramType).toBe('sequence');
    });
  });

  describe('document classification', () => {
    it('classifies a document prompt correctly', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'document',
          confidence: 0.92,
          inferredDiagramType: null,
          inferredDocumentType: 'api-documentation',
        }),
      );

      const result = await classifyPrompt('Write API documentation for our REST endpoints');

      expect(result.type).toBe('document');
      expect(result.confidence).toBe(0.92);
      expect(result.inferredDocumentType).toBe('api-documentation');
      expect(result.inferredDiagramType).toBeUndefined();
    });

    it('classifies a design document prompt', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'document',
          confidence: 0.88,
          inferredDiagramType: null,
          inferredDocumentType: 'design-document',
        }),
      );

      const result = await classifyPrompt('Write a design document for our microservice architecture');

      expect(result.type).toBe('document');
      expect(result.inferredDocumentType).toBe('design-document');
    });
  });

  describe('ambiguous classification', () => {
    it('returns ambiguous when AI classifies as ambiguous', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'ambiguous',
          confidence: 0.4,
          inferredDiagramType: null,
          inferredDocumentType: null,
        }),
      );

      const result = await classifyPrompt('authentication system');

      expect(result.type).toBe('ambiguous');
      expect(result.confidence).toBe(0.4);
    });

    it('returns ambiguous when confidence is below threshold', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'diagram',
          confidence: 0.5,
          inferredDiagramType: 'flowchart',
          inferredDocumentType: null,
        }),
      );

      const result = await classifyPrompt('something about a process');

      expect(result.type).toBe('ambiguous');
      expect(result.confidence).toBe(0.5);
    });

    it('returns ambiguous with confidence exactly at threshold boundary', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'diagram',
          confidence: CLASSIFICATION_CONFIDENCE_THRESHOLD - 0.01,
          inferredDiagramType: 'flowchart',
          inferredDocumentType: null,
        }),
      );

      const result = await classifyPrompt('some process');

      expect(result.type).toBe('ambiguous');
    });

    it('accepts classification at exactly the threshold', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'diagram',
          confidence: CLASSIFICATION_CONFIDENCE_THRESHOLD,
          inferredDiagramType: 'flowchart',
          inferredDocumentType: null,
        }),
      );

      const result = await classifyPrompt('create a flowchart');

      expect(result.type).toBe('diagram');
      expect(result.confidence).toBe(CLASSIFICATION_CONFIDENCE_THRESHOLD);
    });
  });

  describe('error handling', () => {
    it('returns ambiguous when AI client throws an error', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'));

      const result = await classifyPrompt('Create a flowchart');

      expect(result.type).toBe('ambiguous');
      expect(result.confidence).toBe(0);
    });

    it('returns ambiguous when AI returns invalid JSON', async () => {
      mockGenerateText.mockResolvedValue('This is not valid JSON at all');

      const result = await classifyPrompt('Create a flowchart');

      expect(result.type).toBe('ambiguous');
      expect(result.confidence).toBe(0);
    });

    it('returns ambiguous when AI returns invalid type value', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'invalid_type',
          confidence: 0.9,
          inferredDiagramType: null,
          inferredDocumentType: null,
        }),
      );

      const result = await classifyPrompt('Create something');

      expect(result.type).toBe('ambiguous');
      expect(result.confidence).toBe(0);
    });

    it('handles JSON wrapped in markdown code blocks', async () => {
      mockGenerateText.mockResolvedValue(
        '```json\n{"type":"diagram","confidence":0.9,"inferredDiagramType":"flowchart","inferredDocumentType":null}\n```',
      );

      const result = await classifyPrompt('Create a flowchart');

      expect(result.type).toBe('diagram');
      expect(result.confidence).toBe(0.9);
      expect(result.inferredDiagramType).toBe('flowchart');
    });

    it('clamps confidence values above 1.0 to 1.0', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'diagram',
          confidence: 1.5,
          inferredDiagramType: 'flowchart',
          inferredDocumentType: null,
        }),
      );

      const result = await classifyPrompt('Create a flowchart');

      expect(result.confidence).toBe(1);
    });

    it('clamps negative confidence values to 0', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'diagram',
          confidence: -0.5,
          inferredDiagramType: 'flowchart',
          inferredDocumentType: null,
        }),
      );

      const result = await classifyPrompt('Create a flowchart');

      // Negative confidence is below threshold, so should be ambiguous
      expect(result.type).toBe('ambiguous');
      expect(result.confidence).toBe(0);
    });

    it('ignores invalid inferred diagram type', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'diagram',
          confidence: 0.9,
          inferredDiagramType: 'pie-chart',
          inferredDocumentType: null,
        }),
      );

      const result = await classifyPrompt('Create a pie chart');

      expect(result.type).toBe('diagram');
      expect(result.inferredDiagramType).toBeUndefined();
    });

    it('ignores invalid inferred document type', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'document',
          confidence: 0.85,
          inferredDiagramType: null,
          inferredDocumentType: 'blog-post',
        }),
      );

      const result = await classifyPrompt('Write a blog post');

      expect(result.type).toBe('document');
      expect(result.inferredDocumentType).toBeUndefined();
    });
  });

  describe('AI client interaction', () => {
    it('passes correct messages to the AI client', async () => {
      mockGenerateText.mockResolvedValue(
        JSON.stringify({
          type: 'diagram',
          confidence: 0.9,
          inferredDiagramType: 'flowchart',
          inferredDocumentType: null,
        }),
      );

      await classifyPrompt('Create a flowchart');

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      const [messages, options] = mockGenerateText.mock.calls[0];
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Create a flowchart');
      expect(options?.temperature).toBe(0.1);
      expect(options?.maxTokens).toBe(256);
    });
  });
});


describe('PromptEngine - extractCodeStructure', () => {
  it('returns null for text without code patterns', () => {
    const result = extractCodeStructure('Create a flowchart for user login');
    expect(result).toBeNull();
  });

  it('extracts class declarations', () => {
    const code = `
      class UserService {
        getUser() {}
      }
      export class AuthController extends BaseController implements Serializable {
        login() {}
      }
    `;
    const result = extractCodeStructure(code);
    expect(result).not.toBeNull();
    expect(result!.classes).toContain('UserService');
    expect(result!.classes).toContain('AuthController');
  });

  it('extracts function declarations', () => {
    const code = `
      function processOrder(order) { }
      export async function handlePayment(amount) { }
    `;
    const result = extractCodeStructure(code);
    expect(result).not.toBeNull();
    expect(result!.functions).toContain('processOrder');
    expect(result!.functions).toContain('handlePayment');
  });

  it('extracts interface and type declarations', () => {
    const code = `
      interface UserRepository {
        findById(id: string): User;
      }
      export type PaymentResult = { status: string };
    `;
    const result = extractCodeStructure(code);
    expect(result).not.toBeNull();
    expect(result!.interfaces).toContain('UserRepository');
    expect(result!.interfaces).toContain('PaymentResult');
  });

  it('extracts class relationships (extends/implements)', () => {
    const code = `class Dog extends Animal implements Pet, Trainable {}`;
    const result = extractCodeStructure(code);
    expect(result).not.toBeNull();
    expect(result!.relationships).toContain('Dog extends Animal');
    expect(result!.relationships).toContain('Dog implements Pet');
    expect(result!.relationships).toContain('Dog implements Trainable');
  });

  it('extracts abstract classes', () => {
    const code = `export abstract class BaseRepository {}`;
    const result = extractCodeStructure(code);
    expect(result).not.toBeNull();
    expect(result!.classes).toContain('BaseRepository');
  });
});


describe('PromptEngine - submitRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws PromptEngineError for empty prompt', async () => {
    await expect(submitRequest({ prompt: '' })).rejects.toThrow(PromptEngineError);
    await expect(submitRequest({ prompt: '' })).rejects.toMatchObject({
      code: ErrorCode.PROMPT_EMPTY,
    });
  });

  it('throws PromptEngineError for prompt exceeding max length', async () => {
    const longPrompt = 'a'.repeat(MAX_PROMPT_LENGTH + 1);
    await expect(submitRequest({ prompt: longPrompt })).rejects.toThrow(PromptEngineError);
    await expect(submitRequest({ prompt: longPrompt })).rejects.toMatchObject({
      code: ErrorCode.PROMPT_TOO_LONG,
    });
  });

  it('throws PromptEngineError for unsupported output format', async () => {
    await expect(
      submitRequest({ prompt: 'test', outputFormat: 'graphviz' as any }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORMAT_UNSUPPORTED,
    });
  });

  it('returns clarification response for ambiguous classification', async () => {
    // Mock AI to return ambiguous classification
    mockGenerateText.mockResolvedValue(
      JSON.stringify({
        type: 'ambiguous',
        confidence: 0.3,
        inferredDiagramType: null,
        inferredDocumentType: null,
      }),
    );

    // Use mock session manager that creates sessions
    const mockSessionManager = {
      createSession: vi.fn().mockResolvedValue({ id: 'test-session-id', exchanges: [], outputType: 'document', currentVersion: 0, createdAt: new Date(), updatedAt: new Date() }),
      getSession: vi.fn(),
      addExchange: vi.fn(),
    } as any;

    const result = await submitRequest(
      { prompt: 'authentication system' },
      { sessionManager: mockSessionManager },
    );

    expect(result.content).toContain('clarify');
    expect(result.sessionId).toBe('test-session-id');
  });

  it('routes diagram requests to diagram generator when diagramType is specified', async () => {
    // Mock AI to return diagram code
    mockGenerateText.mockResolvedValue('graph TD\n  A --> B');

    const mockSessionManager = {
      createSession: vi.fn().mockResolvedValue({ id: 'diagram-session', exchanges: [], outputType: 'diagram', currentVersion: 0, createdAt: new Date(), updatedAt: new Date() }),
      getSession: vi.fn(),
      addExchange: vi.fn().mockResolvedValue({ success: true }),
    } as any;

    const result = await submitRequest(
      { prompt: 'Create a login flowchart', diagramType: 'flowchart' },
      { sessionManager: mockSessionManager },
    );

    expect(result.outputType).toBe('diagram');
    expect(result.format).toBe('mermaid');
    expect(result.sessionId).toBe('diagram-session');
    expect(mockSessionManager.addExchange).toHaveBeenCalledOnce();
  });

  it('routes document requests when classified as document', async () => {
    // First call: classification returns document
    // Second call: document generation returns content
    mockGenerateText
      .mockResolvedValueOnce(
        JSON.stringify({
          type: 'document',
          confidence: 0.9,
          inferredDiagramType: null,
          inferredDocumentType: 'api-documentation',
        }),
      )
      .mockResolvedValueOnce(
        '# API Documentation\n\n## Endpoints\n\nGET /users returns a list of users.\n\n## Authentication\n\nUse Bearer token authentication.',
      );

    const mockSessionManager = {
      createSession: vi.fn().mockResolvedValue({ id: 'doc-session', exchanges: [], outputType: 'document', currentVersion: 0, createdAt: new Date(), updatedAt: new Date() }),
      getSession: vi.fn(),
      addExchange: vi.fn().mockResolvedValue({ success: true }),
    } as any;

    const result = await submitRequest(
      { prompt: 'Write API documentation for our REST endpoints' },
      { sessionManager: mockSessionManager },
    );

    expect(result.outputType).toBe('document');
    expect(result.sessionId).toBe('doc-session');
    expect(mockSessionManager.addExchange).toHaveBeenCalledOnce();
  });

  it('throws PromptEngineError for non-existent session', async () => {
    const mockSessionManager = {
      getSession: vi.fn().mockResolvedValue({ success: false, error: { code: ErrorCode.SESSION_NOT_FOUND, message: 'Session not found' } }),
    } as any;

    await expect(
      submitRequest(
        { prompt: 'Continue the diagram', sessionId: 'nonexistent' },
        { sessionManager: mockSessionManager },
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.SESSION_NOT_FOUND,
    });
  });

  it('throws PromptEngineError for invalid attachments', async () => {
    const invalidAttachment = {
      filename: 'test.exe',
      mimeType: 'application/octet-stream',
      size: 100,
      content: Buffer.from('binary data'),
    };

    await expect(
      submitRequest({ prompt: 'Analyze this file', attachments: [invalidAttachment] }),
    ).rejects.toMatchObject({
      code: ErrorCode.ATTACHMENT_TYPE_UNSUPPORTED,
    });
  });
});
