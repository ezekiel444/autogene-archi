import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

interface GroupPanelData {
  label: string;
  color: string;
  groupId: string;
}

/**
 * Background panel node that renders a labeled, colored group container
 * behind the service nodes that belong to the group.
 *
 * The panel's size and background are set via the node's `style` field in
 * autoLayout.ts so React Flow handles width/height natively. The inner div
 * only adds the group-label text overlay.
 *
 * React Flow passes `selected` and `dragging` props which are used to
 * apply visual feedback CSS classes.
 */
export const GroupPanelNode = memo(({ data, selected, dragging }: NodeProps) => {
  const panelData = data as unknown as GroupPanelData;

  const classNames = ['group-panel-node'];
  if (selected) classNames.push('selected');
  if (dragging) classNames.push('dragging');

  return (
    <div className={classNames.join(' ')}>
      <span className="group-panel-label">{panelData.label}</span>
    </div>
  );
});

GroupPanelNode.displayName = 'GroupPanelNode';
