import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DiagramData } from '../App';
import { CloudServiceNode } from './nodes/CloudServiceNode';
import { GroupPanelNode } from './nodes/GroupPanelNode';
import { getAutoLayout } from '../utils/autoLayout';
import { exportDiagram } from '../utils/exportDiagram';

const nodeTypes = {
  cloudService: CloudServiceNode,
  groupPanel: GroupPanelNode,
};

const proOptions = { hideAttribution: true };

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

export function DiagramCanvas({ data, onChange }: Props) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const layouted = getAutoLayout(data);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Re-sync whenever upstream data changes (template switch, regeneration, refinement)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleExport = useCallback(
    (format: 'svg' | 'png' | 'json') => exportDiagram(format, data),
    [data],
  );

  // Derive metadata for the info bar
  const serviceNodes = data.nodes.length;
  const groupCount   = data.groups?.length ?? 0;
  const edgeCount    = data.connections.length;

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
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={proOptions}
          minZoom={0.2}
          maxZoom={2.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={miniMapNodeColor}
            nodeStrokeWidth={2}
            pannable
            zoomable
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}
          />
        </ReactFlow>
        <div className="diagram-watermark">Ezekiel Matomi Lucky</div>
      </div>
    </div>
  );
}
