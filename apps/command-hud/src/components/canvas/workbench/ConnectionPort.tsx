import React from 'react';
import { Pin } from '../../../ecs/links';

interface PortProps {
  id: string;
  nodeId: string;
  position: Pin;
  targetPreview?: ConnectionTargetPreview | null;
  onPortClick?: (portId: string, position: Pin) => void;
  onPortPointerDown?: (event: React.PointerEvent<HTMLDivElement>, portId: string, position: Pin) => void;
}

export interface ConnectionTargetPreview {
  nodeId: string;
  pin: Pin;
  valid: boolean;
  reason?: string;
}

export const ConnectionPort: React.FC<PortProps> = ({
  id,
  nodeId,
  position,
  targetPreview,
  onPortClick,
  onPortPointerDown,
}) => {
  const isTarget = targetPreview?.nodeId === nodeId && targetPreview.pin === position;
  const posClasses = {
    top: '-top-1.5 left-1/2 -translate-x-1/2',
    bottom: '-bottom-1.5 left-1/2 -translate-x-1/2',
    left: '-left-1.5 top-1/2 -translate-y-1/2',
    right: '-right-1.5 top-1/2 -translate-y-1/2',
  };

  return (
    <div
      data-port-id={id}
      data-port-pos={position}
      data-wire-target={isTarget ? (targetPreview.valid ? 'valid' : 'invalid') : undefined}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPortPointerDown?.(event, id, position);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onPortClick?.(id, position);
      }}
      className={`absolute w-3 h-3 rounded-full bg-[#020500] border-2 ${
        isTarget
          ? targetPreview.valid ? 'border-[#22C55E] shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'border-[#EF4444] shadow-[0_0_10px_rgba(239,68,68,0.8)]'
          : 'border-[#086375] hover:border-[#E0CA3C]'
      } hover:scale-125 transition-all cursor-crosshair z-30 ${posClasses[position]}`}
      title={isTarget ? targetPreview.reason || 'Valid wire target' : `Connect Port (${position})`}
    >
      <div className="w-1 h-1 rounded-full bg-[#086375] hover:bg-[#E0CA3C] m-auto mt-0.5" />
    </div>
  );
};
