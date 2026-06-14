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
  FormattingRule,
  ValidationError,
  Exchange,
} from '../types/index.js';
import { DIAGRAM_GENERATION_TIMEOUT_MS, SUPPORTED_DIAGRAM_TYPES } from '../types/index.js';
import {
  ALL_ICON_NAMES,
  buildIconSelectionRules,
  formatIconCatalogForPrompt,
} from './icon-catalog.js';

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
 * Builds template formatting-rules section for prompts.
 */
function buildFormattingRulesSection(rules: FormattingRule[]): string {
  if (rules.length === 0) return '';

  const items = rules.map((r) => `- ${r.rule}: ${r.description}`);
  return `\n\nFormatting rules:\n${items.join('\n')}`;
}

/**
 * Builds template layout-ordering section for prompts.
 */
function buildLayoutOrderingSection(ordering: string[]): string {
  if (ordering.length === 0) return '';
  return `\n\nPreferred layout/grouping order: ${ordering.join(' → ')}`;
}

/**
 * Returns the canonical CONNECTIVITY block included in every diagram prompt.
 * Forces the AI to produce a single connected graph with labeled edges.
 */
function buildConnectivityRulesSection(): string {
  return [
    '',
    'CONNECTIVITY (CRITICAL — every diagram MUST be a fully connected architecture):',
    '- Every node MUST appear in at least one connection. No isolated nodes.',
    '- The diagram MUST form a single connected graph. No isolated subgraphs.',
    '- For N nodes include AT LEAST N-1 connections so the architecture is end-to-end traceable.',
    '- Every connection MUST have a short "label" describing what flows (data, request, event, dependency, message, signal, etc.).',
    '- Each group MUST connect to at least one node outside the group; groups must not be islands.',
    '- Provide a clear flow from entry points (user, client, external system) through processing nodes to terminal nodes (storage, response, output).',
    '- Cross-group connections are encouraged where they reflect real interactions (e.g., compute → storage, frontend → backend, service → monitoring).',
  ].join('\n');
}

// ─── Connectivity Analysis ───────────────────────────────────────────────────

/**
 * A minimal shape extracted from the diagram JSON for graph analysis.
 */
interface ParsedDiagramGraph {
  nodes: Array<{ id: string; group?: string }>;
  connections: Array<{ from: string; to: string }>;
}

/**
 * Result of connectivity analysis on a parsed diagram.
 */
interface ConnectivityReport {
  orphanNodeIds: string[];
  componentCount: number;
  totalNodes: number;
  totalConnections: number;
  isWellConnected: boolean;
}

/**
 * Safely parse the diagram JSON for graph analysis. Returns null if the JSON
 * cannot be parsed or has the wrong shape, in which case connectivity checks
 * are skipped (graceful degradation).
 */
function safeParseDiagramGraph(jsonStr: string): ParsedDiagramGraph | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return null;

    const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const rawConnections = Array.isArray(parsed.connections) ? parsed.connections : [];

    const nodes: Array<{ id: string; group?: string }> = rawNodes
      .filter(
        (n: unknown): n is { id: string; group?: unknown } =>
          typeof n === 'object' &&
          n !== null &&
          'id' in n &&
          typeof (n as { id: unknown }).id === 'string',
      )
      .map((n: { id: string; group?: unknown }) => ({
        id: n.id,
        group: typeof n.group === 'string' ? n.group : undefined,
      }));

    const connections: Array<{ from: string; to: string }> = rawConnections
      .filter(
        (c: unknown): c is { from: string; to: string } =>
          typeof c === 'object' &&
          c !== null &&
          'from' in c &&
          'to' in c &&
          typeof (c as { from: unknown }).from === 'string' &&
          typeof (c as { to: unknown }).to === 'string',
      )
      .map((c: { from: string; to: string }) => ({ from: c.from, to: c.to }));

    return { nodes, connections };
  } catch {
    return null;
  }
}

/**
 * Analyzes connectivity of a parsed diagram graph.
 * - orphanNodeIds: nodes with zero incident edges
 * - componentCount: number of connected components in the undirected graph
 * - isWellConnected: no orphans AND at most one component
 */
