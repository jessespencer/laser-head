import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, getEyePositions, updatePlayer } from './player.ts';
import { PLAYER_SIZE, PLAYER_SPEED, setCanvasSize } from './types.ts';

const WIDTH = 1280, HEIGHT = 720;
const fresh = () => { setCanvasSize(WIDTH, HEIGHT); return createPlayer({} as HTMLImageElement); };
const keys = (...held: string[]) => new Set(held);

test('the player starts on the left, vertically centred', () => {
  const player = fresh();
  assert.deepEqual([player.x, player.y], [120, HEIGHT / 2]);
});

test('arrow keys and WASD both move at player speed', () => {
  for (const [key, dx, dy] of [['d', 1, 0], ['arrowright', 1, 0], ['a', -1, 0], ['arrowleft', -1, 0],
    ['s', 0, 1], ['arrowdown', 0, 1], ['w', 0, -1], ['arrowup', 0, -1]] as const) {
    const player = fresh();
    player.x = 600;
    const { x, y } = player;
    updatePlayer(player, keys(key), false);
    assert.deepEqual([player.x - x, player.y - y], [dx * PLAYER_SPEED, dy * PLAYER_SPEED], key);
  }
});

test('diagonal movement is no faster than straight movement', () => {
  const player = fresh();
  player.x = 600;
  const { x, y } = player;
  updatePlayer(player, keys('d', 's'), false);
  assert.ok(Math.abs(Math.hypot(player.x - x, player.y - y) - PLAYER_SPEED) < 1e-9);
});

test('opposite keys cancel out', () => {
  const player = fresh();
  const { x, y } = player;
  updatePlayer(player, keys('a', 'd', 'w', 's'), false);
  assert.deepEqual([player.x, player.y], [x, y]);
});

test('the whole head stays on the field', () => {
  const player = fresh();
  const half = PLAYER_SIZE / 2;
  for (let i = 0; i < 300; i++) updatePlayer(player, keys('a', 'w'), false);
  assert.deepEqual([player.x, player.y], [half, half]);
  for (let i = 0; i < 300; i++) updatePlayer(player, keys('d', 's'), false);
  assert.deepEqual([player.x, player.y], [WIDTH - half, HEIGHT - half]);
});

test('the glow ramps up while firing and fades more slowly after', () => {
  const player = fresh();
  for (let i = 0; i < 6; i++) updatePlayer(player, keys(), true);
  assert.ok(Math.abs(player.glowIntensity - 1) < 1e-9);
  updatePlayer(player, keys(), true);
  assert.equal(player.glowIntensity, 1, 'capped');
  for (let i = 0; i < 6; i++) updatePlayer(player, keys(), false);
  assert.ok(Math.abs(player.glowIntensity - 0.5) < 1e-9, 'half gone after as long as it took to build');
  for (let i = 0; i < 10; i++) updatePlayer(player, keys(), false);
  assert.equal(player.glowIntensity, 0);
});

test('the eyes sit level, either side of centre, and move with the head', () => {
  const player = fresh();
  const [left, right] = getEyePositions(player);
  assert.equal(left.y, player.y);
  assert.equal(right.y, player.y);
  assert.ok(left.x < player.x && right.x > player.x);
  assert.ok(Math.abs((left.x + right.x) / 2 - player.x) < 1e-9);
});
