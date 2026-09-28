import { test } from "node:test";
import assert from "node:assert/strict";
import {
  helixPose,
  landing,
  flightEase,
  dragTravel,
  repeatDecks,
  TAU,
} from "../src/helix.ts";

test("horizontal and vertical drags follow the same centered screw path", () => {
  const height = 610;
  const vertical = dragTravel(0, 98, height);
  const horizontal = dragTravel((vertical * TAU * 2) / 0.009, 0, height);
  assert.ok(Math.abs(vertical - horizontal) < 1e-12);
  const before = helixPose(0, 24, 0.35, 0.3, 980, height);
  const after = helixPose(0, 24, 0.35 + vertical, 0.3, 980, height);
  assert.ok(Math.abs(after.y - before.y - 98) < 1e-9);
  assert.ok(
    Math.abs(after.x - before.x) > 10,
    "vertical dragging must also rotate",
  );
  assert.ok(
    Math.abs(after.z - before.z) > 10,
    "cards must move around the axis",
  );
});

test("reversing or cancelling a drag cannot leave a separate vertical offset", () => {
  for (const [dx, dy] of [
    [120, 0],
    [0, -180],
    [90, 65],
    [-200, 110],
  ]) {
    const forward = dragTravel(dx, dy, 610);
    const back = dragTravel(-dx, -dy, 610);
    assert.ok(Math.abs(forward + back) < 1e-12);
  }
  const dy = ((-100 * 0.009) / (TAU * 2)) * 980;
  assert.ok(Math.abs(dragTravel(100, dy, 610)) < 1e-12);
});
test("every card can land front-center regardless of existing motion", () => {
  for (const slots of [2, 15, 24, 29, 30, 42, 58, 84, 200])
    for (let index = 0; index < slots; index++)
      for (const [travel, turn] of [
        [0.17, 0.3],
        [17.2, -7.8],
        [-2.2, 24],
      ]) {
        const end = landing(index, slots, travel, turn),
          pose = helixPose(index, slots, end.travel, end.turn, 980, 610);
        assert.ok(Math.abs(pose.x) < 1e-8);
        assert.ok(Math.abs(pose.y) < 1e-8);
        assert.ok(pose.depth > 0.999999);
        assert.ok(end.travel - travel >= 2);
      }
});
test("cards wrap out of sight instead of visibly jumping", () => {
  for (const travel of [0, 0.00001, 0.99999, 1])
    assert.ok(helixPose(0, 30, travel, 0, 980, 610).opacity < 0.001);
});
test("flight accelerates and decelerates without reversing or overshooting", () => {
  assert.equal(flightEase(0), 0);
  assert.equal(flightEase(1), 1);
  let last = 0;
  for (let i = 0; i <= 100; i++) {
    const v = flightEase(i / 100);
    assert.ok(v >= last && v <= 1);
    last = v;
  }
  assert.ok(flightEase(0.01) < 0.001);
  assert.ok(1 - flightEase(0.99) < 0.001);
});

test("filtered pools stay populated throughout the spiral without adding ineligible decks", () => {
  assert.deepEqual(repeatDecks([]), []);
  for (const count of [1, 2, 3, 7, 10, 29, 40]) {
    const pool = Array.from({ length: count }, (_, id) => ({ id }));
    const items = repeatDecks(pool);
    assert.deepEqual([...new Set(items)], pool);
    assert.equal(
      pool.length,
      count,
      "visual repetition must not change the random-choice pool",
    );
    for (let step = 0; step < 40; step++) {
      const visible = items.filter((_, i) => {
        const pose = helixPose(i, items.length, step / 40, 0.3, 980, 610);
        return Math.abs(pose.y) < 305 && pose.opacity > 0.2;
      });
      assert.ok(
        visible.length >= 14,
        `${count} decks at step ${step} leaves the spiral sparse`,
      );
    }
  }
});

test("both visible strands cycle through every deck in order, including the wrap", () => {
  for (const count of [1, 2, 3, 4, 5, 10, 29]) {
    const pool = Array.from({ length: count }, (_, i) => i);
    const items = repeatDecks(pool);
    for (const strand of [0, 1]) {
      const sequence = items.filter((_, i) => i % 2 === strand);
      for (let i = 0; i < sequence.length; i++) {
        assert.equal(
          sequence[(i + 1) % sequence.length],
          (sequence[i] + 1) % count,
        );
      }
    }
  }
});

test("larger pools preserve the seven-deck spacing and number of on-screen cards", () => {
  const reference = repeatDecks(Array.from({ length: 7 }, (_, i) => i));
  for (const count of [1, 2, 3, 7, 8, 14, 22, 29, 50, 100]) {
    const items = repeatDecks(Array.from({ length: count }, (_, i) => i));
    const gap =
      helixPose(2, items.length, 0.35, 0.3, 980, 610).y -
      helixPose(0, items.length, 0.35, 0.3, 980, 610).y;
    const referenceGap =
      helixPose(2, reference.length, 0.35, 0.3, 980, 610).y -
      helixPose(0, reference.length, 0.35, 0.3, 980, 610).y;
    assert.ok(
      Math.abs(gap - referenceGap) < 1e-9,
      `${count} decks compress the rows`,
    );
    for (let step = 0; step < 60; step++) {
      const visible = items.filter((_, i) => {
        const p = helixPose(i, items.length, step / 17, 0.3, 980, 610);
        assert.ok(p.opacity >= 0 && p.opacity <= 1);
        return Math.abs(p.y) < 305 && p.opacity > 0.2;
      });
      assert.ok(
        visible.length >= 24 && visible.length <= 28,
        `${count} decks gives ${visible.length} visible cards`,
      );
    }
  }
});
test("long loops wrap fully faded while every deck can still enter the center", () => {
  const slots = repeatDecks(Array.from({ length: 29 }, (_, i) => i)).length;
  const period = slots / 2 / 21;
  const wrap = period - (period - 1) / 2;
  for (const travel of [wrap - 0.00001, wrap, wrap + 0.00001]) {
    const pose = helixPose(0, slots, travel, 0.3, 980, 610);
    assert.equal(pose.opacity, 0);
    assert.ok(Math.abs(pose.y) > 490);
  }
});

test("varied spin distances still land every eligible card at the center", () => {
  for (const count of [2, 7, 29]) {
    const slots=repeatDecks(Array.from({length:count},(_,i)=>i)).length;
    for (let i=0;i<slots;i++) for (const distance of [2,2.71,3.5]) {
      const end=landing(i,slots,0.63,2.17,distance);
      const p=helixPose(i,slots,end.travel,end.turn,980,610);
      assert.ok(Math.abs(p.x)<1e-8 && Math.abs(p.y)<1e-8 && p.depth>.99999);
      assert.ok(end.travel-.63 >= distance-1e-10);
    }
  }
});
