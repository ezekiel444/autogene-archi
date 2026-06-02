/**
 * Document Generator — converts natural language prompts into
 * structured Markdown documents using the AI client.
 */

import { generateText } from '../infrastructure/ai-client.js';
import type {
  GenerationContext,
  DocumentResult,
  DocumentType,
  MarkdownValidationError,
} from '../types/index.js';
import {
  DOCUMENT_GENERATION_TIMEOUT_MS,
  SUPPORTED_DOCUMENT_TYPES,
} from '../types/index.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const DOCUMENT_TYPE_DESCRIPTIONS: Record<DocumentType, string> = {
  'design-document': 'a software design document with architecture decisions, component descriptions, and technical rationale',
  'documentation-outline': 'a documentation outline with structured sections for a knowledge base or user guide',
  'sop': 'a standard operating procedure with step-by-step instructions, prerequisites, and responsibilities',
  'api-documentation': 'API documentation with endpoint descriptions, request/response formats, and authentication details',
  'technical-specification': 'a technical specification with requirements, constraints, interfaces, and implementation details',
};

// ─── Prompt Construction ─────────────────────────────────────────────────────

/**
 * Builds a system prompt that instructs the AI to produce structured Markdown.
 */
function buildSystemPrompt(documentType: DocumentType, context: GenerationContext): string {
  const typeDescription = DOCUMENT_TYPE_DESCRIPTIONS[documentType];

  let systemPrompt = `You are a technical document generator. You produce well-structured, professional Markdown documents.

Your output MUST:
- Be valid CommonMark Markdown
- Start with a title heading (# Title)
- Contain at least 2 section headings (## Section)
- Have descriptive content of at least one sentence under each section heading
- Be ${typeDescription}

Output ONLY the Markdown document. Do not include any explanation, commentary, or code fences wrapping the document.`;

  // Add template constraints if available
  if (context.template?.structure) {
    const { sections, formattingRules, layoutOrdering } = context.template.structure;

    if (sections && sections.length > 0) {
      const sectionList = sections
        .map((s) => `- ${'#'.repeat(s.level)} ${s.heading}${s.required ? ' (required)' : ' (optional)'}`)
        .join('\n');
      systemPrompt += `\n\nThe document MUST follow this template structure:\n${sectionList}`;
    }

    if (layoutOrdering && layoutOrdering.length > 0) {
      systemPrompt += `\n\nSections should appear in this order: ${layoutOrdering.join(', ')}`;
    }

    if (formattingRules && formattingRules.length > 0) {
      const rules = formattingRules
        .map((r) => `- ${r.description}`)
        .join('\n');
      systemPrompt += `\n\nFormatting rules:\n${rules}`;
    }
  }

  return systemPrompt;
}

/**
 * Builds the user message content including prompt, session history, and attachment context.
 */
