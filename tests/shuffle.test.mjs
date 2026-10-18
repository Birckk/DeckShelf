import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShuffleDeal } from '../src/shuffle.ts';
import { drawDistinct } from '../src/domain.ts';

const decks = ['a', 'b', 'c'].map(id => ({ id }));
const fillFrom = values => a => { a[0] = values.shift(); return a; };

test('shuffle snapshots the eligible pool and makes the identical fair draw as the helix', () => {
  // Every possible ordered pair for a three-deck pool occurs exactly once.
  const results = new Set();
  for (let first = 0; first < 3; first++) for (let second = 0; second < 2; second++) {
    const pool = decks.slice();
    const run = createShuffleDeal(pool, 2, fillFrom([first, second]));
    assert.deepEqual(run.picks, drawDistinct(pool, 2, fillFrom([first, second])));
    assert.equal(new Set(run.picks).size, 2);
    results.add(run.picks.map(d => d.id).join(','));
    pool.reverse();
    assert.deepEqual(run.gathered, decks);
  }
  assert.equal(results.size, 6);
  const filtered = decks.slice(1);
  assert.deepEqual(createShuffleDeal(filtered, 4, fillFrom([0, 0])).picks, filtered);
  assert.deepEqual(createShuffleDeal([], 4).picks, []);
});

