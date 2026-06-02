/**
 * Core type definitions for the AI Diagram & Document Generator.
 * All shared types, interfaces, and enums used across the application layers.
 */

export { ErrorCode, type ErrorResponse } from './errors.js';

// ─── Diagram Types ───────────────────────────────────────────────────────────

/**
 * Supported diagram types for generation.
 */
export type DiagramType =
  | 'flowchart'
  | 'er-diagram'
  | 'cloud-architecture'
  | 'sequence'
  | 'bpmn'
  | 'class-diagram'
  | 'network'
  | 'state-diagram'
  | 'data-flow';

/**
 * Supported diagram output DSL formats.
 */
export type OutputFormat = 'mermaid' | 'plantuml';

// ─── Document Types ──────────────────────────────────────────────────────────

/**
 * Supported document types for generation.
 */
export type DocumentType =
  | 'design-document'
  | 'documentation-outline'
  | 'sop'
  | 'api-documentation'
  | 'technical-specification';

// ─── Request & Response ──────────────────────────────────────────────────────

/**
 * Attachment included with a generation request.
 */
export interface Attachment {
  filename: string;
  mimeType: string;
  size: number; // bytes
  content: Buffer;
}

/**
 * A generation request submitted by the user via UI or API.
 */
export interface GenerationRequest {
  prompt: string;
  sessionId?: string;
  diagramType?: DiagramType;
  outputFormat?: OutputFormat;
  templateId?: string;
  attachments?: Attachment[];
}

/**
 * Response from a successful generation operation.
 */
