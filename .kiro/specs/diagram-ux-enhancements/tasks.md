# Implementation Plan: Diagram UX Enhancements

## Overview

Implement six UX enhancements for the diagram canvas: movable group panels, improved icons with fallback resolution, custom edge styling, zoom-to-fit and minimap improvements, snap-to-grid alignment, and undo/redo history. All changes are frontend-only, using React Flow built-in APIs and custom hooks.

## Tasks

- [x] 1. Create useHistory hook for undo/redo state management
  - [x] 1.1 Create `frontend/src/hooks/useHistory.ts` with HistoryStack interface (past, present, future)
  - [x] 1.2 Implement pushHistory: add current state to past, clear future, enforce max 50 depth
  - [x] 1.3 Implement undo: pop from past into present, push old present to future
  - [x] 1.4 Implement redo: shift from future into present, push old present to past
  - [x] 1.5 Export canUndo/canRedo boolean flags and recordSnapshot function
  - [x] 1.6 Use structuredClone for deep state copies
  > Requirements: 6.1, 6.2, 6.6, 6.7, 6.9, 6.10

- [x] 2. Create useGroupDrag hook for movable group panels
  - [x] 2.1 Create `frontend/src/hooks/useGroupDrag.ts`
  - [x] 2.2 On drag start of groupPanel: record snapshot, store group position and child offsets
  - [x] 2.3 On drag: apply positional delta to group and all children preserving relative offsets
  - [x] 2.4 On drag stop: finalize positions in state
  - [x] 2.5 Ensure individual service node drags do NOT affect the group or siblings
  - [x] 2.6 Clamp group position to prevent nodes going beyond canvas bounds
  > Requirements: 1.1, 1.2, 1.4, 1.6, 1.7

- [x] 3. Make GroupPanelNode interactive and visually draggable
  - [x] 3.1 Update autoLayout.ts: set draggable true, selectable true on group panel nodes
  - [x] 3.2 Remove pointerEvents none from group panel node styles
  - [x] 3.3 Add data.groupId to panel node data for membership lookup
  - [x] 3.4 Update GroupPanelNode.tsx: add selection highlight when selected prop is true
  - [x] 3.5 Add drag visual feedback: thicker border and drop-shadow via CSS
  - [x] 3.6 Add CSS for .group-panel-node selected and dragging states
  > Requirements: 1.3, 1.5

- [x] 4. Implement resolveEdgeStyle utility and CustomEdge component
  - [x] 4.1 Create `frontend/src/utils/edgeStyle.ts` with resolveEdgeStyle function
  - [x] 4.2 Implement keyword-based color mapping for 8 categories
  - [x] 4.3 Implement isValidCssColor validator for explicit color override
  - [x] 4.4 Create `frontend/src/components/edges/CustomEdge.tsx`
  - [x] 4.5 Render label centered on edge, truncate at 40 chars with ellipsis
  - [x] 4.6 Show tooltip on hover when label is truncated
  - [x] 4.7 Support arrowStyle prop: closed, open, none
  - [x] 4.8 Update autoLayout.ts to use resolveEdgeStyle and pass color/arrowStyle from connections
  > Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

- [x] 5. Enhance icon registry with category fallback and default icon
  - [x] 5.1 Update getCloudIcon in cloudIcons.ts: implement 3-tier resolution (exact, category, default)
  - [x] 5.2 Define CATEGORY_PREFIXES map for 10 categories
  - [x] 5.3 Ensure default icon is rounded rect with centered circle
  - [x] 5.4 Verify consistent viewBox, stroke-width, linecap/linejoin across all icons
  > Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6

- [x] 6. Implement snap-to-grid with toolbar toggle
  - [x] 6.1 Add snapToGrid state and snapGrid constant [16, 16] to DiagramCanvas
  - [x] 6.2 Pass snapToGrid and snapGrid props to ReactFlow
  - [x] 6.3 Implement onNodeDragStop handler that rounds group positions to grid
  - [x] 6.4 Show dot grid via Background when snap enabled
  - [x] 6.5 Add snap toggle button to toolbar
  - [x] 6.6 Ensure snap only affects actively dragged elements
  > Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7

- [x] 7. Enhance minimap with auto-show/hide and fit-view button
  - [x] 7.1 Add fit-view button that calls fitView with padding 0.15 and 500ms duration
  - [x] 7.2 Make fit-view keyboard accessible (Enter/Space)
  - [x] 7.3 Implement conditional minimap: show when nodes > 15, hide otherwise
  - [x] 7.4 Add minimap toggle button for manual show/hide
  - [x] 7.5 Render minimap nodes with group colors
  - [x] 7.6 Fit-view no-op when no visible nodes
  > Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7

- [ ] 8. Wire all hooks and controls in DiagramCanvas
  - [x] 8.1 Integrate useHistory: wrap node/edge state, wire undo/redo buttons
  - [x] 8.2 Add keyboard shortcuts Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y
  - [x] 8.3 Integrate useGroupDrag: pass drag handlers to ReactFlow
  - [x] 8.4 Register CustomEdge in edgeTypes map
  - [x] 8.5 Record history snapshots on node move, group move, edge change
  - [x] 8.6 Wire snap toggle and fit-view in toolbar
  - [x] 8.7 Add toolbar CSS for new buttons
  > Requirements: 1.1, 1.2, 5.1, 6.1, 6.2, 6.3, 6.4, 6.5, 6.8

- [x] 9. Update DiagramData types and App integration
  - [x] 9.1 Update DiagramData interface in App.tsx: add color and arrowStyle to connections
  - [x] 9.2 Ensure backend data passes through new fields unchanged
  > Requirements: 3.2, 3.3

- [x] 10. Build and verify all features work together
  - [x] 10.1 Run pnpm build in frontend to verify no TypeScript errors
  - [x] 10.2 Verify group panels are draggable with children moving together
  - [x] 10.3 Verify undo/redo for node moves, group moves, edge changes
  - [x] 10.4 Verify snap-to-grid toggles and aligns nodes
  - [x] 10.5 Verify minimap auto-show/hide and fit-view button
  - [x] 10.6 Verify edge labels with correct styling and tooltips
  - [x] 10.7 Verify icon fallback for unknown keys

## Task Dependency Graph

```json
{
  "waves": [
    { "tasks": [1, 2, 3, 4, 5, 7] },
    { "tasks": [6, 9] },
    { "tasks": [8] },
    { "tasks": [10] }
  ],
  "dependencies": {
    "6": [1],
    "8": [1, 2, 3, 4, 6, 7],
    "9": [4],
    "10": [8, 9, 5]
  }
}
```

## Notes

- No new runtime dependencies needed; all features use React Flow built-in APIs
- Tasks 1-5, 7 are independent and can be executed in parallel
- Task 6 depends on Task 1 (needs recordSnapshot from history hook for snap interactions)
- Task 8 is the integration task that wires everything together
- Task 9 extends the data model for edge styling
- Task 10 is the final verification
