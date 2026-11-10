import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POWER_TIERS, applyPickup, eligibleTiers, pickPowerTier, tierRank } from './power.ts';

test('tiers form a strict ladder: higher rank fires faster', () => {
  const ladder = Object.values(POWER_TIERS).sort((a, b) => a.rank - b.rank);
  assert.deepEqual(ladder.map(d => d.tier), ['overdrive', 'plasma']);
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(ladder[i].fireRate < ladder[i - 1].fireRate, `${ladder[i].tier} outpaces ${ladder[i-1].tier}`);
    assert.ok(ladder[i].minDifficulty >= ladder[i - 1].minDifficulty, 'higher tiers unlock no earlier');
  }
  // Overdrive hands back exactly the pre-nerf cadence.
  assert.equal(POWER_TIERS.overdrive.fireRate, 4);
});

test('tiers unlock by difficulty, and nothing drops before the first unlock', () => {
  assert.deepEqual(eligibleTiers(0).map(d => d.tier), []);
  assert.equal(pickPowerTier(0, 0.5), null);
  assert.deepEqual(eligibleTiers(1).map(d => d.tier), ['overdrive']);
  assert.deepEqual(eligibleTiers(3).map(d => d.tier), ['overdrive', 'plasma']);
  // Below the plasma unlock every roll still yields overdrive.
  for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) assert.equal(pickPowerTier(2, roll), 'overdrive');
});

test('drop weights favour the lower tier once both are unlocked', () => {
  const counts = { overdrive: 0, plasma: 0 };
  for (let i = 0; i < 1000; i++) counts[pickPowerTier(5, i / 1000)!]++;
  assert.equal(counts.overdrive + counts.plasma, 1000);
  assert.equal(counts.overdrive, 750); // 3:1 weighting
  assert.equal(counts.plasma, 250);
});

test('a pickup never downgrades an active power', () => {
  // Lower tier while plasma runs: keep plasma, top the timer up, never past its cap.
  const toppedUp = applyPickup('plasma', 100, 'overdrive');
  assert.equal(toppedUp.tier, 'plasma');
  assert.ok(toppedUp.timer > 100);
  assert.ok(toppedUp.timer <= POWER_TIERS.plasma.duration);
  assert.equal(applyPickup('plasma', POWER_TIERS.plasma.duration, 'overdrive').timer, POWER_TIERS.plasma.duration);

  // Higher tier replaces outright; same tier refreshes to full.
  assert.deepEqual(applyPickup('overdrive', 10, 'plasma'), { tier: 'plasma', timer: POWER_TIERS.plasma.duration });
  assert.deepEqual(applyPickup('overdrive', 10, 'overdrive'), { tier: 'overdrive', timer: POWER_TIERS.overdrive.duration });
  assert.deepEqual(applyPickup(null, 0, 'overdrive'), { tier: 'overdrive', timer: POWER_TIERS.overdrive.duration });
});

test('base cadence outranks nothing', () => {
  assert.equal(tierRank(null), 0);
  assert.ok(tierRank('overdrive') > tierRank(null));
  assert.ok(tierRank('plasma') > tierRank('overdrive'));
});

