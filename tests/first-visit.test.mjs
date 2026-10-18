import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_KEY, FIRST_VISIT_KEY, ENABLE_FIRST_VISIT_IN_PRODUCTION, isFreshProfile, markFirstVisit } from '../src/firstVisit.ts';

function storage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('first visit requires no collection and no seen flag; any saved data suppresses it', () => {
  assert.equal(isFreshProfile(storage()), true);
  for (const value of ['', '{}', 'corrupt', '{"version":1}']) {
    assert.equal(isFreshProfile(storage({ [COLLECTION_KEY]: value })), false);
    assert.equal(isFreshProfile(storage({ [FIRST_VISIT_KEY]: value })), false);
  }
  assert.equal(ENABLE_FIRST_VISIT_IN_PRODUCTION, true);
});

test('claim is persistent and fails closed for blocked, full or silently unwritable storage', () => {
  const saved = storage();
  assert.equal(markFirstVisit(saved), true);
  assert.equal(isFreshProfile(saved), false);
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(isFreshProfile(blocked), false);
  assert.equal(markFirstVisit(blocked), false);
  assert.equal(markFirstVisit({ getItem: () => null, setItem() {} }), false);
  assert.equal(markFirstVisit({ getItem: () => null, setItem() { throw Error('quota'); } }), false);
});
