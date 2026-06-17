import React, { useState } from 'react';
import {
  BaseEdge,
  type EdgeProps,
  getBezierPath,
} from '@xyflow/react';

const LABEL_MAX_LENGTH = 40;

export interface CustomEdgeData {
  label?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  animated?: boolean;
  markerType?: 'closed' | 'open' | 'none';
  [key: string]: unknown;
}

function truncateLabel(label: string): { display: string; isTruncated: boolean } {
  if (label.length <= LABEL_MAX_LENGTH) {
    return { display: label, isTruncated: false };
  }
  return { display: label.slice(0, LABEL_MAX_LENGTH) + '...', isTruncated: true };
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);

  const edgeData = (data ?? {}) as CustomEdgeData;
  const fullLabel = edgeData.label ?? '';
  const stroke = edgeData.stroke ?? '#94a3b8';
  const strokeWidth = edgeData.strokeWidth ?? 2;
  const strokeDasharray = edgeData.strokeDasharray;
  const animated = edgeData.animated ?? false;

  const { display, isTruncated } = truncateLabel(fullLabel);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeStyle: React.CSSProperties = {
    ...style,
    stroke,
    strokeWidth,
    strokeDasharray,
    animation: animated ? 'dashmove 0.5s linear infinite' : undefined,
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={edgeStyle} />

      {fullLabel && (
        <foreignObject
          x={labelX - 60}
          y={labelY - 12}
          width={120}
          height={24}
          className="custom-edge-label-wrapper"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{ overflow: 'visible', pointerEvents: 'all' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              position: 'relative',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: '#374151',
                background: 'rgba(255, 255, 255, 0.88)',
                border: `0.5px solid ${stroke}`,
                borderRadius: 4,
                padding: '2px 6px',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {display}
            </span>

            {/* Tooltip shown on hover when label is truncated */}
            {isTruncated && hovered && (
              <div
                role="tooltip"
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 4,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 400,
                  color: '#fff',
                  background: '#1e293b',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                  zIndex: 1000,
                  pointerEvents: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                {fullLabel}
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </>
  );
}
