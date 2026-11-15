import { particleCount } from "./effects";
import { summarize, type Summary } from "./frame-stats";
import { getEnemies, spawnMine, spawnRandomEnemy, spawnWave } from "./enemies";
import { enemyShotCount } from "./enemy-shots";
import { getLasers, getUltraLasers } from "./laser";
import { seedRandom, unseedRandom } from "./rng";
import { createSim, stepSim, type Sim, type SimInput } from "./sim";
import { setCanvasSize } from "./types";

// Seeded scenes for measuring and testing the simulation without a browser.
// A scene is a seed, a scripted pilot, and (for the stress scenes) a spawner
// that holds the entity count far above anything a real run reaches. Same
// seed, same scene: same run, tick for tick.
//
// runScene times the simulation only. Drawing is the other half of a frame and
// can only be measured in a browser: open the game with ?bench=swarm to fly the
// same scene on screen with frame timings (see game.ts).

export type SceneName =
  /** Sector 01 exactly as shipped, flown by the pilot. */
  | "sector1"
  /** Sector 01 plus a constant flood of raiders, formations and mines, with
   * plasma and spread forced on: the most entities the rules can produce. */
  | "swarm";

export interface SceneOptions {
  scene: SceneName;
  seed: number;
  ticks: number;
  width?: number;
  height?: number;
  /** Top shields up every tick so the run always lasts `ticks`. */
  immortal?: boolean;
  /** Called after every tick; tests use it to watch the run unfold. */
  onTick?: (sim: Sim, tick: number) => void;
}

export interface SceneResult {
  ticksRun: number;
  score: number;
  kills: number;
  lives: number;
  gameOver: boolean;
  /** Hash of the gameplay state sampled every tick. Two runs with the same
   * digest played out identically; cosmetics are deliberately left out. */
  digest: string;
  peak: { enemies: number; lasers: number; enemyShots: number; particles: number };
  /** Wall-clock cost of a simulation tick, in milliseconds. */
  tickMs: Summary;
}

export function isSceneName(value: unknown): value is SceneName {
  return value === "sector1" || value === "swarm";
}

const HEADLESS_IMAGE = {} as HTMLImageElement;

/** Fly at whatever is nearest ahead and never stop firing. Not a good pilot,
 * a repeatable one: it reads only simulation state, so it replays exactly. */
function pilot(sim: Sim, input: SimInput) {
  const { player } = sim;
  let target: { x: number; y: number } | null = sim.boss;
  let best = Infinity;
  for (const e of getEnemies()) {
    if (e.x < player.x) continue;
    const distance = e.x - player.x + Math.abs(e.y - player.y) * 2;
    if (distance < best) { best = distance; target = e; }
  }
  input.keys.clear();
  input.keys.add(" ");
  if (!target) return;
  const dy = target.y - player.y;
  if (dy > 12) input.keys.add("s");
  else if (dy < -12) input.keys.add("w");
}

/** Hold the field at stress density. Spawns go through the game's own spawn
 * functions, so every entity obeys the real rules. */
function flood(sim: Sim, tick: number) {
  sim.state.powerTier = "plasma";
  sim.state.powerTimer = 2;
  sim.spread = true;
  if (sim.boss) return;
  if (tick % 2 === 0) spawnRandomEnemy(6, 1.5);
  if (tick % 90 === 0) spawnWave(6 + Math.floor(tick / 90), 1.5);
  if (tick % 150 === 75) spawnMine(3);
}

/** Everything a scene does to a run before a tick: keep it alive, crowd the
 * field, fly the ship. `tick` counts from 0 at the start of the scene. */
export function driveScene(scene: SceneName, sim: Sim, input: SimInput, tick: number, immortal = true) {
  if (immortal) sim.state.lives = 8;
  if (scene === "swarm") flood(sim, tick);
  pilot(sim, input);
}

function fnv1a(hash: number, value: number): number {
  // Quantise so the digest tracks position to a thousandth of a pixel.
  let v = Math.round(value * 1000) | 0;
  for (let i = 0; i < 4; i++) {
    hash ^= v & 0xff;
    hash = Math.imul(hash, 0x01000193);
    v >>>= 8;
  }
  return hash >>> 0;
}

function sample(hash: number, sim: Sim): number {
  const { state, player } = sim;
  hash = fnv1a(hash, state.score);
  hash = fnv1a(hash, state.lives);
  hash = fnv1a(hash, state.combo);
  hash = fnv1a(hash, player.x);
  hash = fnv1a(hash, player.y);
  const enemies = getEnemies();
  hash = fnv1a(hash, enemies.length);
  for (const e of enemies) {
    hash = fnv1a(hash, e.x);
    hash = fnv1a(hash, e.y);
    hash = fnv1a(hash, e.hp);
  }
  hash = fnv1a(hash, getLasers().length + getUltraLasers().length);
  hash = fnv1a(hash, enemyShotCount());
  return hash;
}

export function runScene(options: SceneOptions): SceneResult {
  const { scene, seed, ticks, width = 1280, height = 720, immortal = scene === "swarm" } = options;
  setCanvasSize(width, height);
  seedRandom(seed);
  try {
    const sim = createSim(HEADLESS_IMAGE);
    const input: SimInput = { keys: new Set(), fireRequested: false };
    const times = new Float64Array(ticks);
    const peak = { enemies: 0, lasers: 0, enemyShots: 0, particles: 0 };
    let digest = 0x811c9dc5;
    let ticksRun = 0;

    for (let tick = 0; tick < ticks && !sim.state.gameOver; tick++) {
      driveScene(scene, sim, input, tick, immortal);

      const started = performance.now();
      stepSim(sim, input);
      times[tick] = performance.now() - started;
      ticksRun++;

      digest = sample(digest, sim);
      peak.enemies = Math.max(peak.enemies, getEnemies().length);
      peak.lasers = Math.max(peak.lasers, getLasers().length + getUltraLasers().length);
      peak.enemyShots = Math.max(peak.enemyShots, enemyShotCount());
      peak.particles = Math.max(peak.particles, particleCount());
      options.onTick?.(sim, tick);
    }

    return {
      ticksRun,
      score: sim.state.score,
      kills: sim.state.kills,
      lives: sim.state.lives,
      gameOver: sim.state.gameOver,
      digest: digest.toString(16).padStart(8, "0"),
      peak,
      tickMs: summarize(times.subarray(0, ticksRun)),
    };
  } finally {
    unseedRandom();
  }
}
