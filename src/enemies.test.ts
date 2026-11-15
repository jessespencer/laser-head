import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearEnemies, detonateBomb, getEnemies, setCombatAggression, spawnAttackTank,
  spawnMine, spawnRandomEnemy, spawnWave, updateEnemies,
} from './enemies.ts';
import { clearEnemyShots, enemyShotCount } from './enemy-shots.ts';
import { seedRandom } from './rng.ts';
import { BOMB_DETONATE_FRAMES, MAX_ATTACK_TANKS, setCanvasSize } from './types.ts';

const WIDTH = 1280, HEIGHT = 720;
const player = { x: 120, y: 360 };

beforeEach(() => {
  setCanvasSize(WIDTH, HEIGHT);
  seedRandom(21);
  clearEnemies();
  clearEnemyShots();
  setCombatAggression(0);
});

function run(ticks: number, from = 1) {
  for (let frame = from; frame < from + ticks; frame++) updateEnemies(frame, player);
}

test('raiders enter from the right, cross the field and are removed past the left edge', () => {
  spawnRandomEnemy(0, 1);
  const [raider] = getEnemies();
  assert.ok(raider.x > WIDTH, 'spawns off-screen');
  assert.ok(raider.y >= raider.size && raider.y <= HEIGHT - raider.size);
  const startX = raider.x;
  run(10);
  assert.ok(raider.x < startX);
  run(2000, 11);
  assert.equal(getEnemies().length, 0);
});

test('tanks only join random raids once the run has heated up', () => {
  for (let i = 0; i < 300; i++) spawnRandomEnemy(0, 1);
  assert.ok(getEnemies().every(e => e.type !== 'tank'));
  clearEnemies();
  for (let i = 0; i < 300; i++) spawnRandomEnemy(4, 1);
  assert.ok(getEnemies().some(e => e.type === 'tank'));
});

test('every tank is born with an attack plan and the armour its variant carries', () => {
  for (let i = 0; i < 300; i++) spawnRandomEnemy(4, 1);
  const tanks = getEnemies().filter(e => e.type === 'tank');
  assert.ok(tanks.length > 0);
  for (const tank of tanks) {
    assert.ok(tank.attack);
    assert.equal(tank.hp, tank.attack.variant === 'spreader' ? 7 : 6);
    assert.equal(tank.maxHp, tank.hp);
  }
});

test('the shooter cap rises by one late in the run', () => {
  for (let i = 0; i < 6; i++) spawnAttackTank(1);
  assert.equal(getEnemies().length, MAX_ATTACK_TANKS - 1);
  setCombatAggression(1);
  for (let i = 0; i < 6; i++) spawnAttackTank(1);
  assert.equal(getEnemies().length, MAX_ATTACK_TANKS);
});

test('an attack tank brakes on the field and opens fire', () => {
  spawnAttackTank(1);
  let fired = false;
  for (let frame = 1; frame <= 600 && !fired; frame++) {
    updateEnemies(frame, player);
    fired = enemyShotCount() > 0;
  }
  assert.ok(fired, 'no shot within ten seconds');
  const [tank] = getEnemies();
  assert.ok(tank.x < WIDTH, 'it has come on-screen to attack');
});

test('a formation spawns its whole squadron and it flies off in the end', () => {
  spawnWave(1);
  assert.equal(getEnemies().length, 5);
  assert.ok(getEnemies().every(e => e.flight), 'formation members follow a flight path');
  run(1500);
  assert.equal(getEnemies().length, 0);
});

test('mines drop into place, hover, then expire on their own', () => {
  spawnMine(3);
  const mines = getEnemies();
  assert.equal(mines.length, 3);
  assert.ok(mines.every(m => m.type === 'bomb' && m.y < 0), 'they start above the field');
  run(300);
  assert.ok(mines.every(m => m.bombTargetY === undefined && m.y > 0), 'all three are hovering');
  run(700, 301);
  assert.equal(getEnemies().length, 0);
});

test('an armed mine counts down once and waits to be resolved rather than expiring', () => {
  spawnMine(1);
  run(300);
  detonateBomb(0);
  const [mine] = getEnemies();
  assert.equal(mine.detonateTimer, BOMB_DETONATE_FRAMES);
  run(5, 301);
  detonateBomb(0); // a second hit cannot restart the fuse
  assert.equal(mine.detonateTimer, BOMB_DETONATE_FRAMES - 5);
  run(600, 306);
  assert.equal(getEnemies().length, 1, 'the blast is the game loop\'s to resolve');
  assert.equal(mine.detonateTimer, 0);
});
