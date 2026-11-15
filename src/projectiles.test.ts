import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { clearEnemyShots, enemyShotCount, enemyShotHits, spawnEnemyShot, updateEnemyShots } from './enemy-shots.ts';
import {
  clearLasers, clearUltraLasers, getLasers, getUltraLasers,
  spawnLaser, spawnUltraLaser, updateLasers, updateUltraLasers,
} from './laser.ts';
import { ENEMY_SHOT_SPEED, LASER_SPEED, MAX_ENEMY_SHOTS, PLAYER_HURT_FRACTION, setCanvasSize } from './types.ts';

const WIDTH = 1280, HEIGHT = 720;
const player = { x: 400, y: 300, width: 112, height: 112 };

beforeEach(() => {
  setCanvasSize(WIDTH, HEIGHT);
  clearEnemyShots();
  clearLasers();
  clearUltraLasers();
});

// --- Player lasers ---

test('lasers fly right at laser speed and are dropped past the right edge', () => {
  spawnLaser(100, 200);
  updateLasers();
  assert.deepEqual([getLasers()[0].x, getLasers()[0].y], [100 + LASER_SPEED, 200]);
  for (let i = 0; i < 100; i++) updateLasers();
  assert.equal(getLasers().length, 0);
});

test('spread bolts drift vertically and are dropped off the top and bottom', () => {
  spawnLaser(100, 20, -5);
  spawnLaser(100, HEIGHT - 20, 5);
  updateLasers();
  assert.deepEqual(getLasers().map(l => l.y), [15, HEIGHT - 15]);
  for (let i = 0; i < 12; i++) updateLasers();
  assert.equal(getLasers().length, 0);
});

test('plasma bolts are tracked apart from ordinary lasers', () => {
  spawnLaser(0, 0);
  spawnUltraLaser(0, 0);
  spawnUltraLaser(0, 0);
  assert.equal(getLasers().length, 1);
  assert.equal(getUltraLasers().length, 2);
  updateUltraLasers();
  assert.equal(getUltraLasers()[0].x, LASER_SPEED);
  assert.equal(getLasers()[0].x, 0, 'updating one list leaves the other alone');
  clearUltraLasers();
  assert.equal(getLasers().length, 1);
});

// --- Enemy shots ---

test('enemy fire is capped, so a late-run barrage cannot grow without bound', () => {
  for (let i = 0; i < MAX_ENEMY_SHOTS + 80; i++) spawnEnemyShot(600, 300, -1, 0);
  assert.equal(enemyShotCount(), MAX_ENEMY_SHOTS);
});

test('enemy shots travel along their aim and vanish off-screen', () => {
  spawnEnemyShot(600, 300, -1, 0);
  spawnEnemyShot(600, 300, 0, 1);
  updateEnemyShots();
  assert.equal(enemyShotCount(), 2);
  for (let i = 0; i < Math.ceil(700 / ENEMY_SHOT_SPEED); i++) updateEnemyShots();
  assert.equal(enemyShotCount(), 0);
});

test('a stalled shot still expires', () => {
  spawnEnemyShot(600, 300, 0, 0);
  for (let i = 0; i < 239; i++) updateEnemyShots();
  assert.equal(enemyShotCount(), 1);
  updateEnemyShots();
  assert.equal(enemyShotCount(), 0);
});

test('a shot that reaches the player hits once and is spent', () => {
  spawnEnemyShot(player.x, player.y, 0, 0);
  assert.equal(enemyShotHits(player), true);
  assert.equal(enemyShotCount(), 0);
  assert.equal(enemyShotHits(player), false);
});

test('the hurt box is a fraction of the sprite, so a near miss is a miss', () => {
  const reach = player.width * PLAYER_HURT_FRACTION + 5;
  spawnEnemyShot(player.x + reach + 1, player.y, 0, 0);
  assert.equal(enemyShotHits(player), false, 'just outside');
  assert.ok(reach + 1 < player.width / 2, 'and that is still inside the drawn head');
  spawnEnemyShot(player.x + reach - 1, player.y, 0, 0);
  assert.equal(enemyShotHits(player), true, 'just inside');
});

test('a fast shot cannot tunnel through the player between ticks', () => {
  spawnEnemyShot(player.x + 60, player.y, -1, 0, 120);
  updateEnemyShots(); // now 60px past the player on the far side
  assert.equal(enemyShotHits(player), true);
});
