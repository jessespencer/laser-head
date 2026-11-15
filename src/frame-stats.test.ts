import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFrameStats, summarize } from './frame-stats.ts';

test('a summary reports mean, percentiles and the worst sample, in any input order', () => {
  const samples = Array.from({ length: 100 }, (_, i) => 100 - i); // 100..1
  assert.deepEqual(summarize(samples), { mean: 50.5, p50: 51, p95: 96, p99: 100, max: 100 });
});

test('no samples summarise to zeros rather than NaN', () => {
  assert.deepEqual(summarize([]), { mean: 0, p50: 0, p95: 0, p99: 0, max: 0 });
});

test('one bad frame shows in the tail without moving the median', () => {
  const samples = Array.from({ length: 200 }, () => 8);
  samples[57] = 80;
  const summary = summarize(samples);
  assert.equal(summary.p50, 8);
  assert.equal(summary.p95, 8);
  assert.equal(summary.max, 80);
});

test('frame stats keep each timing separate and count slow frames', () => {
  const stats = createFrameStats(100, 20);
  for (let i = 0; i < 9; i++) stats.record(16, 1, 3);
  stats.record(40, 2, 30);
  const report = stats.report();
  assert.equal(report.frames, 10);
  assert.equal(report.interval.max, 40);
  assert.equal(report.update.max, 2);
  assert.equal(report.render.max, 30);
  assert.equal(report.slow, 0.1);
});

test('only the most recent frames are kept', () => {
  const stats = createFrameStats(50, 20);
  for (let i = 0; i < 50; i++) stats.record(100, 0, 0); // a slow warm-up
  for (let i = 0; i < 50; i++) stats.record(8, 0, 0);
  const report = stats.report();
  assert.equal(report.frames, 50);
  assert.equal(report.interval.max, 8, 'the warm-up has been pushed out');
  assert.equal(report.slow, 0);
});

test('reset starts a fresh sample', () => {
  const stats = createFrameStats();
  stats.record(16, 1, 1);
  stats.reset();
  assert.equal(stats.report().frames, 0);
});