export function analyzeConnectivity(diagram: ParsedDiagramGraph): ConnectivityReport {
  const totalNodes = diagram.nodes.length;
  const totalConnections = diagram.connections.length;

  if (totalNodes === 0) {
    return {
      orphanNodeIds: [],
      componentCount: 0,
      totalNodes: 0,
      totalConnections: 0,
      isWellConnected: true,
    };
  }

  const nodeIdSet = new Set(diagram.nodes.map((n) => n.id));
  const adj = new Map<string, Set<string>>();
  for (const id of nodeIdSet) adj.set(id, new Set());

  for (const c of diagram.connections) {
    if (!nodeIdSet.has(c.from) || !nodeIdSet.has(c.to)) continue; // ignore dangling edges
    if (c.from === c.to) continue; // self-loops don't count for connectivity
    adj.get(c.from)!.add(c.to);
    adj.get(c.to)!.add(c.from);
  }

  const orphanNodeIds: string[] = [];
  for (const node of diagram.nodes) {
    const neighbors = adj.get(node.id);
    if (!neighbors || neighbors.size === 0) orphanNodeIds.push(node.id);
  }

  // BFS to count connected components
  const visited = new Set<string>();
  let componentCount = 0;
  for (const node of diagram.nodes) {
    if (visited.has(node.id)) continue;
    componentCount++;
    const queue: string[] = [node.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const n of adj.get(cur) ?? []) {
        if (!visited.has(n)) queue.push(n);
      }
    }
  }

  return {
    orphanNodeIds,
    componentCount,
    totalNodes,
    totalConnections,
    isWellConnected: orphanNodeIds.length === 0 && componentCount <= 1,
  };
}

/**
 * Builds validation errors describing connectivity issues, suitable for
 * surfacing to the client in DiagramResult.validationErrors.
 */
function buildConnectivityValidationErrors(report: ConnectivityReport): ValidationError[] {
  const errors: ValidationError[] = [];
  if (report.orphanNodeIds.length > 0) {
    errors.push({
      code: 'DIAGRAM_ISOLATED_NODES',
      message: `Diagram contains ${report.orphanNodeIds.length} isolated node(s) with no connections.`,
      details: { orphanNodeIds: report.orphanNodeIds },
    });
  }
  if (report.componentCount > 1) {
    errors.push({
      code: 'DIAGRAM_DISCONNECTED_COMPONENTS',
      message: `Diagram has ${report.componentCount} disconnected subgraph(s); expected a single connected architecture.`,
      details: { componentCount: report.componentCount },
    });
  }
  return errors;
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

/**
 * Flat list of every icon name recognized by the renderer. Sourced from
 * `icon-catalog.ts` so backend (prompts) and frontend (SVGs) can never drift.
 */
const AVAILABLE_ICONS = ALL_ICON_NAMES;

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
  const initial = parseAIResponse(aiResponse, format, diagramType);

  // Connectivity safety net: orphan detection + at most one repair pass
  return enforceConnectivity(initial, format, diagramType);
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
  const initial = parseAIResponse(aiResponse, format, diagramType);
  return enforceConnectivity(initial, format, diagramType);
}

// ─── Connectivity Repair Pipeline ────────────────────────────────────────────

/**
 * After parsing an AI response, validates connectivity and runs at most one
 * repair pass to fix isolated nodes / disconnected subgraphs.
 *
 * Returns the original result on parse failure, on repair failure, or when the
 * diagram is already well-connected. When unfixed issues remain, surfaces them
 * via `validationErrors` (and flips `isValid` to false) so callers can react.
 */
async function enforceConnectivity(
  initial: DiagramResult,
  format: OutputFormat,
  diagramType: DiagramType | undefined,
): Promise<DiagramResult> {
  const parsed = safeParseDiagramGraph(initial.code);
  // If we can't parse the diagram (raw-text fallback), skip connectivity logic.
  if (!parsed || parsed.nodes.length === 0) return initial;

  const initialReport = analyzeConnectivity(parsed);
  if (initialReport.isWellConnected) return initial;

  // One repair attempt with a focused system prompt.
  let repaired: DiagramResult | null = null;
  try {
    repaired = await runRepairAttempt(initial.code, initialReport, format, diagramType);
  } catch {
    // Repair failed — fall through and surface the original issues.
  }

  const finalResult = repaired ?? initial;
  const finalParsed = safeParseDiagramGraph(finalResult.code);
  const finalReport = finalParsed
    ? analyzeConnectivity(finalParsed)
    : initialReport;

  if (finalReport.isWellConnected) return finalResult;

  // Still has issues — return result with diagnostic warnings attached.
  const validationErrors = buildConnectivityValidationErrors(finalReport);
  return {
    ...finalResult,
    isValid: false,
    validationErrors,
  };
}

/**
 * Single AI repair pass: ask the model to add the minimum connections needed
 * to make the diagram a single connected graph. Only accepts a result that
 * strictly improves on the input.
 */
