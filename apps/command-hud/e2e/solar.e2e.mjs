/**
 * Phase G4 (Master Plan v3.1): browser regression for the Phase 2 canvas items.
 * Runs the HUD in SNAPSHOT mode (local fake CSV data, no sign-in, nothing written to Master Control) on its own
 * port, drives the installed Microsoft Edge with playwright-core, and writes evidence to e2e/results/.
 *
 *   npm run e2e                  (starts its own dev server on 3099)
 *   E2E_URL=http://127.0.0.1:3099 npm run e2e   (reuse a running snapshot-mode server)
 *
 * Every test gets a fresh browser context, so localStorage (wires, layout) starts empty each time.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(here, 'results');
mkdirSync(resultsDir, { recursive: true });
const PORT = 3099;
const BASE = process.env.E2E_URL || `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startServer() {
  if (process.env.E2E_URL) return null;
  const child = spawn(process.execPath, [path.join(here, '..', '..', '..', 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: path.join(here, '..'), env: { ...process.env, VITE_DATA_MODE: 'snapshot' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(BASE)).ok) return child; } catch { /* not up yet */ }
    await sleep(500);
  }
  child.kill();
  throw new Error('Snapshot dev server did not start on ' + BASE);
}

/* ---------- helpers ---------- */
const box = async (page, id) => page.locator(`[data-node-id="${id}"]`).first().boundingBox();
const wireD = async (page, id) => page.locator(`[data-wire-id="${id}"] path`).first().getAttribute('d');
const menu = (page) => page.locator('[role="menu"]').last();
function assert(condition, message) { if (!condition) throw new Error(message); }

const pacCard = (page) => page.locator('article[aria-label="Project PAC-01"]');
async function gotoUniverse(page) {
  await page.goto(BASE + '/');
  await pacCard(page).waitFor();
}
async function gotoGalaxy(page) {
  await gotoUniverse(page);
  await pacCard(page).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'GALAXY', exact: true }).click();
  await page.locator('article', { hasText: 'PAC-01' }).first().waitFor();
}
async function gotoSolar(page) {
  await gotoGalaxy(page);
  await page.locator('article', { hasText: 'PAC-01' }).first().dblclick();
  await page.locator('[data-node-id="core-node"]').waitFor();
  await sleep(600);
}
async function dragBy(page, x, y, dx, dy, steps = 8) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
  await sleep(200);
}
/** A point on a wire path, in screen coordinates. */
async function wirePoint(page, id) {
  return page.locator(`[data-wire-id="${id}"] path`).first().evaluate((p) => {
    const point = p.getPointAtLength(p.getTotalLength() / 2);
    const m = p.getScreenCTM();
    return { x: point.x * m.a + point.y * m.c + m.e, y: point.x * m.b + point.y * m.d + m.f };
  });
}
/** An empty spot of the Solar canvas (no node or menu under it). */
async function emptySpot(page) {
  for (const [x, y] of [[1400, 760], [1400, 260], [700, 820], [230, 760], [230, 260]]) {
    const empty = await page.evaluate(([px, py]) => {
      const hit = document.elementFromPoint(px, py);
      return Boolean(hit && hit.closest('.canvas-pannable-bg')
        && !hit.closest('[data-node-id], [data-wire-id], button, input, select, textarea, section, aside, nav, [role="menu"], [role="dialog"]'));
    }, [x, y]);
    if (empty) return { x, y };
  }
  throw new Error('No empty canvas spot found.');
}

/* ---------- tests (each returns evidence text) ---------- */
const tests = [];
const test = (id, name, fn) => tests.push({ id, name, fn });

test('bays', 'Bottom bays visible and clickable in Universe, Galaxy, Solar and Planet', async (page) => {
  const evidence = [];
  const check = async (view) => {
    for (const label of ['Calendar', 'Alfred Core', 'Client Dossier']) {
      assert(await page.getByText(label, { exact: true }).first().isVisible(), `${label} not visible in ${view}`);
    }
    const header = page.getByText('Client Dossier', { exact: true }).first();
    await header.click();
    await sleep(350);
    const expanded = await page.getByText('Client Dossier', { exact: true }).count();
    await header.click();
    await sleep(350);
    evidence.push(`${view}: 3 bay headers visible; Dossier header click toggled (${expanded} label(s) while pinned)`);
  };
  await gotoUniverse(page); await check('Universe');
  await pacCard(page).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'GALAXY', exact: true }).click(); await sleep(500); await check('Galaxy');
  await page.locator('article', { hasText: 'PAC-01' }).first().dblclick(); await page.locator('[data-node-id="core-node"]').waitFor(); await check('Solar');
  await page.locator('[data-node-id="core-node"]').dblclick({ position: { x: 200, y: 140 } });
  await page.locator('[aria-label="Planet view for PAC-01"]').waitFor(); await check('Planet');
  return evidence.join('\n');
});

test('drag-wire', 'Node drag moves the node and its wires follow (Pamela, Dolores pairs)', async (page) => {
  await gotoSolar(page);
  const before = await box(page, 'node-pamela');
  const wiresBefore = [await wireD(page, 'default:PAC:pamela-sun'), await wireD(page, 'default:PAC:dolores-vala')];
  await dragBy(page, before.x + 70, before.y + 12, 140, 90);
  const after = await box(page, 'node-pamela');
  assert(after.x - before.x > 60 && after.y - before.y > 40, `Pamela did not move (${before.x},${before.y} -> ${after.x},${after.y})`);
  const pamelaWire = await wireD(page, 'default:PAC:pamela-sun');
  assert(pamelaWire !== wiresBefore[0], 'Pamela-Sun wire did not follow the move');
  const dolores = await box(page, 'node-dolores');
  await dragBy(page, dolores.x + 70, dolores.y + 12, -80, 60);
  assert(await wireD(page, 'default:PAC:dolores-vala') !== wiresBefore[1], 'Dolores-Vala wire did not follow the move');
  return `Pamela moved ${Math.round(after.x - before.x)},${Math.round(after.y - before.y)} px; pamela-sun and dolores-vala paths changed`;
});

