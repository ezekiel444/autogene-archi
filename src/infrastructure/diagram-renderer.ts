/**
 * Diagram Renderer
 *
 * Renders diagram code (Mermaid or PlantUML) into SVG visual output.
 *
 * - Mermaid: Since mermaid v11 requires a browser DOM, server-side rendering
 *   returns a pass-through SVG placeholder. Actual rendering happens client-side.
 * - PlantUML: Renders via the PlantUML public server (http://www.plantuml.com/plantuml/svg/).
 * - Enforces a 3-second render timeout (RENDER_TIMEOUT_MS).
 * - Retains last valid render on error.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 11.2, 11.3, 11.4
 */

import type { OutputFormat, RenderResult } from '../types/index.js';
import { RENDER_TIMEOUT_MS } from '../types/index.js';

// ─── State ───────────────────────────────────────────────────────────────────

/**
 * Cache of last valid render per format, keyed by diagram code hash.
 * Used to retain last valid render on error (Requirement 4.3, 11.3, 11.4).
 */
let lastValidRender: RenderResult | null = null;

// ─── PlantUML Encoding ───────────────────────────────────────────────────────

/**
 * Encodes a PlantUML diagram string for the PlantUML web service URL.
 * Uses the PlantUML text encoding: deflate + custom base64.
 */
function encodePlantUml(code: string): string {
  // PlantUML uses a custom encoding: deflate then encode with a modified base64
  // For simplicity and reliability, use the hex encoding approach (~h prefix)
  const hex = Buffer.from(code, 'utf-8').toString('hex');
  return '~h' + hex;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Basic syntax validation for diagram code.
 * Returns true if the code appears syntactically valid for the given format.
 */
export function isValid(code: string, format: OutputFormat): boolean {
  if (!code || code.trim().length === 0) {
    return false;
  }

  if (format === 'mermaid') {
    return isValidMermaid(code);
  }

  if (format === 'plantuml') {
    return isValidPlantUml(code);
  }

  return false;
}

/**
 * Basic Mermaid syntax validation.
 * Checks for recognized diagram type keywords.
 */
function isValidMermaid(code: string): boolean {
  const trimmed = code.trim();
  const mermaidKeywords = [
    'graph',
    'flowchart',
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'erDiagram',
    'gantt',
    'pie',
    'gitGraph',
    'journey',
    'mindmap',
    'timeline',
    'quadrantChart',
    'sankey',
    'xychart',
    'block',
    'C4Context',
    'C4Container',
    'C4Component',
    'C4Deployment',
    'architecture',
    'packet',
    'kanban',
  ];

  const firstLine = trimmed.split('\n')[0].trim();
  return mermaidKeywords.some(
    (keyword) => firstLine.startsWith(keyword) || firstLine.startsWith(keyword + ' '),
  );
}

/**
 * Basic PlantUML syntax validation.
 * Checks for @startuml/@enduml markers.
 */
function isValidPlantUml(code: string): boolean {
  const trimmed = code.trim();
  return trimmed.startsWith('@startuml') && trimmed.includes('@enduml');
}

// ─── Rendering ───────────────────────────────────────────────────────────────

/**
 * Renders diagram code to SVG.
 *
 * - Mermaid: Returns a pass-through result (client-side rendering required).
 * - PlantUML: Fetches SVG from the PlantUML public server.
 *
 * Enforces RENDER_TIMEOUT_MS (3 seconds). On error, returns the last valid render
 * if available, otherwise throws.
 */
export async function render(code: string, format: OutputFormat): Promise<RenderResult> {
  try {
    const result = await renderWithTimeout(code, format);
    lastValidRender = result;
    return result;
  } catch (error) {
    if (lastValidRender) {
      return lastValidRender;
    }
    throw error;
  }
}

/**
 * Internal render with timeout enforcement.
 */
async function renderWithTimeout(code: string, format: OutputFormat): Promise<RenderResult> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Render timeout: exceeded 3 second limit')), RENDER_TIMEOUT_MS);
  });

  const renderPromise = format === 'mermaid'
    ? renderMermaid(code)
    : renderPlantUml(code);

  return Promise.race([renderPromise, timeoutPromise]);
}

/**
 * Mermaid rendering (server-side pass-through).
 *
 * Since mermaid v11 requires a full browser DOM environment, server-side
 * rendering returns a placeholder SVG. The client will use mermaid.js directly
 * for real visual rendering.
 */
async function renderMermaid(code: string): Promise<RenderResult> {
  // Server-side: return a placeholder SVG that signals client-side rendering is needed.
  // The placeholder contains the code as a data attribute for the client to pick up.
  const escapedCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const width = 800;
  const height = 600;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" data-mermaid-source="${escapedCode}" data-requires-client-render="true">`,
    `  <rect width="100%" height="100%" fill="#f8f9fa" />`,
    `  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14" fill="#6c757d">`,
    `    Mermaid diagram - client-side rendering required`,
    `  </text>`,
    `</svg>`,
  ].join('\n');

  return { svg, width, height };
}

/**
 * PlantUML rendering via the PlantUML public server.
 * Encodes the diagram and fetches SVG from http://www.plantuml.com/plantuml/svg/
 */
async function renderPlantUml(code: string): Promise<RenderResult> {
  const encoded = encodePlantUml(code);
  const url = `http://www.plantuml.com/plantuml/svg/${encoded}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`PlantUML server returned HTTP ${response.status}: ${response.statusText}`);
  }

  const svg = await response.text();

  // Extract dimensions from the SVG if available
  const { width, height } = extractSvgDimensions(svg);

  return { svg, width, height };
}

/**
 * Extracts width and height from an SVG string.
 * Falls back to default dimensions if not found.
 */
function extractSvgDimensions(svg: string): { width: number; height: number } {
  const widthMatch = svg.match(/width="(\d+)(?:px)?"/);
  const heightMatch = svg.match(/height="(\d+)(?:px)?"/);

  const width = widthMatch ? parseInt(widthMatch[1], 10) : 800;
  const height = heightMatch ? parseInt(heightMatch[1], 10) : 600;

  return { width, height };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Indicates whether a given format can be rendered server-side.
 * Mermaid requires a browser; PlantUML uses the public server.
 */
export function canRenderServerSide(format: OutputFormat): boolean {
  return format === 'plantuml';
}

/**
 * Returns the last valid render result, or null if none exists.
 * Used for retaining last valid render on error (Req 4.3, 11.3, 11.4).
 */
export function getLastValidRender(): RenderResult | null {
  return lastValidRender;
}

/**
 * Resets the last valid render cache. Primarily used for testing.
 */
export function resetLastValidRender(): void {
  lastValidRender = null;
}
