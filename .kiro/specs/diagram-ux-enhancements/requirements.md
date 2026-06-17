# Requirements Document

## Introduction

This feature set enhances the diagram canvas UX of the AI architecture diagram generator. The current canvas (built on @xyflow/react v12) supports draggable service nodes, basic edges with labels, a minimap, and static group panels. This spec covers six enhancements: movable group blocks, improved resource icons, edge label/styling customization, zoom-to-fit with minimap improvements, snap-to-grid, and undo/redo.

## Glossary

- **Canvas**: The React Flow diagram viewport rendered by `DiagramCanvas.tsx`
- **Group_Panel**: A colored background node (type `groupPanel`) representing a logical group of services
- **Service_Node**: A draggable node (type `cloudService`) representing a single cloud resource or service
- **Edge**: A connection line between two Service_Nodes rendered by React Flow
- **Icon_Registry**: The lookup map in `cloudIcons.ts` that returns an SVG string for a given service key
- **Minimap**: The React Flow `<MiniMap>` overlay showing a reduced view of the full diagram
- **History_Stack**: An in-memory data structure tracking diagram state changes for undo/redo
- **Grid**: An alignment grid overlaid on the Canvas that nodes and groups can snap to
- **Provider_Icon**: An SVG icon sourced from or inspired by official cloud provider icon sets (AWS Architecture Icons, Azure icons, GCP icons)
- **Fallback_Icon**: A generic stroke-based SVG icon used when no official Provider_Icon mapping exists

## Requirements

### Requirement 1: Movable Group Panels

**User Story:** As a user, I want to drag group panels on the canvas, so that I can rearrange logical groupings and their children together without moving nodes individually.

#### Acceptance Criteria

1. WHEN a user presses and holds the pointer on a Group_Panel and moves it at least 3 pixels, THE Canvas SHALL move the Group_Panel and all Service_Nodes whose group property matches that Group_Panel by the same positional delta applied each frame.
2. WHEN a Group_Panel drag completes (pointer released), THE Canvas SHALL persist the updated positions of the Group_Panel and all child Service_Nodes in the diagram state so that subsequent renders reflect the new positions.
3. WHILE a Group_Panel is being dragged, THE Canvas SHALL render the Group_Panel border with increased thickness (at least 2× the default border width) and apply a drop-shadow to distinguish the group drag from an individual node drag.
4. WHEN a Group_Panel is dragged, THE Canvas SHALL preserve the relative positions of child Service_Nodes within the group such that the offset between each child node and the Group_Panel origin remains constant throughout and after the drag.
5. WHEN a Group_Panel is selected (single click), THE Canvas SHALL display a visible border highlight (contrasting color or increased opacity compared to the default state) around the Group_Panel boundary to indicate it is interactive.
6. WHEN a user initiates a drag on an individual Service_Node that belongs to a group, THE Canvas SHALL move only that Service_Node independently without affecting the Group_Panel or other sibling nodes in the same group.
7. IF a Group_Panel is dragged such that it or any child Service_Node would move beyond the canvas coordinate bounds, THEN THE Canvas SHALL clamp the Group_Panel position to keep all child nodes within the renderable canvas area.

### Requirement 2: Improved Resource Icons

**User Story:** As a user, I want service nodes to display high-quality, recognizable cloud provider icons, so that I can quickly identify services at a glance.

#### Acceptance Criteria

1. WHEN a Service_Node has an icon key matching a known cloud provider service, THE Icon_Registry SHALL return a Provider_Icon with a unique SVG path that is not shared with any other service entry in the same provider namespace.
2. WHEN a Service_Node has an icon key that does not match any known provider service but contains a recognized service category prefix (e.g., compute, storage, database, network, queue, monitoring, security, serverless, container, analytics), THE Icon_Registry SHALL return a Fallback_Icon using the category's designated shape from the shape library.
3. IF a Service_Node has an icon key that matches neither a known service nor a recognized category, THEN THE Icon_Registry SHALL return a generic Default_Icon (rounded rectangle with centered circle).
4. THE Icon_Registry SHALL support icon keys for at least 30 AWS services, 25 Azure services, and 20 GCP services.
5. THE Icon_Registry SHALL render all icons at a consistent viewBox of 0 0 24 24 with stroke-based styling using stroke-width 1.5, stroke-linecap round, and stroke-linejoin round.
6. WHEN the Icon_Registry resolves a Provider_Icon, THE Canvas SHALL render the icon with the provider's brand color (AWS orange #FF9900, Azure blue #0078D4, GCP blue #4285F4, Generic #64748b).

### Requirement 3: Edge Labels and Styling

**User Story:** As a user, I want to customize connection labels, arrow styles, and colors on edges, so that I can communicate data flow direction and protocol type visually.

#### Acceptance Criteria

