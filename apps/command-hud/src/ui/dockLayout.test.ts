import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDockLayout } from './dockLayout';

test('bay widths: saved values are used exactly within the bay limits; missing = responsive default', () => {
  const stored: Record<string, string> = { szs_bay_cal: '520', szs_bay_center: '5000', szs_bay_dossier: 'junk', szs_dock_scale: '0.83' };
  const layout = parseDockLayout((key) => stored[key] ?? null);
  assert.deepEqual(layout.widths, { calendar: 520, center: 1000, dossier: null, macro: null });
  assert.equal(layout.scale, 0.85, 'scale snaps to 5% steps');
  assert.equal(parseDockLayout(() => '3').scale, 1.25);
  assert.equal(parseDockLayout(() => null).scale, 1);
});
