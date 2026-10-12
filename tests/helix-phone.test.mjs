import { test } from 'node:test';
import assert from 'node:assert/strict';
import { helixPose, dragTravel, landing, repeatDecks } from '../src/helix.ts';

test('phone helix spreads horizontally without making larger pools denser', () => {
  for (const width of [286, 349]) {
    const height = 590;
    const desktopGap = helixPose(2, 42, 0.35, 0, 980, height).y - helixPose(0, 42, 0.35, 0, 980, height).y;
    let referenceGap;
    for (const count of [1, 2, 7, 184]) {
      const slots = repeatDecks(Array.from({ length: count }, (_, i) => i)).length;
      const first = helixPose(0, slots, 0.35, 0, width, height);
      const next = helixPose(2, slots, 0.35, 0, width, height);
      const gap = next.y - first.y;
      assert.ok(gap > desktopGap && gap < desktopGap * 1.12, 'phone vertical separation stays restrained');
      const side = helixPose(0, slots, 0.125, 0, width, height);
      assert.ok(side.x > width * 0.40, 'phone orbit uses more horizontal spread');
      referenceGap ??= gap;
      assert.ok(Math.abs(gap - referenceGap) < 1e-9, 'pool size must not compress rows');
      const front = helixPose(0, slots, 0.5, 0, width, height);
      assert.ok(front.z < 105, 'avoid desktop perspective magnification on narrow stages');
      for (let i = 0; i < slots; i++) {
        const end = landing(i, slots, 0.73, 0.1);
        const pose = helixPose(i, slots, end.travel, end.turn, width, height);
        assert.ok(Math.abs(pose.x) < 1e-8 && Math.abs(pose.y) < 1e-8 && pose.depth > 0.9999);
      }
    }
  }
});

test('phone vertical drag retains direct pixel tracking and reversibility', () => {
  for (const width of [286, 349, 700, 1367]) {
    for (const dy of [-80, 80]) {
      const movement = dragTravel(0, dy, 590, width);
      const before = helixPose(0, 42, 0.35, 0.3, width, 590);
      const after = helixPose(0, 42, 0.35 + movement, 0.3, width, 590);
      assert.ok(Math.abs(after.y - before.y - dy) < 1e-8);
      assert.ok(Math.abs(movement + dragTravel(0, -dy, 590, width)) < 1e-12);
    }
  }
});
