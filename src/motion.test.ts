import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rememberPosition, renderX, renderY, setRenderBlend, shotHits } from './motion.ts';

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
