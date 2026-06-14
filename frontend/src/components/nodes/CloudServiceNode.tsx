import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { getCloudIcon } from '../../utils/cloudIcons';

interface CloudServiceData {
  label: string;
  icon: string;
  group?: string;
  groupColor?: string | null;
}

/**
 * Hex color → rgba with given alpha (e.g. "#e0f2fe" → "rgba(224,242,254,0.35)")
 */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Darken a hex color slightly for use as the node's left accent border.
 */
function darkenHex(hex: string): string {
  const clean = hex.replace('#', '');
  const r = Math.max(0, parseInt(clean.substring(0, 2), 16) - 48);
  const g = Math.max(0, parseInt(clean.substring(2, 4), 16) - 48);
  const b = Math.max(0, parseInt(clean.substring(4, 6), 16) - 48);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const CloudServiceNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as CloudServiceData;
  const iconSvg = getCloudIcon(nodeData.icon);
  const gc = nodeData.groupColor;

  const nodeStyle: React.CSSProperties = gc
    ? {
        borderLeft: `4px solid ${darkenHex(gc)}`,
        background: hexToRgba(gc, 0.18),
      }
    : {};

  return (
    <div className="cloud-service-node" style={nodeStyle} title={nodeData.label}>
      <Handle type="target" position={Position.Left} />
      <div className="node-icon" dangerouslySetInnerHTML={{ __html: iconSvg }} />
      <div className="node-label">{nodeData.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

CloudServiceNode.displayName = 'CloudServiceNode';