function buildUserMessage(prompt: string, context: GenerationContext): string {
  let message = '';

  // Include session history for context
  if (context.sessionHistory && context.sessionHistory.length > 0) {
    message += 'Previous conversation context:\n';
    for (const exchange of context.sessionHistory) {
      message += `User: ${exchange.prompt}\n`;
      message += `Assistant: [Generated document]\n`;
    }
    message += '\n';
  }

  // Include attachment context
  if (context.attachmentContexts && context.attachmentContexts.length > 0) {
    message += 'Attached file context:\n';
    for (const attachment of context.attachmentContexts) {
      message += `--- File: ${attachment.filename} ---\n`;
      if (attachment.extractedText) {
        message += attachment.extractedText + '\n';
      }
      message += '\n';
    }
  }

  message += prompt;
  return message;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates that generated Markdown content meets structural requirements:
 * - Has a title heading (# or ##)
 * - Has at least 2 section headings
 * - Has content under each section heading
 * - Is valid CommonMark (basic checks)
 */
function validateMarkdown(content: string): MarkdownValidationError[] {
  const errors: MarkdownValidationError[] = [];
  const lines = content.split('\n');

  // Find all headings
  const headings: { line: number; level: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({ line: i + 1, level: match[1].length, text: match[2] });
    }
  }

  // Check for title heading (level 1 or 2)
  const titleHeading = headings.find((h) => h.level <= 2);
  if (!titleHeading) {
    errors.push({
      line: 1,
      message: 'Document must contain a title heading (# or ##)',
      severity: 'error',
    });
  }

  // Check for at least 2 section headings (any level)
  // Section headings are headings other than the first title heading
  const sectionHeadings = titleHeading
    ? headings.filter((h) => h !== titleHeading)
    : headings;

  if (sectionHeadings.length < 2) {
    errors.push({
      line: 1,
      message: `Document must contain at least 2 section headings. Found ${sectionHeadings.length}.`,
      severity: 'error',
    });
  }

  // Check for content under each section heading (skip title heading)
  const headingsToCheck = titleHeading
    ? headings.filter((h) => h !== titleHeading)
    : headings;

  for (const heading of headingsToCheck) {
    const headingIndex = heading.line - 1;
    let hasContent = false;

    // Look for non-empty lines after this heading until the next heading or end
    for (let i = headingIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      // Stop at next heading
      if (/^#{1,6}\s+/.test(line)) break;
      // Check if line has meaningful content (non-empty, non-whitespace)
      if (line.trim().length > 0) {
        hasContent = true;
        break;
      }
    }

    if (!hasContent) {
      errors.push({
        line: heading.line,
        message: `Section "${heading.text}" has no content below it`,
        severity: 'warning',
      });
    }
  }

  return errors;
}

// ─── Document Type Inference ─────────────────────────────────────────────────

/**
 * Infers the document type from the prompt content using keyword matching.
 */
function inferDocumentType(prompt: string): DocumentType {
  const lower = prompt.toLowerCase();

  if (
    lower.includes('api') &&
    (lower.includes('endpoint') || lower.includes('documentation') || lower.includes('rest') || lower.includes('route'))
  ) {
    return 'api-documentation';
  }

  if (
    lower.includes('sop') ||
    lower.includes('standard operating procedure') ||
    lower.includes('step-by-step') ||
    lower.includes('procedure')
  ) {
    return 'sop';
  }

  if (
    lower.includes('specification') ||
    lower.includes('spec') ||
    lower.includes('requirements') ||
    lower.includes('constraints')
  ) {
    return 'technical-specification';
  }

  if (
    lower.includes('outline') ||
    lower.includes('table of contents') ||
    lower.includes('guide') ||
    lower.includes('user guide') ||
    lower.includes('how-to')
  ) {
    return 'documentation-outline';
  }

  // Default to design document
  return 'design-document';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generates a structured Markdown document from a natural language prompt.
 *
 * @param prompt - The user's natural language description of the desired document
 * @param context - Generation context including session history, attachments, and template
 * @returns DocumentResult with the generated content and validation info
 */
export async function generate(
  prompt: string,
  context: GenerationContext,
): Promise<DocumentResult> {
  // Determine document type: use explicit context, or infer from prompt
  const documentType: DocumentType =
    context.documentType && SUPPORTED_DOCUMENT_TYPES.includes(context.documentType)
      ? context.documentType
      : inferDocumentType(prompt);

  const systemPrompt = buildSystemPrompt(documentType, context);
  const userMessage = buildUserMessage(prompt, context);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage },
  ];

  const content = await generateText(messages, {
    timeoutMs: DOCUMENT_GENERATION_TIMEOUT_MS,
    temperature: 0.7,
    maxTokens: 4096,
  });

  // Strip any markdown code fences the AI may have wrapped around the output
  const cleanedContent = stripCodeFences(content);

  // Validate the output
  const validationErrors = validateMarkdown(cleanedContent);
  const hasErrors = validationErrors.some((e) => e.severity === 'error');

  return {
    content: cleanedContent,
    documentType,
    isValid: !hasErrors,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
  };
}

/**
 * Refines an existing document based on new instructions.
 *
 * @param prompt - The refinement instructions
 * @param existingDocument - The current document content to refine
 * @param context - Generation context including session history, attachments, and template
 * @returns DocumentResult with the refined content and validation info
 */
export async function refine(
  prompt: string,
  existingDocument: string,
  context: GenerationContext,
): Promise<DocumentResult> {
  // Determine document type: use explicit context, or infer from prompt
  const documentType: DocumentType =
    context.documentType && SUPPORTED_DOCUMENT_TYPES.includes(context.documentType)
      ? context.documentType
      : inferDocumentType(prompt);

  const systemPrompt = buildSystemPrompt(documentType, context) +
    '\n\nYou are refining an existing document. Apply the user\'s instructions to modify the document. Preserve sections and content that are not explicitly being changed.';

  let userMessage = buildUserMessage(prompt, context);
  userMessage = `Here is the existing document to refine:\n\n${existingDocument}\n\n---\n\nRefinement instructions: ${userMessage}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage },
  ];

  const content = await generateText(messages, {
    timeoutMs: DOCUMENT_GENERATION_TIMEOUT_MS,
    temperature: 0.7,
    maxTokens: 4096,
  });

  // Strip any markdown code fences the AI may have wrapped around the output
  const cleanedContent = stripCodeFences(content);

  // Validate the output
  const validationErrors = validateMarkdown(cleanedContent);
  const hasErrors = validationErrors.some((e) => e.severity === 'error');

  return {
    content: cleanedContent,
    documentType,
    isValid: !hasErrors,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Strips markdown code fences that AI models sometimes wrap around output.
 */
function stripCodeFences(content: string): string {
  let stripped = content.trim();

  // Remove leading ```markdown or ```md or ```
  if (/^```(?:markdown|md)?\s*\n/i.test(stripped)) {
    stripped = stripped.replace(/^```(?:markdown|md)?\s*\n/i, '');
  }

  // Remove trailing ```
  if (/\n```\s*$/.test(stripped)) {
    stripped = stripped.replace(/\n```\s*$/, '');
  }

  return stripped.trim();
}
