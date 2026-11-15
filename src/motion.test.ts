import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rememberPosition, renderX, renderY, setRenderBlend, shotHits } from './motion.ts';
import { mulberry32 } from './rng.ts';

test('rendering fills intermediate refreshes without changing simulation positions', () => {
  const p = { x: 10, y: 20 };
  rememberPosition(p);
  p.x = 20; p.y = 40;
  setRenderBlend(0.25);
  assert.equal(renderX(p), 12.5);
  assert.equal(renderY(p), 25);
  setRenderBlend(0.75);
  assert.equal(renderX(p), 17.5);
  assert.deepEqual(p, { x: 20, y: 40 });
});
test('newly spawned objects render at their spawn position', () => {
  setRenderBlend(0);
  assert.equal(renderX({ x: 42, y: 0 }), 42);
});
test('fast shots hit targets crossed between updates', () => {
  const shot = { x: 0, y: 10 };
  rememberPosition(shot); shot.x = 100;
  assert.equal(shotHits(shot, { x: 50, y: 10 }, 8, 8), true);
  assert.equal(shotHits(shot, { x: 50, y: 30 }, 8, 8), false);
  assert.equal(shotHits(shot, { x: -50, y: 10 }, 8, 8), false);
});
test('collision accounts for a target moving across the shot path', () => {
  const shot = { x: 0, y: 0 }, target = { x: 30, y: 0 };
  rememberPosition(shot); rememberPosition(target);
  shot.x = 20; target.x = 10;
  assert.equal(shotHits(shot, target, 2, 2), true);
});

// The plain statement of the swept test, kept here as the reference the
// allocation-free version in motion.ts has to agree with.
function sweptReference(from: {x:number;y:number}, to: {x:number;y:number}, targetFrom: {x:number;y:number}, targetTo: {x:number;y:number}, halfWidth: number, halfHeight: number) {
  const x = from.x - targetFrom.x, y = from.y - targetFrom.y;
  const dx = to.x - targetTo.x - x, dy = to.y - targetTo.y - y;
  let enter = 0, leave = 1;
  for (const [start, delta, extent] of [[x, dx, halfWidth], [y, dy, halfHeight]]) {
    if (delta === 0) { if (Math.abs(start) > extent) return false; continue; }
    const t1 = (-extent - start) / delta, t2 = (extent - start) / delta;
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
    if (enter > leave) return false;
  }
  return true;
}
test('the swept test agrees with its reference across random and axis-aligned motion', () => {
  const random = mulberry32(99);
  // Coarse coordinates make exact zero deltas and edge-touching cases common.
  const coord = () => Math.round(random() * 40) * 5;
  let hits = 0;
  for (let i = 0; i < 20000; i++) {
    const from = { x: coord(), y: coord() }, targetFrom = { x: coord(), y: coord() };
    const shot = { ...from }, target = { ...targetFrom };
    rememberPosition(shot); rememberPosition(target);
    if (random() < 0.7) shot.x = coord();
    if (random() < 0.7) shot.y = coord();
    if (random() < 0.5) target.x = coord();
    if (random() < 0.5) target.y = coord();
    const halfWidth = 5 + Math.round(random() * 6) * 5, halfHeight = 5 + Math.round(random() * 6) * 5;
    const expected = sweptReference(from, shot, targetFrom, target, halfWidth, halfHeight);
    assert.equal(shotHits(shot, target, halfWidth, halfHeight), expected, `case ${i}`);
    if (expected) hits++;
  }
  assert.ok(hits > 2000 && hits < 18000, `expected a real mix of hits and misses, got ${hits}`);
});
