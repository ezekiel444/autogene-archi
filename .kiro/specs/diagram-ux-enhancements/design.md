# Design Document: Diagram UX Enhancements

## Overview

This feature set enhances the AI architecture diagram canvas with six UX improvements: movable group panels with child-node dragging, improved cloud provider icons, edge label/styling customization, zoom-to-fit with minimap enhancements, snap-to-grid alignment, and undo/redo history.

The architecture follows React Flow's data-driven model where nodes and edges are state arrays managed by custom hooks. Each enhancement is implemented as an isolated concern (hook or utility) composed in the existing `DiagramCanvas` component, preserving the current layout pipeline while adding interactivity layers on top.

Key design decisions:
1. **Movable groups**: Manual delta-tracking (not React Flow parentId) — groups remain computed bounding-box nodes with `zIndex: -1`, and child membership is resolved via the `group` field on service nodes. This avoids breaking the existing Dagre layout pipeline.
2. **Undo/Redo**: Snapshot-based history (full state cloning) — simpler than command-pattern given the small state size (~100 nodes max) and avoids inverse-command complexity.
3. **Icons**: Keep the existing stroke-based SVG approach with expanded registry — no external library dependency.
4. **Snap-to-grid**: React Flow's built-in `snapGrid` prop combined with post-drag rounding for groups.

## Architecture

```
App.tsx → DiagramCanvas.tsx → ReactFlow
                            → useHistory hook
                            → useGroupDrag hook
                            → useSnapToGrid hook
                            → useMinimap hook
                            → CustomEdge component
                            → autoLayout.ts → dagre
                            → cloudIcons.ts (icon registry)
```

## Components and Interfaces

### Component 1: DiagramCanvas (Enhanced)

**Purpose**: Main orchestrator that composes all hooks and passes props to ReactFlow.

**Interface Changes**:
```typescript
interface DiagramCanvasEnhancements {
  snapToGrid: boolean;
  snapGrid: [number, number]; // [16, 16] default
  onNodeDragStop: (event: React.MouseEvent, node: Node) => void;
  onNodeDrag: (event: React.MouseEvent, node: Node) => void;
  edgeTypes: { custom: typeof CustomEdge };
}
```

**Responsibilities**:
- Wire up useHistory, useGroupDrag, useSnapToGrid, useMinimap hooks
- Render toolbar controls (undo/redo buttons, snap toggle, fit-view, minimap toggle)
- Pass keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y) to history hook

### Component 2: GroupPanelNode (Enhanced)

**Purpose**: Now interactive — supports selection highlight and drag initiation.

**Interface**:
```typescript
interface GroupPanelNodeProps {
  data: {
    label: string;
    color: string;
    groupId: string;
  };
  selected: boolean;
}
```

**Responsibilities**:
- Render selection border highlight when `selected` is true
- Emit drag events via React Flow's native node drag system
- Apply visual feedback (thicker border, drop-shadow) during drag

### Component 3: CustomEdge

**Purpose**: Renders edges with keyword-based styling, custom colors, arrow types, hover tooltip.

**Interface**:
```typescript
interface CustomEdgeData {
  label?: string;
  color?: string;
  arrowStyle?: 'closed' | 'open' | 'none';
}
```

## Data Models

### DiagramData (Extended)

```typescript
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
    color?: string;           // NEW
    arrowStyle?: 'closed' | 'open' | 'none'; // NEW
  }>;
  groups: Array<{
    id: string;
    label: string;
    color: string;
  }>;
}
```

### HistoryState

```typescript
interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface HistoryStack {
  past: HistoryState[];     // max 50 entries
  present: HistoryState;
  future: HistoryState[];
}
```

### SnapConfig

```typescript
interface SnapConfig {
  enabled: boolean;
  gridSize: [number, number]; // default [16, 16]
}
```

## Key Functions

### Hook: useHistory

