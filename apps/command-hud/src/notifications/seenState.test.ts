import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSeenNotificationIds, persistSeenNotificationIds } from './seenState';

test('notification acknowledgements persist as local seen-state only', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });

  try {
    assert.equal(persistSeenNotificationIds(['alert-a', 'alert-a']), null);
    assert.deepEqual(loadSeenNotificationIds(), { ids: ['alert-a'] });
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
