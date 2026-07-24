/**
 * Redis-backed Template Manager for Vercel serverless deployment.
 * Stores custom templates in Upstash Redis. Built-in templates are embedded in code.
 * API contract is identical to the original TemplateManager.
 */

import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from '../infrastructure/redis-client.js';
import type {
  Template,
  TemplateStructure,
  TemplateFilter,
  ValidationResult,
  ValidationError,
  DiagramType,
  DocumentType,
} from '../types/index.js';
import { ErrorCode, MAX_CUSTOM_TEMPLATES } from '../types/index.js';

export type CreateTemplateInput = Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>;

/** Redis key prefix for templates */
const TEMPLATE_PREFIX = 'template:';

/** Redis set key that tracks all custom template IDs */
const TEMPLATE_INDEX_KEY = 'template:index';

/**
 * Serializable form of a Template.
 */
interface StoredTemplate {
  id: string;
  name: string;
  type: 'diagram' | 'document';
  subType: DiagramType | DocumentType;
  isBuiltIn: boolean;
  structure: TemplateStructure;
  createdAt: string;
  updatedAt: string;
}

function templateKey(id: string): string {
  return `${TEMPLATE_PREFIX}${id}`;
}

function serializeTemplate(template: Template): StoredTemplate {
  return {
    ...template,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function deserializeTemplate(stored: StoredTemplate): Template {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}

/**
 * Redis-backed TemplateManager.
 */
export class TemplateManagerRedis {
  /**
   * Lists templates with optional filtering.
   */
  async listTemplates(filter?: TemplateFilter): Promise<Template[]> {
    const redis = getRedisClient();
    const templates: Template[] = [];

    // Load custom template IDs from the index set
    const ids = await redis.smembers(TEMPLATE_INDEX_KEY);

    if (ids.length > 0) {
      // Fetch each template
      for (const id of ids) {
        const raw = await redis.get<string>(templateKey(id));
        if (raw) {
          try {
            const stored: StoredTemplate = typeof raw === 'string' ? JSON.parse(raw) : raw as unknown as StoredTemplate;
            templates.push(deserializeTemplate(stored));
          } catch {
            // Skip corrupted entries
          }
        }
      }
    }

    // Apply filters
    if (!filter) return templates;

    return templates.filter((t) => {
      if (filter.type !== undefined && t.type !== filter.type) return false;
      if (filter.subType !== undefined && t.subType !== filter.subType) return false;
      if (filter.isBuiltIn !== undefined && t.isBuiltIn !== filter.isBuiltIn) return false;
      return true;
    });
  }

  /**
   * Gets a template by ID.
   */
  async getTemplate(id: string): Promise<Template | null> {
    const redis = getRedisClient();
    const raw = await redis.get<string>(templateKey(id));
    if (!raw) return null;

    try {
      const stored: StoredTemplate = typeof raw === 'string' ? JSON.parse(raw) : raw as unknown as StoredTemplate;
      return deserializeTemplate(stored);
    } catch {
      return null;
    }
  }

  /**
   * Creates a new custom template.
   */
  async createTemplate(input: CreateTemplateInput): Promise<Template> {
    const redis = getRedisClient();

    // Validate template structure
    const validation = this.validateTemplate(input.structure);
    if (!validation.isValid) {
      const error = new Error(validation.errors[0].message);
      (error as any).code = ErrorCode.TEMPLATE_INVALID;
      (error as any).validationErrors = validation.errors;
      throw error;
    }

    // Validate required fields
    const fieldValidation = this.validateRequiredFields(input);
    if (!fieldValidation.isValid) {
      const error = new Error(fieldValidation.errors[0].message);
      (error as any).code = ErrorCode.TEMPLATE_INVALID;
      (error as any).validationErrors = fieldValidation.errors;
      throw error;
    }

    // Check custom template limit
    const count = await redis.scard(TEMPLATE_INDEX_KEY);
    if (count >= MAX_CUSTOM_TEMPLATES) {
      const error = new Error(
        `Custom template limit reached. Maximum ${MAX_CUSTOM_TEMPLATES} custom templates allowed.`
      );
      (error as any).code = ErrorCode.TEMPLATE_LIMIT_REACHED;
      throw error;
    }

    const now = new Date();
    const template: Template = {
      id: uuidv4(),
      name: input.name,
      type: input.type,
      subType: input.subType,
      isBuiltIn: false,
      structure: input.structure,
      createdAt: now,
      updatedAt: now,
    };

    const serialized = serializeTemplate(template);
    await redis.set(templateKey(template.id), JSON.stringify(serialized));
    await redis.sadd(TEMPLATE_INDEX_KEY, template.id);

    return template;
  }

  /**
   * Updates an existing custom template.
   */
  async updateTemplate(id: string, updates: Partial<TemplateStructure>): Promise<Template> {
    const template = await this.getTemplate(id);
    if (!template) {
      const error = new Error(`Template with ID "${id}" not found.`);
      (error as any).code = ErrorCode.TEMPLATE_NOT_FOUND;
      throw error;
    }

    if (template.isBuiltIn) {
      const error = new Error('Cannot modify built-in templates.');
      (error as any).code = ErrorCode.TEMPLATE_BUILTIN_READONLY;
      throw error;
    }

    const updatedStructure: TemplateStructure = {
      ...template.structure,
      ...updates,
    };

    const validation = this.validateTemplate(updatedStructure);
    if (!validation.isValid) {
      const error = new Error(validation.errors[0].message);
      (error as any).code = ErrorCode.TEMPLATE_INVALID;
      (error as any).validationErrors = validation.errors;
      throw error;
    }

    const updatedTemplate: Template = {
      ...template,
      structure: updatedStructure,
      updatedAt: new Date(),
    };

    const redis = getRedisClient();
    await redis.set(templateKey(id), JSON.stringify(serializeTemplate(updatedTemplate)));

    return updatedTemplate;
  }

  /**
   * Deletes a custom template.
   */
  async deleteTemplate(id: string): Promise<boolean> {
    const template = await this.getTemplate(id);
    if (!template) {
      const error = new Error(`Template with ID "${id}" not found.`);
      (error as any).code = ErrorCode.TEMPLATE_NOT_FOUND;
      throw error;
    }

    if (template.isBuiltIn) {
      const error = new Error('Cannot delete built-in templates.');
      (error as any).code = ErrorCode.TEMPLATE_BUILTIN_READONLY;
      throw error;
    }

    const redis = getRedisClient();
    await redis.del(templateKey(id));
    await redis.srem(TEMPLATE_INDEX_KEY, id);

    return true;
  }

  /**
   * Validates a template structure.
   */
  validateTemplate(structure: TemplateStructure): ValidationResult {
    const errors: ValidationError[] = [];

    if (!structure) {
      errors.push({
        code: ErrorCode.TEMPLATE_INVALID,
        message: 'Template structure must not be null or undefined.',
      });
      return { isValid: false, errors };
    }

    const hasContent =
      (structure.sections && structure.sections.length > 0) ||
      (structure.layoutOrdering && structure.layoutOrdering.length > 0) ||
      (structure.formattingRules && structure.formattingRules.length > 0) ||
      (structure.diagramConstraints && structure.diagramConstraints.length > 0);

    if (!hasContent) {
      errors.push({
        code: ErrorCode.TEMPLATE_INVALID,
        message:
          'Template structure must contain at least one non-empty field (sections, layoutOrdering, formattingRules, or diagramConstraints).',
      });
      return { isValid: false, errors };
    }

    if (structure.sections) {
      for (let i = 0; i < structure.sections.length; i++) {
        const section = structure.sections[i];
        if (!section.heading || section.heading.trim().length === 0) {
          errors.push({
            code: ErrorCode.TEMPLATE_INVALID,
            message: `Section at index ${i} must have a non-empty heading.`,
          });
        }
        if (typeof section.level !== 'number' || section.level < 1 || section.level > 6) {
          errors.push({
            code: ErrorCode.TEMPLATE_INVALID,
            message: `Section at index ${i} must have a heading level between 1 and 6.`,
          });
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Checks template compatibility with a request type.
   */
  checkCompatibility(
    template: Template,
    requestType: 'diagram' | 'document'
  ): ValidationResult {
    const errors: ValidationError[] = [];

    if (template.type !== requestType) {
      errors.push({
        code: ErrorCode.TEMPLATE_INCOMPATIBLE,
        message: `Template "${template.name}" is of type "${template.type}" but the request is for a "${requestType}".`,
        details: {
          templateType: template.type,
          requestType,
          templateId: template.id,
        },
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  private validateRequiredFields(input: CreateTemplateInput): ValidationResult {
    const errors: ValidationError[] = [];

    if (!input.name || input.name.trim().length === 0) {
      errors.push({ code: ErrorCode.TEMPLATE_INVALID, message: 'Template name must not be empty.' });
    }

    if (!input.type || !['diagram', 'document'].includes(input.type)) {
      errors.push({ code: ErrorCode.TEMPLATE_INVALID, message: 'Template type must be "diagram" or "document".' });
    }

    if (!input.subType || input.subType.trim().length === 0) {
      errors.push({ code: ErrorCode.TEMPLATE_INVALID, message: 'Template subType must not be empty.' });
    }

    return { isValid: errors.length === 0, errors };
  }
}
