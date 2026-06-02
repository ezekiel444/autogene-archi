/**
 * Diagram Generator — converts natural language prompts into diagram DSL code.
 * Supports generation and iterative refinement with session context,
 * template constraints, and attachment context.
 */

import { generateText } from '../infrastructure/ai-client.js';
import type {
  GenerationContext,
  DiagramResult,
  DiagramType,
  OutputFormat,
  AttachmentContext,
  DiagramConstraint,
  Exchange,
} from '../types/index.js';
import { DIAGRAM_GENERATION_TIMEOUT_MS, SUPPORTED_DIAGRAM_TYPES } from '../types/index.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_FORMAT: OutputFormat = 'mermaid';
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_TOKENS = 4096;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Strips markdown code fences from AI response if present.
 * Handles both ```mermaid ... ``` and ``` ... ``` patterns.
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();

  // Match fenced code blocks: ```<optional-lang>\n...\n```
  const fenceRegex = /^```(?:\w*)\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = trimmed.match(fenceRegex);
  if (match) {
    return match[1].trim();
  }

  return trimmed;
}

/**
 * Builds attachment context section for prompts.
 */
function buildAttachmentSection(attachmentContexts: AttachmentContext[]): string {
  if (attachmentContexts.length === 0) return '';

  const sections = attachmentContexts.map((ctx) => {
    const parts: string[] = [`File: ${ctx.filename}`];
    if (ctx.extractedText) {
      parts.push(`Content:\n${ctx.extractedText}`);
    }
    if (Object.keys(ctx.metadata).length > 0) {
      parts.push(`Metadata: ${JSON.stringify(ctx.metadata)}`);
    }
    return parts.join('\n');
  });

  return `\n\nAttached file context:\n${sections.join('\n---\n')}`;
}

/**
 * Builds session history section for prompts.
 */
function buildSessionHistorySection(exchanges: Exchange[]): string {
  if (exchanges.length === 0) return '';

  const history = exchanges.map((ex) => {
    return `User: ${ex.prompt}\nAssistant: ${ex.response.content}`;
  });

  return `\n\nConversation history:\n${history.join('\n\n')}`;
}

/**
 * Builds template constraints section for prompts.
 */
function buildConstraintsSection(constraints: DiagramConstraint[]): string {
  if (constraints.length === 0) return '';

  const items = constraints.map((c) => `- ${c.constraint}: ${c.description}`);
  return `\n\nTemplate constraints:\n${items.join('\n')}`;
}

/**
 * Infers diagram type from the AI response when not specified.
 * Looks for a "DiagramType:" line in the response.
 */
function inferDiagramTypeFromResponse(response: string): DiagramType | undefined {
  const typeRegex = /DiagramType:\s*(\S+)/i;
  const match = response.match(typeRegex);
  if (match) {
    const candidate = match[1].toLowerCase().trim();
    if (SUPPORTED_DIAGRAM_TYPES.includes(candidate as DiagramType)) {
      return candidate as DiagramType;
    }
  }
  return undefined;
}

/**
 * Removes the DiagramType metadata line from code output.
 */
function removeDiagramTypeMetadata(code: string): string {
  return code.replace(/^DiagramType:\s*\S+\s*\n?/im, '').trim();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generates diagram code from a natural language prompt.
 *
 * @param prompt - User's natural language description
 * @param context - Generation context with session history, attachments, template, etc.
 * @returns DiagramResult with generated code, format, type, and validity
 */
export async function generate(
  prompt: string,
  context: GenerationContext,
): Promise<DiagramResult> {
  const format: OutputFormat = context.outputFormat ?? DEFAULT_FORMAT;
  const diagramType = context.diagramType;

  // Build system prompt
  const systemPrompt = buildGenerateSystemPrompt(format, diagramType, context);

  // Build user prompt
  const userPrompt = buildGenerateUserPrompt(prompt, context);

  // Call AI
  const aiResponse = await generateText(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      timeoutMs: DIAGRAM_GENERATION_TIMEOUT_MS,
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS,
    },
  );

  // Parse response
  return parseAIResponse(aiResponse, format, diagramType);
}

/**
 * Refines existing diagram code based on new instructions.
 *
 * @param prompt - User's refinement instructions
 * @param existingCode - Current diagram code to modify
 * @param context - Generation context with session history, attachments, template, etc.
 * @returns DiagramResult with updated code
 */
export async function refine(
  prompt: string,
  existingCode: string,
  context: GenerationContext,
): Promise<DiagramResult> {
  const format: OutputFormat = context.outputFormat ?? DEFAULT_FORMAT;
  const diagramType = context.diagramType;

  // Build system prompt
  const systemPrompt = buildRefineSystemPrompt(format, diagramType, context);

  // Build user prompt
  const userPrompt = buildRefineUserPrompt(prompt, existingCode, context);

  // Call AI
  const aiResponse = await generateText(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      timeoutMs: DIAGRAM_GENERATION_TIMEOUT_MS,
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS,
    },
  );

  // Parse response
  return parseAIResponse(aiResponse, format, diagramType);
}

// ─── Prompt Builders ─────────────────────────────────────────────────────────

function buildGenerateSystemPrompt(
  format: OutputFormat,
  diagramType: DiagramType | undefined,
  context: GenerationContext,
): string {
  const parts: string[] = [];

  parts.push(
    `You are a diagram code generator. Your task is to produce ONLY valid ${format} diagram code.`,
  );
  parts.push('Do not include any explanation, commentary, or markdown formatting.');
  parts.push(`Output ONLY the raw ${format} code.`);

  if (format === 'mermaid') {
    parts.push('CRITICAL Mermaid syntax rules:');
    parts.push('- The FIRST line MUST be the diagram type declaration (e.g., "graph TD", "flowchart LR", "sequenceDiagram")');
    parts.push('- Edge labels use: A -->|label text| B (the label is BETWEEN the pipes, no > after the closing pipe)');
    parts.push('- Node labels use: A[Label Text] or A(Label Text) or A{Label Text}');
    parts.push('- NEVER write -->|label|> — the > after | is INVALID syntax');
    parts.push('- Valid connections: -->, --->, -.->  Invalid: -->|text|>');
    parts.push('- ALWAYS start with a diagram type keyword like: graph TD, flowchart LR, sequenceDiagram, classDiagram, erDiagram, stateDiagram-v2');
  }

  if (diagramType) {
    parts.push(`Generate a ${diagramType} diagram.`);
  } else {
    parts.push(
      'Infer the most appropriate diagram type from the user prompt.',
    );
    parts.push(
      'On the FIRST line of your response, output "DiagramType: <type>" where <type> is one of: ' +
        SUPPORTED_DIAGRAM_TYPES.join(', ') +
        '. Then output the diagram code on subsequent lines.',
    );
  }

  // Cloud architecture specific instructions for architecture-beta syntax
  if (diagramType === 'cloud-architecture') {
    parts.push(`Generate a Mermaid architecture-beta diagram.`);
    parts.push(`Use iconify icon identifiers for cloud services. Common mappings:`);
    parts.push(`  AWS: aws:ec2, aws:s3, aws:lambda, aws:rds, aws:dynamodb, aws:sqs, aws:sns, aws:cloudwatch, aws:api-gateway, aws:ecs, aws:eks, aws:elasticache, aws:cloudfront`);
    parts.push(`  Azure: azure:virtual-machines, azure:app-service, azure:sql-database, azure:cosmos-db, azure:functions, azure:storage, azure:key-vault, azure:aks`);
    parts.push(`  GCP: gcp:compute-engine, gcp:cloud-run, gcp:cloud-functions, gcp:cloud-sql, gcp:bigquery, gcp:cloud-storage, gcp:gke, gcp:pub-sub`);
    parts.push(`  General: logos:kubernetes, logos:docker, logos:nginx, logos:redis, logos:postgresql, logos:mongodb`);
    parts.push(`The architecture-beta syntax structure:`);
    parts.push(`  architecture-beta`);
    parts.push(`    group groupName(icon)[Label]`);
    parts.push(`    service serviceName(icon)[Label] in groupName`);
    parts.push(`    serviceName:R -- L:otherService`);
    parts.push(`Connections use directional ports: T(top), B(bottom), L(left), R(right)`);
    parts.push(`Example:`);
    parts.push(`  architecture-beta`);
    parts.push(`    group api_layer(cloud)[API Layer]`);
    parts.push(`    group data_layer(cloud)[Data Layer]`);
    parts.push(`    service apigw(aws:api-gateway)[API Gateway] in api_layer`);
    parts.push(`    service fn(aws:lambda)[Lambda] in api_layer`);
    parts.push(`    service db(aws:dynamodb)[DynamoDB] in data_layer`);
    parts.push(`    service storage(aws:s3)[S3] in data_layer`);
    parts.push(`    apigw:R -- L:fn`);
    parts.push(`    fn:B -- T:db`);
    parts.push(`    fn:R -- L:storage`);
  }

  // Add template constraints
  if (context.template?.structure?.diagramConstraints) {
    parts.push(buildConstraintsSection(context.template.structure.diagramConstraints));
  }

  return parts.join('\n');
}

function buildGenerateUserPrompt(
  prompt: string,
  context: GenerationContext,
): string {
  let userPrompt = prompt;

  // Add session history context
  if (context.sessionHistory && context.sessionHistory.length > 0) {
    userPrompt += buildSessionHistorySection(context.sessionHistory);
  }

  // Add attachment context
  if (context.attachmentContexts && context.attachmentContexts.length > 0) {
    userPrompt += buildAttachmentSection(context.attachmentContexts);
  }

  return userPrompt;
}

function buildRefineSystemPrompt(
  format: OutputFormat,
  diagramType: DiagramType | undefined,
  context: GenerationContext,
): string {
  const parts: string[] = [];

  parts.push(
    `You are a diagram code refiner. Your task is to modify existing ${format} diagram code based on new instructions.`,
  );
  parts.push('Preserve unchanged elements from the existing code.');
  parts.push('Do not include any explanation, commentary, or markdown formatting.');
  parts.push(`Output ONLY the updated raw ${format} code.`);

  if (diagramType) {
    parts.push(`The diagram is a ${diagramType} diagram.`);
  } else {
    parts.push(
      'Maintain the existing diagram type. On the FIRST line, output "DiagramType: <type>" where <type> is one of: ' +
        SUPPORTED_DIAGRAM_TYPES.join(', ') +
        '. Then output the diagram code on subsequent lines.',
    );
  }

  // Add template constraints
  if (context.template?.structure?.diagramConstraints) {
    parts.push(buildConstraintsSection(context.template.structure.diagramConstraints));
  }

  return parts.join('\n');
}

function buildRefineUserPrompt(
  prompt: string,
  existingCode: string,
  context: GenerationContext,
): string {
  let userPrompt = `Existing diagram code:\n\`\`\`\n${existingCode}\n\`\`\`\n\nNew instructions: ${prompt}`;

  // Add session history context
  if (context.sessionHistory && context.sessionHistory.length > 0) {
    userPrompt += buildSessionHistorySection(context.sessionHistory);
  }

  // Add attachment context
  if (context.attachmentContexts && context.attachmentContexts.length > 0) {
    userPrompt += buildAttachmentSection(context.attachmentContexts);
  }

  return userPrompt;
}

