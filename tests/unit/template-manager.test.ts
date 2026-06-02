import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { TemplateManager, type CreateTemplateInput } from '@/application/template-manager.js';
import {
  type Template,
  type TemplateStructure,
  ErrorCode,
  MAX_CUSTOM_TEMPLATES,
} from '@/types/index.js';

const TEST_DATA_DIR = join(process.cwd(), 'tests', '.tmp-template-test-data');

function makeValidStructure(): TemplateStructure {
  return {
    sections: [
      { heading: 'Overview', level: 2, required: true },
      { heading: 'Details', level: 3, required: false },
    ],
  };
}

function makeValidInput(overrides?: Partial<CreateTemplateInput>): CreateTemplateInput {
  return {
    name: 'Test Template',
    type: 'document',
    subType: 'design-document',
    structure: makeValidStructure(),
    ...overrides,
  };
}

describe('TemplateManager', () => {
  let manager: TemplateManager;

  beforeEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
    manager = new TemplateManager(TEST_DATA_DIR);
    await manager.initialize();
  });

  afterEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('creates data directories if they do not exist', async () => {
      const freshDir = join(TEST_DATA_DIR, 'fresh');
      const freshManager = new TemplateManager(freshDir);
      await freshManager.initialize();
      // Should not throw — directories are created
      const templates = await freshManager.listTemplates();
      expect(templates).toHaveLength(0);
    });
  });

  describe('createTemplate', () => {
    it('creates a template with generated ID and timestamps', async () => {
      const input = makeValidInput();
      const template = await manager.createTemplate(input);

      expect(template.id).toBeDefined();
      expect(template.id.length).toBeGreaterThan(0);
      expect(template.name).toBe('Test Template');
      expect(template.type).toBe('document');
      expect(template.subType).toBe('design-document');
      expect(template.isBuiltIn).toBe(false);
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
      expect(template.structure).toEqual(makeValidStructure());
    });

    it('persists template to disk and retrieves it', async () => {
      const input = makeValidInput();
      const created = await manager.createTemplate(input);

      const retrieved = await manager.getTemplate(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe(created.name);
      expect(retrieved!.type).toBe(created.type);
      expect(retrieved!.subType).toBe(created.subType);
      expect(retrieved!.isBuiltIn).toBe(false);
      expect(retrieved!.createdAt.toISOString()).toBe(created.createdAt.toISOString());
    });

    it('rejects template with empty structure', async () => {
      const input = makeValidInput({ structure: {} as TemplateStructure });
      await expect(manager.createTemplate(input)).rejects.toMatchObject({
        code: ErrorCode.TEMPLATE_INVALID,
      });
    });

    it('rejects template with empty name', async () => {
      const input = makeValidInput({ name: '' });
      await expect(manager.createTemplate(input)).rejects.toMatchObject({
        code: ErrorCode.TEMPLATE_INVALID,
      });
    });

    it('rejects template with whitespace-only name', async () => {
      const input = makeValidInput({ name: '   ' });
      await expect(manager.createTemplate(input)).rejects.toMatchObject({
        code: ErrorCode.TEMPLATE_INVALID,
      });
    });

    it('rejects template with invalid type', async () => {
      const input = makeValidInput({ type: 'invalid' as any });
      await expect(manager.createTemplate(input)).rejects.toMatchObject({
        code: ErrorCode.TEMPLATE_INVALID,
      });
    });

    it('rejects template with empty subType', async () => {
      const input = makeValidInput({ subType: '' as any });
      await expect(manager.createTemplate(input)).rejects.toMatchObject({
        code: ErrorCode.TEMPLATE_INVALID,
      });
    });

    it('enforces the custom template limit', async () => {
      // Create MAX_CUSTOM_TEMPLATES templates
      for (let i = 0; i < MAX_CUSTOM_TEMPLATES; i++) {
        await manager.createTemplate(makeValidInput({ name: `Template ${i}` }));
      }

      // The next one should fail
      await expect(
        manager.createTemplate(makeValidInput({ name: 'One Too Many' }))
      ).rejects.toMatchObject({
        code: ErrorCode.TEMPLATE_LIMIT_REACHED,
      });
    });
  });

  describe('getTemplate', () => {
    it('returns null for non-existent template', async () => {
      const result = await manager.getTemplate('non-existent-id');
      expect(result).toBeNull();
    });

    it('retrieves a built-in template', async () => {
      // Manually place a built-in template
      const builtInDir = join(TEST_DATA_DIR, 'built-in');
      const builtInTemplate = {
        id: 'built-in-1',
        name: 'Built-in Flowchart',
        type: 'diagram',
        subType: 'flowchart',
        isBuiltIn: true,
        structure: {
          diagramConstraints: [
            { constraint: 'top-down', description: 'Use top-down layout' },
          ],
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      await writeFile(
        join(builtInDir, 'built-in-1.json'),
        JSON.stringify(builtInTemplate, null, 2)
      );

      const result = await manager.getTemplate('built-in-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('built-in-1');
      expect(result!.isBuiltIn).toBe(true);
      expect(result!.name).toBe('Built-in Flowchart');
      expect(result!.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('listTemplates', () => {
    it('returns empty array when no templates exist', async () => {
      const templates = await manager.listTemplates();
      expect(templates).toHaveLength(0);
    });

    it('returns all custom and built-in templates', async () => {
      // Create a custom template
      await manager.createTemplate(makeValidInput({ name: 'Custom 1' }));

      // Add a built-in template
      const builtInDir = join(TEST_DATA_DIR, 'built-in');
      await writeFile(
        join(builtInDir, 'built-in-1.json'),
        JSON.stringify({
          id: 'built-in-1',
          name: 'Built-in Doc',
          type: 'document',
          subType: 'sop',
          isBuiltIn: true,
          structure: { sections: [{ heading: 'Steps', level: 2, required: true }] },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })
      );

      const templates = await manager.listTemplates();
      expect(templates).toHaveLength(2);
    });

    it('filters by type', async () => {
      await manager.createTemplate(makeValidInput({ name: 'Doc', type: 'document', subType: 'sop' }));
      await manager.createTemplate(
        makeValidInput({
          name: 'Diagram',
          type: 'diagram',
          subType: 'flowchart',
          structure: { diagramConstraints: [{ constraint: 'lr', description: 'Left to right' }] },
        })
      );

      const diagramsOnly = await manager.listTemplates({ type: 'diagram' });
      expect(diagramsOnly).toHaveLength(1);
      expect(diagramsOnly[0].type).toBe('diagram');
    });

    it('filters by isBuiltIn', async () => {
      await manager.createTemplate(makeValidInput({ name: 'Custom' }));

      const builtInDir = join(TEST_DATA_DIR, 'built-in');
      await writeFile(
        join(builtInDir, 'b1.json'),
        JSON.stringify({
          id: 'b1',
          name: 'Built-in',
          type: 'document',
          subType: 'sop',
          isBuiltIn: true,
          structure: { sections: [{ heading: 'Intro', level: 2, required: true }] },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })
      );

      const customOnly = await manager.listTemplates({ isBuiltIn: false });
      expect(customOnly).toHaveLength(1);
      expect(customOnly[0].isBuiltIn).toBe(false);
    });

    it('filters by subType', async () => {
      await manager.createTemplate(makeValidInput({ name: 'SOP', type: 'document', subType: 'sop' }));
      await manager.createTemplate(makeValidInput({ name: 'Design', type: 'document', subType: 'design-document' }));

      const sopOnly = await manager.listTemplates({ subType: 'sop' });
      expect(sopOnly).toHaveLength(1);
      expect(sopOnly[0].subType).toBe('sop');
    });
  });

  describe('updateTemplate', () => {
    it('updates a custom template structure', async () => {
      const created = await manager.createTemplate(makeValidInput());
      const newStructure: Partial<TemplateStructure> = {
        sections: [
          { heading: 'Updated Section', level: 2, required: true },
        ],
      };

      const updated = await manager.updateTemplate(created.id, newStructure);
      expect(updated.structure.sections).toHaveLength(1);
      expect(updated.structure.sections![0].heading).toBe('Updated Section');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('rejects update on non-existent template', async () => {
      await expect(
        manager.updateTemplate('no-such-id', { sections: [] })
      ).rejects.toMatchObject({
        code: ErrorCode.TEMPLATE_NOT_FOUND,
      });
    });

    it('rejects update on built-in template', async () => {
      const builtInDir = join(TEST_DATA_DIR, 'built-in');
      await writeFile(
        join(builtInDir, 'built-in-1.json'),
        JSON.stringify({
          id: 'built-in-1',
          name: 'Built-in',
          type: 'document',
          subType: 'sop',
          isBuiltIn: true,
          structure: { sections: [{ heading: 'Steps', level: 2, required: true }] },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })
      );

      await expect(
        manager.updateTemplate('built-in-1', {
          sections: [{ heading: 'New', level: 2, required: true }],
        })
      ).rejects.toMatchObject({
        code: ErrorCode.TEMPLATE_BUILTIN_READONLY,
      });
    });

    it('rejects update with invalid structure (empty)', async () => {
      const created = await manager.createTemplate(makeValidInput());

      await expect(
        manager.updateTemplate(created.id, {
          sections: [],
          layoutOrdering: [],
          formattingRules: [],
          diagramConstraints: [],
        })
      ).rejects.toMatchObject({
        code: ErrorCode.TEMPLATE_INVALID,
      });
    });
  });

  describe('deleteTemplate', () => {
    it('deletes a custom template', async () => {
      const created = await manager.createTemplate(makeValidInput());

      const result = await manager.deleteTemplate(created.id);
      expect(result).toBe(true);

      const retrieved = await manager.getTemplate(created.id);
      expect(retrieved).toBeNull();
    });

    it('rejects deletion of non-existent template', async () => {
      await expect(manager.deleteTemplate('no-such-id')).rejects.toMatchObject({
        code: ErrorCode.TEMPLATE_NOT_FOUND,
      });
    });

    it('rejects deletion of built-in template', async () => {
      const builtInDir = join(TEST_DATA_DIR, 'built-in');
      await writeFile(
        join(builtInDir, 'built-in-1.json'),
        JSON.stringify({
          id: 'built-in-1',
          name: 'Built-in',
          type: 'diagram',
          subType: 'flowchart',
          isBuiltIn: true,
          structure: { diagramConstraints: [{ constraint: 'td', description: 'Top-down' }] },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })
      );

      await expect(manager.deleteTemplate('built-in-1')).rejects.toMatchObject({
        code: ErrorCode.TEMPLATE_BUILTIN_READONLY,
      });
    });
  });

  describe('validateTemplate', () => {
    it('accepts a structure with sections', () => {
      const result = manager.validateTemplate(makeValidStructure());
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a structure with only layoutOrdering', () => {
      const result = manager.validateTemplate({
        layoutOrdering: ['Overview', 'Details'],
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts a structure with only formattingRules', () => {
      const result = manager.validateTemplate({
        formattingRules: [{ rule: 'use-bullet-lists', description: 'Use bullet lists for items' }],
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts a structure with only diagramConstraints', () => {
      const result = manager.validateTemplate({
        diagramConstraints: [{ constraint: 'top-down', description: 'Use top-down layout' }],
      });
      expect(result.isValid).toBe(true);
    });

    it('rejects an empty structure (no fields)', () => {
      const result = manager.validateTemplate({});
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.TEMPLATE_INVALID);
    });

    it('rejects a structure with all empty arrays', () => {
      const result = manager.validateTemplate({
        sections: [],
        layoutOrdering: [],
        formattingRules: [],
        diagramConstraints: [],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.TEMPLATE_INVALID);
    });

    it('rejects a section with empty heading', () => {
      const result = manager.validateTemplate({
        sections: [{ heading: '', level: 2, required: true }],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('non-empty heading'))).toBe(true);
    });

    it('rejects a section with invalid level', () => {
      const result = manager.validateTemplate({
        sections: [{ heading: 'Valid', level: 0, required: true }],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('level between 1 and 6'))).toBe(true);
    });

    it('rejects a section with level > 6', () => {
      const result = manager.validateTemplate({
        sections: [{ heading: 'Valid', level: 7, required: true }],
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('checkCompatibility', () => {
    it('passes when template type matches request type', () => {
      const template: Template = {
        id: 'test-1',
        name: 'Diagram Template',
        type: 'diagram',
        subType: 'flowchart',
        isBuiltIn: false,
        structure: { diagramConstraints: [{ constraint: 'td', description: 'Top-down' }] },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = manager.checkCompatibility(template, 'diagram');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when template type does not match request type', () => {
      const template: Template = {
        id: 'test-1',
        name: 'Document Template',
        type: 'document',
        subType: 'sop',
        isBuiltIn: false,
        structure: { sections: [{ heading: 'Steps', level: 2, required: true }] },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = manager.checkCompatibility(template, 'diagram');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.TEMPLATE_INCOMPATIBLE);
      expect(result.errors[0].details?.templateType).toBe('document');
      expect(result.errors[0].details?.requestType).toBe('diagram');
    });
  });
});