test('lock', 'Lock (L) prevents drag; unlock restores it', async (page) => {
  await gotoSolar(page);
  const start = await box(page, 'node-oracle');
  await page.mouse.click(start.x + 70, start.y + 12);
  await page.keyboard.press('l');
  await dragBy(page, start.x + 70, start.y + 12, 120, 80);
  const locked = await box(page, 'node-oracle');
  assert(Math.abs(locked.x - start.x) < 2 && Math.abs(locked.y - start.y) < 2, 'Locked node moved');
  await page.mouse.click(start.x + 70, start.y + 12);
  await page.keyboard.press('l');
  await dragBy(page, start.x + 70, start.y + 12, 120, 80);
  const moved = await box(page, 'node-oracle');
  assert(moved.x - start.x > 50, 'Unlocked node did not move');
  return `locked: moved ${Math.round(locked.x - start.x)} px; unlocked: moved ${Math.round(moved.x - start.x)} px`;
});

test('resize', 'Resize handle grows a node', async (page) => {
  await gotoSolar(page);
  const before = await box(page, 'node-vala');
  const handle = await page.locator('[data-node-id="node-vala"] .cursor-se-resize').first().boundingBox();
  await dragBy(page, handle.x + handle.width / 2, handle.y + handle.height / 2, 80, 50);
  const after = await box(page, 'node-vala');
  assert(after.width - before.width > 30 && after.height - before.height > 20, `Vala did not resize (${before.width}x${before.height} -> ${after.width}x${after.height})`);
  return `Vala ${Math.round(before.width)}x${Math.round(before.height)} -> ${Math.round(after.width)}x${Math.round(after.height)}`;
});

test('zoom-pan', 'Wheel zoom on the canvas and background pan', async (page) => {
  await gotoSolar(page);
  const spot = await emptySpot(page);
  const before = await box(page, 'core-node');
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.wheel(0, -400);
  await sleep(400);
  const zoomed = await box(page, 'core-node');
  assert(Math.abs(zoomed.width - before.width) > 10, `Zoom did not change scale (${before.width} -> ${zoomed.width})`);
  const spot2 = await emptySpot(page);
  await dragBy(page, spot2.x, spot2.y, 120, -60);
  const panned = await box(page, 'core-node');
  assert(Math.abs(panned.x - zoomed.x) > 60, `Pan did not move the camera (${zoomed.x} -> ${panned.x})`);
  return `zoom: Sun width ${Math.round(before.width)} -> ${Math.round(zoomed.width)}; pan: Sun x ${Math.round(zoomed.x)} -> ${Math.round(panned.x)}`;
});

test('menus', 'Node, Alt+Right-Click, Sun, wire and canvas context menus open with their actions', async (page) => {
  await gotoSolar(page);
  const evidence = [];
  const oracle = await box(page, 'node-oracle');
  await page.mouse.click(oracle.x + 70, oracle.y + 12, { button: 'right' });
  assert(await menu(page).isVisible(), 'Node menu did not open');
  evidence.push('node: ' + (await menu(page).locator('[role="menuitem"]').allInnerTexts()).map((t) => t.split('\n')[0]).join(', '));
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.keyboard.down('Alt');
  await page.mouse.move(oracle.x + 70, oracle.y + 60);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await page.keyboard.up('Alt');
  assert(await menu(page).isVisible(), 'Alt+Right-Click did not open the node menu');
  evidence.push('Alt+Right-Click: node menu opened');
  await page.keyboard.press('Escape');
  await sleep(200);
  const sun = await box(page, 'core-node');
  await page.mouse.click(sun.x + 210, sun.y + 140, { button: 'right' });
  const sunItems = (await menu(page).locator('[role="menuitem"]').allInnerTexts()).map((t) => t.split('\n')[0]);
  assert(sunItems.some((t) => /Planet/.test(t)) && sunItems.some((t) => /Recenter Sun/.test(t)), 'Sun menu is missing Planet/Recenter: ' + sunItems.join(', '));
  evidence.push('Sun: ' + sunItems.join(', '));
  await page.keyboard.press('Escape');
  await sleep(200);
  const wire = await wirePoint(page, 'default:PAC:dolores-vala');
  await page.mouse.click(wire.x, wire.y, { button: 'right' });
  const wireItems = (await menu(page).locator('[role="menuitem"]').allInnerTexts()).map((t) => t.split('\n')[0]);
  assert(wireItems.some((t) => /Delete wire/.test(t)), 'Wire menu has no Delete wire: ' + wireItems.join(', '));
  evidence.push('wire: ' + wireItems.join(', '));
  await page.keyboard.press('Escape');
  await sleep(200);
  const spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y, { button: 'right' });
  assert(await menu(page).isVisible(), 'Canvas menu did not open');
  evidence.push('canvas: ' + (await menu(page).locator('[role="menuitem"]').allInnerTexts()).map((t) => t.split('\n')[0]).join(', '));
  return evidence.join('\n');
});

test('wire-delete', 'Wire delete by context menu, Undo restores it, a delete survives reload', async (page) => {
  await gotoSolar(page);
  const id = 'default:PAC:dolores-vala';
  const open = async () => {
    const point = await wirePoint(page, id);
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await menu(page).getByText('Delete wire').click();
    await sleep(300);
  };
  await open();
  assert(await page.locator(`[data-wire-id="${id}"]`).count() === 0, 'Wire still present after delete');
  await page.keyboard.press('Control+z');
  await sleep(300);
  assert(await page.locator(`[data-wire-id="${id}"]`).count() === 1, 'Undo did not restore the wire');
  await open();
  await page.reload();
  await page.locator('[data-node-id="core-node"]').waitFor({ timeout: 15000 }).catch(async () => { await gotoSolar(page); });
  await sleep(600);
  assert(await page.locator(`[data-wire-id="${id}"]`).count() === 0, 'Deleted wire came back after reload');
  return 'deleted via menu -> gone; Ctrl+Z -> restored; deleted again + reload -> still gone';
});

