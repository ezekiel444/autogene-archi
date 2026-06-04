import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { DiagramData } from '../App';

const NODE_WIDTH = 150;
const NODE_HEIGHT = 80;

export function getAutoLayout(data: DiagramData): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    nodesep: 80,
    ranksep: 120,
    marginx: 40,
    marginy: 40,
  });

  // Add nodes
  for (const node of data.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Add edges
  for (const conn of data.connections) {
    g.setEdge(conn.from, conn.to);
  }

  dagre.layout(g);

  // Convert to React Flow format
  const nodes: Node[] = data.nodes.map((node) => {
    const dagreNode = g.node(node.id);
    return {
      id: node.id,
      type: 'cloudService',
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - NODE_HEIGHT / 2,
      },
      data: { label: node.label, icon: node.icon, group: node.group },
    };
  });

  const edges: Edge[] = data.connections.map((conn, i) => ({
    id: `e-${i}`,
    source: conn.from,
    target: conn.to,
    label: conn.label || '',
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#94a3b8', strokeWidth: 2 },
  }));

  return { nodes, edges };
}
