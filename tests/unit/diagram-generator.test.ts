import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GenerationContext, DiagramType, OutputFormat } from '@/types/index.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGenerateText = vi.fn();

vi.mock('@/infrastructure/ai-client.js', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

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
    it('returns DiagramResult with code, format, and diagramType', async () => {
      mockGenerateText.mockResolvedValue(
        'graph TD\n  A[Start] --> B[End]',
      );

      const result = await generate('Create a simple flowchart', {
        diagramType: 'flowchart',
        outputFormat: 'mermaid',
      });

      expect(result).toEqual({
        code: 'graph TD\n  A[Start] --> B[End]',
        format: 'mermaid',
        diagramType: 'flowchart',
        isValid: true,
        validationErrors: undefined,
      });
    });

    it('defaults to mermaid format when no format specified', async () => {
      mockGenerateText.mockResolvedValue('graph LR\n  A --> B');

      const result = await generate('Create a chart', {
        diagramType: 'flowchart',
      });

      expect(result.format).toBe('mermaid');
    });

    it('uses plantuml format when specified', async () => {
      mockGenerateText.mockResolvedValue(
        '@startuml\nAlice -> Bob : Hello\n@enduml',
      );

      const result = await generate('Create a sequence diagram', {
        diagramType: 'sequence',
        outputFormat: 'plantuml',
      });

      expect(result.format).toBe('plantuml');
      expect(result.code).toBe('@startuml\nAlice -> Bob : Hello\n@enduml');
    });

    it('strips markdown code fences from AI response', async () => {
      mockGenerateText.mockResolvedValue(
        '```mermaid\ngraph TD\n  A --> B\n```',
      );

      const result = await generate('Create a flowchart', {
        diagramType: 'flowchart',
        outputFormat: 'mermaid',
      });

      expect(result.code).toBe('graph TD\n  A --> B');
    });

    it('strips generic code fences from AI response', async () => {
      mockGenerateText.mockResolvedValue(
        '```\ngraph TD\n  A --> B\n```',
      );

      const result = await generate('Create a flowchart', {
        diagramType: 'flowchart',
        outputFormat: 'mermaid',
      });

      expect(result.code).toBe('graph TD\n  A --> B');
    });

    it('infers diagram type from AI response when not specified', async () => {
      mockGenerateText.mockResolvedValue(
        'DiagramType: sequence\nsequenceDiagram\n  Alice->>Bob: Hello',
      );

      const result = await generate('Show how Alice talks to Bob', {});

      expect(result.diagramType).toBe('sequence');
      expect(result.code).toBe('sequenceDiagram\n  Alice->>Bob: Hello');
    });

    it('defaults to flowchart when type inference fails', async () => {
      mockGenerateText.mockResolvedValue('graph TD\n  A --> B');

      const result = await generate('Make something', {});

      expect(result.diagramType).toBe('flowchart');
    });

    it('passes timeout to AI client', async () => {
      mockGenerateText.mockResolvedValue('graph TD\n  A --> B');

      await generate('Create a flowchart', { diagramType: 'flowchart' });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          timeoutMs: 30_000,
        }),
      );
    });

    it('includes diagram type in system prompt when specified', async () => {
      mockGenerateText.mockResolvedValue('erDiagram\n  A ||--o{ B : has');

      await generate('Create an ER diagram', {
        diagramType: 'er-diagram',
        outputFormat: 'mermaid',
      });

      const systemMessage = mockGenerateText.mock.calls[0][0][0];
      expect(systemMessage.role).toBe('system');
      expect(systemMessage.content).toContain('er-diagram');
    });

    it('instructs AI to infer type when not specified', async () => {
      mockGenerateText.mockResolvedValue(
        'DiagramType: flowchart\ngraph TD\n  A --> B',
      );

      await generate('Show a process', {});

      const systemMessage = mockGenerateText.mock.calls[0][0][0];
      expect(systemMessage.content).toContain('Infer the most appropriate diagram type');
      expect(systemMessage.content).toContain('DiagramType:');
    });

    it('includes attachment context in prompt', async () => {
      mockGenerateText.mockResolvedValue('graph TD\n  A --> B');

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
      mockGenerateText.mockResolvedValue('graph TD\n  A --> B --> C');

      await generate('Add a third node', {
        diagramType: 'flowchart',
        outputFormat: 'mermaid',
        sessionHistory: [
          {
            index: 0,
            prompt: 'Create a flowchart with two nodes',
            response: {
              content: 'graph TD\n  A --> B',
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
      expect(userMessage.content).toContain('graph TD');
    });

    it('includes template constraints in system prompt', async () => {
      mockGenerateText.mockResolvedValue('graph TD\n  A --> B');

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
  });

  describe('refine', () => {
    it('returns updated DiagramResult', async () => {
      mockGenerateText.mockResolvedValue(
        'graph TD\n  A --> B --> C[New Node]',
      );

      const result = await refine(
        'Add a new node C',
        'graph TD\n  A --> B',
        { diagramType: 'flowchart', outputFormat: 'mermaid' },
      );

      expect(result).toEqual({
        code: 'graph TD\n  A --> B --> C[New Node]',
        format: 'mermaid',
        diagramType: 'flowchart',
        isValid: true,
        validationErrors: undefined,
      });
    });

    it('includes existing code in the prompt', async () => {
      mockGenerateText.mockResolvedValue('graph TD\n  A --> B --> C');

      await refine(
        'Add node C',
        'graph TD\n  A --> B',
        { diagramType: 'flowchart', outputFormat: 'mermaid' },
      );

      const userMessage = mockGenerateText.mock.calls[0][0][1];
      expect(userMessage.content).toContain('graph TD\n  A --> B');
      expect(userMessage.content).toContain('Add node C');
    });

    it('instructs AI to preserve unchanged elements', async () => {
      mockGenerateText.mockResolvedValue('graph TD\n  A --> B');

      await refine(
        'Change label',
        'graph TD\n  A --> B',
        { diagramType: 'flowchart', outputFormat: 'mermaid' },
      );

      const systemMessage = mockGenerateText.mock.calls[0][0][0];
      expect(systemMessage.content).toContain('Preserve unchanged elements');
    });

    it('strips code fences from refine response', async () => {
      mockGenerateText.mockResolvedValue(
        '```mermaid\ngraph TD\n  A --> B --> C\n```',
      );

      const result = await refine(
        'Add C',
        'graph TD\n  A --> B',
        { diagramType: 'flowchart', outputFormat: 'mermaid' },
      );

      expect(result.code).toBe('graph TD\n  A --> B --> C');
    });

    it('includes attachment context in refine prompt', async () => {
      mockGenerateText.mockResolvedValue('classDiagram\n  class Foo');

      await refine(
        'Update based on attached file',
        'classDiagram\n  class Bar',
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
      mockGenerateText.mockResolvedValue('graph TD\n  A --> B --> C');

      await refine(
        'Add more',
        'graph TD\n  A --> B',
        {
          diagramType: 'flowchart',
          outputFormat: 'mermaid',
          sessionHistory: [
            {
              index: 0,
              prompt: 'Original request',
              response: {
                content: 'graph TD\n  A --> B',
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
      mockGenerateText.mockResolvedValue(
        'DiagramType: er-diagram\nerDiagram\n  CUSTOMER ||--o{ ORDER : places',
      );

      const result = await refine(
        'Add orders table',
        'erDiagram\n  CUSTOMER',
        {},
      );

      expect(result.diagramType).toBe('er-diagram');
      expect(result.code).toBe('erDiagram\n  CUSTOMER ||--o{ ORDER : places');
    });

    it('passes timeout to AI client during refine', async () => {
      mockGenerateText.mockResolvedValue('graph TD\n  A --> B');

      await refine('Update', 'graph TD\n  A', {
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
        refine('Update', 'graph TD', { diagramType: 'flowchart' }),
      ).rejects.toThrow('AI generation failed');
    });
  });
});
