import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkPowerUpCollision, clearPowerUp, getPowerUp, tryDropPowerUp, updatePowerUp } from './powerup.ts';
import { seedRandom } from './rng.ts';
import { POWERUP_COOLDOWN, setCanvasSize, type Player } from './types.ts';

const HEIGHT = 720;
const player = { x: 300, y: 300, width: 112, height: 112 } as Player;

beforeEach(() => {
  setCanvasSize(1280, HEIGHT);
  seedRandom(4);
  clearPowerUp();
});

/** Kill tanks at one spot until a core falls out (they carry one ~35% of the time). */
function dropFromTanks(x = 800, y = 300, difficulty = 1) {
  for (let i = 0; i < 500 && !getPowerUp(); i++) tryDropPowerUp(x, y, difficulty, 'tank', null);
  return getPowerUp();
}

test('scouts and mines never leave a core behind', () => {
  for (let i = 0; i < 2000; i++) {
    tryDropPowerUp(800, 300, 5, 'scout', null);
    tryDropPowerUp(800, 300, 5, 'bomb', null);
  }
  assert.equal(getPowerUp(), null);
});

test('nothing drops before the first tier unlocks', () => {
  assert.equal(dropFromTanks(800, 300, 0), null);
});

test('a tank kill can leave a core where it died', () => {
  const core = dropFromTanks(800, 300);
  assert.ok(core);
  assert.deepEqual([core.x, core.y], [800, 300]);
});

test('a core dropped at the very edge is nudged back onto the field', () => {
  const core = dropFromTanks(800, 2);
  assert.ok(core && core.y >= core.size);
  clearPowerUp();
  const low = dropFromTanks(800, HEIGHT - 2);
  assert.ok(low && low.y <= HEIGHT - low.size);
});

test('only one core exists at a time', () => {
  const core = dropFromTanks(800, 300);
  for (let i = 0; i < 500; i++) tryDropPowerUp(100, 100, 5, 'tank', null);
  assert.equal(getPowerUp(), core);
});

test('collecting a core hands over its tier and clears the field', () => {
  const core = dropFromTanks(player.x, player.y);
  assert.ok(core);
  assert.equal(checkPowerUpCollision(player), core.tier);
  assert.equal(getPowerUp(), null);
  assert.equal(checkPowerUpCollision(player), null);
});

test('a core out of reach is not collected', () => {
  dropFromTanks(player.x + 200, player.y);
  assert.equal(checkPowerUpCollision(player), null);
  assert.ok(getPowerUp());
});

test('a second drop has to wait out the cooldown', () => {
  dropFromTanks(player.x, player.y);
  checkPowerUpCollision(player);
  for (let frame = 1; frame < POWERUP_COOLDOWN; frame++) updatePowerUp(frame);
  assert.equal(dropFromTanks(), null, 'one tick short of the cooldown');
  updatePowerUp(POWERUP_COOLDOWN);
  assert.ok(dropFromTanks());
});

test('an uncollected core drifts left and is lost off the edge', () => {
  const core = dropFromTanks(800, 300);
  assert.ok(core);
  updatePowerUp(1);
  assert.ok(core.x < 800);
  for (let frame = 2; frame < 2000 && getPowerUp(); frame++) updatePowerUp(frame);
  assert.equal(getPowerUp(), null);
});