export interface GenerationResponse {
  content: string;
  outputType: 'diagram' | 'document';
  format: OutputFormat | DocumentType;
  diagramType?: DiagramType;
  documentType?: DocumentType;
  sessionId: string;
  exchangeIndex: number;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * A single validation error with a machine-readable code and human-readable message.
 */
export interface ValidationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ─── Classification ──────────────────────────────────────────────────────────

/**
 * Result of prompt classification by the Prompt Engine.
 */
export interface ClassificationResult {
  type: 'diagram' | 'document' | 'ambiguous';
  confidence: number;
  inferredDiagramType?: DiagramType;
  inferredDocumentType?: DocumentType;
}

// ─── Generation Context ──────────────────────────────────────────────────────

/**
 * Context passed to generators containing session history, attachments, and template info.
 */
export interface GenerationContext {
  sessionHistory?: Exchange[];
  attachmentContexts?: AttachmentContext[];
  template?: Template;
  diagramType?: DiagramType;
  outputFormat?: OutputFormat;
  documentType?: DocumentType;
}

// ─── Session ─────────────────────────────────────────────────────────────────

/**
 * A user session tracking conversation history for iterative refinement.
 */
export interface Session {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  exchanges: Exchange[];
  outputType: 'diagram' | 'document';
  currentVersion: number;
}

/**
 * A single prompt-response exchange within a session.
 */
export interface Exchange {
  index: number;
  prompt: string;
  response: GenerationResponse;
  timestamp: Date;
}

// ─── Templates ───────────────────────────────────────────────────────────────

/**
 * A template defining structure and formatting rules for generation output.
 */
export interface Template {
  id: string;
  name: string;
  type: 'diagram' | 'document';
  subType: DiagramType | DocumentType;
  isBuiltIn: boolean;
  structure: TemplateStructure;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Structural definition of a template.
 */
export interface TemplateStructure {
  sections?: SectionDefinition[];
  layoutOrdering?: string[];
  formattingRules?: FormattingRule[];
  diagramConstraints?: DiagramConstraint[];
}

/**
 * A section defined within a template.
 */
export interface SectionDefinition {
  heading: string;
  level: number;
  required: boolean;
}

/**
 * A formatting rule applied during generation.
 */
export interface FormattingRule {
  rule: string;
  description: string;
}

/**
 * A constraint applied to diagram generation from a template.
 */
export interface DiagramConstraint {
  constraint: string;
  description: string;
}

/**
 * Filter options for listing templates.
 */
export interface TemplateFilter {
  type?: 'diagram' | 'document';
  subType?: DiagramType | DocumentType;
  isBuiltIn?: boolean;
}

// ─── Attachments ─────────────────────────────────────────────────────────────

/**
 * Processed attachment context ready for use in generation prompts.
 */
export interface AttachmentContext {
  filename: string;
  extractedText?: string;
  imageData?: Buffer;
  metadata: Record<string, string>;
}

// ─── DSL Validation ──────────────────────────────────────────────────────────

/**
 * A syntax error found during DSL validation.
 */
export interface SyntaxError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

// ─── Diagram Results ─────────────────────────────────────────────────────────

/**
 * Result of a diagram generation operation.
 */
export interface DiagramResult {
  code: string;
  format: OutputFormat;
  diagramType: DiagramType;
  isValid: boolean;
  validationErrors?: SyntaxError[];
}

// ─── Document Results ────────────────────────────────────────────────────────

/**
 * A Markdown validation error found in generated documents.
 */
export interface MarkdownValidationError {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Result of a document generation operation.
 */
export interface DocumentResult {
  content: string;
  documentType: DocumentType;
  isValid: boolean;
  validationErrors?: MarkdownValidationError[];
}

// ─── Rendering ───────────────────────────────────────────────────────────────

/**
 * Result of rendering diagram code to a visual format.
 */
export interface RenderResult {
  svg: string;
  width: number;
  height: number;
}

// ─── API Types ───────────────────────────────────────────────────────────────

/**
 * API request for generation (mirrors GenerationRequest with base64 attachments).
 */
export interface APIGenerateRequest {
  prompt: string;
  sessionId?: string;
  diagramType?: DiagramType;
  outputFormat?: OutputFormat;
  templateId?: string;
  attachments?: APIAttachment[];
}

/**
 * An attachment in API request format (base64 encoded content).
 */
export interface APIAttachment {
  filename: string;
  contentBase64: string;
  mimeType: string;
}

/**
 * API response for successful generation.
 */
export interface APIGenerateResponse {
  content: string;
  outputType: 'diagram' | 'document';
  format: string;
  sessionId: string;
  diagramType?: DiagramType;
  documentType?: DocumentType;
}

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Configuration for the Prompt Engine.
 */
export interface PromptEngineConfig {
  maxPromptLength: number;
  maxSessionExchanges: number;
  classificationConfidenceThreshold: number;
}

/**
 * Configuration for the Diagram Generator.
 */
export interface DiagramGeneratorConfig {
  timeoutMs: number;
  defaultFormat: OutputFormat;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum prompt length in characters */
export const MAX_PROMPT_LENGTH = 10_000;

/** Maximum exchanges per session */
export const MAX_SESSION_EXCHANGES = 50;

/** Maximum custom templates allowed */
export const MAX_CUSTOM_TEMPLATES = 100;

/** Maximum attachments per prompt */
export const MAX_ATTACHMENTS_PER_PROMPT = 5;

/** Maximum attachment size in bytes (10 MB) */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Maximum document length in characters */
export const MAX_DOCUMENT_LENGTH = 100_000;

/** Diagram generation timeout in milliseconds */
export const DIAGRAM_GENERATION_TIMEOUT_MS = 30_000;

/** Document generation timeout in milliseconds */
export const DOCUMENT_GENERATION_TIMEOUT_MS = 30_000;

/** API request timeout in milliseconds */
export const API_TIMEOUT_MS = 60_000;

/** Diagram render timeout in milliseconds */
export const RENDER_TIMEOUT_MS = 3_000;

/** Classification confidence threshold */
export const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.7;

/** Supported diagram output formats */
export const SUPPORTED_OUTPUT_FORMATS: OutputFormat[] = ['mermaid', 'plantuml'];

/** Supported diagram types */
export const SUPPORTED_DIAGRAM_TYPES: DiagramType[] = [
  'flowchart',
  'er-diagram',
  'cloud-architecture',
  'sequence',
  'bpmn',
  'class-diagram',
  'network',
  'state-diagram',
  'data-flow',
];

/** Supported document types */
export const SUPPORTED_DOCUMENT_TYPES: DocumentType[] = [
  'design-document',
  'documentation-outline',
  'sop',
  'api-documentation',
  'technical-specification',
];

/** Supported file extensions for attachments */
export const SUPPORTED_FILE_EXTENSIONS: string[] = [
  'png', 'jpeg', 'jpg',
  'pdf',
  'txt', 'md',
  'py', 'js', 'ts', 'java', 'c', 'cpp', 'go', 'rb', 'rs',
  'html', 'css', 'json', 'yaml', 'yml', 'xml', 'sh',
];
