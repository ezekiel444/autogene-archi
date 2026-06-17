import dagre from '@dagrejs/dagre';
import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { DiagramData } from '../App';
import { resolveEdgeStyle } from './edgeStyle';

const NODE_WIDTH  = 160;
const NODE_HEIGHT = 88;
const GROUP_PADDING = 32;

// ─── Layout ───────────────────────────────────────────────────────────────────

export function getAutoLayout(data: DiagramData): { nodes: Node[]; edges: Edge[] } {
  // ── 1. Run dagre layout ───────────────────────────────────────────────────
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    nodesep: 50,
    ranksep: 90,
    marginx: 40,
    marginy: 40,
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
    },
    data: { label: box.label, color: box.color, groupId: grpId },
    selectable: true,
    draggable: true,
  }));

  // ── 4. Build styled edges ─────────────────────────────────────────────────
  const flowEdges: Edge[] = data.connections.map((conn, i) => {
    const lbl = conn.label || '';
    const resolved = resolveEdgeStyle(lbl, conn.color, conn.arrowStyle);

    // Determine markerEnd based on resolved markerType
    let markerEnd: Edge['markerEnd'] | undefined;
    if (resolved.markerType === 'closed') {
      markerEnd = {
        type: MarkerType.ArrowClosed,
        color: resolved.stroke,
        width: 18,
        height: 18,
      };
    } else if (resolved.markerType === 'open') {
      markerEnd = {
        type: MarkerType.Arrow,
        color: resolved.stroke,
        width: 18,
        height: 18,
      };
    }
    // 'none' → no markerEnd

    return {
      id: `e-${i}`,
      source: conn.from,
      target: conn.to,
      type: 'custom',
      animated: resolved.animated,
      markerEnd,
      data: {
        label: lbl,
        stroke: resolved.stroke,
        strokeWidth: resolved.strokeWidth,
        strokeDasharray: resolved.strokeDasharray,
        animated: resolved.animated,
        markerType: resolved.markerType,
      },
    };
  });

  // Panel nodes MUST come before service nodes so they render behind
  return { nodes: [...panelNodes, ...flowNodes], edges: flowEdges };
}
