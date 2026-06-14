import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

interface GroupPanelData {
  label: string;
  color: string;
}

/**
 * Background panel node that renders a labeled, colored group container
 * behind the service nodes that belong to the group.
 *
 * The panel's size and background are set via the node's `style` field in
 * autoLayout.ts so React Flow handles width/height natively. The inner div
 * only adds the group-label text overlay.
 */
export const GroupPanelNode = memo(({ data }: NodeProps) => {
  const panelData = data as unknown as GroupPanelData;

  return (
    <div className="group-panel-node">
      <span className="group-panel-label">{panelData.label}</span>
    </div>
  );
});

GroupPanelNode.displayName = 'GroupPanelNode';
