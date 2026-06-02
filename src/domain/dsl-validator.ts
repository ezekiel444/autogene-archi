/**
 * DSL Validator - Validates Mermaid and PlantUML diagram syntax.
 *
 * Uses regex-based structural validation for server-side use.
 * This is a "best effort" validator — real validation happens client-side when rendering.
 *
 * Requirements: 2.1, 2.4, 11.3
 */

import type { OutputFormat, ValidationResult, SyntaxError } from '../types/index.js';

// ─── Valid Mermaid Diagram Keywords ──────────────────────────────────────────

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

// ─── Mermaid Direction Keywords ──────────────────────────────────────────────

const MERMAID_DIRECTIONS = ['TD', 'TB', 'BT', 'LR', 'RL'];

// ─── Mermaid Validation ──────────────────────────────────────────────────────

/**
 * Validates Mermaid diagram code using structural checks.
 * Checks that the code starts with a valid diagram keyword and has basic structural integrity.
 */
function validateMermaid(code: string): SyntaxError[] {
  const errors: SyntaxError[] = [];
  const trimmed = code.trim();

  if (trimmed.length === 0) {
    errors.push({
      line: 1,
      column: 1,
      message: 'Empty diagram code',
      severity: 'error',
    });
    return errors;
  }

  const lines = trimmed.split('\n');
  const firstLine = lines[0].trim();

  // Check if the first line starts with a valid Mermaid keyword
  const startsWithValidKeyword = MERMAID_DIAGRAM_KEYWORDS.some((keyword) => {
    if (keyword === 'graph' || keyword === 'flowchart') {
      // graph/flowchart may be followed by a direction keyword
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

  // Check bracket balance for graph/flowchart diagrams
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
          errors.push({
            line: i + 1,
            column: j + 1,
            message: 'Unmatched closing bracket "]"',
            severity: 'error',
          });
          squareBrackets = 0;
        }
        if (curlyBrackets < 0) {
          errors.push({
            line: i + 1,
            column: j + 1,
            message: 'Unmatched closing bracket "}"',
            severity: 'error',
          });
          curlyBrackets = 0;
        }
        if (roundBrackets < 0) {
          errors.push({
            line: i + 1,
            column: j + 1,
            message: 'Unmatched closing bracket ")"',
            severity: 'error',
          });
          roundBrackets = 0;
        }
      }
    }

    if (squareBrackets > 0) {
      errors.push({
        line: lines.length,
        column: lines[lines.length - 1].length,
        message: `Unmatched opening bracket "[" (${squareBrackets} unclosed)`,
        severity: 'error',
      });
    }
    if (curlyBrackets > 0) {
      errors.push({
        line: lines.length,
        column: lines[lines.length - 1].length,
        message: `Unmatched opening bracket "{" (${curlyBrackets} unclosed)`,
        severity: 'error',
      });
    }
    if (roundBrackets > 0) {
      errors.push({
        line: lines.length,
        column: lines[lines.length - 1].length,
        message: `Unmatched opening bracket "(" (${roundBrackets} unclosed)`,
        severity: 'error',
      });
    }
  }

  return errors;
}

// ─── PlantUML Validation ─────────────────────────────────────────────────────

/**
 * Validates PlantUML diagram code using structural checks.
 * Checks for @startuml/@enduml markers and basic structural validity.
 */
function validatePlantUML(code: string): SyntaxError[] {
  const errors: SyntaxError[] = [];
  const trimmed = code.trim();

  if (trimmed.length === 0) {
    errors.push({
      line: 1,
      column: 1,
      message: 'Empty diagram code',
      severity: 'error',
    });
    return errors;
  }

  const lines = trimmed.split('\n');

  // Check for @startuml marker
  const firstNonEmptyLine = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmptyLine === -1 || !lines[firstNonEmptyLine].trim().startsWith('@startuml')) {
    errors.push({
      line: 1,
      column: 1,
      message: 'PlantUML diagram must start with @startuml',
      severity: 'error',
    });
  }

  // Check for @enduml marker
  const lastNonEmptyLineIndex = findLastNonEmptyLine(lines);
  if (lastNonEmptyLineIndex === -1 || !lines[lastNonEmptyLineIndex].trim().startsWith('@enduml')) {
    errors.push({
      line: lines.length,
      column: 1,
      message: 'PlantUML diagram must end with @enduml',
      severity: 'error',
    });
  }

  // Check that there's content between start and end markers
  if (errors.length === 0) {
    const startLine = firstNonEmptyLine;
    const endLine = lastNonEmptyLineIndex;

    if (endLine - startLine <= 1) {
      // Only @startuml and @enduml, no content between them
      const contentBetween = lines
        .slice(startLine + 1, endLine)
        .some((l) => l.trim().length > 0);

      if (!contentBetween && endLine - startLine <= 1) {
        errors.push({
          line: startLine + 1,
          column: 1,
          message: 'PlantUML diagram has no content between @startuml and @enduml',
          severity: 'warning',
        });
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

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validates diagram code against the specified DSL format rules.
 *
 * @param code - The diagram source code to validate
 * @param format - The output format ('mermaid' or 'plantuml')
 * @returns ValidationResult with isValid flag and any errors found
 */
export function validate(code: string, format: OutputFormat): ValidationResult {
  const syntaxErrors = format === 'mermaid'
    ? validateMermaid(code)
    : validatePlantUML(code);

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
 * @param code - The diagram source code to validate
 * @param format - The output format ('mermaid' or 'plantuml')
 * @returns The first SyntaxError found, or null if the code is valid
 */
export function getFirstError(code: string, format: OutputFormat): SyntaxError | null {
  const syntaxErrors = format === 'mermaid'
    ? validateMermaid(code)
    : validatePlantUML(code);

  const firstError = syntaxErrors.find((e) => e.severity === 'error');
  return firstError ?? null;
}
