/**
 * Diagram Generator — converts natural language prompts into diagram JSON
 * for interactive Drawflow rendering.
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
 * Handles both ```json ... ``` and ``` ... ``` patterns.
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
 * Extracts JSON from an AI response that may contain surrounding text.
 * Finds the first valid JSON object in the response.
 */
function extractJSON(text: string): string {
  const stripped = stripCodeFences(text);

  // Try parsing directly first
  try {
    JSON.parse(stripped);
    return stripped;
  } catch {
    // Not directly parseable, try to extract JSON object
  }

  // Find the first { and last matching }
  const firstBrace = stripped.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('No JSON object found in response');
  }

  // Find the matching closing brace
  let depth = 0;
  let lastBrace = -1;
  for (let i = firstBrace; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++;
    else if (stripped[i] === '}') {
      depth--;
      if (depth === 0) {
        lastBrace = i;
        break;
      }
    }
  }

  if (lastBrace === -1) {
    throw new Error('No valid JSON object found in response');
  }

  const jsonStr = stripped.slice(firstBrace, lastBrace + 1);

  // Validate it's parseable
  JSON.parse(jsonStr);
  return jsonStr;
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
 * Looks for a "diagramType" field in the JSON or a "DiagramType:" line.
 */
function inferDiagramTypeFromJSON(jsonStr: string): DiagramType | undefined {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.diagramType) {
      const candidate = parsed.diagramType.toLowerCase().trim();
      if (SUPPORTED_DIAGRAM_TYPES.includes(candidate as DiagramType)) {
        return candidate as DiagramType;
      }
    }
  } catch {
    // Fall through
  }

  // Legacy fallback: check for DiagramType: line
  const typeRegex = /DiagramType:\s*(\S+)/i;
  const match = jsonStr.match(typeRegex);
  if (match) {
    const candidate = match[1].toLowerCase().trim();
    if (SUPPORTED_DIAGRAM_TYPES.includes(candidate as DiagramType)) {
      return candidate as DiagramType;
    }
  }
  return undefined;
}

/**
 * Legacy no-op: kept for backward compatibility.
 * Previously fixed architecture-beta syntax; now a no-op since we output JSON.
 */
function fixArchitectureBetaSyntax(code: string): string {
  return code;
}

/**
 * Legacy no-op: kept for backward compatibility.
 * Previously fixed Mermaid syntax; now a no-op since we output JSON.
 */
function fixCommonMermaidSyntax(code: string): string {
  return code;
}

// ─── Available Icons ─────────────────────────────────────────────────────────

