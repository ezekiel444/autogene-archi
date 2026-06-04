import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GenerationContext, DiagramType, OutputFormat } from '@/types/index.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGenerateText = vi.fn();

vi.mock('@/infrastructure/ai-client.js', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

// ─── Test Data ───────────────────────────────────────────────────────────────

const SIMPLE_DIAGRAM_JSON = JSON.stringify({
  nodes: [
    { id: 'start', label: 'Start', icon: 'default', group: 'flow', x: 100, y: 200 },
    { id: 'end', label: 'End', icon: 'default', group: 'flow', x: 350, y: 200 },
  ],
  connections: [
    { from: 'start', to: 'end', label: 'Next' },
  ],
  groups: [
    { id: 'flow', label: 'Flow', color: '#e3f2fd' },
  ],
});

const SEQUENCE_DIAGRAM_JSON = JSON.stringify({
  diagramType: 'sequence',
  nodes: [
    { id: 'alice', label: 'Alice', icon: 'user', x: 100, y: 100 },
    { id: 'bob', label: 'Bob', icon: 'user', x: 350, y: 100 },
  ],
  connections: [
    { from: 'alice', to: 'bob', label: 'Hello' },
  ],
  groups: [],
});

const ER_DIAGRAM_JSON = JSON.stringify({
  diagramType: 'er-diagram',
  nodes: [
    { id: 'customer', label: 'Customer', icon: 'database', x: 100, y: 100 },
    { id: 'order', label: 'Order', icon: 'database', x: 350, y: 100 },
  ],
  connections: [
    { from: 'customer', to: 'order', label: '1:N' },
  ],
  groups: [],
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Diagram Generator', () => {
  let generate: (prompt: string, context: GenerationContext) => Promise<any>;
  let refine: (prompt: string, existingCode: string, context: GenerationContext) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/domain/diagram-generator.js');
    generate = mod.generate;
    refine = mod.refine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generate', () => {
    it('returns DiagramResult with JSON code, format, and diagramType', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      const result = await generate('Create a simple flowchart', {
        diagramType: 'flowchart',
        outputFormat: 'mermaid',
      });

      expect(result).toEqual({
        code: SIMPLE_DIAGRAM_JSON,
        format: 'mermaid',
        diagramType: 'flowchart',
        isValid: true,
        validationErrors: undefined,
      });
    });

    it('defaults to mermaid format when no format specified', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      const result = await generate('Create a chart', {
        diagramType: 'flowchart',
      });

      expect(result.format).toBe('mermaid');
    });

    it('uses plantuml format when specified', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      const result = await generate('Create a sequence diagram', {
        diagramType: 'sequence',
        outputFormat: 'plantuml',
      });

      expect(result.format).toBe('plantuml');
    });

    it('strips markdown code fences from AI response', async () => {
      mockGenerateText.mockResolvedValue(
        '```json\n' + SIMPLE_DIAGRAM_JSON + '\n```',
      );

      const result = await generate('Create a flowchart', {
        diagramType: 'flowchart',
        outputFormat: 'mermaid',
      });

      expect(result.code).toBe(SIMPLE_DIAGRAM_JSON);
    });

    it('strips generic code fences from AI response', async () => {
      mockGenerateText.mockResolvedValue(
        '```\n' + SIMPLE_DIAGRAM_JSON + '\n```',
      );

      const result = await generate('Create a flowchart', {
        diagramType: 'flowchart',
        outputFormat: 'mermaid',
      });

      expect(result.code).toBe(SIMPLE_DIAGRAM_JSON);
    });

    it('infers diagram type from JSON diagramType field when not specified', async () => {
      mockGenerateText.mockResolvedValue(SEQUENCE_DIAGRAM_JSON);

      const result = await generate('Show how Alice talks to Bob', {});

      expect(result.diagramType).toBe('sequence');
    });

    it('defaults to flowchart when type inference fails', async () => {
      // JSON without diagramType field and no diagramType in context
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      const result = await generate('Make something', {});

      expect(result.diagramType).toBe('flowchart');
    });

    it('passes timeout to AI client', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      await generate('Create a flowchart', { diagramType: 'flowchart' });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          timeoutMs: 30_000,
        }),
      );
    });

    it('includes diagram type in system prompt when specified', async () => {
      mockGenerateText.mockResolvedValue(ER_DIAGRAM_JSON);

      await generate('Create an ER diagram', {
        diagramType: 'er-diagram',
        outputFormat: 'mermaid',
      });

      const systemMessage = mockGenerateText.mock.calls[0][0][0];
      expect(systemMessage.role).toBe('system');
      expect(systemMessage.content).toContain('er-diagram');
    });

    it('instructs AI to infer type when not specified', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      await generate('Show a process', {});

      const systemMessage = mockGenerateText.mock.calls[0][0][0];
      expect(systemMessage.content).toContain('Infer the most appropriate diagram type');
      expect(systemMessage.content).toContain('diagramType');
    });

    it('includes attachment context in prompt', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      await generate('Diagram this code', {
        diagramType: 'class-diagram',
        outputFormat: 'mermaid',
        attachmentContexts: [
          {
            filename: 'app.ts',
            extractedText: 'class Foo { bar(): void {} }',
            metadata: { language: 'typescript' },
          },
        ],
      });

      const userMessage = mockGenerateText.mock.calls[0][0][1];
      expect(userMessage.role).toBe('user');
      expect(userMessage.content).toContain('app.ts');
      expect(userMessage.content).toContain('class Foo { bar(): void {} }');
    });

    it('includes session history in prompt', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      await generate('Add a third node', {
        diagramType: 'flowchart',
        outputFormat: 'mermaid',
        sessionHistory: [
          {
            index: 0,
            prompt: 'Create a flowchart with two nodes',
            response: {
              content: SIMPLE_DIAGRAM_JSON,
              outputType: 'diagram',
              format: 'mermaid',
              diagramType: 'flowchart',
              sessionId: 'test-session',
              exchangeIndex: 0,
            },
            timestamp: new Date(),
          },
        ],
      });

      const userMessage = mockGenerateText.mock.calls[0][0][1];
      expect(userMessage.content).toContain('Create a flowchart with two nodes');
    });

    it('includes template constraints in system prompt', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      await generate('Create a flowchart', {
        diagramType: 'flowchart',
        outputFormat: 'mermaid',
        template: {
          id: 'test-template',
          name: 'Test Template',
          type: 'diagram',
          subType: 'flowchart',
          isBuiltIn: true,
          structure: {
            diagramConstraints: [
              {
                constraint: 'max-nodes',
                description: 'Limit diagram to 10 nodes maximum',
              },
              {
                constraint: 'direction',
                description: 'Use top-down direction',
              },
            ],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const systemMessage = mockGenerateText.mock.calls[0][0][0];
      expect(systemMessage.content).toContain('max-nodes');
      expect(systemMessage.content).toContain('Limit diagram to 10 nodes maximum');
      expect(systemMessage.content).toContain('direction');
    });

    it('system prompt instructs AI to output JSON format', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      await generate('Create a flowchart', {
        diagramType: 'flowchart',
        outputFormat: 'mermaid',
      });

      const systemMessage = mockGenerateText.mock.calls[0][0][0];
      expect(systemMessage.content).toContain('valid JSON');
      expect(systemMessage.content).toContain('"nodes"');
      expect(systemMessage.content).toContain('"connections"');
      expect(systemMessage.content).toContain('"groups"');
    });

    it('extracts JSON from response with surrounding text', async () => {
      mockGenerateText.mockResolvedValue(
        'Here is the diagram:\n' + SIMPLE_DIAGRAM_JSON + '\n\nHope this helps!',
      );

      const result = await generate('Create a flowchart', {
        diagramType: 'flowchart',
        outputFormat: 'mermaid',
      });

      expect(result.code).toBe(SIMPLE_DIAGRAM_JSON);
    });
  });

  describe('refine', () => {
    it('returns updated DiagramResult with JSON', async () => {
      const updatedJSON = JSON.stringify({
        nodes: [
          { id: 'start', label: 'Start', icon: 'default', group: 'flow', x: 100, y: 200 },
          { id: 'middle', label: 'Middle', icon: 'default', group: 'flow', x: 350, y: 200 },
          { id: 'end', label: 'End', icon: 'default', group: 'flow', x: 600, y: 200 },
        ],
        connections: [
          { from: 'start', to: 'middle', label: 'Next' },
          { from: 'middle', to: 'end', label: 'Done' },
        ],
        groups: [
          { id: 'flow', label: 'Flow', color: '#e3f2fd' },
        ],
      });

      mockGenerateText.mockResolvedValue(updatedJSON);

      const result = await refine(
        'Add a new node in the middle',
        SIMPLE_DIAGRAM_JSON,
        { diagramType: 'flowchart', outputFormat: 'mermaid' },
      );

      expect(result.code).toBe(updatedJSON);
      expect(result.format).toBe('mermaid');
      expect(result.diagramType).toBe('flowchart');
      expect(result.isValid).toBe(true);
    });

    it('includes existing code in the prompt', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      await refine(
        'Add node C',
        SIMPLE_DIAGRAM_JSON,
        { diagramType: 'flowchart', outputFormat: 'mermaid' },
      );

      const userMessage = mockGenerateText.mock.calls[0][0][1];
      expect(userMessage.content).toContain(SIMPLE_DIAGRAM_JSON);
      expect(userMessage.content).toContain('Add node C');
    });

    it('instructs AI to preserve unchanged elements', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      await refine(
        'Change label',
        SIMPLE_DIAGRAM_JSON,
        { diagramType: 'flowchart', outputFormat: 'mermaid' },
      );

      const systemMessage = mockGenerateText.mock.calls[0][0][0];
      expect(systemMessage.content).toContain('Preserve unchanged');
    });

    it('strips code fences from refine response', async () => {
      mockGenerateText.mockResolvedValue(
        '```json\n' + SIMPLE_DIAGRAM_JSON + '\n```',
      );

      const result = await refine(
        'Add C',
        SIMPLE_DIAGRAM_JSON,
        { diagramType: 'flowchart', outputFormat: 'mermaid' },
      );

      expect(result.code).toBe(SIMPLE_DIAGRAM_JSON);
    });

    it('includes attachment context in refine prompt', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      await refine(
        'Update based on attached file',
        SIMPLE_DIAGRAM_JSON,
        {
          diagramType: 'class-diagram',
          outputFormat: 'mermaid',
          attachmentContexts: [
            {
              filename: 'model.ts',
              extractedText: 'export class Foo {}',
              metadata: {},
            },
          ],
        },
      );

      const userMessage = mockGenerateText.mock.calls[0][0][1];
      expect(userMessage.content).toContain('model.ts');
      expect(userMessage.content).toContain('export class Foo {}');
    });

    it('includes session history in refine prompt', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      await refine(
        'Add more',
        SIMPLE_DIAGRAM_JSON,
        {
          diagramType: 'flowchart',
          outputFormat: 'mermaid',
          sessionHistory: [
            {
              index: 0,
              prompt: 'Original request',
              response: {
                content: SIMPLE_DIAGRAM_JSON,
                outputType: 'diagram',
                format: 'mermaid',
                sessionId: 'sess-1',
                exchangeIndex: 0,
              },
              timestamp: new Date(),
            },
          ],
        },
      );

      const userMessage = mockGenerateText.mock.calls[0][0][1];
      expect(userMessage.content).toContain('Original request');
    });

    it('infers diagram type during refine when not specified', async () => {
      mockGenerateText.mockResolvedValue(ER_DIAGRAM_JSON);

      const result = await refine(
        'Add orders table',
        SIMPLE_DIAGRAM_JSON,
        {},
      );

      expect(result.diagramType).toBe('er-diagram');
    });

    it('passes timeout to AI client during refine', async () => {
      mockGenerateText.mockResolvedValue(SIMPLE_DIAGRAM_JSON);

      await refine('Update', SIMPLE_DIAGRAM_JSON, {
        diagramType: 'flowchart',
      });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          timeoutMs: 30_000,
        }),
      );
    });
  });

  describe('error propagation', () => {
    it('propagates AI client errors from generate', async () => {
      mockGenerateText.mockRejectedValue(
        new Error('AI generation failed. Groq error: timeout. Gemini fallback error: quota exceeded'),
      );

      await expect(
        generate('Create a flowchart', { diagramType: 'flowchart' }),
      ).rejects.toThrow('AI generation failed');
    });

    it('propagates AI client errors from refine', async () => {
      mockGenerateText.mockRejectedValue(
        new Error('AI generation failed'),
      );

      await expect(
        refine('Update', SIMPLE_DIAGRAM_JSON, { diagramType: 'flowchart' }),
      ).rejects.toThrow('AI generation failed');
    });
  });
});