async function runRepairAttempt(
  existingCode: string,
  report: ConnectivityReport,
  format: OutputFormat,
  diagramType: DiagramType | undefined,
): Promise<DiagramResult | null> {
  const systemPrompt = buildRepairSystemPrompt(diagramType);
  const userPrompt = buildRepairUserPrompt(existingCode, report);

  const aiResponse = await generateText(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      timeoutMs: DIAGRAM_GENERATION_TIMEOUT_MS,
      temperature: 0.2,
      maxTokens: DEFAULT_MAX_TOKENS,
    },
  );

  const repaired = parseAIResponse(aiResponse, format, diagramType);
  const repairedParsed = safeParseDiagramGraph(repaired.code);
  if (!repairedParsed) return null;

  const repairedReport = analyzeConnectivity(repairedParsed);
  const improvedOrphans = repairedReport.orphanNodeIds.length < report.orphanNodeIds.length;
  const improvedComponents = repairedReport.componentCount < report.componentCount;
  if (!improvedOrphans && !improvedComponents) return null;
  return repaired;
}

function buildRepairSystemPrompt(diagramType: DiagramType | undefined): string {
  const parts: string[] = [
    'You are a diagram repair assistant. Your sole task is to add the missing connections needed to fix isolated nodes and disconnected subgraphs.',
    'Preserve every existing node, group, label, position, icon, and existing connection EXACTLY.',
    'Add only the minimum number of new connections required to make the diagram a single connected graph.',
    'Each new connection MUST have a short "label" describing what flows between the nodes.',
    'Output ONLY valid JSON in the same shape as the input. No commentary, no markdown.',
    '',
    'JSON shape: { "nodes": [...], "connections": [...], "groups": [...] }',
  ];
  if (diagramType) parts.push(`The diagram type is ${diagramType}.`);
  return parts.join('\n');
}