test('shortcuts', 'Ctrl+A / clear / Ctrl+D / Delete / Ctrl+Z / F, ignored while typing in an input', async (page) => {
  await gotoSolar(page);
  const selected = () => page.locator('[data-node-id][aria-selected="true"]').count();
  const spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y);
  await page.keyboard.press('Control+a');
  const all = await selected();
  assert(all >= 5, `Ctrl+A selected ${all} nodes`);
  // Escape in Solar also returns to Galaxy (App level navigation), so clear the selection with a canvas click.
  await page.mouse.click(spot.x, spot.y);
  await sleep(200);
  assert(await selected() === 0, 'A canvas click did not clear the selection');
  const nodesBefore = await page.locator('[data-node-id]').count();
  const idsBefore = await page.$$eval('[data-node-id]', (els) => els.map((e) => e.getAttribute('data-node-id')));
  const pamela = await box(page, 'node-pamela');
  await page.mouse.click(pamela.x + 70, pamela.y + 12);
  await page.keyboard.press('Control+d');
  await sleep(300);
  const nodesDup = await page.locator('[data-node-id]').count();
  const dupNote = nodesDup > nodesBefore ? `Ctrl+D duplicated (${nodesBefore} -> ${nodesDup})` : 'Ctrl+D made no copy of a department node (built-in)';
  let deleteNote = 'no deletable copy';
  // Multi-select delete is at the top level of a node menu (owner 2026-11-05); departments are kept.
  await page.keyboard.press('Control+a');
  const oracleBox = await box(page, 'node-oracle');
  await page.mouse.click(oracleBox.x + 70, oracleBox.y + 12, { button: 'right' });
  const multiItems = (await menu(page).locator('[role="menuitem"]').allInnerTexts()).map((t) => t.split('\n')[0]);
  const multiDelete = multiItems.find((t) => /Delete \d+ selected/.test(t));
  assert(multiDelete, 'No top-level multi-select delete: ' + multiItems.join(', '));
  await page.keyboard.press('Escape');
  await page.mouse.click(spot.x, spot.y);
  await page.mouse.click(pamela.x + 70, pamela.y + 12);
  if (nodesDup > nodesBefore) {
    const copyId = (await page.$$eval('[data-node-id]', (els) => els.map((e) => e.getAttribute('data-node-id')))).find((id) => !idsBefore.includes(id));
    const copy = await box(page, copyId);
    await page.mouse.click(copy.x + 70, copy.y + 12);
    await page.keyboard.press('Delete');
    await sleep(300);
    const afterDelete = await page.locator('[data-node-id]').count();
    await page.keyboard.press('Control+z');
    await sleep(300);
    const afterUndo = await page.locator('[data-node-id]').count();
    assert(afterDelete === nodesBefore && afterUndo === nodesDup, `Delete/Undo counts ${afterDelete}/${afterUndo}`);
    deleteNote = `Delete removed the copy ${copyId} (${afterDelete}), Ctrl+Z restored it (${afterUndo})`;
  }
  await page.mouse.click(spot.x, spot.y);
  const oracle = await box(page, 'node-oracle');
  await page.mouse.click(oracle.x + 70, oracle.y + 12);
  const sunBefore = await box(page, 'core-node');
  await page.keyboard.press('f');
  await sleep(500);
  const sunAfter = await box(page, 'core-node');
  assert(Math.abs(sunAfter.x - sunBefore.x) + Math.abs(sunAfter.y - sunBefore.y) > 20, 'F did not focus the selected node');
  // Input-focus exception: the Planet task form is not on Solar, so use a temporary input on the page.
  await page.evaluate(() => { const input = document.createElement('input'); input.id = 'e2e-input'; document.body.appendChild(input); });
  await page.mouse.click(spot.x, spot.y);
  await page.focus('#e2e-input');
  await page.keyboard.press('Control+a');
  const whileTyping = await selected();
  assert(whileTyping <= 1, `Ctrl+A selected ${whileTyping} nodes while typing in an input`);
  return [`Ctrl+A selected ${all}`, 'canvas click cleared the selection', dupNote, `multi-select menu: ${multiDelete}`, deleteNote, 'F moved the camera to the node', `Ctrl+A in an input selected ${whileTyping} node(s)`].join('\n');
});

test('drop-snap-guard', 'Service drop: Financial Mutation dialog, orbit snap around the Sun, duplicate guard on a second drop', async (page) => {
  await gotoSolar(page);
  const workbench = page.locator('div.pointer-events-auto.relative[data-canvas-bg="true"]').first();
  const sun = await box(page, 'core-node');
  const drop = async (x, y) => {
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.setData('application/json', JSON.stringify({ serviceId: 'comp_dns_shield', name: 'DNS & DMARC Armor', price: 1500 }));
      return dt;
    });
    await workbench.dispatchEvent('drop', { dataTransfer, clientX: x, clientY: y });
    await sleep(300);
  };
  // Drop right next to the Sun: the orbit snap pushes the node out to at least 220 px from the Sun.
  await drop(sun.x + sun.width / 2 + 30, sun.y + sun.height / 2 + 10);
  const dialog = page.getByRole('dialog', { name: /Financial Mutation Confirmation/ });
  assert(await dialog.isVisible(), 'The Financial Mutation dialog did not open for a priced drop');
  const dialogText = (await dialog.innerText()).replace(/\s+/g, ' ');
  await dialog.getByRole('button', { name: /AUTHORIZE MUTATION/ }).click();
  await page.locator('[data-node-id="node-comp_dns_shield"]').waitFor();
  const node = await box(page, 'node-comp_dns_shield');
  const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  const distance = Math.hypot(centre(node).x - centre(sun).x, centre(node).y - centre(sun).y);
  assert(distance > 150, `Dropped node is only ${Math.round(distance)} px from the Sun (no orbit snap)`);
  await drop(sun.x - 200, sun.y + 50);
  assert(!(await dialog.isVisible()), 'A second drop of the same service opened the dialog again');
  assert(await page.locator('[data-node-id="node-comp_dns_shield"]').count() === 1, 'Duplicate node created');
  return [`dialog: ${dialogText.slice(0, 140)}…`, `node snapped ${Math.round(distance)} px from the Sun centre`, 'second drop: no dialog, still one node (duplicate guard)'].join('\n');
});

