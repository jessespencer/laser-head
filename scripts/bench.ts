// Simulation benchmark: `pnpm bench [seed]`.
//
// Runs the seeded scenes headless and prints the cost of a simulation tick.
// The budget for a whole frame at 60 Hz is 16.7 ms, and drawing has to fit in
// it too, so read these as "how much of the frame do the rules take".
import { runScene, type SceneName } from "../src/stress.ts";

const seed = Number(process.argv[2] ?? 1);
const scenes: { scene: SceneName; ticks: number }[] = [
  { scene: "sector1", ticks: 80 * 60 },
  { scene: "swarm", ticks: 60 * 60 },
];
const fmt = (ms: number) => `${(ms * 1000).toFixed(1).padStart(8)}µs`;

console.log(`seed ${seed}, node ${process.version}`);
for (const { scene, ticks } of scenes) {
  runScene({ scene, seed, ticks, immortal: true }); // warm the JIT
  const runs = Array.from({ length: 5 }, () => runScene({ scene, seed, ticks, immortal: true }));
  const best = runs.reduce((a, b) => (b.tickMs.mean < a.tickMs.mean ? b : a));
  const { peak, tickMs } = best;
  console.log(`\n${scene}: ${best.ticksRun} ticks, score ${best.score}, kills ${best.kills}, digest ${best.digest}`);
  console.log(`  peak   enemies ${peak.enemies}  lasers ${peak.lasers}  enemy shots ${peak.enemyShots}  particles ${peak.particles}`);
  console.log(`  tick   mean ${fmt(tickMs.mean)}  p50 ${fmt(tickMs.p50)}  p95 ${fmt(tickMs.p95)}  p99 ${fmt(tickMs.p99)}  max ${fmt(tickMs.max)}`);
  if (new Set(runs.map(r => r.digest)).size !== 1) console.log("  WARNING: runs with the same seed diverged");
}
