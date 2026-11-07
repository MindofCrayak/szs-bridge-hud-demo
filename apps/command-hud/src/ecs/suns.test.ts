import assert from 'node:assert/strict';
import test from 'node:test';
import type { LinkState } from './links';
import { nearestSun, planSuns, sunDefaultKey, sunLayout, sunNodeId, withSunDefaults } from './suns';

const p = (ProjectID: string, SprintStage: string) => ({ ProjectID, SprintStage } as { ProjectID: string; SprintStage: never });

test('plan: primary = selected open project, else first open; sunset projects go out', () => {
  const projects = [p('SEN-01', '09: Sunset / Retainer'), p('SEN-02', '03: Deep Intelligence'), p('SEN-03', '05: Architecture & Builds')];
  const plan = planSuns(projects, 'SEN-01');
  assert.equal(plan.primary?.ProjectID, 'SEN-02', 'a sunset selection falls back to an open project');
  assert.deepEqual(plan.secondary.map((x) => x.ProjectID), ['SEN-03']);
  assert.equal(plan.primaryOut, false);
  assert.equal(planSuns(projects, 'SEN-03').primary?.ProjectID, 'SEN-03');
  const allDone = planSuns([p('A-01', '09: Sunset / Retainer')], null);
  assert.equal(allDone.primary?.ProjectID, 'A-01');
  assert.equal(allDone.primaryOut, true, 'only sunset projects: the primary sun is shown going out');
  assert.deepEqual(allDone.secondary, []);
});

test('layout keeps secondary suns outside the department ring', () => {
  assert.deepEqual(sunLayout(0), { x: 400, y: -110 });
  assert.deepEqual(sunLayout(1), { x: -780, y: -110 });
  assert.deepEqual(sunLayout(6), { x: 840, y: 150 });
});

test('sun default wires: added per department, respect deletions, removed when the sun goes out', () => {
  const base: LinkState = { version: 2, clientId: 'SEN', links: [], suppressedDefaults: [sunDefaultKey('SEN-03', 'oracle')], connectors: [] };
  const withSuns = withSunDefaults(base, ['SEN-03']);
  assert.equal(withSuns.links.length, 4, 'oracle wire was deleted by the user, so it is not re-added');
  assert.ok(withSuns.links.every((link) => link.toNodeId === sunNodeId('SEN-03') && link.origin === 'default'));
  assert.equal(withSunDefaults(withSuns, ['SEN-03']), withSuns, 'idempotent: no change, same object');
  const custom = { ...withSuns.links[0], id: 'wire:user', origin: 'user' as const, defaultKey: undefined };
  const gone = withSunDefaults({ ...withSuns, links: [...withSuns.links, custom] }, []);
  assert.deepEqual(gone.links.map((link) => link.id), ['wire:user'], 'sun defaults leave with the sun; user wires stay');
});

test('nearest sun picks the closest centre', () => {
  const suns = [{ id: 'core-node', cx: 0, cy: 0 }, { id: 'sun-B', cx: 580, cy: 0 }];
  assert.equal(nearestSun({ x: 400, y: 50 }, suns)?.id, 'sun-B');
  assert.equal(nearestSun({ x: 100, y: 50 }, suns)?.id, 'core-node');
});

test('workbench layout: saved positions win, copies come back, removed components do not', async () => {
  const { mergeLayout, parseLayout, serializeLayout } = await import('./workbenchLayout');
  const initial = [
    { id: 'node-pamela', x: -300, y: -200, width: 220, height: 130, isLocked: false },
    { id: 'node-comp_x', serviceId: 'comp_x', x: 500, y: 0, width: 200, height: 100, isLocked: false },
  ];
  const saved = parseLayout(serializeLayout([
    { id: 'node-pamela', x: 10, y: 20, width: 300, height: 150, isLocked: true },
    { id: 'node-comp_x', serviceId: 'comp_x', x: 900, y: 40, width: 200, height: 100, isLocked: false, projectId: 'PAC-02' },
    { id: 'node-oracle-copy-1', title: 'ORACLE COPY', x: 1, y: 2, width: 220, height: 130, isLocked: false },
    { id: 'node-comp_gone', serviceId: 'comp_gone', x: 0, y: 0, width: 200, height: 100, isLocked: false },
  ]));
  const merged = mergeLayout(initial, saved);
  assert.deepEqual(merged.map((n) => [n.id, n.x, n.y, n.isLocked]), [
    ['node-pamela', 10, 20, true], ['node-comp_x', 900, 40, false], ['node-oracle-copy-1', 1, 2, false],
  ]);
  assert.equal(merged[1].projectId, 'PAC-02');
  assert.deepEqual(parseLayout('not json'), {});
});
