export interface SunNode {
  projectId: string;
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

export const SOLAR_BARYCENTER: Point = { x: 0, y: 0 };
export const MIN_PROJECT_ORBIT_RADIUS = 220;
export const MAX_PROJECT_ORBIT_RADIUS = 480;

export function snapProjectSunToOrbit(pointer: Point, origin: Point): Point {
  const dx = pointer.x - origin.x;
  const dy = pointer.y - origin.y;
  const angle = Math.atan2(dy, dx);
  const radius = Math.max(
    MIN_PROJECT_ORBIT_RADIUS,
    Math.min(MAX_PROJECT_ORBIT_RADIUS, Math.hypot(dx, dy)),
  );
  return {
    x: origin.x + Math.cos(angle) * radius,
    y: origin.y + Math.sin(angle) * radius,
  };
}

export function createSunNode(projectId: string, position: Point): SunNode {
  if (!projectId) throw new Error('A project ID is required for a Sun node.');
  return { projectId, ...position };
}
