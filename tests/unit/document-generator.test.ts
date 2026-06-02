import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GenerationContext, DocumentType } from '@/types/index.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGenerateText = vi.fn();

vi.mock('@/infrastructure/ai-client.js', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Document Generator', () => {
  let generate: (prompt: string, context: GenerationContext) => Promise<import('@/types/index.js').DocumentResult>;
  let refine: (prompt: string, existingDocument: string, context: GenerationContext) => Promise<import('@/types/index.js').DocumentResult>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/domain/document-generator.js');
    generate = mod.generate;
    refine = mod.refine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validMarkdown = `# Project Design Document

## Overview

This document describes the architecture of the system.

## Architecture

The system uses a layered architecture with clear separation of concerns.

## Implementation

Implementation follows standard TypeScript patterns with strict type checking.
`;

  const emptyContext: GenerationContext = {};

  describe('generate', () => {
    it('returns valid DocumentResult for well-structured AI output', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      const result = await generate('Create a design document for a todo app', emptyContext);

      expect(result.content).toBe(validMarkdown.trim());
      expect(result.documentType).toBe('design-document');
      expect(result.isValid).toBe(true);
      expect(result.validationErrors).toBeUndefined();
    });

    it('passes timeout option to generateText', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      await generate('Create a design doc', emptyContext);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          timeoutMs: 30000,
        }),
      );
    });

    it('constructs messages with system and user roles', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      await generate('Write a design doc', emptyContext);

      const messages = mockGenerateText.mock.calls[0][0];
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
    });

    it('uses explicit document type from context', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      const context: GenerationContext = { documentType: 'api-documentation' };
      const result = await generate('Write documentation', context);

      expect(result.documentType).toBe('api-documentation');
      // System prompt should mention API documentation
      const systemMsg = mockGenerateText.mock.calls[0][0][0].content;
      expect(systemMsg).toContain('API documentation');
    });

    it('infers document type as api-documentation from prompt keywords', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      const result = await generate('Create API endpoint documentation for the users REST service', emptyContext);

      expect(result.documentType).toBe('api-documentation');
    });

    it('infers document type as sop from prompt keywords', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      const result = await generate('Write a standard operating procedure for deployment', emptyContext);

      expect(result.documentType).toBe('sop');
    });

    it('infers document type as technical-specification from prompt keywords', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      const result = await generate('Write a technical specification for the auth module', emptyContext);

      expect(result.documentType).toBe('technical-specification');
    });

    it('infers document type as documentation-outline from prompt keywords', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      const result = await generate('Create an outline for a user guide', emptyContext);

      expect(result.documentType).toBe('documentation-outline');
    });

    it('defaults to design-document when no keywords match', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      const result = await generate('Write about our new feature', emptyContext);

      expect(result.documentType).toBe('design-document');
    });

    it('strips markdown code fences from AI output', async () => {
      const wrappedContent = '```markdown\n' + validMarkdown + '\n```';
      mockGenerateText.mockResolvedValue(wrappedContent);

      const result = await generate('Write a doc', emptyContext);

      expect(result.content).not.toContain('```');
      expect(result.content).toContain('# Project Design Document');
    });

    it('includes template sections in system prompt', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      const context: GenerationContext = {
        template: {
          id: 'test-template',
          name: 'Test Template',
          type: 'document',
          subType: 'design-document',
          isBuiltIn: true,
          structure: {
            sections: [
              { heading: 'Overview', level: 2, required: true },
              { heading: 'Architecture', level: 2, required: true },
              { heading: 'Testing', level: 2, required: false },
            ],
            layoutOrdering: ['Overview', 'Architecture', 'Testing'],
            formattingRules: [
              { rule: 'use-diagrams', description: 'Include Mermaid diagrams where applicable' },
            ],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      await generate('Write a design doc', context);

      const systemMsg = mockGenerateText.mock.calls[0][0][0].content;
      expect(systemMsg).toContain('Overview');
      expect(systemMsg).toContain('Architecture');
      expect(systemMsg).toContain('Testing');
      expect(systemMsg).toContain('required');
      expect(systemMsg).toContain('optional');
      expect(systemMsg).toContain('Include Mermaid diagrams');
    });

    it('includes attachment context in user message', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      const context: GenerationContext = {
        attachmentContexts: [
          {
            filename: 'schema.ts',
            extractedText: 'interface User { id: string; name: string; }',
            metadata: { language: 'typescript' },
          },
        ],
      };

      await generate('Document the user model', context);

      const userMsg = mockGenerateText.mock.calls[0][0][1].content;
      expect(userMsg).toContain('schema.ts');
      expect(userMsg).toContain('interface User');
    });

    it('includes session history in user message', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      const context: GenerationContext = {
        sessionHistory: [
          {
            index: 0,
            prompt: 'Create a design document',
            response: {
              content: '# Design\n\n## Overview\n\nContent here.',
              outputType: 'document',
              format: 'design-document',
              documentType: 'design-document',
              sessionId: 'test-session',
              exchangeIndex: 0,
            },
            timestamp: new Date(),
          },
        ],
      };

      await generate('Add a section about testing', context);

      const userMsg = mockGenerateText.mock.calls[0][0][1].content;
      expect(userMsg).toContain('Previous conversation context');
      expect(userMsg).toContain('Create a design document');
    });

    it('marks output as invalid when missing title heading', async () => {
      const noTitleContent = `Some intro text.

## Section One

Content for section one.

## Section Two

Content for section two.
`;
      mockGenerateText.mockResolvedValue(noTitleContent);

      const result = await generate('Write a doc', emptyContext);

      // ## headings satisfy title requirement (level <= 2)
      // The first ## is used as title, leaving only 1 remaining section heading
      expect(result.isValid).toBe(false);
      expect(result.validationErrors).toBeDefined();
    });

    it('marks output as invalid when fewer than 2 section headings', async () => {
      const fewSections = `# My Document

## Only One Section

Some content here.
`;
      mockGenerateText.mockResolvedValue(fewSections);

      const result = await generate('Write a doc', emptyContext);

      expect(result.isValid).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.some((e) => e.message.includes('at least 2 section headings'))).toBe(true);
    });

    it('reports warning when a section has no content', async () => {
      const emptySection = `# My Document

## Section One

Content here.

## Section Two

## Section Three

More content.
`;
      mockGenerateText.mockResolvedValue(emptySection);

      const result = await generate('Write a doc', emptyContext);

      expect(result.isValid).toBe(true); // warnings don't invalidate
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.some((e) => e.severity === 'warning' && e.message.includes('Section Two'))).toBe(true);
    });
  });

  describe('refine', () => {
    const existingDoc = `# Todo App Design

## Overview

A simple todo application.

## Features

Basic CRUD operations for todo items.
`;

    it('returns valid DocumentResult when refining', async () => {
      const refinedContent = `# Todo App Design

## Overview

A simple todo application with real-time sync.

## Features

Basic CRUD operations for todo items.

## Real-time Sync

WebSocket-based real-time synchronization between clients.
`;
      mockGenerateText.mockResolvedValue(refinedContent);

      const result = await refine('Add a section about real-time sync', existingDoc, emptyContext);

      expect(result.content).toContain('Real-time Sync');
      expect(result.isValid).toBe(true);
      expect(result.documentType).toBe('design-document');
    });

    it('includes existing document in the user message', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      await refine('Make the overview more detailed', existingDoc, emptyContext);

      const userMsg = mockGenerateText.mock.calls[0][0][1].content;
      expect(userMsg).toContain('existing document to refine');
      expect(userMsg).toContain('Todo App Design');
      expect(userMsg).toContain('Refinement instructions');
    });

    it('adds refinement instruction to system prompt', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      await refine('Add testing section', existingDoc, emptyContext);

      const systemMsg = mockGenerateText.mock.calls[0][0][0].content;
      expect(systemMsg).toContain('refining an existing document');
      expect(systemMsg).toContain('Preserve sections');
    });

    it('uses explicit document type from context during refinement', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      const context: GenerationContext = { documentType: 'sop' };
      const result = await refine('Add safety section', existingDoc, context);

      expect(result.documentType).toBe('sop');
    });

    it('passes timeout to generateText during refine', async () => {
      mockGenerateText.mockResolvedValue(validMarkdown);

      await refine('Update doc', existingDoc, emptyContext);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          timeoutMs: 30000,
        }),
      );
    });
  });
});