```typescript
function useHistory(initialState: HistoryState): {
  state: HistoryState;
  setState: (newState: HistoryState) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  recordSnapshot: () => void;
}
```

- `undo()`: If past has entries, pops last from past into present, pushes old present to future
- `redo()`: If future has entries, shifts first from future into present, pushes old present to past
- `recordSnapshot()`: Pushes current present to past, clears future
- past.length never exceeds 50

### Hook: useGroupDrag

```typescript
function useGroupDrag(
  nodes: Node[],
  setNodes: SetNodes,
  recordSnapshot: () => void
): {
  onNodeDragStart: (event: React.MouseEvent, node: Node) => void;
  onNodeDrag: (event: React.MouseEvent, node: Node) => void;
  onNodeDragStop: (event: React.MouseEvent, node: Node) => void;
}
```

- On drag start of group panel: records snapshot, stores initial positions and child offsets
- On drag: applies delta to group and all children preserving relative positions
- Individual service node drags are unaffected

### Hook: useSnapToGrid

```typescript
function useSnapToGrid(enabled: boolean, gridSize: [number, number]): {
  snapNodePosition: (node: Node) => Node;
  onNodeDragStop: (event: React.MouseEvent, node: Node) => void;
}
```

- Uses Math.floor rounding to nearest grid point
- Only affects actively dragged nodes on release

### Function: resolveEdgeStyle

```typescript
function resolveEdgeStyle(
  label: string | undefined,
  explicitColor: string | undefined,
  arrowStyle: 'closed' | 'open' | 'none' | undefined
): ResolvedEdgeStyle
```

- Keyword priority: HTTP > gRPC > event > SQL > cache > log > error > SSH > neutral
- Invalid explicit colors are ignored (fallback to keyword mapping)

### Function: getCloudIcon (Enhanced)

3-tier resolution:
1. Exact match in CLOUD_ICONS registry
2. Category prefix fallback (compute, storage, database, etc.)
3. Generic default icon

## Algorithmic Pseudocode

### Group Drag

```typescript
function onGroupDragStart(node, allNodes) {
  children = allNodes.filter(n => n.data.group === node.data.groupId)
  childOffsets = children.map(c => ({
    id: c.id,
    dx: c.position.x - node.position.x,
    dy: c.position.y - node.position.y
  }))
  store { groupId, initialGroupPos, childOffsets }
}

function applyGroupDelta(nodes, dragState, newGroupPos) {
  return nodes.map(n => {
    if n is the group → position = newGroupPos
    if n is a child → position = newGroupPos + offset
    else → unchanged
  })
}
```

### History Management

```typescript
function pushHistory(stack, newPresent) {
  past = [...stack.past, stack.present]
  if (past.length > 50) past.shift()
  return { past, present: newPresent, future: [] }
}

function undo(stack) {
  if (stack.past.length === 0) return stack
  previous = stack.past.at(-1)
  return { past: stack.past.slice(0, -1), present: previous, future: [stack.present, ...stack.future] }
}
```

### Snap Position

```typescript
function snapPosition(pos, gridSize) {
  return {
    x: Math.floor(pos.x / gridSize[0]) * gridSize[0],
    y: Math.floor(pos.y / gridSize[1]) * gridSize[1]
  }
}
```

## Performance Considerations

- History snapshots use structuredClone() — acceptable for < 100 nodes
- Group drag updates only group members per frame
- Icon registry is O(1) lookup (object property access)
- Edge style resolution: linear scan through 8 patterns (< 1ms for 200 edges)
- Grid rendering via React Flow's native canvas Background component

## Security Considerations

- CSS color injection prevented by isValidCssColor() validator
- SVG icons are static constants (not user-supplied) — dangerouslySetInnerHTML is safe
- Edge labels rendered as text nodes (no XSS vector)

## Dependencies

No new runtime dependencies. All enhancements use React Flow built-in APIs and standard React patterns.
