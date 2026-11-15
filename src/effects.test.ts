import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearParticles, getShakeOffset, particleCount, spawnBombExplosion, spawnExplosion,
  triggerShake, updateParticles, updateShake,
} from './effects.ts';
import { seedRandom } from './rng.ts';

beforeEach(() => {
  seedRandom(2);
  clearParticles();
});

test('an explosion is eight sparks and a flash, and all of it fades away', () => {
  spawnExplosion(100, 100, '#0f0');
  assert.equal(particleCount(), 9);
  for (let i = 0; i < 30; i++) updateParticles();
  assert.equal(particleCount(), 9, 'still fading');
  for (let i = 0; i < 15; i++) updateParticles();
  assert.equal(particleCount(), 0);
});

test('a mine blast throws far more debris than an ordinary kill', () => {
  spawnBombExplosion(100, 100);
  assert.equal(particleCount(), 71);
});

test('particles are capped so stacked blasts cannot grow the list without bound', () => {
  for (let i = 0; i < 30; i++) spawnBombExplosion(100, 100);
  assert.ok(particleCount() > 700);
  updateParticles();
  assert.equal(particleCount(), 700);
});

test('screen shake decays to rest and stays there', () => {
  triggerShake(10);
  let moved = 0;
  let previous = Infinity;
  for (let i = 0; i < 10; i++) {
    updateShake();
    const { x, y } = getShakeOffset();
    if (x !== 0 || y !== 0) moved++;
    assert.ok(Math.abs(x) <= 7 && Math.abs(y) <= 7, 'never more than half the 14px range');
    // The envelope shrinks every tick, whatever the random direction.
    const limit = 7 * (10 - i) / 10;
    assert.ok(Math.abs(x) <= limit && Math.abs(y) <= limit && limit < previous);
    previous = limit;
  }
  assert.equal(moved, 10);
  updateShake();
  assert.deepEqual(getShakeOffset(), { x: 0, y: 0 });
});