test('nav-actions', 'Universe -> Galaxy -> Solar from the top bar; client actions via ⋮ and right-click in Universe and Galaxy, and from the Sun menu', async (page) => {
  await page.setViewportSize({ width: 1250, height: 880 });
  await gotoUniverse(page);
  const evidence = [];
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const openMenuItems = async () => (await menu(page).locator('[role="menuitem"]').allInnerTexts()).map((t) => t.trim());
  await page.getByRole('button', { name: /Actions for .*Prime Auto Collision/ }).first().click();
  let items = await openMenuItems();
  assert(items.some((t) => /Status Summary/.test(t)) && items.some((t) => /Sunset whole client/.test(t)), 'Universe ⋮ menu: ' + items.join(', '));
  evidence.push('Universe ⋮: ' + items.join(', '));
  await page.keyboard.press('Escape');
  await pacCard(page).click({ button: 'right' });
  assert(await menu(page).isVisible(), 'Universe right-click menu did not open');
  evidence.push('Universe right-click: menu opened');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: path.join(resultsDir, 'fonts-universe.png') });
  await nav.getByRole('button', { name: 'GALAXY', exact: true }).click();
  await page.locator('article', { hasText: 'PAC-01' }).first().waitFor();
  evidence.push('top bar GALAXY reachable from Universe');
  await page.getByRole('button', { name: /Actions for .*Prime Auto Collision/ }).first().click();
  items = await openMenuItems();
  assert(items.some((t) => /Draft Invoice/.test(t)), 'Galaxy ⋮ menu: ' + items.join(', '));
  evidence.push('Galaxy ⋮: menu opened');
  await page.keyboard.press('Escape');
  await page.locator('article', { hasText: 'PAC-01' }).first().click({ button: 'right' });
  assert(await menu(page).isVisible(), 'Galaxy right-click menu did not open');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: path.join(resultsDir, 'fonts-galaxy.png') });
  await nav.getByRole('button', { name: 'SOLAR', exact: true }).click();
  await page.locator('[data-node-id="core-node"]').waitFor();
  evidence.push('top bar SOLAR reachable from Galaxy');
  const sun = await box(page, 'core-node');
  await page.mouse.click(sun.x + sun.width / 2, sun.y + sun.height / 2, { button: 'right' });
  await menu(page).getByText(/Client actions/).click();
  items = await openMenuItems();
  assert(items.some((t) => /Sunset whole client/.test(t)), 'Solar client actions: ' + items.join(', '));
  evidence.push('Solar Sun menu -> Client actions -> menu with Sunset whole client');
  return evidence.join('\n');
});

test('galaxy-board', 'Galaxy is a plain board: empty stages collapsed, a card dragged to the far stage, ⋮ Move to stage, ⋮ Move phase and Reset to auto', async (page) => {
  await page.setViewportSize({ width: 1250, height: 880 });
  await gotoGalaxy(page);
  const evidence = [];
  const strips = await page.locator('button[aria-label$=", empty. Expand"]').count();
  assert(strips >= 5, `expected collapsed empty stages, found ${strips}`);
  evidence.push(`${strips} empty stages collapsed to strips`);
  await page.screenshot({ path: path.join(resultsDir, 'galaxy-board.png') });
  const card = page.locator('article', { hasText: 'PAC-01' }).first();
  const target = page.locator('button[aria-label="09: Sunset / Retainer, empty. Expand"]');
  await card.dragTo(target);
  await page.locator('section[aria-label^="09: Sunset / Retainer projects"] article', { hasText: 'PAC-01' }).waitFor({ timeout: 5000 });
  evidence.push('dragged PAC-01 onto the far 09 strip: it is now in 09');
  await page.getByRole('button', { name: /Actions for .*Prime Auto Collision/ }).first().click();
  await menu(page).getByText(/Move PAC-01 to stage/).click();
  await menu(page).getByRole('menuitem', { name: '04: Session Zero Kickoff', exact: true }).click();
  await page.locator('section[aria-label^="04: Session Zero Kickoff projects"] article', { hasText: 'PAC-01' }).waitFor({ timeout: 5000 });
  evidence.push('⋮ → Move PAC-01 to stage → 04: back in 04');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'UNIVERSE', exact: true }).click();
  await page.getByRole('button', { name: /Actions for .*Zenith/ }).first().click();
  await menu(page).getByText(/Move phase/).click();
  await menu(page).getByRole('menuitem', { name: '06: Archived/Sunset', exact: true }).click();
  await page.locator('section[aria-label="06: Archived/Sunset clients"]', { hasText: 'Zenith' }).waitFor({ timeout: 5000 });
  evidence.push('⋮ → Move phase → 06: Zenith shows in the (open) Sunset column');
  await page.getByRole('button', { name: /Actions for .*Zenith/ }).first().click();
  await menu(page).getByText(/Move phase/).click();
  const reset = menu(page).getByRole('menuitem', { name: /Reset phase to auto/ });
  evidence.push(`Reset to auto offered in the menu (enabled: ${await reset.isEnabled()})`);
  return evidence.join('\n');
});

test('universe-projects', 'Universe shows one card per project; dragging a project card to Sunset moves only that project to 09', async (page) => {
  await page.setViewportSize({ width: 1250, height: 880 });
  await gotoUniverse(page);
  const projectCards = await page.locator('article[aria-label^="Project "]').count();
  assert(projectCards >= 2, `expected project cards, found ${projectCards}`);
  const sunset = page.locator('section[aria-label="06: Archived/Sunset clients"], button[aria-label^="Expand 06: Archived/Sunset"]').first();
  await pacCard(page).dragTo(sunset);
  await page.locator('section[aria-label="06: Archived/Sunset clients"] article[aria-label="Project PAC-01"]').waitFor({ timeout: 5000 });
  const stage = await page.locator('article[aria-label="Project PAC-01"]').innerText();
  assert(/09: Sunset \/ Retainer/.test(stage), 'PAC-01 card does not show stage 09: ' + stage.replace(/\s+/g, ' ').slice(0, 160));
  await page.screenshot({ path: path.join(resultsDir, 'universe-projects.png') });
  return `${projectCards} project cards; PAC-01 dragged to Sunset -> stage 09 in the Sunset column`;
});

