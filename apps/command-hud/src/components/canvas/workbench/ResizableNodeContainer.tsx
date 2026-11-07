import React, { useRef, useState } from 'react';
import { Lock, Unlock, Maximize2 } from 'lucide-react';
import { Pin } from '../../../ecs/links';
import { ConnectionPort, ConnectionTargetPreview } from './ConnectionPort';
import { ContextMenu, MenuItem } from './ContextMenu';

export interface NodeGeometry {
  id: string;
  serviceId?: string;
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isLocked: boolean;
  /** Multi-sun Solar: a project sun node, or the project a component was attached to. */
  kind?: 'sun';
  projectId?: string;
}

interface Props {
  node: NodeGeometry;
  cameraZoom: number;
  onUpdate: (id: string, updates: Partial<NodeGeometry>) => void;
  onPortClick?: (nodeId: string, pin: Pin) => void;
  onPortPointerDown?: (event: React.PointerEvent<HTMLDivElement>, nodeId: string, pin: Pin) => void;
  targetPreview?: ConnectionTargetPreview | null;
  onSelect?: (nodeId: string, additive?: boolean) => void;
  isSelected?: boolean;
  onGroupDragStart?: (nodeId: string) => boolean;
  onGroupDragMove?: (nodeId: string, dx: number, dy: number) => void;
  onGroupDragEnd?: () => void;
  onDelete?: (node: NodeGeometry) => void;
  additionalMenuItems?: MenuItem[];
  /** Phase F: double-click opens the node's project page (service nodes). */
  onOpen?: () => void;
  children: React.ReactNode;
}