function buildRepairUserPrompt(
  existingCode: string,
  report: ConnectivityReport,
): string {
  const issues: string[] = [];
  if (report.orphanNodeIds.length > 0) {
    issues.push(
      `Isolated nodes (no connections): ${report.orphanNodeIds.join(', ')}.`,
    );
  }
  if (report.componentCount > 1) {
    issues.push(
      `The diagram has ${report.componentCount} disconnected subgraphs. Connect them so the diagram forms a single connected graph.`,
    );
  }

  return [
    'The previous diagram has connectivity issues:',
    issues.join('\n'),
    '',
    'Fix the diagram by adding the missing connections. Preserve all existing nodes, groups, and connections. Output ONLY the corrected JSON.',
    '',
    'Current diagram JSON:',
    existingCode,
  ].join('\n');
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
      return `This is a sequence diagram showing interactions between real named services.
- Represent each participant (API Gateway, AuthService, PaymentService, Database, ExternalProvider, etc.) as a node arranged horizontally at increasing x values, all at the same y.
- Connections represent ordered messages. Label each connection with the actual operation: "POST /auth/token", "validateJWT", "charge(amount)", "INSERT order", etc.
- Include at least one synchronous request/response pair, one async operation (dashed/event), and one error/alt path.
- Use at least 5 distinct participants. Derive real names from the user's prompt.`;

    case 'class-diagram':
      return `This is a UML class diagram with domain-driven design.
- Derive entity names from the user prompt (e.g. User, Order, Product, Payment, Inventory, etc.).
- Include at least one abstract base class or interface, two concrete implementations, and at least one association/composition.
- Label connections with relationship type and multiplicity: "extends", "implements", "1..* orders", "has many", "composed of".
- Each class node label should be the class name. Use icon "default" for classes, "database" for repositories, "server" for services.
- Minimum 8 nodes.`;

    case 'er-diagram':
      return `This is a production-ready Entity-Relationship diagram.
- Derive entity names from the user prompt (e.g. User, Product, Order, OrderItem, Category, Review, Payment, Address).
- Each entity MUST have representative attributes listed in the label (e.g. "Order | id, userId, total, status").
- Include at least one M:N relationship with a junction/bridge table (e.g. OrderItem between Order and Product).
- Label connections with precise cardinality: "1:1", "1:N", "M:N", "has many", "belongs to".
- Minimum 6 entity nodes plus at least 1 junction table node.
- Use icon "database" for entities and "data-warehouse" for junction tables.`;

    case 'state-diagram':
      return `This is a UML state machine diagram with guard conditions.
- Include an initial state (label: "Start", icon "default"), at least one composite/nested state, and a terminal state (label: "End").
- Derive states from the user prompt — use realistic names like "Idle", "Authenticating", "Processing", "Failed", "Completed", "Retrying".
- Label every transition with: trigger [guard] / action notation e.g. "submitOrder [valid] / createInvoice".
- Include at least one self-loop (retry), one error path (→ Failed → retry or End), and one happy path.
- Minimum 6 state nodes.`;

    case 'network':
      return `This is a professional network topology diagram.
- Zone groups: Internet, DMZ, Internal LAN, Secure Zone, Management.
- Always include: Internet (user) → Firewall/FortiGate → DMZ (Reverse Proxy/Nginx, WAF) → Internal LAN (Load Balancer, App Servers, DB Cluster) → Secure Zone (Vault, LDAP) → Management (Monitoring, Logging, Bastion Host).
- Use specific icons: firewall, proxy, load-balancer, server, database, monitoring, shield, key, user.
- Label connections with protocol/port: "HTTPS:443", "SSH:22", "PostgreSQL:5432", "gRPC:50051", "LDAP:389".
- Group by zone. Include a Bastion Host in the Management zone.
- Minimum 12 nodes across at least 4 zones.`;

    case 'data-flow':
      return `This is a Level-1 Data Flow Diagram (DFD) with realistic data stores and processes.
- External entities (users, external systems) on the left. Processes in the middle. Data stores on the right.
- Derive process names from the prompt: "Validate Request", "Enrich Data", "Transform & Aggregate", "Persist Record", "Notify Downstream".
- Each data store should be named: "UserDB", "EventLog", "CacheLayer", "S3 Archive".
- Label every flow with the data being moved: "raw event", "validated payload", "enriched record", "audit log entry".
- Include at least one data store that is read and written by different processes.
- Use icons: user/browser for external entities, default/microservice for processes, database/nosql/object-storage for stores.
- Minimum 8 nodes.`;

    case 'bpmn':
      return `This is a BPMN 2.0 process diagram with proper event and gateway types.
- Include: Start Event → one or more Tasks (User Task, Service Task) → at least one Exclusive Gateway (XOR decision) with labeled Yes/No branches → at least one Parallel Gateway → End Event.
- Model a realistic business process from the prompt (e.g. "Order Processing", "User Onboarding", "Incident Response").
- Use pools to separate actors: one pool per major participant (Customer, System, Finance, Ops).
- Label gateway branches with conditions: "Payment Approved?", "Stock Available?", "Retry < 3?".
- Include an error End Event on the exception path.
- Use icon "default" for Tasks, "shield" for Gateways, "user" for User Tasks, "api" for Service Tasks.
- Minimum 10 nodes across at least 2 pools.`;

    case 'cloud-architecture':
      return `You are generating a PRODUCTION-GRADE cloud architecture diagram. Think like a senior solutions architect.

ARCHITECTURE SCOPE: Generate a realistic multi-tier, multi-service architecture for the described system. Do NOT generate a minimal toy diagram.

NODE COUNT: Generate 14–22 nodes. A real production system always has multiple tiers.

ENTRY POINT (MANDATORY): Always start with a "user" or "browser" node as the external actor.

CANONICAL LAYER STRUCTURE (adapt to the detected platform):

AWS architecture MUST follow this pattern unless the prompt says otherwise:
  Ingress:     user → aws-route53 → aws-cloudfront → aws-waf → aws-elb
  Compute:     aws-elb → (aws-ecs OR aws-eks OR aws-lambda) — include 2–3 compute services
  Data:        compute → aws-rds (primary) + aws-aurora OR aws-rds-replica + aws-elasticache + aws-dynamodb (if NoSQL needed)
  Storage:     aws-s3 (static assets + backups)
  Messaging:   aws-sqs + aws-sns OR aws-eventbridge (for async/event flows)
  Security:    aws-iam + aws-cognito + aws-kms (in Security group, connected to compute and data tiers)
  Observability: aws-cloudwatch + aws-x-ray connected to ALL compute services

Azure architecture MUST follow this pattern:
  Ingress:     user → azure-traffic-manager → azure-front-door → azure-cdn → azure-load-balancer
  Compute:     azure-aks OR azure-app-service + azure-functions (event-driven)
  Data:        azure-sql + azure-cosmos-db + azure-redis
  Messaging:   azure-service-bus + azure-event-hub
  Security:    azure-active-directory + azure-key-vault
  Observability: azure-monitor + azure-app-insights

GCP architecture MUST follow this pattern:
  Ingress:     user → gcp-cloud-dns → gcp-cloud-cdn → gcp-cloud-load-balancing → gcp-cloud-armor
  Compute:     gcp-gke OR gcp-cloud-run + gcp-cloud-functions
  Data:        gcp-cloud-sql + gcp-spanner OR gcp-firestore + gcp-memorystore
  Messaging:   gcp-pubsub + gcp-eventarc
  Security:    gcp-iam + gcp-kms + gcp-secret-manager
  Observability: gcp-cloud-monitoring + gcp-cloud-logging

GROUPS (MANDATORY — use these exact group names and colors):
  { "id": "ingress",     "label": "Ingress & CDN",     "color": "#e0f2fe" }
  { "id": "compute",     "label": "Compute",            "color": "#f0fdf4" }
  { "id": "data",        "label": "Data & Storage",     "color": "#fef9c3" }
  { "id": "messaging",   "label": "Messaging & Events", "color": "#fce7f3" }
  { "id": "security",    "label": "Security & Identity","color": "#fef2f2" }
  { "id": "observability","label": "Observability",     "color": "#f5f3ff" }

MANDATORY CONNECTIONS (every architecture MUST have these cross-group flows):
  - WAF/Shield → Load Balancer (labeled: "filtered HTTPS")
  - Load Balancer → every compute service (labeled: "HTTP/gRPC")
  - Every compute service → primary database (labeled: "SQL/read-write")
  - Every compute service → cache (labeled: "cache read/write")
  - Every compute service → object storage (labeled: "PUT/GET assets")
  - Compute services → message queue (labeled: "publish event")
  - Message queue → async compute (Lambda/Functions) (labeled: "trigger")
  - Async compute → secondary data store (labeled: "write record")
  - ALL compute AND data services → monitoring (labeled: "metrics & logs")
  - Monitoring → alerting/tracing services (labeled: "alert/trace")`;

    default:
      return `Arrange nodes logically based on the diagram content. Minimum 6 nodes.`;
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
  parts.push('');
  parts.push(formatIconCatalogForPrompt());
  parts.push(buildIconSelectionRules());
  parts.push('');
  parts.push('RULES:');
  parts.push('- Each node MUST have: id (string, kebab-case), label (string, 1-4 words), icon (from available set), x (number 100-1200), y (number 50-800)');
  parts.push('- Space nodes at least 220px apart horizontally and 160px apart vertically so they do not overlap');
  parts.push('- Group nodes logically and assign a "group" field matching a group id');
  parts.push('- Connections reference node ids via "from" and "to" fields');
  parts.push('- For cloud-architecture: generate 14-22 nodes for a realistic production diagram');
  parts.push('- For all other diagram types: generate 7-15 nodes for a rich, readable diagram');
  parts.push('- NEVER generate fewer than 6 nodes');
  parts.push('- Groups should have distinct soft pastel colors (hex values)');

  // Universal connectivity rules (applies to every diagram type)
  parts.push(buildConnectivityRulesSection());

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

  // Add template constraints, formatting rules, and layout ordering
  if (context.template?.structure) {
    const { diagramConstraints, formattingRules, layoutOrdering } = context.template.structure;
    if (diagramConstraints && diagramConstraints.length > 0) {
      parts.push(buildConstraintsSection(diagramConstraints));
    }
    if (formattingRules && formattingRules.length > 0) {
      parts.push(buildFormattingRulesSection(formattingRules));
    }
    if (layoutOrdering && layoutOrdering.length > 0) {
      parts.push(buildLayoutOrderingSection(layoutOrdering));
    }
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
  parts.push(buildIconSelectionRules());

  // Universal connectivity rules also apply during refinement
  parts.push(buildConnectivityRulesSection());

  if (diagramType) {
    parts.push(`The diagram is a ${diagramType} diagram.`);
  } else {
    parts.push(
      'Maintain the existing diagram type. Include a "diagramType" field set to one of: ' +
        SUPPORTED_DIAGRAM_TYPES.join(', '),
    );
  }

  // Add template constraints, formatting rules, and layout ordering
  if (context.template?.structure) {
    const { diagramConstraints, formattingRules, layoutOrdering } = context.template.structure;
    if (diagramConstraints && diagramConstraints.length > 0) {
      parts.push(buildConstraintsSection(diagramConstraints));
    }
    if (formattingRules && formattingRules.length > 0) {
      parts.push(buildFormattingRulesSection(formattingRules));
    }
    if (layoutOrdering && layoutOrdering.length > 0) {
      parts.push(buildLayoutOrderingSection(layoutOrdering));
    }
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
