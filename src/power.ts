/** Power-up tiers. Each tier is a strict upgrade of the one below it: a faster
 * cadence and a louder beam. Kept import-free so the node test runner can load
 * it directly, and so the rules stay independent of rendering. */
export type PowerTier = 'overdrive' | 'plasma';

export interface PowerTierDef {
  tier: PowerTier;
  /** Higher outranks lower. A pickup never downgrades an active power. */
  rank: number;
  duration: number;   // frames
  fireRate: number;   // frames between shots
  label: string;      // HUD
  color: string;      // HUD bar, pickup glow
  image: string;
  minDifficulty: number;
  /** Relative drop chance among the tiers currently eligible. */
  weight: number;
}

export const POWER_TIERS: Record<PowerTier, PowerTierDef> = {
  // Tier 1 — the pre-nerf cadence, handed back as a temporary reward.
  overdrive: {
    tier: 'overdrive',
    rank: 1,
    duration: 540, // ~9 seconds
    fireRate: 4,
    label: 'OVERDRIVE',
    color: '#ffb347',
    image: '/laser-head/overdrive-core.svg',
    minDifficulty: 1,
    weight: 3,
  },
  // Tier 2 — plasma: faster still, and swaps the beam for cyan bolts.
  plasma: {
    tier: 'plasma',
    rank: 2,
    duration: 420, // ~7 seconds
    fireRate: 3,
    label: 'PLASMA',
    color: '#67efff',
    image: '/laser-head/plasma-core.svg',
    minDifficulty: 3,
    weight: 1,
  },
};

const ORDER: PowerTier[] = ['overdrive', 'plasma'];

export function tierRank(tier: PowerTier | null) {
  return tier ? POWER_TIERS[tier].rank : 0;
}

/** Tiers the run has unlocked, in ascending rank. */
export function eligibleTiers(difficulty: number): PowerTierDef[] {
  return ORDER.map(t => POWER_TIERS[t]).filter(d => difficulty >= d.minDifficulty);
}

/** Weighted pick among unlocked tiers. `roll` is 0..1. Null until the first
 * tier unlocks, so early waves stay unassisted.
 *
 * `active` is the power already running, if any. A core that only tops up what
 * you are already holding is a non-event, so while something is running the
 * drop is the next rung up — that is what makes this a ladder you climb rather
 * than a coin flip you re-toss. With nothing running the weights apply, so your
 * first core of a run is usually the bottom rung. */
export function pickPowerTier(
  difficulty: number,
  roll: number,
  active: PowerTier | null = null
): PowerTier | null {
  const unlocked = eligibleTiers(difficulty);
  if (unlocked.length === 0) return null;
  const above = unlocked.filter(d => d.rank > tierRank(active));
  const tiers = above.length > 0 ? above : unlocked;
  const total = tiers.reduce((sum, d) => sum + d.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const def of tiers) {
    cursor -= def.weight;
    if (cursor < 0) return def.tier;
  }
  return tiers[tiers.length - 1].tier;
}

/** Collecting a power never makes you worse off: a lower tier picked up while a
 * higher one is running tops up the active timer instead of replacing it. */
export function applyPickup(
  active: PowerTier | null,
  timer: number,
  picked: PowerTier
): { tier: PowerTier; timer: number } {
  if (active && tierRank(active) > tierRank(picked)) {
    return { tier: active, timer: Math.min(POWER_TIERS[active].duration, timer + POWER_TIERS[picked].duration) };
  }
  // Same tier refreshes; higher tier replaces outright.
  return { tier: picked, timer: POWER_TIERS[picked].duration };
}

/** Chance that a destroyed enemy leaves a core behind. Only the enemies that
 * shoot back carry one: the reward tracks the risk, and scouts — which are
 * both harmless and by far the most numerous — would otherwise turn drops
 * into a lottery on the safest kills in the game. */
export function dropChance(enemyType: string): number {
  switch (enemyType) {
    case 'tank': return 0.35;
    case 'drone': return 0.04;
    default: return 0; // scouts and mines never carry cores
  }
}