1. WHEN a connection has a label defined, THE Canvas SHALL render the label text centered along the Edge path, truncating labels longer than 40 characters with an ellipsis.
2. WHEN a connection has a color property defined, THE Canvas SHALL apply that color to the Edge stroke and arrowhead marker, overriding any default color mapping.
3. WHEN a connection has an arrow style property defined, THE Canvas SHALL render the specified arrowhead type (closed, open, or none) on the target end of the Edge.
4. IF a connection has no explicit color or arrow style, THEN THE Canvas SHALL apply a default style by matching the label text against keyword categories: HTTP/REST (blue), gRPC (purple), event/async (amber, dashed), SQL/database (green), cache (orange), logging/monitoring (indigo, dashed), error/failure (red, dashed), SSH/VPN (gray, dashed), and a neutral gray fallback when no keyword matches.
5. WHEN a user hovers over an Edge, THE Canvas SHALL increase the Edge stroke width by at least 1px and display a tooltip containing the full label text within 200ms, but only if the rendered label is truncated.
6. IF a connection has an explicit color value that is not a valid CSS color, THEN THE Canvas SHALL ignore the invalid value and apply the default keyword-based color mapping instead.

### Requirement 4: Zoom-to-Fit and Minimap Enhancements

**User Story:** As a user, I want a fit-view button and an improved minimap, so that I can quickly orient myself in large diagrams.

#### Acceptance Criteria

1. WHEN the user clicks the fit-view button, THE Canvas SHALL animate the viewport to fit all visible nodes with 15% padding, completing the animation within 500 milliseconds.
2. THE Canvas SHALL display the fit-view button in the diagram toolbar area, activatable by a single click or by keyboard focus and Enter/Space key press.
3. THE Canvas SHALL render the Minimap overlay in the bottom-right corner showing all nodes with their assigned group color, and nodes without a group color SHALL be rendered with a neutral default color.
4. WHEN the user clicks or drags within the Minimap, THE Canvas SHALL pan the main viewport so that the center of the visible area corresponds to the clicked or dragged position in the Minimap.
5. WHILE the diagram contains more than 15 nodes, THE Canvas SHALL display the Minimap by default.
6. WHILE the diagram contains 15 or fewer nodes, THE Canvas SHALL hide the Minimap by default and SHALL provide a toggle control in the toolbar to show or hide the Minimap manually.
7. IF the diagram contains no visible nodes when the user clicks the fit-view button, THEN THE Canvas SHALL keep the current viewport unchanged and not perform any animation.

### Requirement 5: Snap-to-Grid

**User Story:** As a user, I want optional grid snapping when dragging nodes or groups, so that I can align elements cleanly.

#### Acceptance Criteria

1. WHEN snap-to-grid is enabled and a user releases a Service_Node after dragging, THE Canvas SHALL constrain the node's top-left corner position to the nearest grid point, rounding to the lower coordinate value when equidistant.
2. WHEN snap-to-grid is enabled and a user releases a Group_Panel after dragging, THE Canvas SHALL constrain the group's top-left corner position to the nearest grid point, rounding to the lower coordinate value when equidistant.
3. THE Canvas SHALL provide a toggle control in the toolbar to enable or disable snap-to-grid, with snap-to-grid disabled by default on canvas initialization.
4. WHEN snap-to-grid is enabled, THE Canvas SHALL display a dot grid pattern aligned to the snap increment with a minimum contrast ratio of 2:1 against the canvas background.
5. THE Canvas SHALL use a default snap increment of 16 pixels in both horizontal and vertical directions.
6. WHILE snap-to-grid is disabled, THE Canvas SHALL allow free-form positioning without any constraint.
7. WHEN snap-to-grid is enabled, THE Canvas SHALL only snap elements that are actively dragged and released; elements already placed on the canvas SHALL remain at their current position until individually moved.

### Requirement 6: Undo and Redo

**User Story:** As a user, I want to undo and redo changes to the diagram, so that I can experiment with layouts without fear of losing previous states.

#### Acceptance Criteria

1. WHEN the user triggers an undo action, THE Canvas SHALL revert the diagram to the previous state in the History_Stack.
2. WHEN the user triggers a redo action, THE Canvas SHALL advance the diagram to the next state in the History_Stack.
3. WHEN a node move is completed, a node is added, or a node is deleted, THE Canvas SHALL record a new history entry capturing the full diagram state before the change.
4. WHEN a Group_Panel move is completed, THE Canvas SHALL record a new history entry capturing the full diagram state before the change.
5. WHEN an Edge is added or removed, THE Canvas SHALL record a new history entry capturing the full diagram state before the change.
6. WHILE the History_Stack has no previous state, THE Canvas SHALL disable the undo control and ignore undo triggers.
7. WHILE the History_Stack has no forward state, THE Canvas SHALL disable the redo control and ignore redo triggers.
8. THE Canvas SHALL trigger an undo action on Ctrl+Z and a redo action on Ctrl+Shift+Z or Ctrl+Y keyboard shortcuts.
9. THE Canvas SHALL maintain a History_Stack depth of at least 50 entries, discarding the oldest entry when a new entry would exceed the maximum depth.
10. WHEN the user performs a new diagram change after an undo, THE Canvas SHALL clear all forward (redo) states from the History_Stack.
