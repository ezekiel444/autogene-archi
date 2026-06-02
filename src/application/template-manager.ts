/**
 * Template Manager — manages built-in and custom templates for generation output.
 * Templates are stored as JSON files in configurable data directories.
 */

import { readdir, readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  type Template,
  type TemplateStructure,
  type TemplateFilter,
  type ValidationResult,
  type ValidationError,
  type DiagramType,
  type DocumentType,
  ErrorCode,
  MAX_CUSTOM_TEMPLATES,
} from '../types/index.js';

/**
 * Serializable form of a Template (dates stored as ISO strings).
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

/**
 * Input for creating a new custom template.
 */
export type CreateTemplateInput = Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>;

/**
 * Manages template CRUD operations, validation, and compatibility checking.
 */
export class TemplateManager {
  private readonly customDir: string;
  private readonly builtInDir: string;

  constructor(dataDir: string = './data/templates') {
    this.customDir = join(dataDir, 'custom');
    this.builtInDir = join(dataDir, 'built-in');
  }

  /**
   * Ensures the data directories exist.
   */
  async initialize(): Promise<void> {
    await mkdir(this.customDir, { recursive: true });
    await mkdir(this.builtInDir, { recursive: true });
  }

  /**
   * Lists templates with optional filtering.
   */
  async listTemplates(filter?: TemplateFilter): Promise<Template[]> {
    await this.initialize();
    const templates: Template[] = [];

    // Load built-in templates
    const builtInTemplates = await this.loadTemplatesFromDir(this.builtInDir);
    templates.push(...builtInTemplates);

    // Load custom templates
    const customTemplates = await this.loadTemplatesFromDir(this.customDir);
    templates.push(...customTemplates);

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
   * Gets a template by ID. Returns null if not found.
   */
  async getTemplate(id: string): Promise<Template | null> {
    await this.initialize();

    // Try custom directory first
    const custom = await this.loadTemplateFromFile(join(this.customDir, `${id}.json`));
    if (custom) return custom;

    // Try built-in directory
    const builtIn = await this.loadTemplateFromFile(join(this.builtInDir, `${id}.json`));
    if (builtIn) return builtIn;

    return null;
  }

  /**
   * Creates a new custom template. Returns the created template with generated ID and timestamps.
   */
  async createTemplate(input: CreateTemplateInput): Promise<Template> {
    await this.initialize();

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
    const customTemplates = await this.loadTemplatesFromDir(this.customDir);
    if (customTemplates.length >= MAX_CUSTOM_TEMPLATES) {
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

    await this.saveTemplate(template, this.customDir);
    return template;
  }

  /**
   * Updates an existing custom template's structure.
   * Rejects updates to built-in templates.
   */
  async updateTemplate(id: string, updates: Partial<TemplateStructure>): Promise<Template> {
    await this.initialize();

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

    // Validate the updated structure
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

    await this.saveTemplate(updatedTemplate, this.customDir);
    return updatedTemplate;
  }

  /**
   * Deletes a custom template by ID.
   * Rejects deletion of built-in templates.
   */
  async deleteTemplate(id: string): Promise<boolean> {
    await this.initialize();

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

    const filePath = join(this.customDir, `${id}.json`);
    await unlink(filePath);
    return true;
  }

  /**
   * Validates a template structure.
   * Checks that structure is non-empty and has at least one meaningful field.
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

    // Check that at least one field is non-empty
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

    // Validate sections if present
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

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Checks if a template is compatible with a generation request type.
   * Returns a validation error if incompatible.
   */
  checkCompatibility(
    template: Template,
    requestType: 'diagram' | 'document'
  ): ValidationResult {
    const errors: ValidationError[] = [];

    if (template.type !== requestType) {
      errors.push({
        code: ErrorCode.TEMPLATE_INCOMPATIBLE,
        message: `Template "${template.name}" is of type "${template.type}" but the request is for a "${requestType}". Template type must match the request type.`,
        details: {
          templateType: template.type,
          requestType,
          templateId: template.id,
        },
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Validates required fields on a create template input.
   */
  private validateRequiredFields(input: CreateTemplateInput): ValidationResult {
    const errors: ValidationError[] = [];

    if (!input.name || input.name.trim().length === 0) {
      errors.push({
        code: ErrorCode.TEMPLATE_INVALID,
        message: 'Template name must not be empty.',
      });
    }

    if (!input.type || !['diagram', 'document'].includes(input.type)) {
      errors.push({
        code: ErrorCode.TEMPLATE_INVALID,
        message: 'Template type must be "diagram" or "document".',
      });
    }

    if (!input.subType || input.subType.trim().length === 0) {
      errors.push({
        code: ErrorCode.TEMPLATE_INVALID,
        message: 'Template subType must not be empty.',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Loads all templates from a directory.
   */
  private async loadTemplatesFromDir(dir: string): Promise<Template[]> {
    const templates: Template[] = [];

    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return templates;
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const template = await this.loadTemplateFromFile(join(dir, file));
      if (template) templates.push(template);
    }

    return templates;
  }

  /**
   * Loads a single template from a JSON file.
   */
  private async loadTemplateFromFile(filePath: string): Promise<Template | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const stored: StoredTemplate = JSON.parse(content);
      return this.deserializeTemplate(stored);
    } catch {
      return null;
    }
  }

  /**
   * Saves a template to a JSON file.
   */
  private async saveTemplate(template: Template, dir: string): Promise<void> {
    const stored = this.serializeTemplate(template);
    const filePath = join(dir, `${template.id}.json`);
    await writeFile(filePath, JSON.stringify(stored, null, 2), 'utf-8');
  }

  /**
   * Serializes a Template to a StoredTemplate (converts Dates to ISO strings).
   */
  private serializeTemplate(template: Template): StoredTemplate {
    return {
      ...template,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  /**
   * Deserializes a StoredTemplate to a Template (converts ISO strings to Dates).
   */
  private deserializeTemplate(stored: StoredTemplate): Template {
    return {
      ...stored,
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
    };
  }
}
