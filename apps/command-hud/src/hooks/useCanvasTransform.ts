import { useState, useEffect, useRef, useCallback } from 'react';

const SOLAR_CAMERA_KEY = 'szs.solar-camera';

interface StoredCamera {
  scale: number;
  pan: { x: number; y: number };
}

function readStoredCamera(storageKey: string): StoredCamera {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || 'null') as unknown;
    if (stored && typeof stored === 'object'
      && 'pan' in stored && stored.pan && typeof stored.pan === 'object'
      && 'x' in stored.pan && 'y' in stored.pan
      && typeof stored.pan.x === 'number' && Number.isFinite(stored.pan.x)
      && typeof stored.pan.y === 'number' && Number.isFinite(stored.pan.y)) {
      const scale = 'scale' in stored && typeof stored.scale === 'number'
        && Number.isFinite(stored.scale) && stored.scale >= 0.1 && stored.scale <= 3
        ? stored.scale
        : 1;
      return { scale, pan: { x: stored.pan.x, y: stored.pan.y } };
    }
    if (stored && typeof stored === 'object'
      && 'x' in stored && 'y' in stored
      && typeof stored.x === 'number' && Number.isFinite(stored.x)
      && typeof stored.y === 'number' && Number.isFinite(stored.y)) {
      return { scale: 1, pan: { x: stored.x, y: stored.y } };
    }
  } catch {
    return { scale: 1, pan: { x: 0, y: 0 } };
  }
  return { scale: 1, pan: { x: 0, y: 0 } };
}

export interface CanvasTransformReturn {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  pan: { x: number; y: number };
  setScale: (value: number | ((prev: number) => number)) => void;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  resetTransform: () => void;
  isPanning: boolean;
  transformStyle: React.CSSProperties;
  handlePointerDown: (e: React.PointerEvent) => void;
}

export function useCanvasTransform(
  externalScale?: number,
  externalSetScale?: (value: number | ((prev: number) => number)) => void,
  storageKey = SOLAR_CAMERA_KEY,
): CanvasTransformReturn {
  const [internalScale, setInternalScale] = useState<number>(() => readStoredCamera(storageKey).scale);
  const scale = externalScale !== undefined ? externalScale : internalScale;
  const setScale = externalSetScale !== undefined ? externalSetScale : setInternalScale;

  const [pan, setPan] = useState<{ x: number; y: number }>(() => readStoredCamera(storageKey).pan);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const panStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number }>({
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ scale, pan }));
    } catch {
      return;
    }
  }, [pan, scale, storageKey]);

  // Non-passive wheel handler:
  // Supports wheel zoom toward cursor (clamp: 0.20 to 3.0)
  // Both plain wheel on background canvas, Alt+wheel, and Ctrl+wheel work, while preventing browser zoom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Check if target is inside an interactive scrollable area or dialog
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [role="dialog"], .overflow-auto, .overflow-y-auto')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;

      setScale((prevScale) => {
        const nextScale = Math.min(3.0, Math.max(0.20, Number((prevScale * zoomFactor).toFixed(3))));

        // Zoom toward mouse pointer coordinates
        if (el) {
          const rect = el.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          setPan((prevPan) => {
            const scaleRatio = nextScale / prevScale;
            const newPanX = mouseX - (mouseX - prevPan.x) * scaleRatio;
            const newPanY = mouseY - (mouseY - prevPan.y) * scaleRatio;
            return { x: Math.round(newPanX), y: Math.round(newPanY) };
          });
        }

        return nextScale;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [setScale]);

  // Pointer-down handler: left click on background or middle-click anywhere starts pan
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const isMiddleClick = e.button === 1;
    const target = e.target as HTMLElement | null;
    const isBackground =
      target === viewportRef.current ||
      target === stageRef.current ||
      target?.classList.contains('canvas-pannable-bg') ||
      target?.getAttribute('data-canvas-bg') === 'true' ||
      target?.getAttribute('data-theme') !== null;

    if (isMiddleClick || (e.button === 0 && isBackground)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      };
      // No pointer capture: move/up are tracked on window (below). Capturing retargeted the click to the viewport,
      // so a plain click on empty canvas never reached the workbench and did not clear the selection (G4 e2e).
    }
  }, [pan.x, pan.y]);

  useEffect(() => {
    if (!isPanning) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      setPan({
        x: Math.round(panStartRef.current.initialPanX + dx),
        y: Math.round(panStartRef.current.initialPanY + dy),
      });
    };

    const handlePointerUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isPanning]);

  // Reset transform with Home key support
  const resetTransform = useCallback(() => {
    setScale(1.0);
    setPan({ x: 0, y: 0 });
  }, [setScale]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Home') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          resetTransform();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetTransform]);

  const transformStyle: React.CSSProperties = {
    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
    transformOrigin: '0 0',
    transition: isPanning ? 'none' : 'transform 75ms ease-out',
    willChange: isPanning ? 'transform' : 'auto',
  };

  return {
    viewportRef,
    stageRef,
    scale,
    pan,
    setScale,
    setPan,
    resetTransform,
    isPanning,
    transformStyle,
    handlePointerDown,
  };
}
