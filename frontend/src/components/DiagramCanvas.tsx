import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  type Node,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DiagramData } from '../App';
import { CloudServiceNode } from './nodes/CloudServiceNode';
import { GroupPanelNode } from './nodes/GroupPanelNode';
import { CustomEdge } from './edges/CustomEdge';
import { getAutoLayout } from '../utils/autoLayout';
import { exportDiagram } from '../utils/exportDiagram';
import { useHistory } from '../hooks/useHistory';
import { useGroupDrag } from '../hooks/useGroupDrag';

const nodeTypes = {
  cloudService: CloudServiceNode,
  groupPanel: GroupPanelNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const proOptions = { hideAttribution: true };

/** Snap grid size in pixels [x, y] */
const SNAP_GRID: [number, number] = [16, 16];

interface Props {
  data: DiagramData;
  onChange: (data: DiagramData) => void;
}

function miniMapNodeColor(node: Node): string {
  // Colour minimap nodes by their group-color tint; panels invisible
  if (node.type === 'groupPanel') return 'transparent';
  const gc = (node.data as { groupColor?: string | null }).groupColor;
  return gc ?? '#cbd5e1';
}

/**
 * Inner component for the fit-view button. Must be rendered inside ReactFlow
 * (or ReactFlowProvider) so that useReactFlow hook is available.
 */
function FitViewButton({ nodes }: { nodes: Node[] }) {
  const { fitView } = useReactFlow();

  const handleFitView = useCallback(() => {
    // No-op when there are no visible service nodes (Requirement 4.7)
    const visibleNodes = nodes.filter((n) => n.type !== 'groupPanel');
    if (visibleNodes.length === 0) return;

    fitView({ padding: 0.15, duration: 500 });
  }, [fitView, nodes]);

  return (
    <button
      onClick={handleFitView}
      className="diagram-export-btn"
      aria-label="Fit to view"
    >
      Fit View
    </button>
  );
}

function DiagramCanvasInner({ data, onChange }: Props) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const layouted = getAutoLayout(data);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Snap-to-grid state (disabled by default per Requirement 5.3)
  const [snapEnabled, setSnapEnabled] = useState(false);

  // Minimap visibility state: null = auto mode, boolean = manual override
  const [showMinimap, setShowMinimap] = useState<boolean | null>(null);

  // --- Undo/Redo history (Requirement 6) ---
  const { state: historyState, undo, redo, canUndo, canRedo, recordSnapshot } = useHistory({
    nodes: initialNodes,
    edges: initialEdges,
  });

  // Track whether a history-driven state update is in progress to avoid circular updates
  const isRestoringRef = useRef(false);

  // --- Group drag integration (Requirement 1) ---
  const {
    onNodeDragStart: onGroupDragStart,
    onNodeDrag: onGroupDrag,
    onNodeDragStop: onGroupDragStop,
  } = useGroupDrag(nodes, setNodes, recordSnapshot);

  // Re-sync whenever upstream data changes (template switch, regeneration, refinement)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // When history state changes (after undo/redo), update React Flow nodes/edges
  useEffect(() => {
    isRestoringRef.current = true;
    setNodes(historyState.nodes);
    setEdges(historyState.edges);
    // Reset flag after React processes the update
    requestAnimationFrame(() => {
      isRestoringRef.current = false;
    });
  }, [historyState, setNodes, setEdges]);

  // --- Keyboard shortcuts (Requirement 6.8) ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const handleExport = useCallback(
    (format: 'svg' | 'png' | 'json') => exportDiagram(format, data),
    [data],
  );

  /**
   * onNodeDragStop handler combining snap-to-grid + group drag + history recording.
   * - Group panel drags: handled by useGroupDrag (snapshot recorded on drag start).
   * - Individual service node drags: record snapshot on drag stop (Requirement 6.3).
   * - Group panels snap to grid when snap is enabled (Requirement 5.2).
   */
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Delegate to group drag handler (no-ops for non-group nodes)
      onGroupDragStop(_event, node);

      // Snap group panels to grid when enabled
      if (snapEnabled && node.type === 'groupPanel') {
        const snappedX = Math.floor(node.position.x / SNAP_GRID[0]) * SNAP_GRID[0];
        const snappedY = Math.floor(node.position.y / SNAP_GRID[1]) * SNAP_GRID[1];

        if (snappedX !== node.position.x || snappedY !== node.position.y) {
          setNodes((currentNodes) =>
            currentNodes.map((n) =>
              n.id === node.id
                ? { ...n, position: { x: snappedX, y: snappedY } }
                : n
            )
          );
        }
      }

      // Record history snapshot for individual node drags (Requirement 6.3)
      // Group panel drags already record on drag start via useGroupDrag
      if (node.type !== 'groupPanel') {
        recordSnapshot();
      }
    },
    [snapEnabled, setNodes, onGroupDragStop, recordSnapshot]
  );

  /**
   * Wrap onEdgesChange to record a history snapshot when edges are added or removed
   * (Requirement 6.5).
   */
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Detect add/remove edge changes
      const hasStructuralChange = changes.some(
        (c) => c.type === 'add' || c.type === 'remove'
      );

      if (hasStructuralChange && !isRestoringRef.current) {
        recordSnapshot();
      }

      onEdgesChange(changes);
    },
    [onEdgesChange, recordSnapshot]
  );

  // Derive metadata for the info bar
  const serviceNodes = data.nodes.length;
  const groupCount   = data.groups?.length ?? 0;
  const edgeCount    = data.connections.length;

  // Conditional minimap: auto-show when service nodes > 15 (Requirement 4.5/4.6)
  const autoShowMinimap = nodes.filter((n) => n.type !== 'groupPanel').length > 15;
  const minimapVisible = showMinimap !== null ? showMinimap : autoShowMinimap;

  // Detect primary platform
  const platform = useMemo(() => {
    const icons = data.nodes.map((n) => n.icon ?? '');
    const awsCount   = icons.filter((i) => i.startsWith('aws-') || i === 'aws').length;
    const azureCount = icons.filter((i) => i.startsWith('azure-') || i === 'azure').length;
    const gcpCount   = icons.filter((i) => i.startsWith('gcp-') || i === 'gcp').length;
    if (awsCount > azureCount && awsCount > gcpCount) return 'AWS';
    if (azureCount > awsCount && azureCount > gcpCount) return 'Azure';
    if (gcpCount > awsCount && gcpCount > azureCount) return 'GCP';
    return 'Multi-cloud';
  }, [data.nodes]);

  return (
    <div className="diagram-canvas-container">
      {/* Toolbar */}
      <div className="diagram-toolbar">
        <div className="diagram-toolbar-meta">
          <span className="diagram-meta-chip">{serviceNodes} nodes</span>
          <span className="diagram-meta-chip">{groupCount} groups</span>
          <span className="diagram-meta-chip">{edgeCount} connections</span>
          <span className="diagram-meta-chip diagram-meta-platform">{platform}</span>
        </div>
        <div className="diagram-toolbar-actions">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="diagram-export-btn"
            aria-label="Undo"
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="diagram-export-btn"
            aria-label="Redo"
          >
            Redo
          </button>
          <FitViewButton nodes={nodes} />
          <button
            onClick={() => setShowMinimap((v) => v === null ? !autoShowMinimap : !v)}
            className={`diagram-export-btn ${minimapVisible ? 'active' : ''}`}
          >
            Minimap
          </button>
          <button
            onClick={() => setSnapEnabled((s) => !s)}
            className={`diagram-export-btn ${snapEnabled ? 'active' : ''}`}
          >
            {snapEnabled ? 'Grid: On' : 'Grid: Off'}
          </button>
          <button onClick={() => handleExport('svg')}  className="diagram-export-btn">Export SVG</button>
          <button onClick={() => handleExport('png')}  className="diagram-export-btn">Export PNG</button>
          <button onClick={() => handleExport('json')} className="diagram-export-btn">Export JSON</button>
        </div>
      </div>

      {/* Canvas */}
      <div className="diagram-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={handleEdgesChange}
          onNodeDragStart={onGroupDragStart}
          onNodeDrag={onGroupDrag}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          snapToGrid={snapEnabled}
          snapGrid={SNAP_GRID}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={proOptions}
          minZoom={0.2}
          maxZoom={2.5}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={snapEnabled ? 16 : 24}
            size={1}
            color="#cbd5e1"
          />
          <Controls showInteractive={false} />
          {minimapVisible && (
            <MiniMap
              nodeColor={miniMapNodeColor}
              nodeStrokeWidth={2}
              pannable
              zoomable
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}
            />
          )}
        </ReactFlow>
        <div className="diagram-watermark">Ezekiel Matomi Lucky</div>
      </div>
    </div>
  );
}

/**
 * DiagramCanvas wrapped with ReactFlowProvider so that useReactFlow hook
 * works in the FitViewButton component rendered in the toolbar.
 */
export function DiagramCanvas({ data, onChange }: Props) {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInner data={data} onChange={onChange} />
    </ReactFlowProvider>
  );
}