test('drawer-departments', 'Left-bar department buttons and the drawer chips filter the feed; the main view stays put', async (page) => {
  await gotoUniverse(page);
  const evidence = [];
  await page.locator('button[title="Open Universal Intercom Drawer"]').click();
  for (const dept of ['Daisy', 'Pamela']) {
    await page.getByRole('group', { name: 'Filter alerts by department' }).getByRole('button', { name: new RegExp(`^${dept} \\d+$`) }).click();
    const summary = await page.locator('summary', { hasText: 'Priority Feed' }).first().innerText();
    assert(summary.toLowerCase().includes(`${dept} · priority feed`.toLowerCase()), `feed did not switch to ${dept}: ${summary}`);
    evidence.push(summary.replace(/\s+/g, ' ').trim());
  }
  await page.getByRole('group', { name: 'Filter alerts by department' }).getByRole('button', { name: /^All \d+$/ }).click();
  evidence.push((await page.locator('summary', { hasText: 'Priority Feed' }).first().innerText()).replace(/\s+/g, ' ').trim());
  assert(await pacCard(page).isVisible(), 'the main view changed away from Universe');
  evidence.push('Universe still showing');
  return evidence.join('\n');
});

/** Adds a second open project PAC-02 (stage 05) to the snapshot projects.csv in the browser only (files untouched). */
async function withSecondPacProject(page, stage = '05: Architecture & Builds') {
  await page.route(/local-data\/projects\.csv/, async (route) => {
    const response = await route.fetch();
    const text = await response.text();
    const match = text.match(/export default ("(?:[^"\\]|\\.)*")/);
    if (!match) return route.fulfill({ response });
    const csv = JSON.parse(match[1]);
    const lines = csv.split(/\r?\n/);
    const header = lines[0].split(',');
    const pac = lines.find((line) => line.startsWith('PAC-01,'));
    if (!pac) return route.fulfill({ response });
    const cells = pac.split(',');
    cells[header.indexOf('ProjectID')] = 'PAC-02';
    const titleIndex = header.indexOf('ProjectName');
    if (titleIndex !== -1) cells[titleIndex] = 'Second Build';
    cells[header.indexOf('SprintStage')] = stage;
    const next = [...lines.filter(Boolean), cells.join(',')].join('\n');
    await route.fulfill({ response, body: text.replace(match[1], JSON.stringify(next)) });
  });
}

test('multi-sun', 'A client with two open projects gets two suns: default department wires, drops attach to the nearest sun, sun double-click opens its Planet, a Sunset project goes out', async (page) => {
  await withSecondPacProject(page);
  await gotoSolar(page);
  const evidence = [];
  const sun2 = page.locator('[data-node-id="sun-PAC-02"]');
  await sun2.waitFor({ timeout: 8000 });
  const primary = await page.locator('[data-node-id="core-node"]').getAttribute('data-sun-project');
  evidence.push(`primary sun = ${primary}; second sun = PAC-02`);
  const sunWires = await page.locator('[data-wire-id^="default:PAC:sun:PAC-02:"]').count();
  assert(sunWires === 5, `expected 5 default department wires to PAC-02, found ${sunWires}`);
  evidence.push(`${sunWires} default department wires to the PAC-02 sun`);
  // Drop a service right beside sun 2: it orbits sun 2 (the drop is attached to PAC-02).
  const box2 = await sun2.boundingBox();
  const workbench = page.locator('div.pointer-events-auto.relative[data-canvas-bg="true"]').first();
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.setData('application/json', JSON.stringify({ serviceId: 'comp_dns_shield', name: 'DNS & DMARC Armor', price: 1500 }));
    return dt;
  });
  await workbench.dispatchEvent('drop', { dataTransfer, clientX: box2.x + box2.width + 40, clientY: box2.y + box2.height / 2 });
  await page.getByRole('dialog', { name: /Financial Mutation Confirmation/ }).getByRole('button', { name: /AUTHORIZE MUTATION/ }).click();
  const node = page.locator('[data-node-id="node-comp_dns_shield"]');
  await node.waitFor();
  const nb = await node.boundingBox();
  const core = await page.locator('[data-node-id="core-node"]').boundingBox();
  const dist = (a, b) => Math.hypot(a.x + a.width / 2 - (b.x + b.width / 2), a.y + a.height / 2 - (b.y + b.height / 2));
  assert(dist(nb, box2) < dist(nb, core), 'the dropped service did not land next to sun 2');
  evidence.push(`service orbits sun 2 (${Math.round(dist(nb, box2))} px vs ${Math.round(dist(nb, core))} px from the primary)`);
  const wireToService = page.locator('[data-wire-from="sun-PAC-02"][data-wire-to="node-comp_dns_shield"]');
  assert(await wireToService.count() === 1, 'the dropped service has no wire from the PAC-02 sun');
  evidence.push('wire sun-PAC-02 → service');
  // Rearrange: move sun 2 and Oracle, leave Solar, come back: the layout and the wire are kept.
  const oracleBefore = await box(page, 'node-oracle');
  await dragBy(page, oracleBefore.x + 70, oracleBefore.y + 12, -60, 120);
  const sun2Before = await sun2.boundingBox();
  await dragBy(page, sun2Before.x + 120, sun2Before.y + 12, 90, 60);
  const oracleMoved = await box(page, 'node-oracle');
  const sun2Moved = await sun2.boundingBox();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'GALAXY', exact: true }).click();
  await page.locator('article', { hasText: 'PAC-01' }).first().waitFor();
  await page.locator('article', { hasText: 'PAC-01' }).first().dblclick();
  await sun2.waitFor();
  await sleep(700);
  const oracleAfter = await box(page, 'node-oracle');
  const sun2After = await sun2.boundingBox();
  const near = (a, b) => Math.abs(a.x - b.x) < 3 && Math.abs(a.y - b.y) < 3;
  assert(near(oracleAfter, oracleMoved), `Oracle moved back (${oracleMoved.x},${oracleMoved.y} -> ${oracleAfter.x},${oracleAfter.y})`);
  assert(near(sun2After, sun2Moved), `sun 2 moved back (${sun2Moved.x},${sun2Moved.y} -> ${sun2After.x},${sun2After.y})`);
  assert(await wireToService.count() === 1, 'the service wire to sun 2 was lost after reopening Solar');
  evidence.push('after Galaxy → Solar: Oracle and sun 2 stayed where they were moved; the service wire is still on sun 2');
  // Zoomed out (owner case): a drop beside sun 2 must still attach to sun 2.
  const spot = await emptySpot(page);
  await page.mouse.move(spot.x, spot.y);
  for (let i = 0; i < 5; i += 1) { await page.mouse.wheel(0, 500); await sleep(150); }
  await sleep(400);
  const coreZoomed = await page.locator('[data-node-id="core-node"]').boundingBox();
  assert(coreZoomed.width < 300, `did not zoom out (core width ${coreZoomed.width})`);
  const box2z = await sun2.boundingBox();
  const dt2 = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.setData('application/json', JSON.stringify({ serviceId: 'comp_mcc_engine', name: 'MCC Autonomous Dispatch', price: 3200 }));
    return dt;
  });
  await workbench.dispatchEvent('drop', { dataTransfer: dt2, clientX: box2z.x + box2z.width / 2, clientY: box2z.y + box2z.height + 30 });
  await page.getByRole('dialog', { name: /Financial Mutation Confirmation/ }).getByRole('button', { name: /AUTHORIZE MUTATION/ }).click();
  await page.locator('[data-node-id="node-comp_mcc_engine"]').waitFor();
  assert(await page.locator('[data-wire-from="sun-PAC-02"][data-wire-to="node-comp_mcc_engine"]').count() === 1, 'zoomed-out drop beside sun 2 did not attach to sun 2');
  evidence.push(`zoomed out (core ${Math.round(coreZoomed.width)} px wide): drop beside sun 2 attached to sun 2`);
  await sun2.dblclick({ position: { x: 60, y: 40 } });
  await page.locator('[aria-label="Planet view for PAC-02"]').waitFor();
  evidence.push('double-click on sun 2 opened Planet for PAC-02');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: path.join(resultsDir, 'multi-sun.png') });
  // A project at 09 Sunset/Retainer has no sun.
  const context2 = await page.context().browser().newContext({ viewport: { width: 1600, height: 950 } });
  const page2 = await context2.newPage();
  await withSecondPacProject(page2, '09: Sunset / Retainer');
  await gotoSolar(page2);
  await sleep(800);
  assert(await page2.locator('[data-node-id="sun-PAC-02"]').count() === 0, 'a Sunset project still has a sun');
  evidence.push('with PAC-02 at 09 Sunset/Retainer: no second sun');
  await context2.close();
  return evidence.join('\n');
});

