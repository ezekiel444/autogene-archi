/**
 * Prompt Engine — central routing component for input validation,
 * classification, and generation orchestration.
 */

import {
  type GenerationRequest,
  type GenerationResponse,
  type GenerationContext,
  type AttachmentContext,
  type ValidationResult,
  type ValidationError,
  type ClassificationResult,
  type DiagramType,
  type DocumentType,
  ErrorCode,
  MAX_PROMPT_LENGTH,
  SUPPORTED_OUTPUT_FORMATS,
  SUPPORTED_DIAGRAM_TYPES,
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  type OutputFormat,
} from '../types/index.js';
import { generateText, type ChatMessage } from '../infrastructure/ai-client.js';
import { SessionManager } from './session-manager.js';
import { TemplateManager } from './template-manager.js';
import { validateAll as validateAttachments, process as processAttachment } from '../domain/attachment-processor.js';
import { generate as generateDiagram, refine as refineDiagram } from '../domain/diagram-generator.js';
import { generate as generateDocument, refine as refineDocument } from '../domain/document-generator.js';

/**
 * Validates a generation request input.
 * Checks prompt length, whitespace-only content, output format, and diagram type.
 */
export function validateInput(request: GenerationRequest): ValidationResult {
  const errors: ValidationError[] = [];

  // Check empty or whitespace-only prompt
  if (!request.prompt || request.prompt.trim().length === 0) {
    errors.push({
      code: ErrorCode.PROMPT_EMPTY,
      message: 'Prompt must contain non-whitespace content.',
    });
    return { isValid: false, errors };
  }

  // Check prompt length exceeds max
  if (request.prompt.length > MAX_PROMPT_LENGTH) {
    errors.push({
      code: ErrorCode.PROMPT_TOO_LONG,
      message: `Prompt exceeds the maximum allowed length of ${MAX_PROMPT_LENGTH} characters.`,
      details: {
        maxLength: MAX_PROMPT_LENGTH,
        actualLength: request.prompt.length,
      },
    });
  }

  // Validate output format if provided
  if (request.outputFormat !== undefined) {
    if (
      !SUPPORTED_OUTPUT_FORMATS.includes(request.outputFormat as OutputFormat)
    ) {
      errors.push({
        code: ErrorCode.FORMAT_UNSUPPORTED,
        message: `Unsupported output format: "${request.outputFormat}". Supported formats are: ${SUPPORTED_OUTPUT_FORMATS.join(', ')}.`,
        details: {
          requestedFormat: request.outputFormat,
          supportedFormats: SUPPORTED_OUTPUT_FORMATS,
        },
      });
    }
  }

  // Validate diagram type if provided
  if (request.diagramType !== undefined) {
    if (
      !SUPPORTED_DIAGRAM_TYPES.includes(request.diagramType as DiagramType)
    ) {
      errors.push({
        code: ErrorCode.DIAGRAM_TYPE_UNSUPPORTED,
        message: `Unsupported diagram type: "${request.diagramType}". Supported types are: ${SUPPORTED_DIAGRAM_TYPES.join(', ')}.`,
        details: {
          requestedType: request.diagramType,
          supportedTypes: SUPPORTED_DIAGRAM_TYPES,
        },
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ─── Classification ──────────────────────────────────────────────────────────

const CLASSIFICATION_SYSTEM_PROMPT = `You are a prompt classifier for a diagram and document generation tool.
Your task is to classify the user's prompt into one of three categories:
- "diagram": The user wants to generate a visual diagram (flowchart, ER diagram, sequence diagram, class diagram, network diagram, state diagram, data flow diagram, cloud architecture, BPMN, etc.)
- "document": The user wants to generate a structured text document (design document, documentation outline, SOP, API documentation, technical specification, etc.)
- "ambiguous": You cannot confidently determine whether the user wants a diagram or a document.

You must also infer the specific diagram or document type if applicable.

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{"type":"diagram"|"document"|"ambiguous","confidence":0.0-1.0,"inferredDiagramType":"flowchart"|"er-diagram"|"cloud-architecture"|"sequence"|"bpmn"|"class-diagram"|"network"|"state-diagram"|"data-flow"|null,"inferredDocumentType":"design-document"|"documentation-outline"|"sop"|"api-documentation"|"technical-specification"|null}

Rules:
- confidence is a number between 0.0 and 1.0 indicating how certain you are
- inferredDiagramType should be set when type is "diagram", null otherwise
- inferredDocumentType should be set when type is "document", null otherwise
- If you are unsure, set type to "ambiguous" with a low confidence`;

/**
 * Classifies a user prompt as requesting a diagram, document, or ambiguous.
 * Uses the AI client to determine the user's intent.
 */
export async function classifyPrompt(prompt: string): Promise<ClassificationResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  try {
    const response = await generateText(messages, {
      temperature: 0.1,
      maxTokens: 256,
    });

    const parsed = parseClassificationResponse(response);
    return parsed;
  } catch {
    // If AI call or parsing fails, return ambiguous with low confidence
    return {
      type: 'ambiguous',
      confidence: 0,
    };
  }
}

/**
 * Parses the AI response JSON into a ClassificationResult.
 * Applies the confidence threshold to return ambiguous when below threshold.
 */
function parseClassificationResponse(response: string): ClassificationResult {
  // Try to extract JSON from the response (handle potential markdown wrapping)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { type: 'ambiguous', confidence: 0 };
  }

  const data = JSON.parse(jsonMatch[0]);

  // Validate the type field
  const validTypes = ['diagram', 'document', 'ambiguous'] as const;
  if (!validTypes.includes(data.type)) {
    return { type: 'ambiguous', confidence: 0 };
  }

  // Validate and clamp confidence
  const confidence = typeof data.confidence === 'number'
    ? Math.max(0, Math.min(1, data.confidence))
    : 0;

  // If confidence is below threshold, return ambiguous
  if (confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD && data.type !== 'ambiguous') {
    return {
      type: 'ambiguous',
      confidence,
      inferredDiagramType: data.inferredDiagramType ?? undefined,
      inferredDocumentType: data.inferredDocumentType ?? undefined,
    };
  }

  const result: ClassificationResult = {
    type: data.type,
    confidence,
  };

  // Attach inferred types if present and valid
  if (data.inferredDiagramType && SUPPORTED_DIAGRAM_TYPES.includes(data.inferredDiagramType as DiagramType)) {
    result.inferredDiagramType = data.inferredDiagramType as DiagramType;
  }

  if (data.inferredDocumentType) {
    const supportedDocTypes: DocumentType[] = [
      'design-document', 'documentation-outline', 'sop',
      'api-documentation', 'technical-specification',
    ];
    if (supportedDocTypes.includes(data.inferredDocumentType as DocumentType)) {
      result.inferredDocumentType = data.inferredDocumentType as DocumentType;
    }
  }

  return result;
}

// ─── Code Snippet Structure Extraction ───────────────────────────────────────

/**
 * Common patterns for extracting structural information from code snippets.
 * Detects class declarations, function definitions, interfaces, and other constructs
 * to augment generation context.
 */
export interface CodeStructure {
  classes: string[];
  functions: string[];
  interfaces: string[];
  relationships: string[];
}

/**
 * Extracts structural information from a code snippet in the prompt.
 * Looks for common patterns: class declarations, function definitions,
 * interface definitions, and import/extends/implements relationships.
 */
export function extractCodeStructure(text: string): CodeStructure | null {
  const classes: string[] = [];
  const functions: string[] = [];
  const interfaces: string[] = [];
  const relationships: string[] = [];

  // Class declarations: class Foo, export class Foo, abstract class Foo
  const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(text)) !== null) {
    classes.push(match[1]);
    if (match[2]) {
      relationships.push(`${match[1]} extends ${match[2]}`);
    }
    if (match[3]) {
      const impls = match[3].split(',').map((s) => s.trim()).filter(Boolean);
      for (const impl of impls) {
        relationships.push(`${match[1]} implements ${impl}`);
      }
    }
  }

  // Function declarations: function foo, export function foo, async function foo
  const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  while ((match = funcRegex.exec(text)) !== null) {
    functions.push(match[1]);
  }

  // Arrow function / const declarations: const foo = (...) =>, const foo = function
  const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/g;
  while ((match = arrowRegex.exec(text)) !== null) {
    functions.push(match[1]);
  }

  // Interface/type declarations: interface Foo, export interface Foo, type Foo
  const interfaceRegex = /(?:export\s+)?(?:interface|type)\s+(\w+)/g;
  while ((match = interfaceRegex.exec(text)) !== null) {
    interfaces.push(match[1]);
  }

  // Check if any structural elements were found
  if (classes.length === 0 && functions.length === 0 && interfaces.length === 0) {
    return null;
  }

  return { classes, functions, interfaces, relationships };
}

/**
 * Formats extracted code structure into a string suitable for inclusion in generation context.
 */
function formatCodeStructureContext(structure: CodeStructure): string {
  const parts: string[] = ['Code structure detected in prompt:'];

  if (structure.classes.length > 0) {
    parts.push(`  Classes: ${structure.classes.join(', ')}`);
  }
  if (structure.functions.length > 0) {
    parts.push(`  Functions: ${structure.functions.join(', ')}`);
  }
  if (structure.interfaces.length > 0) {
    parts.push(`  Interfaces/Types: ${structure.interfaces.join(', ')}`);
  }
  if (structure.relationships.length > 0) {
    parts.push(`  Relationships: ${structure.relationships.join('; ')}`);
  }

  return parts.join('\n');
}

// ─── Orchestration Error ─────────────────────────────────────────────────────

/**
 * Error thrown during orchestration with a machine-readable code.
 */
export class PromptEngineError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PromptEngineError';
    this.code = code;
    this.details = details;
  }
}

