import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createLinkState,
  createProjectConnector,
  exportLinkState,
  loadLinkState,
  parseLinkState,
  parseLinkExport,
  saveProjectConnectors,
  saveLinkState,
} from './links';

test('wire exports round-trip and reject unknown nodes', () => {
  const state = createLinkState('test-client');
  const validNodeIds = new Set([
    'node-pamela',
    'node-oracle',
    'node-dolores',
    'node-vala',
    'node-daisy',
    'core-node',
  ]);
  const encoded = JSON.stringify(exportLinkState(state));

  assert.deepEqual(parseLinkExport(encoded, state.clientId, validNodeIds), state);
  const daisyRoutes = state.links
    .filter((link) => link.toNodeId === 'node-daisy' && link.kind === 'trigger')
    .map((link) => link.fromNodeId);
  for (const source of ['node-pamela', 'node-oracle', 'node-dolores', 'node-vala', 'core-node']) {
    assert.equal(daisyRoutes.includes(source), true);
  }
  assert.throws(
    () => parseLinkExport(encoded, state.clientId, new Set(['core-node'])),
    /node that is not available/,
  );
});

test('wire state persists deleted default links as suppressed', () => {
  const state = createLinkState('persisted-test-client');
  const key = 'pamela-sun';
  const withoutPamela = {
    ...state,
    links: state.links.filter((link) => link.defaultKey !== key),
    suppressedDefaults: [key],
  };
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (storageKey: string) => values.get(storageKey) ?? null,
      setItem: (storageKey: string, value: string) => values.set(storageKey, value),
    },
  });

  test('version one wire state migrates while retaining deletions and seeded handoffs', () => {
    const state = createLinkState('migration-client');
    const legacyState = {
      version: 1,
      clientId: state.clientId,
      links: state.links.filter((link) => link.defaultKey !== 'pamela-sun'),
      suppressedDefaults: ['pamela-sun'],
    };
    const migrated = parseLinkState(JSON.stringify(legacyState), state.clientId);

    assert.equal(migrated.version, 2);
    assert.equal(migrated.connectors.length, 0);
    assert.equal(migrated.links.some((link) => link.defaultKey === 'pamela-sun'), false);
    assert.equal(migrated.links.some((link) => link.defaultKey === 'pamela-alfred'), true);
  });

  test('project connectors persist locally and round-trip with their owning client', () => {
    const state = createLinkState('connector-client');
    const connector = createProjectConnector({
      clientId: state.clientId,
      fromProjectId: 'project-a',
      toProjectId: 'project-b',
      kind: 'spawns',
    });
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (storageKey: string) => values.get(storageKey) ?? null,
        setItem: (storageKey: string, value: string) => values.set(storageKey, value),
      },
    });
    try {
      const next = saveProjectConnectors(state, [connector]);
      assert.deepEqual(loadLinkState(state.clientId), next);
      assert.throws(
        () => saveProjectConnectors(state, [connector, connector]),
        /contains duplicates/,
      );
      assert.throws(
        () => createProjectConnector({
          clientId: state.clientId,
          fromProjectId: 'project-a',
          toProjectId: 'project-a',
          kind: 'spawns',
        }),
        /distinct project IDs/,
      );
    } finally {
      if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  try {
    saveLinkState(withoutPamela);
    assert.deepEqual(loadLinkState(withoutPamela.clientId), withoutPamela);
    assert.deepEqual(loadLinkState('unpersisted-test-client'), createLinkState('unpersisted-test-client'));
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