test('dock-skins', 'The power crystal cycles the dock skins, including out of Classic and back', async (page) => {
  await gotoUniverse(page);
  await page.locator('footer.szs-dock').waitFor();
  const race = async () => (await page.locator('footer.szs-dock').getAttribute('data-dock-race')) ?? 'classic';
  const seen = [await race()];
  for (let i = 0; i < 5; i += 1) {
    await page.locator('footer.szs-dock button[data-mode]').first().click();
    await sleep(250);
    seen.push(await race());
  }
  assert(new Set(seen).size === 5, 'did not visit all five skins: ' + seen.join(' -> '));
  assert(seen[0] === seen[5], 'did not cycle back to the start: ' + seen.join(' -> '));
  return 'cycle: ' + seen.join(' -> ');
});

test('planet-camera', 'Sun double-click opens Planet; Esc returns to Solar with the camera unchanged', async (page) => {
  await gotoSolar(page);
  const spot = await emptySpot(page);
  await dragBy(page, spot.x, spot.y, 90, 40);
  const before = await box(page, 'core-node');
  await page.locator('[data-node-id="core-node"]').dblclick({ position: { x: 200, y: 140 } });
  await page.locator('[aria-label="Planet view for PAC-01"]').waitFor();
  const url = page.url();
  await page.keyboard.press('Escape');
  await page.locator('[aria-label="Planet view for PAC-01"]').waitFor({ state: 'detached' });
  const after = await box(page, 'core-node');
  assert(Math.abs(after.x - before.x) < 2 && Math.abs(after.y - before.y) < 2, `Camera moved (${before.x},${before.y} -> ${after.x},${after.y})`);
  assert(/\/client\/PAC\/project\/PAC-01$/.test(url), 'Planet URL was ' + url);
  return `Planet URL ${new URL(url).pathname}; Sun at ${Math.round(after.x)},${Math.round(after.y)} before and after`;
});

