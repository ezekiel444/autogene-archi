/**
 * Diagram Validator — validates diagram source before rendering.
 *
 * The generator emits the interactive `node-graph` format: a JSON
 * `{ nodes, connections, groups }` object rendered client-side (React Flow).
 * This validator's primary job is to check that graph is structurally sound
 * (parseable, has nodes, connections reference real nodes).
 *
 * Legacy `mermaid` / `plantuml` structural checks are retained for backward
 * compatibility with older sessions/requests, but are no longer the default.
 *
 * This is a "best effort" validator — final rendering happens client-side.
 */

import type { OutputFormat, ValidationResult, SyntaxError } from '../types/index.js';

// ─── Node-graph Validation (primary) ─────────────────────────────────────────

interface RawNode {
  id?: unknown;
  label?: unknown;
  group?: unknown;
}

interface RawConnection {
  from?: unknown;
  to?: unknown;
}

/**
 * Validates the JSON node/connection graph the generator actually produces.
 *
 * Checks:
 *  - the payload is valid JSON describing an object,
 *  - `nodes` is a non-empty array of objects each with a string `id`,
 *  - node ids are unique,
 *  - every connection references existing node ids.
 */
function validateNodeGraph(code: string): SyntaxError[] {
  const errors: SyntaxError[] = [];
  const trimmed = code.trim();

  if (trimmed.length === 0) {
    errors.push({ line: 1, column: 1, message: 'Empty diagram content', severity: 'error' });
    return errors;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON';
    errors.push({ line: 1, column: 1, message: `Invalid JSON: ${message}`, severity: 'error' });
    return errors;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    errors.push({
      line: 1,
      column: 1,
      message: 'Diagram must be a JSON object with "nodes" and "connections"',
      severity: 'error',
    });
    return errors;
  }

  const graph = parsed as { nodes?: unknown; connections?: unknown };

  if (!Array.isArray(graph.nodes)) {
    errors.push({ line: 1, column: 1, message: 'Diagram must have a "nodes" array', severity: 'error' });
    return errors;
  }

  if (graph.nodes.length === 0) {
    errors.push({ line: 1, column: 1, message: 'Diagram must contain at least one node', severity: 'error' });
  }

  const seenIds = new Set<string>();
  const nodeIds = new Set<string>();
  graph.nodes.forEach((node, index) => {
    if (typeof node !== 'object' || node === null) {
      errors.push({ line: index + 1, column: 1, message: `Node at index ${index} is not an object`, severity: 'error' });
      return;
    }
    const id = (node as RawNode).id;
    if (typeof id !== 'string' || id.trim().length === 0) {
      errors.push({ line: index + 1, column: 1, message: `Node at index ${index} is missing a valid "id"`, severity: 'error' });
      return;
    }
    if (seenIds.has(id)) {
      errors.push({ line: index + 1, column: 1, message: `Duplicate node id "${id}"`, severity: 'error' });
    }
    seenIds.add(id);
    nodeIds.add(id);
  });

  // Connections are optional, but if present must reference known nodes.
  if (graph.connections !== undefined && !Array.isArray(graph.connections)) {
    errors.push({ line: 1, column: 1, message: '"connections" must be an array when present', severity: 'error' });
  } else if (Array.isArray(graph.connections)) {
    graph.connections.forEach((conn, index) => {
      if (typeof conn !== 'object' || conn === null) {
        errors.push({ line: index + 1, column: 1, message: `Connection at index ${index} is not an object`, severity: 'error' });
        return;
      }
      const { from, to } = conn as RawConnection;
      if (typeof from !== 'string' || typeof to !== 'string') {
        errors.push({ line: index + 1, column: 1, message: `Connection at index ${index} must have string "from" and "to"`, severity: 'error' });
        return;
      }
      if (!nodeIds.has(from)) {
        errors.push({ line: index + 1, column: 1, message: `Connection references unknown node "${from}"`, severity: 'warning' });
      }
      if (!nodeIds.has(to)) {
        errors.push({ line: index + 1, column: 1, message: `Connection references unknown node "${to}"`, severity: 'warning' });
      }
    });
  }

  return errors;
}

// ─── Legacy Mermaid Validation ───────────────────────────────────────────────

const MERMAID_DIAGRAM_KEYWORDS = [
  'graph',
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'pie',
  'gantt',
  'journey',
  'gitGraph',
  'mindmap',
  'timeline',
  'quadrantChart',
  'sankey-beta',
  'xychart-beta',
  'block-beta',
  'packet-beta',
  'kanban',
  'architecture-beta',
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Deployment',
  'requirementDiagram',
  'zenuml',
];

const MERMAID_DIRECTIONS = ['TD', 'TB', 'BT', 'LR', 'RL'];

/**
 * Validates Mermaid diagram code using structural checks (legacy support).
 */
