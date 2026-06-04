import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DiagramData } from '../App';
import { CloudServiceNode } from './nodes/CloudServiceNode';
import { getAutoLayout } from '../utils/autoLayout';
import { exportDiagram } from '../utils/exportDiagram';

const nodeTypes = {
  cloudService: CloudServiceNode,
};

interface Props {
  data: DiagramData;
  onChange: (data: DiagramData) => void;
}

export function DiagramCanvas({ data, onChange }: Props) {
  // Convert DiagramData to React Flow nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const layouted = getAutoLayout(data);
    return {
      initialNodes: layouted.nodes,
      initialEdges: layouted.edges,
    };
  }, [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleExport = useCallback(
    (format: 'svg' | 'png' | 'json') => {
      exportDiagram(format, data);
    },
    [data]
  );

  return (
    <div className="diagram-canvas-container">
      <div className="diagram-toolbar">
        <button onClick={() => handleExport('svg')} className="diagram-export-btn">
          Export SVG
        </button>
        <button onClick={() => handleExport('png')} className="diagram-export-btn">
          Export PNG
        </button>
        <button onClick={() => handleExport('json')} className="diagram-export-btn">
          Export JSON
        </button>
      </div>
      <div className="diagram-canvas" style={{ height: 600 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap />
        </ReactFlow>
        <div className="diagram-watermark">Ezekiel Matomi Lucky</div>
      </div>
    </div>
  );
}