const AVAILABLE_ICONS = [
  'aws-lambda', 'aws-s3', 'aws-dynamodb', 'aws-api-gateway', 'aws-cloudwatch',
  'aws-ec2', 'aws-rds', 'aws-sqs', 'aws-cloudfront', 'aws-sns', 'aws-ecs',
  'aws-eks', 'aws-elasticache', 'aws-kinesis', 'aws-step-functions',
  'azure', 'azure-functions', 'azure-storage', 'azure-sql', 'azure-cosmos-db',
  'gcp', 'gcp-cloud-functions', 'gcp-cloud-storage', 'gcp-bigquery',
  'kubernetes', 'docker', 'database', 'server', 'cloud', 'user',
  'load-balancer', 'firewall', 'queue', 'cache', 'cdn', 'monitoring',
  'default',
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generates diagram JSON from a natural language prompt.
 *
 * @param prompt - User's natural language description
 * @param context - Generation context with session history, attachments, template, etc.
 * @returns DiagramResult with generated JSON code, format, type, and validity
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
 * Refines existing diagram JSON based on new instructions.
 *
 * @param prompt - User's refinement instructions
 * @param existingCode - Current diagram JSON to modify
 * @param context - Generation context with session history, attachments, template, etc.
 * @returns DiagramResult with updated JSON code
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

/**
 * Returns diagram-type-specific guidance for JSON node generation.
 */
function getDiagramTypeGuidance(diagramType: DiagramType): string {
  switch (diagramType) {
    case 'flowchart':
      return `This is a flowchart/process diagram. Use icons like "default" for process steps, and arrange nodes top-to-bottom or left-to-right to show process flow. Use descriptive labels for decision points and actions.`;

    case 'sequence':
      return `This is a sequence diagram. Represent each participant as a node arranged horizontally (increasing x, same y). Connections represent messages between participants. Use labels on connections to describe the messages.`;

    case 'class-diagram':
      return `This is a class diagram. Each class is a node. Use connections to represent inheritance, composition, and associations. Label connections with relationship types.`;

    case 'er-diagram':
      return `This is an ER diagram. Each entity is a node. Use connections to represent relationships between entities. Label connections with cardinality (e.g., "1:N", "has many").`;

    case 'state-diagram':
      return `This is a state diagram. Each state is a node. Connections represent transitions between states. Label connections with trigger events or conditions.`;

    case 'network':
      return `This is a network diagram. Represent network components (servers, firewalls, load balancers, databases) as nodes with appropriate icons. Group by network zone (DMZ, Internal, External).`;

    case 'data-flow':
      return `This is a data flow diagram. Represent data stores, processes, and external entities as nodes. Connections show data movement. Label connections with data descriptions.`;

    case 'bpmn':
      return `This is a BPMN process diagram. Represent activities, gateways, and events as nodes. Use connections to show process flow. Group related activities into pools/lanes using groups.`;

    case 'cloud-architecture':
      return `This is a cloud architecture diagram. Use cloud service icons (aws-lambda, aws-s3, aws-api-gateway, aws-ec2, aws-rds, aws-dynamodb, aws-sqs, aws-cloudfront, aws-cloudwatch, azure, gcp, kubernetes, docker, load-balancer, cdn, cache, queue, monitoring, database, server). Group services by logical layers (Frontend, Backend, Storage, Monitoring). Arrange left-to-right: ingress on left, compute in middle, storage on right.`;

    default:
      return `Arrange nodes logically based on the diagram content.`;
  }
}

function buildGenerateSystemPrompt(
  format: OutputFormat,
  diagramType: DiagramType | undefined,
  context: GenerationContext,
): string {
  const parts: string[] = [];

  parts.push(
    `You are a diagram generator. Your task is to produce ONLY valid JSON describing an interactive diagram.`,
  );
  parts.push('Do not include any explanation, commentary, or markdown formatting.');
  parts.push('Output ONLY valid JSON. Nothing else.');
  parts.push('');
  parts.push('The JSON format MUST be:');
  parts.push(`{
  "nodes": [
    { "id": "unique-id", "label": "Display Label", "icon": "icon-name", "group": "GroupName", "x": 100, "y": 200 }
  ],
  "connections": [
    { "from": "source-node-id", "to": "target-node-id", "label": "Connection Label" }
  ],
  "groups": [
    { "id": "group-id", "label": "Group Label", "color": "#hex-color" }
  ]
}`);
  parts.push('');
  parts.push(`Available icon names: ${AVAILABLE_ICONS.join(', ')}`);
  parts.push('');
  parts.push('RULES:');
  parts.push('- Each node MUST have: id (string, kebab-case), label (string, 1-4 words), icon (from available set), x (number 100-800), y (number 50-500)');
  parts.push('- Space nodes with ~200px between them horizontally and ~150px vertically');
  parts.push('- Group nodes logically and assign a "group" field matching a group id');
  parts.push('- Connections reference node ids via "from" and "to" fields');
  parts.push('- Include 5-12 nodes for a rich diagram');
  parts.push('- Groups should have distinct colors (use soft pastel hex colors)');

  if (diagramType) {
    parts.push('');
    parts.push(`Generate a ${diagramType} diagram.`);
    parts.push(getDiagramTypeGuidance(diagramType));
  } else {
    parts.push('');
    parts.push(
      'Infer the most appropriate diagram type from the user prompt.',
    );
    parts.push(
      'Include a "diagramType" field at the top level of the JSON, set to one of: ' +
        SUPPORTED_DIAGRAM_TYPES.join(', '),
    );
  }

  // Cloud architecture specific instructions
  if (diagramType === 'cloud-architecture') {
    parts.push('');
    parts.push('For cloud architecture diagrams:');
    parts.push('- Use specific cloud service icons (aws-lambda, aws-s3, aws-api-gateway, aws-ec2, aws-rds, aws-dynamodb, aws-sqs, aws-cloudfront, aws-cloudwatch, azure, gcp, kubernetes, docker)');
    parts.push('- Create at least 3 logical groups (e.g., Frontend, Backend, Storage, Monitoring)');
    parts.push('- Each group should have 2-4 services');
    parts.push('- Arrange left-to-right: x=100-200 for frontend, x=350-450 for compute, x=600-700 for storage');
    parts.push('- Use soft colors: Frontend=#e3f2fd, Backend=#f3e5f5, Storage=#e8f5e9, Monitoring=#fff3e0');
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
    `You are a diagram refiner. Your task is to modify existing diagram JSON based on new instructions.`,
  );
  parts.push('Preserve unchanged nodes and connections from the existing diagram.');
  parts.push('Do not include any explanation, commentary, or markdown formatting.');
  parts.push('Output ONLY valid JSON. Nothing else.');
  parts.push('');
  parts.push('The JSON format MUST be:');
  parts.push(`{
  "nodes": [
    { "id": "unique-id", "label": "Display Label", "icon": "icon-name", "group": "GroupName", "x": 100, "y": 200 }
  ],
  "connections": [
    { "from": "source-node-id", "to": "target-node-id", "label": "Connection Label" }
  ],
  "groups": [
    { "id": "group-id", "label": "Group Label", "color": "#hex-color" }
  ]
}`);
  parts.push('');
  parts.push(`Available icon names: ${AVAILABLE_ICONS.join(', ')}`);

  if (diagramType) {
    parts.push(`The diagram is a ${diagramType} diagram.`);
  } else {
    parts.push(
      'Maintain the existing diagram type. Include a "diagramType" field set to one of: ' +
        SUPPORTED_DIAGRAM_TYPES.join(', '),
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
  let userPrompt = `Existing diagram JSON:\n\`\`\`\n${existingCode}\n\`\`\`\n\nNew instructions: ${prompt}`;

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

function parseAIResponse(
  aiResponse: string,
  format: OutputFormat,
  diagramType: DiagramType | undefined,
): DiagramResult {
  let code: string;
  let resolvedType = diagramType;

  try {
    // Extract and validate JSON from the response
    code = extractJSON(aiResponse);

    // If no diagram type was specified, try to infer from JSON
    if (!resolvedType) {
      resolvedType = inferDiagramTypeFromJSON(code);
    }
  } catch {
    // If JSON extraction fails, return the raw response stripped of fences
    // (allows graceful degradation)
    code = stripCodeFences(aiResponse);

    // Legacy inference from DiagramType: line
    if (!resolvedType) {
      const typeRegex = /DiagramType:\s*(\S+)/i;
      const match = code.match(typeRegex);
      if (match) {
        const candidate = match[1].toLowerCase().trim();
        if (SUPPORTED_DIAGRAM_TYPES.includes(candidate as DiagramType)) {
          resolvedType = candidate as DiagramType;
        }
      }
    }
  }

  // Default to flowchart if inference failed
  if (!resolvedType) {
    resolvedType = 'flowchart';
  }

  // Legacy no-ops (kept for backward compatibility)
  code = fixArchitectureBetaSyntax(code);
  code = fixCommonMermaidSyntax(code);

  return {
    code,
    format,
    diagramType: resolvedType,
    isValid: true,
    validationErrors: undefined,
  };
}