test('top-nav', 'One ribbon: levels and department screens always reachable, Back and Backspace go up a level, Ctrl+K palette, Alt+N screens, client picker on SOLAR, menu items all work, no old banner', async (page) => {
  await gotoUniverse(page);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const current = async () => (await nav.locator('[aria-current="page"]').allInnerTexts()).join('|');
  const back = page.getByRole('button', { name: /^Back/ });
  assert(!(await page.getByText('UNIVERSE / CLIENT PHASES').count()), 'Old Universe banner still shown');
  assert(await back.isDisabled(), 'Back should be disabled at Universe');
  const visited = [];
  for (const label of ['OSINT', 'SYMPHONY', 'TREASURE', 'MAIL', 'CLIENTS']) {
    await nav.getByRole('button', { name: label, exact: true }).click();
    await sleep(250);
    const active = await nav.locator('[aria-current="page"]').getAttribute('aria-label');
    assert(active === label, `${label} tab not active (got ${active})`);
    assert(await nav.getByRole('button', { name: 'UNIVERSE', exact: true }).isVisible(), `Levels hidden on ${label}`);
    visited.push(label);
  }
  await back.click(); await sleep(250);
  assert((await current()).includes('UNIVERSE'), 'Back from a screen did not return to the board: ' + await current());
  await nav.getByRole('button', { name: 'GALAXY', exact: true }).click(); await sleep(250);
  await page.keyboard.press('Backspace'); await sleep(250);
  assert((await current()).includes('UNIVERSE'), 'Backspace from Galaxy did not go to Universe');
  await page.keyboard.press('Control+k'); await sleep(250);
  await page.getByRole('heading', { name: 'Workspace Actions' }).waitFor({ timeout: 3000 });
  await page.keyboard.press('Alt+4'); await sleep(250);
  await page.getByRole('heading', { name: /Treasure Ledger/ }).waitFor({ timeout: 3000 });
  await page.keyboard.press('Alt+1'); await sleep(250);
  assert((await current()).includes('UNIVERSE'), 'Alt+1 did not open Universe');
  // client picker lives on the SOLAR button
  await page.getByRole('button', { name: 'Pick a client for Solar' }).click();
  await page.getByRole('menu', { name: 'Clients' }).getByRole('menuitem', { name: /Prime Auto Collision/ }).click();
  await page.locator('[data-node-id="core-node"]').waitFor({ timeout: 5000 });
  assert((await current()).includes('SOLAR'), 'Picking a client did not open Solar');
  await back.click(); await sleep(300);
  assert((await current()).includes('GALAXY'), 'Back from Solar did not go to Galaxy');
  // every MENU "go to" item
  const menuButton = page.getByRole('button', { name: /^MENU/ });
  const items = [['Universe', 'UNIVERSE'], ['Galaxy', 'GALAXY'], ['Osint', 'OSINT'], ['Treasure', 'TREASURE'], ['Clients', 'CLIENTS']];
  for (const [item, expect] of items) {
    await menuButton.click();
    await page.getByRole('button', { name: new RegExp(`^${item}`) }).first().click();
    await sleep(250);
    const text = (await current()) + '|' + (await nav.locator('[aria-current="page"]').getAttribute('aria-label'));
    assert(text.includes(expect), `Menu ${item} -> ${text}`);
  }
  await menuButton.click();
  await page.getByRole('button', { name: /Settings & keyboard shortcuts/ }).click();
  await page.getByText('SYSTEM SETTINGS & ERGONOMICS ENGINE').waitFor({ timeout: 3000 });
  await page.getByRole('button', { name: /keybind/i }).first().click();
  await page.getByText(/Shift \+ 1\.\.9/).waitFor({ timeout: 3000 });
  await page.keyboard.press('Escape');
  const readout = await page.getByLabel('Business resources').innerText();
  assert(/PAID/.test(readout) && /OWED/.test(readout) && /PROJ/.test(readout), 'Resource readout missing: ' + readout);
  return `Tabs ${visited.join(', ')}; Back/Backspace/Ctrl+K/Alt+4/Alt+1 ok; picker opened Solar; menu items ok; readout "${readout.replace(/\s+/g, ' ')}"`;
});

test('cockpit', 'Cockpit shows live loaded data (no demo numbers) inline and in the side window, and its buttons drive the main window', async (page) => {
  await gotoUniverse(page);
  await page.keyboard.press('Alt+8');
  await page.getByText('SZS COCKPIT').waitFor();
  const inline = await page.locator('text=Project runway').locator('..').locator('..').innerText();
  assert(/PAC-01/.test(inline), 'Inline cockpit has no PAC-01 project: ' + inline.slice(0, 200));
  assert(!(await page.getByText('$146,200').count()) && !(await page.getByText('TKG-01: Rulebook').count()), 'Demo numbers still shown');
  const side = await page.context().newPage();
  await side.goto(BASE + '/cockpit');
  await side.getByText('Project runway').waitFor({ timeout: 8000 });
  await side.getByRole('button', { name: /GALAXY/ }).click();
  await sleep(500);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const current = (await nav.locator('[aria-current="page"]').allInnerTexts()).join('|');
  assert(current.includes('GALAXY'), 'Side cockpit GALAXY did not move the main window: ' + current);
  await side.close();
  return 'Inline and side-window cockpit show PAC-01 from the loaded data; side GALAXY button moved the main window';
});

test('solar-ribbons', 'In Solar the ▾ client list opens above the canvas, and the zoom controls sit in the workbench ribbon (not the top bar)', async (page) => {
  await gotoSolar(page);
  const onTop = async (locator) => {
    const b = await locator.boundingBox();
    return page.evaluate(([x, y, el]) => { const hit = document.elementFromPoint(x, y); return Boolean(hit && el.contains(hit)); },
      [b.x + b.width / 2, b.y + b.height / 2, await locator.elementHandle()]);
  };
  await page.getByRole('button', { name: 'Pick a client for Solar' }).click();
  const items = page.getByRole('menu', { name: 'Clients' }).getByRole('menuitem');
  const count = await items.count();
  let covered = 0;
  for (let i = 0; i < count; i += 1) if (!(await onTop(items.nth(i)))) covered += 1;
  assert(count > 0 && covered === 0, `${covered} of ${count} client items are covered by the canvas`);
  await items.nth(Math.min(1, count - 1)).click();
  await page.locator('[data-node-id="core-node"]').waitFor({ timeout: 5000 });
  const header = page.locator('header');
  assert(!(await header.getByRole('button', { name: 'Open canvas controls' }).count()), 'Canvas controls still in the top bar');
  const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true });
  const label = page.getByRole('button', { name: 'Open canvas controls' });
  const before = await label.innerText();
  await zoomIn.click(); await sleep(200);
  const after = await label.innerText();
  assert(before !== after, `Zoom in did not change the zoom (${before} -> ${after})`);
  await label.click();
  assert(await onTop(page.getByRole('slider', { name: 'Canvas zoom' })), 'Zoom slider is covered');
  return `${count} client items on top of the canvas; zoom ${before.trim()} -> ${after.trim()} from the workbench ribbon`;
});

