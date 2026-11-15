/** Timing summaries for the benches. Import-free so the node test runner can
 * load it directly. All values are milliseconds. */
export interface Summary { mean: number; p50: number; p95: number; p99: number; max: number }

export function summarize(samples: ArrayLike<number>): Summary {
  const sorted = Float64Array.from(samples).sort();
  const n = sorted.length;
  if (n === 0) return { mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const at = (q: number) => sorted[Math.min(n - 1, Math.floor(q * n))];
  let total = 0;
  for (const value of sorted) total += value;
  return { mean: total / n, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: sorted[n - 1] };
}

export interface FrameReport {
  frames: number;
  /** Time between displayed frames: the number the player actually feels. */
  interval: Summary;
  /** Script time spent advancing the simulation in a frame. */
  update: Summary;
  /** Script time spent issuing draw calls in a frame. */
  render: Summary;
  /** Share of frames (0..1) that took longer than `slowMs` to arrive. */
  slow: number;
}

/** Keeps the most recent `capacity` frames, so a long session reports on its
 * last minute rather than averaging in its warm-up. */
export function createFrameStats(capacity = 3600, slowMs = 20) {
  const interval = new Float64Array(capacity);
  const update = new Float64Array(capacity);
  const render = new Float64Array(capacity);
  let written = 0;
  return {
    reset() { written = 0; },
    record(intervalMs: number, updateMs: number, renderMs: number) {
      const slot = written % capacity;
      interval[slot] = intervalMs;
      update[slot] = updateMs;
      render[slot] = renderMs;
      written++;
    },
    report(): FrameReport {
      const frames = Math.min(written, capacity);
      const intervals = interval.subarray(0, frames);
      let slow = 0;
      for (const value of intervals) if (value > slowMs) slow++;
      return {
        frames,
        interval: summarize(intervals),
        update: summarize(update.subarray(0, frames)),
        render: summarize(render.subarray(0, frames)),
        slow: frames ? slow / frames : 0,
      };
    },
  };
}
