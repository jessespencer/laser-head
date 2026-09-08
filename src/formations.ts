export type Pattern = 'swoop' | 'split' | 'dive';
export type Flight = {
  pattern: Pattern;
  age: number;
  lane: number;
  slot: number;
  count: number;
  speed: number;
};
export const WAVE_NAMES = ['SWOOP SQUADRON', 'SPLIT RAIDERS', 'DIVE WING'];

/** Fixed-tick paths; slots share a route and enter in a readable sequence. */
export function flightPosition(f: Flight, width: number, height: number, margin: number) {
  const t = Math.max(0, f.age);
  const center = height * f.lane;
  const amplitude = Math.min(100, height * 0.18);
  let x = width + 70 - t * f.speed;
  let y = center;
  if (f.pattern === 'swoop') {
    y += Math.sin(t * 0.035) * amplitude;
  } else if (f.pattern === 'split') {
    const side = f.slot % 2 === 0 ? -1 : 1;
    y += side * Math.sin(Math.min(1, t / 90) * Math.PI / 2) * amplitude;
    y += Math.sin(t * 0.045) * 12;
  } else {
    // Assemble at the right, show the formation, then commit to a dive.
    const slotY = (f.slot - (f.count - 1) / 2) * Math.min(42, height * 0.055);
    if (t < 70) {
      x = width + 70 + (width * 0.76 - width - 70) * t / 70;
      y += slotY;
    } else if (t < 100) {
      x = width * 0.76;
      y += slotY;
    } else {
      const dive = t - 100;
      x = width * 0.76 - dive * f.speed * 1.45;
      y += slotY * Math.max(0, 1 - dive / 100) + Math.sin(dive * 0.025) * amplitude;
    }
  }
  const inset = Math.min(margin, height / 2);
  return { x, y: Math.max(inset, Math.min(height - inset, y)) };
}

export function planWave(wave: number, random: () => number = Math.random) {
  const pattern: Pattern = (['swoop', 'split', 'dive'] as const)[(wave - 1) % 3];
  const count = Math.min(8, 5 + Math.floor((wave - 1) / 3));
  const lane = 0.35 + random() * 0.3;
  return Array.from({ length: count }, (_, slot) => ({
    kind: wave >= 4 && slot === count - 1 ? 'tank' as const :
      wave >= 2 && slot % 3 === 0 ? 'drone' as const : 'scout' as const,
    flight: { pattern, age: -slot * 12, lane, slot, count, speed: Math.min(8, 5.5 + wave * 0.15) },
  }));
}

/** A mine is a wave reward opportunity, never a replacement for an alien. */
export function shouldOfferMine(wave: number, elapsed: number, lastMine: number, roll: number) {
  return wave % 4 === 0 && elapsed - lastMine >= 1200 && roll < 0.5;
}

/** Survival time drives pace even when the player is missing shots. */
export function combatPace(ticks: number, difficulty: number) {
  return Math.min(2.25, 1 + Math.max(0, ticks) / 3600 * 0.35 + Math.min(0.2, Math.max(0, difficulty) * 0.02));
}
export function encounterKind(stage: number) { return stage % 2 === 0 ? 'random' : 'formation'; }

export function mineCount(roll:number) { return roll < 0.5 ? 1 : roll < 0.85 ? 2 : 3; }
