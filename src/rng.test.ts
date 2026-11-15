import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { random, fxRandom, seedRandom, unseedRandom, mulberry32 } from './rng.ts';

const draw = (source: () => number, count: number) => Array.from({ length: count }, source);

test('a seed replays the same sequence, and other seeds do not', () => {
  seedRandom(42);
  const first = draw(random, 8);
  seedRandom(42);
  assert.deepEqual(draw(random, 8), first);
  seedRandom(43);
  assert.notDeepEqual(draw(random, 8), first);
  unseedRandom();
});

test('draws stay inside [0, 1) and are not stuck', () => {
  const values = draw(mulberry32(1), 5000);
  assert.ok(values.every(v => v >= 0 && v < 1));
  assert.ok(new Set(values).size > 4900);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  assert.ok(Math.abs(mean - 0.5) < 0.02, `mean ${mean} is far from uniform`);
});

test('effects draws never advance the gameplay stream', () => {
  seedRandom(9);
  const undisturbed = draw(random, 6);
  seedRandom(9);
  const interleaved = Array.from({ length: 6 }, () => { fxRandom(); fxRandom(); return random(); });
  assert.deepEqual(interleaved, undisturbed);
  unseedRandom();
});

test('the two streams differ under one seed', () => {
  seedRandom(9);
  assert.notDeepEqual(draw(random, 4), draw(fxRandom, 4));
  unseedRandom();
});

test('unseeding hands both streams back to Math.random', () => {
  const original = Math.random;
  Math.random = () => 0.125;
  try {
    seedRandom(1);
    assert.notEqual(random(), 0.125);
    unseedRandom();
    assert.equal(random(), 0.125);
    assert.equal(fxRandom(), 0.125);
  } finally {
    Math.random = original;
  }
});

test('game code draws its randomness from rng.ts, never from Math.random directly', () => {
  const dir = new URL('.', import.meta.url);
  // An injectable default (`random = Math.random`) is fine: callers pass rng's.
  // leaderboard.ts only uses it for a player-token fallback, outside the game.
  const exempt = new Set(['rng.ts', 'leaderboard.ts']);
  const offenders: string[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts') || exempt.has(file)) continue;
    readFileSync(new URL(file, dir), 'utf8').split('\n').forEach((line, index) => {
      if (line.includes('Math.random') && !/=\s*Math\.random\b(?!\()/.test(line)) offenders.push(`${file}:${index + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});
