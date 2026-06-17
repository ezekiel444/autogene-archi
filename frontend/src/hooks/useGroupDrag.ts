import { useCallback, useRef } from 'react';
import type { Node } from '@xyflow/react';

/**
 * Canvas bounds used for clamping group positions.
 * Using a very generous range (negative allowed) so groups can move
 * freely in all directions. React Flow supports infinite canvas.
 */
const CANVAS_MIN_X = -50000;
const CANVAS_MIN_Y = -50000;
const CANVAS_MAX_X = 50000;
const CANVAS_MAX_Y = 50000;

interface ChildOffset {
  id: string;
  dx: number;
  dy: number;
}

interface DragState {
  groupId: string;
  groupNodeId: string;
  initialGroupX: number;
  initialGroupY: number;
  childOffsets: ChildOffset[];
}

/**
 * Hook that enables dragging a group panel node and moving all its
 * child service nodes together, preserving their relative offsets.
 *
 * Individual service node drags are not intercepted — React Flow
 * handles them normally.
 */
export function useGroupDrag(
  nodes: Node[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  recordSnapshot: () => void
): {
  onNodeDragStart: (event: React.MouseEvent, node: Node) => void;
  onNodeDrag: (event: React.MouseEvent, node: Node) => void;
  onNodeDragStop: (event: React.MouseEvent, node: Node) => void;
} {
  const dragStateRef = useRef<DragState | null>(null);

  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Only intercept group panel drags
      if (node.type !== 'groupPanel') return;

      const groupId = (node.data as { groupId?: string }).groupId;
      if (!groupId) return;

      // Record snapshot for undo support before any changes
      recordSnapshot();

      // Find all child nodes belonging to this group
      const children = nodes.filter(
        (n) => (n.data as { group?: string }).group === groupId
      );

      // Store offsets relative to the group panel position
      const childOffsets: ChildOffset[] = children.map((child) => ({
        id: child.id,
        dx: child.position.x - node.position.x,
        dy: child.position.y - node.position.y,
      }));

      dragStateRef.current = {
        groupId,
        groupNodeId: node.id,
        initialGroupX: node.position.x,
        initialGroupY: node.position.y,
        childOffsets,
      };
    },
    [nodes, recordSnapshot]
  );

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const dragState = dragStateRef.current;

      // Only handle group panel drags
      if (!dragState || node.id !== dragState.groupNodeId) return;

      // Clamp group position to keep all children within canvas bounds
      const clampedPos = clampGroupPosition(
        node.position.x,
        node.position.y,
        dragState.childOffsets
      );

      // Apply the clamped group position and update all children
      setNodes((currentNodes) =>
        currentNodes.map((n) => {
          if (n.id === dragState.groupNodeId) {
            return { ...n, position: { x: clampedPos.x, y: clampedPos.y } };
          }

          // Check if this node is a child of the group
          const offset = dragState.childOffsets.find((o) => o.id === n.id);
          if (offset) {
            return {
              ...n,
              position: {
                x: clampedPos.x + offset.dx,
                y: clampedPos.y + offset.dy,
              },
            };
          }

          return n;
        })
      );
    },
    [setNodes]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const dragState = dragStateRef.current;

      // Only handle group panel drag stops
      if (!dragState || node.id !== dragState.groupNodeId) return;

      // Final position clamping on release
      const clampedPos = clampGroupPosition(
        node.position.x,
        node.position.y,
        dragState.childOffsets
      );

      // Finalize positions in state
      setNodes((currentNodes) =>
        currentNodes.map((n) => {
          if (n.id === dragState.groupNodeId) {
            return { ...n, position: { x: clampedPos.x, y: clampedPos.y } };
          }

          const offset = dragState.childOffsets.find((o) => o.id === n.id);
          if (offset) {
            return {
              ...n,
              position: {
                x: clampedPos.x + offset.dx,
                y: clampedPos.y + offset.dy,
              },
            };
          }

          return n;
        })
      );

      // Clear drag state
      dragStateRef.current = null;
    },
    [setNodes]
  );

  return { onNodeDragStart, onNodeDrag, onNodeDragStop };
}

/**
 * Clamps the group position so that neither the group itself nor any
 * child node (based on stored offsets) exceeds canvas bounds.
 */
function clampGroupPosition(
  groupX: number,
  groupY: number,
  childOffsets: ChildOffset[]
): { x: number; y: number } {
  // Determine the bounding extremes of all children relative to group pos
  let minDx = 0;
  let minDy = 0;
  let maxDx = 0;
  let maxDy = 0;

  for (const offset of childOffsets) {
    if (offset.dx < minDx) minDx = offset.dx;
    if (offset.dy < minDy) minDy = offset.dy;
    if (offset.dx > maxDx) maxDx = offset.dx;
    if (offset.dy > maxDy) maxDy = offset.dy;
  }

  // Clamp so that: groupX + minDx >= CANVAS_MIN_X  and  groupX + maxDx <= CANVAS_MAX_X
  let clampedX = groupX;
  let clampedY = groupY;

  // Left/top boundary: ensure leftmost/topmost child stays in bounds
  if (clampedX + minDx < CANVAS_MIN_X) {
    clampedX = CANVAS_MIN_X - minDx;
  }
  if (clampedY + minDy < CANVAS_MIN_Y) {
    clampedY = CANVAS_MIN_Y - minDy;
  }

  // Right/bottom boundary: ensure rightmost/bottommost child stays in bounds
  if (clampedX + maxDx > CANVAS_MAX_X) {
    clampedX = CANVAS_MAX_X - maxDx;
  }
  if (clampedY + maxDy > CANVAS_MAX_Y) {
    clampedY = CANVAS_MAX_Y - maxDy;
  }

  return { x: clampedX, y: clampedY };
}
