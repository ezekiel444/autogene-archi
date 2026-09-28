import { parseDiagramGraph } from '../../frontend/src/utils/parseDiagramGraph';

const graph = {
  nodes: [{ id: 'user', label: 'User', icon: 'user', x: 100, y: 100 }],
  connections: [],
  groups: [],
};

describe('parseDiagramGraph', () => {
  it.each([
    ['plain JSON', JSON.stringify(graph)],
    ['a fenced JSON block', `\`\`\`json\n${JSON.stringify(graph)}\n\`\`\``],
    ['JSON surrounded by prose', `Here is the architecture:\n${JSON.stringify(graph)}\nDone.`],
    ['a JSON-encoded graph', JSON.stringify(JSON.stringify(graph))],
    ['a content wrapper', JSON.stringify({ content: JSON.stringify(graph) })],
  ])('extracts graph from %s', (_description, content) => {
    expect(parseDiagramGraph(content)).toEqual(graph);
  });

  it('rejects content that does not contain a graph', () => {
    expect(parseDiagramGraph('# Architecture\nThis is prose only.')).toBeNull();
    expect(parseDiagramGraph(JSON.stringify({ nodes: [{ label: 'No id' }] }))).toBeNull();
  });
});