/** A bounded 60 Hz clock. Reset it whenever gameplay is suspended. */
export const TICK_MS = 1000 / 60;
export function createClock() {
  let last: number | undefined;
  let accumulator = 0;
  return {
    reset() { last = undefined; accumulator = 0; },
    advance(now: number, update: () => void) {
      if (last === undefined) { last = now; return 1; }
      accumulator += Math.max(0, Math.min(now - last, TICK_MS * 5));
      last = now;
      let steps = 0;
      while (accumulator + 1e-8 >= TICK_MS && steps < 5) {
        accumulator = Math.max(0, accumulator - TICK_MS);
        update();
        steps++;
      }
      return accumulator / TICK_MS;
    },
  };
}
