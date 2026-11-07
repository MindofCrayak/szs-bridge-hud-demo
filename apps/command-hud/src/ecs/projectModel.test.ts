import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSunNode,
  MAX_PROJECT_ORBIT_RADIUS,
  MIN_PROJECT_ORBIT_RADIUS,
  snapProjectSunToOrbit,
  SOLAR_BARYCENTER,
} from './projectModel';

test('project Sun snaps by atan2 angle and clamps the radius from each project origin', () => {
  const origin = { x: 100, y: -50 };
  const snapped = snapProjectSunToOrbit({ x: origin.x, y: origin.y + 20 }, origin);
  assert.ok(Math.abs(snapped.x - origin.x) < 1e-8);
  assert.equal(snapped.y, origin.y + MIN_PROJECT_ORBIT_RADIUS);

  const outer = snapProjectSunToOrbit({ x: origin.x + 900, y: origin.y }, origin);
  assert.equal(outer.x, origin.x + MAX_PROJECT_ORBIT_RADIUS);
  assert.equal(outer.y, origin.y);

  const diagonal = snapProjectSunToOrbit({ x: origin.x + 50, y: origin.y + 50 }, origin);
  assert.ok(Math.abs(Math.hypot(diagonal.x - origin.x, diagonal.y - origin.y) - MIN_PROJECT_ORBIT_RADIUS) < 1e-8);
  assert.deepEqual(SOLAR_BARYCENTER, { x: 0, y: 0 });
});

test('Sun nodes are keyed by project IDs', () => {
  assert.deepEqual(createSunNode('project-a', { x: 10, y: 20 }), {
    projectId: 'project-a',
    x: 10,
    y: 20,
  });
  assert.throws(() => createSunNode('', { x: 0, y: 0 }), /project ID is required/);
});
