import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, stepSim, type Sim, type SimInput } from './sim.ts';
import { runScene } from './stress.ts';
import { seedRandom } from './rng.ts';
import { getEnemies, detonateBomb } from './enemies.ts';
import { getLasers, spawnLaser } from './laser.ts';
import { getPowerUp, tryDropPowerUp } from './powerup.ts';
import { spawnExplosion } from './effects.ts';
import { BOSS_ARRIVAL_TICK } from './boss.ts';
import { POWER_TIERS } from './power.ts';
import { ENEMY_TYPES, FIRE_RATE, MAX_ENEMY_SHOTS, setCanvasSize, type Enemy, type EnemyType } from './types.ts';

const IMAGE = {} as HTMLImageElement;
const idle = (): SimInput => ({ keys: new Set(), fireRequested: false });

/** A run with the wave director held off, so a test owns the whole field. */
function quietSim(): Sim {
  setCanvasSize(1280, 720);
  seedRandom(7);
  const sim = createSim(IMAGE);
  sim.waveRest = Number.MAX_SAFE_INTEGER;
  return sim;
}

/** Put a stationary enemy on the field, bypassing the spawners. */
function place(type: EnemyType, x: number, y: number): Enemy {
  const def = ENEMY_TYPES[type];
  const enemy: Enemy = { x, y, type, hp: def.hp, maxHp: def.hp, flashFrames: 0, sineOffset: 0, speed: 0, size: def.size };
  getEnemies().push(enemy);
  return enemy;
}

function steps(sim: Sim, count: number, input = idle()) {
  for (let i = 0; i < count; i++) stepSim(sim, input);
}

// --- Replay ---

test('the same seed replays the same run, tick for tick', () => {
  const a = runScene({ scene: 'sector1', seed: 11, ticks: 1500 });
  const b = runScene({ scene: 'sector1', seed: 11, ticks: 1500 });
  assert.equal(a.digest, b.digest);
  assert.equal(a.score, b.score);
  assert.equal(a.kills, b.kills);
  assert.ok(a.kills > 0, 'the pilot should be destroying things, or the digest proves little');
});

test('a different seed plays out differently', () => {
  const a = runScene({ scene: 'sector1', seed: 11, ticks: 1500 });
  const b = runScene({ scene: 'sector1', seed: 12, ticks: 1500 });
  assert.notEqual(a.digest, b.digest);
});

test('cosmetic randomness cannot change how a run plays out', () => {
  const plain = runScene({ scene: 'sector1', seed: 5, ticks: 1200 });
  // Extra sparks every tick draw from the effects stream only.
  const sparkly = runScene({ scene: 'sector1', seed: 5, ticks: 1200, onTick: () => spawnExplosion(0, 0, '#fff') });
  assert.equal(sparkly.digest, plain.digest);
  assert.equal(sparkly.score, plain.score);
});

test('the swarm scene crowds the field without breaking the entity caps', () => {
  const result = runScene({ scene: 'swarm', seed: 3, ticks: 900 });
  assert.equal(result.ticksRun, 900);
  assert.ok(result.peak.enemies >= 40, `expected a crowd, saw ${result.peak.enemies}`);
  assert.ok(result.peak.enemyShots <= MAX_ENEMY_SHOTS);
  assert.ok(result.peak.particles <= 700);
  assert.equal(result.lives, 8, 'an immortal scene keeps its shields');
});

// --- Boss arrival ---

test('the boss arrival shockwave pays out every enemy it destroys', () => {
  const sim = quietSim();
  place('scout', 900, 100);
  place('drone', 900, 300);
  place('tank', 900, 500);
  sim.sectorFrame = BOSS_ARRIVAL_TICK - 1;
  stepSim(sim, idle());
  assert.ok(sim.boss, 'the boss should have arrived');
  assert.equal(getEnemies().length, 0);
  assert.equal(sim.state.score, 100 + 250 + 500);
  assert.equal(sim.state.kills, 3);
  assert.equal(sim.state.combo, 1, 'one shockwave is one combo event, however many it catches');
});

test('a boss arriving on an empty field awards nothing', () => {
  const sim = quietSim();
  sim.sectorFrame = BOSS_ARRIVAL_TICK - 1;
  stepSim(sim, idle());
  assert.ok(sim.boss);
  assert.equal(sim.state.score, 0);
  assert.equal(sim.state.kills, 0);
  assert.equal(sim.state.combo, 0);
});

test('destroying the exposed core clears the sector and ends the run unharmed', () => {
  const sim = quietSim();
  sim.sectorFrame = BOSS_ARRIVAL_TICK - 1;
  stepSim(sim, idle());
  const boss = sim.boss!;
  const [core, gunA, gunB] = boss.parts;
  boss.tick = 200; // past the entry window in which the boss cannot be hit
  boss.x = 1000;   // and on the field, where a laser can reach it
  gunA.hp = 0; gunB.hp = 0; core.hp = 1;
  stepSim(sim, idle()); // parts take up their positions
  spawnLaser(core.x, core.y);
  stepSim(sim, idle());
  assert.equal(boss.dead, true);
  assert.equal(sim.stageCleared, true);
  assert.equal(sim.state.score, 5000);
  assert.equal(sim.state.gameOver, false, 'the death sequence plays out first');

  place('scout', sim.player.x, sim.player.y); // a straggler cannot hurt a cleared run
  let ticks = 0;
  while (!sim.state.gameOver && ticks < 200) { stepSim(sim, idle()); ticks++; }
  assert.equal(sim.state.gameOver, true);
  assert.equal(ticks, 90);
  assert.equal(sim.state.lives, 8);
});

