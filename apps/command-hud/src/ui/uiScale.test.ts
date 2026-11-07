import assert from 'node:assert/strict';
import test from 'node:test';
import { clampUiScale } from './uiScale';

test('HUD size stays between 100% and 125% in 5% steps (no text under 11px)', () => {
  assert.equal(clampUiScale(1), 1);
  assert.equal(clampUiScale(0.8), 1);
  assert.equal(clampUiScale(1.12), 1.1);
  assert.equal(clampUiScale(1.13), 1.15);
  assert.equal(clampUiScale(2), 1.25);
  assert.equal(clampUiScale(Number.NaN), 1);
});
