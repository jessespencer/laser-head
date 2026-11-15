/** Every random draw in the game comes from here, so a run can be replayed.
 *
 * Two streams, on purpose. `random` decides things the player can feel:
 * spawns, attack patterns, drops. `fxRandom` decides things they can only
 * see: particle spread, star positions, screen shake. Keeping them apart means
 * a cosmetic change (more sparks, a pooled particle) can never shift a seeded
 * run's outcome, which is what lets the determinism tests guard gameplay.
 *
 * Unseeded, both are Math.random and the game plays exactly as it always has.
 * Import-free so the node test runner can load it directly. */
type Source = () => number;

let game: Source = Math.random;
let fx: Source = Math.random;

/** Gameplay randomness: anything that changes what the player must react to. */
export function random(): number {
  return game();
}

/** Cosmetic randomness: anything that only changes how a frame looks. */
export function fxRandom(): number {
  return fx();
}

/** Replace both streams with repeatable ones derived from `seed`. */
export function seedRandom(seed: number) {
  game = mulberry32(seed);
  fx = mulberry32(seed ^ 0x9e3779b9);
}

/** Back to Math.random (the shipped behaviour). */
export function unseedRandom() {
  game = Math.random;
  fx = Math.random;
}

/** Small, fast, well-distributed 32-bit generator; returns [0, 1). */
export function mulberry32(seed: number): Source {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