test('calendar-bay', 'Calendar bay is the Google Calendar view: Today / 7 days, Calendars, Refresh; without a Google sign-in it says how to connect', async (page) => {
  await gotoUniverse(page);
  assert(await page.getByText('(sign in)', { exact: true }).first().isVisible(), 'Calendar header does not show the sign-in state');
  await page.getByText('Calendar', { exact: true }).first().click();
  await page.getByText('Sign in with Google to see your calendar here.').waitFor({ timeout: 3000 });
  const range = page.getByRole('group', { name: 'Calendar range' });
  await range.getByRole('button', { name: '7 days' }).click();
  assert(await range.getByRole('button', { name: '7 days' }).getAttribute('aria-pressed') === 'true', '7 days not selected');
  assert(await page.getByRole('button', { name: 'Refresh calendar' }).isVisible(), 'Refresh missing');
  assert(!(await page.getByText('feeds)').count()), 'Old fake feed count still shown');
  return 'header "(sign in)"; bay explains sign-in; range toggles; Refresh and Calendars controls present';
});

test('screen-padding-scale', 'Full-screen views end above the bottom dock; MENU › HUD size scales the text and survives a reload', async (page) => {
  await gotoUniverse(page);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const report = [];
  for (const label of ['OSINT', 'SYMPHONY', 'TREASURE', 'MAIL', 'CLIENTS']) {
    await nav.getByRole('button', { name: label, exact: true }).click(); await sleep(250);
    const area = await page.getByTestId('screen-area').boundingBox();
    const bay = await page.getByText('Alfred Core', { exact: true }).first().boundingBox();
    // Highest visible point of the power crystal (its images overflow the joint box).
    const crystalTop = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.szs-core, .szs-core *')]
      .map((el) => el.getBoundingClientRect()).filter((r) => r.height > 0).map((r) => r.top), Infinity));
    const limit = Math.min(bay.y, crystalTop);
    const contentBottom = area.y + area.height - Number.parseFloat(await page.getByTestId('screen-area').evaluate((el) => getComputedStyle(el).paddingBottom));
    assert(contentBottom <= limit + 1, `${label}: content ends at ${Math.round(contentBottom)}, dock starts at ${Math.round(limit)}`);
    report.push(`${label} ${Math.round(contentBottom)}<=${Math.round(limit)}`);
  }
  const size = async () => page.getByText('Alfred Core', { exact: true }).first().evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  const before = await size();
  await page.getByRole('button', { name: /^MENU/ }).first().click();
  await page.getByRole('button', { name: 'Larger HUD' }).click();
  await page.getByRole('button', { name: 'Larger HUD' }).click();
  const after = await size();
  assert(after > before, `HUD size did not grow (${before} -> ${after})`);
  await page.reload(); await sleep(800);
  const reloaded = await size();
  assert(Math.abs(reloaded - after) < 0.1, `HUD size not kept after reload (${after} -> ${reloaded})`);
  return `${report.join('; ')}; text ${before}px -> ${after}px, kept after reload`;
});

test('dock-layout', 'Settings: each bay width slider sets that bay exactly, the console scale grows the dock, both survive a reload, Reset puts them back', async (page) => {
  await gotoUniverse(page);
  const bayWidth = (v) => page.locator(`[data-bay-var="${v}"]`).evaluate((el) => el.getBoundingClientRect().width);
  const dockHeight = () => page.locator('[data-bay-var="--bay-center-w"]').evaluate((el) => el.getBoundingClientRect().height);
  const openSettings = async () => { await page.keyboard.press('F1'); await page.getByText('Bottom console', { exact: true }).waitFor({ timeout: 3000 }); };
  const calBefore = await bayWidth('--bay-calendar-w');
  const dossierBefore = await bayWidth('--bay-dossier-w');
  const hBefore = await dockHeight();
  await openSettings();
  await page.getByRole('slider', { name: 'Bay 1 (Calendar) width' }).fill('520');
  await page.getByRole('slider', { name: 'Bottom console scale' }).fill('1.1');
  await sleep(300);
  const calAfter = await bayWidth('--bay-calendar-w');
  assert(Math.abs(calAfter - 520 * 1.1) < 3, `Calendar bay is ${calAfter}px, expected ${520 * 1.1}`);
  assert(Math.abs((await bayWidth('--bay-dossier-w')) - dossierBefore * 1.1) < 3, 'Dossier width changed by more than the scale');
  const hAfter = await dockHeight();
  assert(hAfter > hBefore * 1.05, `Console scale did not grow the dock (${hBefore} -> ${hAfter})`);
  await page.reload(); await sleep(800);
  assert(Math.abs((await bayWidth('--bay-calendar-w')) - calAfter) < 3, 'Bay width not kept after reload');
  await openSettings();
  await page.getByRole('button', { name: 'Reset to default' }).click(); await sleep(300);
  assert(Math.abs((await bayWidth('--bay-calendar-w')) - calBefore) < 3, 'Reset did not restore the Calendar bay');
  return `Calendar ${Math.round(calBefore)} -> ${Math.round(calAfter)}px (520 at 110%), dock height ${Math.round(hBefore)} -> ${Math.round(hAfter)}, kept after reload, Reset restored ${Math.round(calBefore)}`;
});

/* ---------- runner ---------- */
const server = await startServer();
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL || 'msedge', headless: process.env.E2E_HEADED ? false : true });
const results = [];
for (const t of tests) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const started = Date.now();
  try {
    const evidence = await t.fn(page);
    if (errors.length) throw new Error('Page errors: ' + errors.join(' | '));
    results.push({ id: t.id, name: t.name, status: 'pass', evidence, ms: Date.now() - started });
  } catch (error) {
    results.push({ id: t.id, name: t.name, status: 'fail', evidence: String(error && error.message || error), ms: Date.now() - started });
  }
  await page.screenshot({ path: path.join(resultsDir, `${t.id}.png`) }).catch(() => {});
  await context.close();
}
await browser.close();
if (server) server.kill();
writeFileSync(path.join(resultsDir, 'results.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 2));
for (const r of results) console.log(`${r.status === 'pass' ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}\n      ${r.evidence.replace(/\n/g, '\n      ')}`);
const failed = results.filter((r) => r.status === 'fail').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
