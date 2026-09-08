import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from './timing.ts';

for (const hz of [30, 60, 120, 144]) {
  test(`ten seconds produces 600 simulation ticks at ${hz} Hz`, () => {
    const clock = createClock();
    let ticks = 0;
    for (let frame = 0; frame <= hz * 10; frame++) {
      clock.advance(frame * 1000 / hz, () => ticks++);
    }
    assert.equal(ticks, 600);
  });
}
test('long stalls perform at most five catch-up updates', () => {
  const clock = createClock();
  let ticks = 0;
  clock.advance(0, () => ticks++);
  clock.advance(60_000, () => ticks++);
  assert.equal(ticks, 5);
});
test('resuming discards elapsed time and partial input-era ticks', () => {
  const clock = createClock();
  let ticks = 0;
  clock.advance(0, () => ticks++);
  clock.advance(10, () => ticks++);
  clock.reset();
  clock.advance(60_000, () => ticks++);
  assert.equal(ticks, 0);
  clock.advance(60_017, () => ticks++);
  assert.equal(ticks, 1);
});