export const ResizableNodeContainer: React.FC<Props> = ({
  node,
  cameraZoom,
  onUpdate,
  onPortClick,
  onPortPointerDown,
  targetPreview,
  onSelect,
  isSelected = false,
  onGroupDragStart,
  onGroupDragMove,
  onGroupDragEnd,
  onDelete,
  additionalMenuItems = [],
  onOpen,
  children,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);
  const menuItems: MenuItem[] = [
    {
      id: 'lock',
      label: node.isLocked ? 'Unlock Dimensions & Drag' : 'Lock Node (Freeze)',
      icon: node.isLocked ? <Unlock size={12} /> : <Lock size={12} />,
      onSelect: () => onUpdate(node.id, { isLocked: !node.isLocked }),
    },
    ...additionalMenuItems,
    ...(node.serviceId && onDelete
      ? [{
          id: 'remove',
          label: 'Remove from canvas',
          danger: true,
          onSelect: () => onDelete(node),
        }]
      : []),
  ];

  // 1. Drag Positioning Handler
  const handleDragStart = (e: React.PointerEvent) => {
    // Also allow Alt + Right Click to open menu directly on click
    if (e.altKey && (e.button === 2 || e.button === 0)) {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
      return;
    }

    if (node.isLocked || e.button !== 0) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initX = node.x;
    const initY = node.y;
    const groupDrag = onGroupDragStart?.(node.id) ?? false;
    dragMovedRef.current = false;

    const onPointerMove = (ev: PointerEvent) => {
      const zoom = cameraZoom > 0 ? cameraZoom : 1.0;
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      if (Math.hypot(dx, dy) > 2) dragMovedRef.current = true;
      if (groupDrag) onGroupDragMove?.(node.id, dx, dy);
      else onUpdate(node.id, { x: Math.round(initX + dx), y: Math.round(initY + dy) });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (groupDrag) onGroupDragEnd?.();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // 2. Corner Resizing (Bottom-Right)
  const handleResizeStart = (e: React.PointerEvent) => {
    if (node.isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initW = node.width;
    const initH = node.height;

    const onPointerMove = (ev: PointerEvent) => {
      const zoom = cameraZoom > 0 ? cameraZoom : 1.0;
      const dw = (ev.clientX - startX) / zoom;
      const dh = (ev.clientY - startY) / zoom;
      onUpdate(node.id, {
        width: Math.max(140, Math.round(initW + dw)),
        height: Math.max(80, Math.round(initH + dh)),
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // 3. Right-Click & Alt + Right-Click Context Menu for Lock/Unlock
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSelected) onSelect?.(node.id, e.shiftKey);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        data-node-id={node.id}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => {
          if (!onOpen || (e.target as HTMLElement).closest('button, input, textarea, select, [data-port-id]')) return;
          e.stopPropagation();
          onOpen();
        }}
        onClick={(e) => {
          if (e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY });
            return;
          }
          if ((e.target as HTMLElement).closest('button, input, [data-port-id]')) return;
          if (dragMovedRef.current) {
            dragMovedRef.current = false;
            return;
          }
          onSelect?.(node.id, e.shiftKey);
        }}
        style={{
          transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
          width: `${node.width}px`,
          height: `${node.height}px`,
          position: 'absolute',
          top: 0,
          left: 0,
        }}
        aria-selected={isSelected}
        className={`group flex flex-col rounded-xl border bg-[#020500]/95 backdrop-blur-md transition-shadow select-none z-20 pointer-events-auto ${
          isSelected
            ? 'ring-2 ring-[#E0CA3C] ring-offset-2 ring-offset-[#020500]'
            : node.isLocked
            ? 'border-[#086375]/40 shadow-none'
            : 'border-[#086375] hover:border-[#E0CA3C] shadow-[0_0_20px_rgba(8,99,117,0.2)]'
        }`}
      >
        {/* ECS Connection Ports */}
        <ConnectionPort
          id={`${node.id}-top`}
          nodeId={node.id}
          position="top"
          targetPreview={targetPreview}
          onPortClick={() => onPortClick?.(node.id, 'top')}
          onPortPointerDown={(event) => onPortPointerDown?.(event, node.id, 'top')}
        />
        <ConnectionPort
          id={`${node.id}-bottom`}
          nodeId={node.id}
          position="bottom"
          targetPreview={targetPreview}
          onPortClick={() => onPortClick?.(node.id, 'bottom')}
          onPortPointerDown={(event) => onPortPointerDown?.(event, node.id, 'bottom')}
        />
        <ConnectionPort
          id={`${node.id}-left`}
          nodeId={node.id}
          position="left"
          targetPreview={targetPreview}
          onPortClick={() => onPortClick?.(node.id, 'left')}
          onPortPointerDown={(event) => onPortPointerDown?.(event, node.id, 'left')}
        />
        <ConnectionPort
          id={`${node.id}-right`}
          nodeId={node.id}
          position="right"
          targetPreview={targetPreview}
          onPortClick={() => onPortClick?.(node.id, 'right')}
          onPortPointerDown={(event) => onPortPointerDown?.(event, node.id, 'right')}
        />

        {/* Drag Bar Header */}
        <div
          onPointerDown={handleDragStart}
          className={`flex items-center justify-between px-2.5 py-1.5 border-b border-[#086375]/30 ${
            node.isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            {node.isLocked ? (
              <Lock size={11} className="text-[#FE5F00]/80 shrink-0" />
            ) : (
              <Unlock size={11} className="text-[#DDFBD0]/40 group-hover:text-[#E0CA3C] shrink-0" />
            )}
            <span className="font-mono text-hud-2 uppercase tracking-wider text-[#DDFBD0]/70 truncate max-w-[120px]">
              {node.title || node.id}
            </span>
          </div>
          <span className="font-mono text-hud-1 text-[#086375] shrink-0">
            {node.width}×{node.height}
          </span>
        </div>

        {/* Node Body Content */}
        <div className="flex-1 overflow-hidden p-2 relative">
          {children}
        </div>

        {/* Resize Handle (Bottom-Right) */}
        {!node.isLocked && (
          <div
            onPointerDown={handleResizeStart}
            className="absolute bottom-1 right-1 p-1 cursor-se-resize text-[#086375] hover:text-[#E0CA3C] z-20"
            style={{ touchAction: 'none' }}
          >
            <Maximize2 size={11} className="rotate-90" />
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
};
