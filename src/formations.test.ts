import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flightPosition, planWave, shouldOfferMine } from './formations.ts';

test('waves cycle attack patterns, stage entries, and cap squadron size', () => {
  assert.deepEqual([1, 2, 3, 4].map(n => planWave(n)[0].flight.pattern), ['swoop', 'split', 'dive', 'swoop']);
  assert.equal(planWave(1).length, 5);
  assert.equal(planWave(100).length, 8);
  assert.equal(planWave(1)[1].flight.age, -12);
  assert.ok(planWave(1).every(m => m.kind === 'scout'));
  assert.ok(planWave(4).some(m => m.kind === 'tank'));
});
test('all paths remain vertically on screen and eventually exit, including small screens', () => {
  for (const [width, height] of [[320, 240], [1280, 720], [3840, 2160]]) {
    for (const wave of [1, 2, 3, 40]) {
      for (const {flight} of planWave(wave, () => 0.5)) {
        for (let age = 0; age <= 1000; age++) {
          flight.age = age;
          const p = flightPosition(flight, width, height, 48);
          assert.ok(p.y >= 48 && p.y <= height - 48);
          assert.ok(Number.isFinite(p.x));
        }
        assert.ok(flightPosition(flight, width, height, 48).x < -100);
      }
    }
  }
});
test('dive wing pauses to assemble before accelerating left', () => {
  const f = planWave(3)[0].flight;
  f.age = 75; const a = flightPosition(f, 1280, 720, 28);
  f.age = 95; assert.equal(flightPosition(f, 1280, 720, 28).x, a.x);
  f.age = 120; assert.ok(flightPosition(f, 1280, 720, 28).x < a.x);
});
test('mines are restricted to occasional waves with a twenty-second minimum gap', () => {
  assert.equal(shouldOfferMine(3, 2000, 0, 0), false);
  assert.equal(shouldOfferMine(4, 1199, 0, 0), false);
  assert.equal(shouldOfferMine(4, 1200, 0, 0.49), true);
  assert.equal(shouldOfferMine(4, 1200, 0, 0.5), false);
});

test('formations and random raids alternate while pace increases with survival time', async () => {
  const {combatPace, encounterKind} = await import('./formations.ts');
  assert.deepEqual([1,2,3,4].map(encounterKind), ['formation','random','formation','random']);
  assert.equal(combatPace(0, 0), 1);
  assert.ok(combatPace(3600, 0) > combatPace(0, 0));
  assert.ok(combatPace(7200, 0) > combatPace(3600, 0));
  assert.ok(combatPace(3600, 5) > combatPace(3600, 0));
  assert.equal(combatPace(1e9, 100), 2.25);
});

test('mine opportunities include singles, pairs and rare triples',async()=>{
  const {mineCount}=await import('./formations.ts');
  assert.deepEqual([0,0.49,0.5,0.84,0.85,0.99].map(mineCount),[1,1,2,2,3,3]);
});
