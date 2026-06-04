import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { getCloudIcon } from '../../utils/cloudIcons';

interface CloudServiceData {
  label: string;
  icon: string;
  group?: string;
}

export const CloudServiceNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as CloudServiceData;
  const iconSvg = getCloudIcon(nodeData.icon);

  return (
    <div className="cloud-service-node">
      <Handle type="target" position={Position.Left} />
      <div className="node-icon" dangerouslySetInnerHTML={{ __html: iconSvg }} />
      <div className="node-label">{nodeData.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

CloudServiceNode.displayName = 'CloudServiceNode';