// ─── Full Orchestration ──────────────────────────────────────────────────────

/**
 * Submits a generation request through the full orchestration pipeline:
 * 1. Validate input (prompt length, format, diagram type)
 * 2. Validate and process attachments (if present)
 * 3. Retrieve or create session (if sessionId provided)
 * 4. Classify prompt (diagram vs document vs ambiguous)
 * 5. Extract code structure from prompt for additional context
 * 6. Route to appropriate generator (diagram or document)
 * 7. Store exchange in session
 * 8. Return response
 *
 * For the "ambiguous" classification case, returns a response asking for clarification.
 *
 * @param request - The generation request with prompt, optional session, attachments, etc.
 * @param deps - Optional dependencies for testing (session manager, template manager)
 * @returns GenerationResponse with the generated content
 * @throws PromptEngineError for validation or processing failures
 */
export async function submitRequest(
  request: GenerationRequest,
  deps?: {
    sessionManager?: SessionManager;
    templateManager?: TemplateManager;
  },
): Promise<GenerationResponse> {
  const sessionManager = deps?.sessionManager ?? new SessionManager('./data/sessions');
  const templateManager = deps?.templateManager ?? new TemplateManager('./data/templates');

  // ─── Step 1: Validate input ────────────────────────────────────────────────
  const validation = validateInput(request);
  if (!validation.isValid) {
    throw new PromptEngineError(
      validation.errors[0].code as ErrorCode,
      validation.errors[0].message,
      validation.errors[0].details,
    );
  }

  // ─── Step 2: Validate and process attachments ──────────────────────────────
  let attachmentContexts: AttachmentContext[] = [];

  if (request.attachments && request.attachments.length > 0) {
    const attachmentValidation = validateAttachments(request.attachments);
    if (!attachmentValidation.isValid) {
      throw new PromptEngineError(
        attachmentValidation.errors[0].code as ErrorCode,
        attachmentValidation.errors[0].message,
        attachmentValidation.errors[0].details,
      );
    }

    attachmentContexts = await Promise.all(
      request.attachments.map((a) => processAttachment(a)),
    );
  }

  // ─── Step 3: Retrieve or create session ────────────────────────────────────
  let sessionId = request.sessionId;
  let sessionHistory: GenerationContext['sessionHistory'] = undefined;

  if (sessionId) {
    const sessionResult = await sessionManager.getSession(sessionId);
    if (!sessionResult.success) {
      throw new PromptEngineError(
        ErrorCode.SESSION_NOT_FOUND,
        `Session '${sessionId}' not found`,
      );
    }
    sessionHistory = sessionResult.data!.exchanges;
  }

  // ─── Step 4: Resolve template ──────────────────────────────────────────────
  let template: GenerationContext['template'] = undefined;
  if (request.templateId) {
    const foundTemplate = await templateManager.getTemplate(request.templateId);
    if (!foundTemplate) {
      throw new PromptEngineError(
        ErrorCode.TEMPLATE_NOT_FOUND,
        `Template '${request.templateId}' not found`,
      );
    }
    template = foundTemplate;
  }

  // ─── Step 5: Classify prompt ───────────────────────────────────────────────
  let outputType: 'diagram' | 'document';
  let inferredDiagramType: DiagramType | undefined = request.diagramType;

  if (request.diagramType) {
    // Explicit diagram type → diagram request
    outputType = 'diagram';
  } else {
    const classification = await classifyPrompt(request.prompt);

    if (classification.type === 'ambiguous') {
      // Handle ambiguous classification: return clarification response
      // Create a session if one doesn't exist to track the interaction
      if (!sessionId) {
        const outputGuess = 'document'; // default for session creation
        const newSession = await sessionManager.createSession(outputGuess);
        sessionId = newSession.id;
      }

      const clarificationResponse: GenerationResponse = {
        content: 'I\'m not sure whether you\'d like a diagram or a document. Could you please clarify? For example:\n- If you want a visual diagram, mention the type (e.g., "flowchart", "sequence diagram", "ER diagram")\n- If you want a text document, mention the type (e.g., "design document", "API documentation", "SOP")',
        outputType: 'document',
        format: 'design-document',
        sessionId,
        exchangeIndex: sessionHistory ? sessionHistory.length : 0,
      };

      return clarificationResponse;
    }

    if (classification.type === 'diagram') {
      outputType = 'diagram';
      if (!inferredDiagramType && classification.inferredDiagramType) {
        inferredDiagramType = classification.inferredDiagramType;
      }
    } else {
      outputType = 'document';
    }
  }

  // ─── Step 6: Extract code structure for context ────────────────────────────
  const codeStructure = extractCodeStructure(request.prompt);
  let augmentedPrompt = request.prompt;
  if (codeStructure) {
    augmentedPrompt = `${request.prompt}\n\n${formatCodeStructureContext(codeStructure)}`;
  }

  // Also check attachment text content for code structures
  for (const ctx of attachmentContexts) {
    if (ctx.extractedText) {
      const attachmentCodeStructure = extractCodeStructure(ctx.extractedText);
      if (attachmentCodeStructure) {
        const structureStr = formatCodeStructureContext(attachmentCodeStructure);
        // Append to the metadata so generators can use it
        ctx.metadata.codeStructure = structureStr;
      }
    }
  }

  // ─── Step 7: Build generation context ──────────────────────────────────────
  const context: GenerationContext = {
    sessionHistory,
    attachmentContexts: attachmentContexts.length > 0 ? attachmentContexts : undefined,
    template,
    diagramType: inferredDiagramType,
    outputFormat: request.outputFormat,
  };

  // ─── Step 8: Route to appropriate generator ────────────────────────────────
  let response: GenerationResponse;

  if (outputType === 'diagram') {
    const isRefinement = sessionHistory != null && sessionHistory.length > 0;
    const lastContent = isRefinement
      ? sessionHistory![sessionHistory!.length - 1].response.content
      : undefined;

    const result = isRefinement && lastContent
      ? await refineDiagram(augmentedPrompt, lastContent, context)
      : await generateDiagram(augmentedPrompt, context);

    // Create session if needed
    if (!sessionId) {
      const newSession = await sessionManager.createSession('diagram');
      sessionId = newSession.id;
    }

    response = {
      content: result.code,
      outputType: 'diagram',
      format: result.format,
      diagramType: result.diagramType,
      sessionId,
      exchangeIndex: sessionHistory ? sessionHistory.length : 0,
    };
  } else {
    const isRefinement = sessionHistory != null && sessionHistory.length > 0;
    const lastContent = isRefinement
      ? sessionHistory![sessionHistory!.length - 1].response.content
      : undefined;

    const result = isRefinement && lastContent
      ? await refineDocument(augmentedPrompt, lastContent, context)
      : await generateDocument(augmentedPrompt, context);

    // Create session if needed
    if (!sessionId) {
      const newSession = await sessionManager.createSession('document');
      sessionId = newSession.id;
    }

    response = {
      content: result.content,
      outputType: 'document',
      format: result.documentType,
      documentType: result.documentType,
      sessionId,
      exchangeIndex: sessionHistory ? sessionHistory.length : 0,
    };
  }

  // ─── Step 9: Add exchange to session ───────────────────────────────────────
  await sessionManager.addExchange(sessionId, request.prompt, response);

  return response;
}
