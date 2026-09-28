export interface DiagramData {
  nodes: Array<{
    id: string;
    label: string;
    icon: string;
    group?: string;
    x: number;
    y: number;
  }>;
  connections: Array<{
    from: string;
    to: string;
    label?: string;
    color?: string;
    arrowStyle?: 'closed' | 'open' | 'none';
  }>;
  groups: Array<{
    id: string;
    label: string;
    color: string;
  }>;
}

function isDiagramGraph(value: unknown): value is DiagramData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const graph = value as { nodes?: unknown; connections?: unknown };
  return (
    Array.isArray(graph.nodes) &&
    graph.nodes.length > 0 &&
    graph.nodes.some(
      (node) =>
        typeof node === 'object' &&
        node !== null &&
        typeof (node as { id?: unknown }).id === 'string',
    ) &&
    (graph.connections === undefined || Array.isArray(graph.connections))
  );
}

function getJsonCandidates(text: string): string[] {
  const trimmed = text.trim().replace(/^\uFEFF/, '');
  const candidates = [trimmed];

  for (const match of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    candidates.push(match[1].trim());
  }

  for (let start = trimmed.indexOf('{'); start !== -1; start = trimmed.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < trimmed.length; index += 1) {
      const character = trimmed[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }

      if (character === '"') inString = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          candidates.push(trimmed.slice(start, index + 1));
          break;
        }
      }
    }
  }

  return candidates;
}

function findGraph(value: unknown, depth: number): DiagramData | null {
  if (isDiagramGraph(value)) return value;
  if (depth >= 2) return null;

  if (typeof value === 'string') {
    return parseCandidates(value, depth + 1);
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const wrapper = value as { content?: unknown; diagram?: unknown; data?: unknown };
    for (const nested of [wrapper.diagram, wrapper.content, wrapper.data]) {
      const graph = findGraph(nested, depth + 1);
      if (graph) return graph;
    }
  }

  return null;
}

function parseCandidates(text: string, depth: number): DiagramData | null {
  for (const candidate of getJsonCandidates(text)) {
    try {
      const graph = findGraph(JSON.parse(candidate), depth);
      if (graph) return graph;
    } catch {
      // Try the next fenced or embedded JSON candidate.
    }
  }
  return null;
}

export function parseDiagramGraph(content: string): DiagramData | null {
  return parseCandidates(content, 0);
}