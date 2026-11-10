import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POWER_TIERS, applyPickup, dropChance, eligibleTiers, pickPowerTier, tierRank } from './power.ts';

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

test('only the enemies that shoot back carry cores', () => {
  // Scouts are harmless and vastly outnumber everything else; if they dropped,
  // most cores would come from the safest kills on the board.
  assert.equal(dropChance('scout'), 0);
  assert.equal(dropChance('bomb'), 0);
  assert.ok(dropChance('tank') > dropChance('drone'), 'the dangerous kill pays best');
  assert.ok(dropChance('drone') > 0, 'drones keep drops from being fully predictable');
  assert.equal(dropChance('nonsense'), 0, 'unknown kinds never drop');
});

test('drop chances stay probabilities', () => {
  for (const kind of ['scout', 'drone', 'tank', 'bomb']) {
    const c = dropChance(kind);
    assert.ok(c >= 0 && c <= 1, `${kind} chance in range`);
  }
});

test('a core offers the next rung above the run\'s high-water mark', () => {
  // The bug this guards: keyed on the *running* power, the top tier only
  // appeared if a kill landed inside the few seconds a power was still
  // ticking. Measured over full runs that window almost never caught one —
  // two instrumented 70s runs produced 8 tank kills each and, in one, zero
  // plasma. Keyed on the run's peak instead, the climb cannot be missed.
  for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
    assert.equal(pickPowerTier(5, roll, 'overdrive'), 'plasma', `roll ${roll} climbs`);
  }
  // Nothing collected yet: the weights apply, so the first core is rung one.
  assert.equal(pickPowerTier(5, 0.1, null), 'overdrive');
  // Topped out: fall back to the weighted pick, which may top you up.
  assert.ok(['overdrive', 'plasma'].includes(pickPowerTier(5, 0.1, 'plasma')!));
  // An unreachable rung is never offered just because you peaked below it.
  assert.equal(pickPowerTier(1, 0.9, 'overdrive'), 'overdrive');
});