function validateMermaid(code: string): SyntaxError[] {
  const errors: SyntaxError[] = [];
  const trimmed = code.trim();

  if (trimmed.length === 0) {
    errors.push({ line: 1, column: 1, message: 'Empty diagram code', severity: 'error' });
    return errors;
  }

  const lines = trimmed.split('\n');
  const firstLine = lines[0].trim();

  const startsWithValidKeyword = MERMAID_DIAGRAM_KEYWORDS.some((keyword) => {
    if (keyword === 'graph' || keyword === 'flowchart') {
      const pattern = new RegExp(`^${keyword}(\\s+(${MERMAID_DIRECTIONS.join('|')}))?\\s*$`);
      return pattern.test(firstLine) || firstLine.startsWith(`${keyword} `);
    }
    return firstLine === keyword || firstLine.startsWith(`${keyword} `) || firstLine.startsWith(`${keyword}\n`);
  });

  if (!startsWithValidKeyword) {
    errors.push({
      line: 1,
      column: 1,
      message: `Invalid diagram type. Expected one of: ${MERMAID_DIAGRAM_KEYWORDS.slice(0, 10).join(', ')}...`,
      severity: 'error',
    });
    return errors;
  }

  if (firstLine.startsWith('graph') || firstLine.startsWith('flowchart')) {
    let squareBrackets = 0;
    let curlyBrackets = 0;
    let roundBrackets = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '[') squareBrackets++;
        else if (ch === ']') squareBrackets--;
        else if (ch === '{') curlyBrackets++;
        else if (ch === '}') curlyBrackets--;
        else if (ch === '(') roundBrackets++;
        else if (ch === ')') roundBrackets--;

        if (squareBrackets < 0) {
          errors.push({ line: i + 1, column: j + 1, message: 'Unmatched closing bracket "]"', severity: 'error' });
          squareBrackets = 0;
        }
        if (curlyBrackets < 0) {
          errors.push({ line: i + 1, column: j + 1, message: 'Unmatched closing bracket "}"', severity: 'error' });
          curlyBrackets = 0;
        }
        if (roundBrackets < 0) {
          errors.push({ line: i + 1, column: j + 1, message: 'Unmatched closing bracket ")"', severity: 'error' });
          roundBrackets = 0;
        }
      }
    }

    if (squareBrackets > 0) {
      errors.push({ line: lines.length, column: lines[lines.length - 1].length, message: `Unmatched opening bracket "[" (${squareBrackets} unclosed)`, severity: 'error' });
    }
    if (curlyBrackets > 0) {
      errors.push({ line: lines.length, column: lines[lines.length - 1].length, message: `Unmatched opening bracket "{" (${curlyBrackets} unclosed)`, severity: 'error' });
    }
    if (roundBrackets > 0) {
      errors.push({ line: lines.length, column: lines[lines.length - 1].length, message: `Unmatched opening bracket "(" (${roundBrackets} unclosed)`, severity: 'error' });
    }
  }

  return errors;
}

// ─── Legacy PlantUML Validation ──────────────────────────────────────────────

/**
 * Validates PlantUML diagram code using structural checks (legacy support).
 */
function validatePlantUML(code: string): SyntaxError[] {
  const errors: SyntaxError[] = [];
  const trimmed = code.trim();

  if (trimmed.length === 0) {
    errors.push({ line: 1, column: 1, message: 'Empty diagram code', severity: 'error' });
    return errors;
  }

  const lines = trimmed.split('\n');

  const firstNonEmptyLine = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmptyLine === -1 || !lines[firstNonEmptyLine].trim().startsWith('@startuml')) {
    errors.push({ line: 1, column: 1, message: 'PlantUML diagram must start with @startuml', severity: 'error' });
  }

  const lastNonEmptyLineIndex = findLastNonEmptyLine(lines);
  if (lastNonEmptyLineIndex === -1 || !lines[lastNonEmptyLineIndex].trim().startsWith('@enduml')) {
    errors.push({ line: lines.length, column: 1, message: 'PlantUML diagram must end with @enduml', severity: 'error' });
  }

  if (errors.length === 0) {
    const startLine = firstNonEmptyLine;
    const endLine = lastNonEmptyLineIndex;

    if (endLine - startLine <= 1) {
      const contentBetween = lines.slice(startLine + 1, endLine).some((l) => l.trim().length > 0);
      if (!contentBetween && endLine - startLine <= 1) {
        errors.push({ line: startLine + 1, column: 1, message: 'PlantUML diagram has no content between @startuml and @enduml', severity: 'warning' });
      }
    }
  }

  return errors;
}

/**
 * Find the index of the last non-empty line.
 */
function findLastNonEmptyLine(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().length > 0) {
      return i;
    }
  }
  return -1;
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

/**
 * Runs the appropriate syntax check for the given format. Defaults to the
 * node-graph validator, which is the format the app actually produces.
 */
function collectErrors(code: string, format: OutputFormat): SyntaxError[] {
  if (format === 'mermaid') return validateMermaid(code);
  if (format === 'plantuml') return validatePlantUML(code);
  return validateNodeGraph(code);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validates diagram code against the specified format rules.
 *
 * @param code - The diagram source to validate
 * @param format - The output format; defaults to node-graph validation
 * @returns ValidationResult with isValid flag and any errors found
 */
export function validate(code: string, format: OutputFormat = 'node-graph'): ValidationResult {
  const syntaxErrors = collectErrors(code, format);

  const errors = syntaxErrors.map((e) => ({
    code: 'RENDER_SYNTAX_ERROR',
    message: `Line ${e.line}, Col ${e.column}: ${e.message}`,
    details: { line: e.line, column: e.column, severity: e.severity } as Record<string, unknown>,
  }));

  return {
    isValid: syntaxErrors.filter((e) => e.severity === 'error').length === 0,
    errors,
  };
}

/**
 * Returns the first syntax error found in the diagram code, or null if valid.
 *
 * @param code - The diagram source to validate
 * @param format - The output format; defaults to node-graph validation
 * @returns The first SyntaxError found, or null if the code is valid
 */
export function getFirstError(code: string, format: OutputFormat = 'node-graph'): SyntaxError | null {
  const syntaxErrors = collectErrors(code, format);
  const firstError = syntaxErrors.find((e) => e.severity === 'error');
  return firstError ?? null;
}
