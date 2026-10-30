import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { RETIRED_KEYS, clearRetiredKeys } from '../src/retiredKeys.ts';
import { COLLECTION_KEY, FIRST_VISIT_KEY } from '../src/firstVisit.ts';
import { KEPT_KEY, RECENT_KEY } from '../src/shelves.ts';

function storage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return { values, removeItem: key => values.delete(key) };
}

test('retired prototype keys are cleared and current saves are left alone', () => {
  const current = { [COLLECTION_KEY]: '{"version":1}', [FIRST_VISIT_KEY]: '1', [KEPT_KEY]: '[]', [RECENT_KEY]: '[]', 'deckshelf.shelf-bar-hidden': 'true' };
  const saved = storage({ ...current, ...Object.fromEntries(RETIRED_KEYS.map(key => [key, 'old'])) });
  clearRetiredKeys(saved);
  assert.deepEqual(Object.fromEntries(saved.values), current);
  clearRetiredKeys(saved);
  assert.deepEqual(Object.fromEntries(saved.values), current);
});

test('blocked storage does not stop the app from starting', () => {
  assert.doesNotThrow(() => clearRetiredKeys({ removeItem() { throw Error('blocked'); } }));
});

test('no current source file reads a retired key', () => {
  const dir = new URL('../src/', import.meta.url);
  const files = readdirSync(dir, { recursive: true }).filter(file => /\.(tsx?|js)$/.test(file) && !file.endsWith('retiredKeys.ts'));
  for (const file of files) {
    const source = readFileSync(new URL(file.replaceAll('\\', '/'), dir), 'utf8');
    for (const key of RETIRED_KEYS) assert.equal(source.includes(key), false, `${file} uses ${key}`);
  }
});
