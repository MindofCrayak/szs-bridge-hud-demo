/** Phase F route: /client/:clientId/project/:projectId (history API; no router library in this app). */
export interface PlanetRoute { clientId: string; projectId: string }

export function parsePlanetPath(pathname: string): PlanetRoute | null {
  const match = pathname.match(/^\/client\/([^/]+)\/project\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return { clientId: decodeURIComponent(match[1]), projectId: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

export function planetPath(route: PlanetRoute): string {
  return `/client/${encodeURIComponent(route.clientId)}/project/${encodeURIComponent(route.projectId)}`;
}
