import React, { useEffect, useRef } from 'react';
import { useCanvasTransform } from '../../hooks/useCanvasTransform';
import type { ClientRecord } from '../../types';
import { ProjectWorkbenchView } from './ProjectWorkbenchView';
import type { WirePanelActions, WirePanelSnapshot } from '../../ecs/links';
import type { AgentCallsign, AlfredNodeContext } from '../../ecs/agentDispatch';

interface TacticalCanvasProps {
  selectedProjectId: string | null;
  onOpenContextMenu: (x: number, y: number, item: ClientRecord) => void;
  onUpdateClient: (updated: ClientRecord) => void;
  onToggleNonStructural: () => void;
  /** Mode / satellites / zoom controls, shown in the workbench ribbon. */
  canvasControls?: React.ReactNode;
  scale: number;
  setScale: (scale: number | ((prev: number) => number)) => void;
  onWorkbenchChange: (client: ClientRecord | null) => void;
  workbenchClient: ClientRecord;
  resetRequest: number;
  accessToken: string | null;
  interactionMode: 'drag' | 'lock' | 'edit';
  showNonStructural: boolean;
  activeWireIds: string[];
  doneNodeIds: string[];
  onWirePanelChange: (snapshot: WirePanelSnapshot | null) => void;
  onWirePanelActionsChange: (actions: WirePanelActions | null) => void;
  onDispatchAgent: (agent: AgentCallsign, nodeContext: AlfredNodeContext) => void;
  /** Phase F: double-click a project/service node to open the Planet page. */
  onOpenPlanet?: (projectId: string) => void;
}

export const TacticalCanvas: React.FC<TacticalCanvasProps> = ({
  selectedProjectId,
  onOpenContextMenu,
  onUpdateClient,
  onToggleNonStructural,
  canvasControls,
  scale,
  setScale,
  onWorkbenchChange,
  workbenchClient,
  resetRequest,
  accessToken,
  interactionMode,
  showNonStructural,
  activeWireIds,
  doneNodeIds,
  onWirePanelChange,
  onWirePanelActionsChange,
  onDispatchAgent,
  onOpenPlanet,
}) => {
  const {
    viewportRef,
    pan,
    isPanning,
    resetTransform,
    handlePointerDown,
    setPan,
    setScale: updateScale,
  } = useCanvasTransform(scale, setScale);
  const previousResetRequest = useRef(resetRequest);

  useEffect(() => {
    if (previousResetRequest.current === resetRequest) return;
    previousResetRequest.current = resetRequest;
    resetTransform();
  }, [resetRequest, resetTransform]);

  return (
    <div
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      className="relative h-full w-full overflow-hidden bg-[#020500] select-none canvas-pannable-bg"
    >
      <div className="absolute inset-0 z-[-1] pointer-events-none crm-grid opacity-40" data-canvas-bg="true" />
      <div className="relative z-30 h-full w-full pointer-events-none">
        <ProjectWorkbenchView
          client={workbenchClient}
          selectedProjectId={selectedProjectId}
          onExit={() => onWorkbenchChange(null)}
          toolbar={canvasControls}
          onUpdateClient={onUpdateClient}
          cameraZoom={scale}
          cameraPan={pan}
          accessToken={accessToken}
          interactionMode={interactionMode}
          showNonStructural={showNonStructural}
          activeWireIds={activeWireIds}
          doneNodeIds={doneNodeIds}
          onWirePanelChange={onWirePanelChange}
          onWirePanelActionsChange={onWirePanelActionsChange}
          onDispatchAgent={onDispatchAgent}
          onOpenPlanet={onOpenPlanet}
          onTriggerAction={(action, payload) => {
            if (action === 'FOCUS_NODE' && typeof payload?.x === 'number' && typeof payload?.y === 'number') {
              const viewport = viewportRef.current?.getBoundingClientRect();
              if (!viewport) return;
              setPan({
                x: Math.round(viewport.width / 2 - (viewport.width / 2 + payload.x) * scale),
                y: Math.round(viewport.height / 2 - (viewport.height / 2 + payload.y) * scale),
              });
              return;
            }
            if (action === 'FIT_WORKBENCH' && typeof payload?.left === 'number'
              && typeof payload?.top === 'number' && typeof payload?.right === 'number'
              && typeof payload?.bottom === 'number') {
              const viewport = viewportRef.current?.getBoundingClientRect();
              if (!viewport) return;
              const width = Math.max(1, payload.right - payload.left);
              const height = Math.max(1, payload.bottom - payload.top);
              const fitScale = Math.min(
                3,
                Math.max(0.2, Math.min((viewport.width - 96) / width, (viewport.height - 96) / height)),
              );
              const centerX = (payload.left + payload.right) / 2;
              const centerY = (payload.top + payload.bottom) / 2;
              updateScale(fitScale);
              setPan({
                x: Math.round(viewport.width / 2 - (viewport.width / 2 + centerX) * fitScale),
                y: Math.round(viewport.height / 2 - (viewport.height / 2 + centerY) * fitScale),
              });
              return;
            }
            if (action === 'TOGGLE_SATELLITES') {
              onToggleNonStructural();
              return;
            }
            if (action === 'OPEN_TASKS' || action === 'DRAFT_INVOICE') {
              onOpenContextMenu(window.innerWidth / 2, window.innerHeight / 2, payload?.client || workbenchClient);
            }
          }}
        />
      </div>
      {isPanning && <span className="sr-only">Panning Solar canvas</span>}
    </div>
  );
};

export default TacticalCanvas;