// ─── Response Parser ─────────────────────────────────────────────────────────

/**
 * Fixes common AI mistakes in architecture-beta connection syntax.
 * The correct syntax uses `--` not `-->` for connections.
 */
function fixArchitectureBetaSyntax(code: string): string {
  if (!code.trim().startsWith('architecture-beta')) return code;
  // Fix common AI mistakes: --> should be -- for architecture-beta connections
  return code.replace(/(\w+):([TBLR])\s*-->\s*([TBLR]):(\w+)/g, '$1:$2 -- $3:$4');
}

/**
 * Fixes common Mermaid syntax mistakes that LLMs frequently produce.
 * These are well-known AI generation artifacts that break Mermaid parsing.
 */
function fixCommonMermaidSyntax(code: string): string {
  let fixed = code;

  // Fix 0: Ensure diagram starts with a valid Mermaid diagram type declaration.
  // If the first line doesn't contain a recognized keyword, prepend "graph TD"
  const firstLine = fixed.trim().split('\n')[0].trim();
  const mermaidKeywords = [
    'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram',
    'erDiagram', 'pie', 'gantt', 'journey', 'gitGraph', 'mindmap', 'timeline',
    'quadrantChart', 'sankey', 'xychart', 'block', 'architecture-beta',
    'C4Context', 'C4Container', 'C4Component', 'C4Deployment', 'packet', 'kanban',
  ];
  const hasValidStart = mermaidKeywords.some(
    (kw) => firstLine === kw || firstLine.startsWith(kw + ' ') || firstLine.startsWith(kw + '\n'),
  );
  if (!hasValidStart && fixed.trim().length > 0) {
    // Prepend "graph TD" so Mermaid knows what type of diagram this is
    fixed = 'graph TD\n' + fixed;
  }

  // Fix 1: `-->|label|>` should be `-->|label|` (trailing > is invalid)
  fixed = fixed.replace(/(\|[^|]*\|)\s*>/g, '$1');

  // Fix 2: `-- |label| -->` should be `-->|label|` 
  fixed = fixed.replace(/--\s*\|([^|]*)\|\s*-->/g, '-->|$1|');

  // Fix 3: Fix orphan `>` after edge labels
  fixed = fixed.replace(/\|>\s/g, '| ');

  // Fix 4: Remove trailing `>` at end of lines after edge labels
  fixed = fixed.replace(/\|>$/gm, '|');

  return fixed;
}

function parseAIResponse(
  aiResponse: string,
  format: OutputFormat,
  diagramType: DiagramType | undefined,
): DiagramResult {
  let code = stripCodeFences(aiResponse);
  let resolvedType = diagramType;

  // If no diagram type was specified, try to infer it from the response
  if (!resolvedType) {
    resolvedType = inferDiagramTypeFromResponse(code);
    code = removeDiagramTypeMetadata(code);
  }

  // Default to flowchart if inference failed
  if (!resolvedType) {
    resolvedType = 'flowchart';
  }

  // Fix architecture-beta connection syntax if needed
  code = fixArchitectureBetaSyntax(code);

  // Fix common Mermaid syntax mistakes from LLMs
  if (format === 'mermaid') {
    code = fixCommonMermaidSyntax(code);
  }

  return {
    code,
    format,
    diagramType: resolvedType,
    isValid: true, // Validation will be handled by the DSL Validator (task 8.1)
    validationErrors: undefined,
  };
}