// --- Mines ---

test('a mine chain scores each mine and each victim exactly once', () => {
  const sim = quietSim();
  const first = place('bomb', 800, 300);
  place('bomb', 1000, 300);   // inside the first blast: a delayed secondary
  place('scout', 850, 350);   // caught by the first blast
  place('scout', 1200, 300);  // out of the first blast, inside the second
  detonateBomb(getEnemies().indexOf(first));

  steps(sim, 18); // the fuse
  assert.equal(sim.state.score, 750 + 150, 'mine plus one victim, no chain bonus yet');
  assert.equal(sim.state.kills, 2);
  assert.equal(getEnemies().length, 2, 'the secondary mine and the far scout are still alive');

  steps(sim, 10); // the secondary's staggered fuse
  // Second blast: mine + victim + one chain depth, at the 2x combo it just reached.
  assert.equal(sim.state.score, 900 + (750 + 150 + 250) * 2);
  assert.equal(sim.state.kills, 4);
  assert.equal(getEnemies().length, 0);
  assert.deepEqual(sim.chainNotices.map(n => n.text), ['CHAIN +500']);

  steps(sim, 240);
  assert.equal(sim.state.score, 3200, 'nothing left to score, however long we wait');
  assert.equal(sim.state.kills, 4);
});

// --- Damage ---

test('a hit costs one shield and grants a recovery window', () => {
  const sim = quietSim();
  sim.state.combo = 6; sim.state.multiplier = 4; sim.state.comboTimer = 100;
  place('scout', sim.player.x, sim.player.y);
  stepSim(sim, idle());
  assert.equal(sim.state.lives, 7);
  assert.equal(getEnemies().length, 0, 'the rammer is destroyed');
  assert.deepEqual([sim.state.combo, sim.state.multiplier], [0, 1], 'a hit breaks the combo');

  place('scout', sim.player.x, sim.player.y);
  steps(sim, 44);
  assert.equal(sim.state.lives, 7, 'still recovering');
  stepSim(sim, idle());
  assert.equal(sim.state.lives, 6, 'the window has closed');
});

test('losing the last shield ends the run', () => {
  const sim = quietSim();
  sim.state.lives = 1;
  place('scout', sim.player.x, sim.player.y);
  stepSim(sim, idle());
  assert.equal(sim.state.lives, 0);
  assert.equal(sim.state.gameOver, true);
});

// --- Firing ---

test('holding fire shoots at once, then at the base cadence', () => {
  const sim = quietSim();
  const held: SimInput = { keys: new Set([' ']), fireRequested: false };
  stepSim(sim, held);
  assert.equal(getLasers().length, 2, 'one bolt per eye on the first tick');
  steps(sim, FIRE_RATE - 1, held);
  assert.equal(getLasers().length, 2);
  stepSim(sim, held);
  assert.equal(getLasers().length, 4);
});

test('a tap between ticks still fires, once', () => {
  const sim = quietSim();
  const input: SimInput = { keys: new Set(), fireRequested: true };
  stepSim(sim, input);
  assert.equal(getLasers().length, 2);
  assert.equal(input.fireRequested, false, 'the tap is consumed');
  steps(sim, 20, input);
  assert.equal(getLasers().length, 2);
});

// --- Power-ups ---

test('a collected core powers up the run and its rank outlives the power', () => {
  const sim = quietSim();
  // Tanks drop a core about a third of the time; keep killing until one does.
  for (let i = 0; i < 500 && !getPowerUp(); i++) tryDropPowerUp(sim.player.x, sim.player.y, 1, 'tank', null);
  assert.equal(getPowerUp()?.tier, 'overdrive', 'only the first rung is unlocked at difficulty 1');

  stepSim(sim, idle());
  assert.equal(sim.state.powerTier, 'overdrive');
  assert.equal(sim.state.peakTier, 'overdrive');
  assert.equal(getPowerUp(), null);

  steps(sim, POWER_TIERS.overdrive.duration);
  assert.equal(sim.state.powerTier, null, 'the power has run out');
  assert.equal(sim.state.peakTier, 'overdrive', 'the high-water mark has not');
});

test('an active power fires at its own, faster cadence', () => {
  const sim = quietSim();
  sim.state.powerTier = 'overdrive';
  sim.state.powerTimer = 600;
  const held: SimInput = { keys: new Set([' ']), fireRequested: false };
  steps(sim, 1 + POWER_TIERS.overdrive.fireRate, held);
  assert.equal(getLasers().length, 4);
  assert.ok(getLasers().every(l => l.hot), 'overdrive bolts are the hot variant');
});
