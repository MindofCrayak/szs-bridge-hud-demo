import assert from 'node:assert/strict';
import test from 'node:test';
import type { HudTask } from '../types';
import { buildGantt, orderTasks, visibleWindow, dayOffset, addDays } from './gantt';

const t = (over: Partial<HudTask>): HudTask => ({
  id: 'x', title: 'X', status: 'needsAction', due: '', parentId: '', audience: 'internal', notes: '', start: '', key: '', milestone: false, ...over,
});

const tasks: HudTask[] = [
  t({ id: 'P', title: 'Base' }),
  t({ id: 'B', parentId: 'P', title: 'Late', start: '2026-11-02', due: '2026-11-03' }),
  t({ id: 'A', parentId: 'P', title: 'Done', start: '2026-11-01', due: '2026-11-01', status: 'completed' }),
  t({ id: 'C', parentId: 'P', title: 'Later', due: '2026-11-20' }),
  t({ id: 'Q', title: 'Offboarding' }),
  t({ id: 'D', parentId: 'Q', title: 'Archive', start: '2026-12-16', due: '2026-12-20' }),
];

test('date helpers', () => {
  assert.equal(dayOffset('2026-11-01', '2026-11-15'), 14);
  assert.equal(addDays('2026-11-30', 2), '2026-12-02');
});

test('order: parents in list order, children by start/due', () => {
  assert.deepEqual(orderTasks(tasks).map((row) => `${row.depth}${row.task.id}`), ['0P', '1A', '1B', '1C', '0Q', '1D']);
});

test('gantt: day 0 = kickoff, bars from Start to due, marker without start, states and parent spans', () => {
  const layout = buildGantt(tasks, '2026-11-01T05:00:00.000Z', '2026-11-05');
  assert.equal(layout.kickoff, '2026-11-01');
  assert.equal(layout.todayDay, 4);
  const row = (id: string) => layout.rows.find((r) => r.task.id === id)!;
  assert.deepEqual([row('A').startDay, row('A').endDay, row('A').state], [0, 0, 'completed']);
  assert.deepEqual([row('B').startDay, row('B').endDay, row('B').state], [1, 2, 'overdue']);
  assert.deepEqual([row('C').startDay, row('C').marker, row('C').state], [19, true, 'upcoming']);
  assert.deepEqual([row('P').startDay, row('P').endDay, row('P').state, row('P').kind], [0, 19, 'overdue', 'parent']);
  assert.equal(layout.days, 51, 'axis extends past day 45 to the last due date');
  assert.equal(layout.stages[0].day, 0);
});

test('gantt: no kickoff falls back to the earliest task date', () => {
  assert.equal(buildGantt(tasks, undefined, '2026-11-05').kickoff, '2026-11-01');
  assert.equal(buildGantt([], '', '2026-11-05').kickoff, '2026-11-05');
});

test('planet route round-trips and rejects other paths', async () => {
  const { parsePlanetPath, planetPath } = await import('./route');
  assert.deepEqual(parsePlanetPath('/client/PAC/project/PAC-01'), { clientId: 'PAC', projectId: 'PAC-01' });
  assert.deepEqual(parsePlanetPath(planetPath({ clientId: 'A B', projectId: 'X/1' })), { clientId: 'A B', projectId: 'X/1' });
  assert.equal(parsePlanetPath('/'), null);
  assert.equal(parsePlanetPath('/cockpit'), null);
  assert.equal(parsePlanetPath('/client/PAC/project/'), null);
});

test('virtual window renders only the visible slice plus overscan', () => {
  assert.deepEqual(visibleWindow(500, 0, 24, 240, 5), { first: 0, last: 15, padTop: 0, padBottom: 485 * 24 });
  assert.deepEqual(visibleWindow(500, 2400, 24, 240, 5), { first: 95, last: 115, padTop: 95 * 24, padBottom: 385 * 24 });
});
