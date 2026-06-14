import dagre from '@dagrejs/dagre';
import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { DiagramData } from '../App';

const NODE_WIDTH  = 160;
const NODE_HEIGHT = 88;
const GROUP_PADDING = 32;

// ─── Edge color by label keyword ─────────────────────────────────────────────

function edgeStyle(label: string): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
} {
  const l = (label || '').toLowerCase();
  if (/event|async|publish|subscribe|trigger|sns|sqs|pubsub/.test(l))
    return { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '6 3' };
  if (/https|http|rest|request|response|api/.test(l))
    return { stroke: '#3b82f6', strokeWidth: 2 };
  if (/grpc|rpc/.test(l))
    return { stroke: '#8b5cf6', strokeWidth: 2 };
  if (/sql|read|write|query|insert|db/.test(l))
    return { stroke: '#10b981', strokeWidth: 2 };
  if (/cache|redis|memcached/.test(l))
    return { stroke: '#f97316', strokeWidth: 2 };
  if (/log|metric|monitor|trace|alert/.test(l))
    return { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '4 2' };
  if (/error|fail|reject|dlq/.test(l))
    return { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '3 3' };
  if (/ssh|vpn|tunnel/.test(l))
    return { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '5 4' };
  return { stroke: '#94a3b8', strokeWidth: 2 };
}

function isAsyncEdge(label: string): boolean {
  return /event|async|publish|trigger|sns|sqs|pubsub|stream|kinesis/i.test(label);
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function getAutoLayout(data: DiagramData): { nodes: Node[]; edges: Edge[] } {
  // ── 1. Run dagre layout ───────────────────────────────────────────────────
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    nodesep: 90,
    ranksep: 140,
    marginx: 60,
    marginy: 60,
  });

  for (const node of data.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const conn of data.connections) {
    g.setEdge(conn.from, conn.to);
  }

  dagre.layout(g);

  // ── 2. Build positioned nodes ─────────────────────────────────────────────
  // Build a group-color lookup from the groups array
  const groupColors: Record<string, string> = {};
  for (const grp of data.groups ?? []) {
    groupColors[grp.id] = grp.color;
  }

  const flowNodes: Node[] = data.nodes.map((node) => {
    const dn = g.node(node.id);
    return {
      id: node.id,
      type: 'cloudService',
      position: {
        x: dn.x - NODE_WIDTH / 2,
        y: dn.y - NODE_HEIGHT / 2,
      },
      data: {
        label: node.label,
        icon: node.icon,
        group: node.group,
        groupColor: node.group ? (groupColors[node.group] ?? null) : null,
      },
    };
  });

  // ── 3. Compute group bounding boxes → background panel nodes ─────────────
  const groupBoxes: Record<
    string,
    { minX: number; minY: number; maxX: number; maxY: number; color: string; label: string }
  > = {};

  for (const node of flowNodes) {
    const grpId = (node.data as { group?: string }).group;
    if (!grpId) continue;
    const color = groupColors[grpId] ?? '#f1f5f9';
    const grpMeta = data.groups?.find((g) => g.id === grpId);
    const label  = grpMeta?.label ?? grpId;

    const x = node.position.x;
    const y = node.position.y;

    if (!groupBoxes[grpId]) {
      groupBoxes[grpId] = { minX: x, minY: y, maxX: x + NODE_WIDTH, maxY: y + NODE_HEIGHT, color, label };
    } else {
      const b = groupBoxes[grpId];
      b.minX = Math.min(b.minX, x);
      b.minY = Math.min(b.minY, y);
      b.maxX = Math.max(b.maxX, x + NODE_WIDTH);
      b.maxY = Math.max(b.maxY, y + NODE_HEIGHT);
    }
  }

  const panelNodes: Node[] = Object.entries(groupBoxes).map(([grpId, box]) => ({
    id: `__grp_${grpId}`,
    type: 'groupPanel',
    position: {
      x: box.minX - GROUP_PADDING,
      y: box.minY - GROUP_PADDING - 28, // 28px for header label
    },
    style: {
      width:  box.maxX - box.minX + GROUP_PADDING * 2,
      height: box.maxY - box.minY + GROUP_PADDING * 2 + 28,
      background: box.color,
      border: `1.5px solid ${box.color.replace(/f/g, 'd')}`,
      borderRadius: 12,
      zIndex: -1,
      pointerEvents: 'none' as const,
    },
    data: { label: box.label, color: box.color },
    selectable: false,
    draggable: false,
  }));

  // ── 4. Build styled edges ─────────────────────────────────────────────────
  const flowEdges: Edge[] = data.connections.map((conn, i) => {
    const lbl = conn.label || '';
    const style = edgeStyle(lbl);
    const animated = isAsyncEdge(lbl);

    return {
      id: `e-${i}`,
      source: conn.from,
      target: conn.to,
      label: lbl,
      type: 'smoothstep',
      animated,
      style,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: style.stroke,
        width: 18,
        height: 18,
      },
      labelStyle: {
        fontSize: 10,
        fontWeight: 500,
        fill: '#374151',
      },
      labelBgStyle: {
        fill: '#ffffff',
        fillOpacity: 0.88,
        stroke: style.stroke,
        strokeWidth: 0.5,
      },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
    };
  });

  // Panel nodes MUST come before service nodes so they render behind
  return { nodes: [...panelNodes, ...flowNodes], edges: flowEdges };
}
