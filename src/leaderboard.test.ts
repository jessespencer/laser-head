import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NAME, LEADERBOARD_SIZE, MAX_NAME_LEN, fetchTop, getPersonalBest, getPlayerName,
  getPlayerToken, qualifies, sanitizeName, setPlayerName, submitRun, type RunSummary,
} from './leaderboard.ts';

// The store reads `localStorage` at call time, so a fake on globalThis is all
// the browser it needs.
let stored: Map<string, string>;
function installStorage(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
}
beforeEach(() => {
  stored = new Map();
  installStorage({
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => { stored.set(key, String(value)); },
  });
});

let clock = 1000;
function run(score: number, overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    name: 'AAA', score, kills: 0, maxCombo: 0, framesSurvived: 0, difficulty: 0,
    avatarThumb: '', playerToken: 'someone-else', ts: clock++, ...overrides,
  };
}

test('names are upper-cased, stripped of anything unsafe, and capped', () => {
  assert.equal(sanitizeName('  jesse  '), 'JESSE');
  assert.equal(sanitizeName('<b>x</b>"\'&'), 'BXB');
  assert.equal(sanitizeName('a.b_c-d 9'), 'A.B_C-D 9');
  assert.equal(sanitizeName('x'.repeat(40)).length, MAX_NAME_LEN);
  assert.equal(sanitizeName('   '), DEFAULT_NAME);
  assert.equal(sanitizeName('💥'), DEFAULT_NAME);
});

test('the player name is remembered, sanitised on the way in', () => {
  assert.equal(getPlayerName(), DEFAULT_NAME);
  assert.equal(setPlayerName('jes<script>'), 'JESSCRIPT');
  assert.equal(getPlayerName(), 'JESSCRIPT');
});

test('the player token is generated once and then reused', () => {
  const token = getPlayerToken();
  assert.ok(token.length >= 32);
  assert.equal(getPlayerToken(), token);
  stored.clear();
  assert.notEqual(getPlayerToken(), token, 'a fresh browser is a fresh player');
});

test('the board ranks by score, and an earlier run wins a tie', async () => {
  await submitRun(run(500, { name: 'MID' }));
  await submitRun(run(900, { name: 'TOP' }));
  await submitRun(run(500, { name: 'LATE' }));
  const board = await fetchTop();
  assert.deepEqual(board.map(r => [r.rank, r.name]), [[1, 'TOP'], [2, 'MID'], [3, 'LATE']]);
});

test('only the best fifty runs are kept, and only the top ten are shown', async () => {
  for (let score = 1; score <= 60; score++) await submitRun(run(score));
  const all = await fetchTop(1000);
  assert.equal(all.length, 50);
  assert.equal(all[0].score, 60);
  assert.equal(all[49].score, 11);
  assert.equal((await fetchTop()).length, LEADERBOARD_SIZE);
});

test('a score qualifies while the board has room, then only by beating tenth place', async () => {
  assert.equal(await qualifies(0), false, 'zero never places');
  assert.equal(await qualifies(1), true, 'an empty board takes anything');
  for (let i = 0; i < LEADERBOARD_SIZE; i++) await submitRun(run(100 + i));
  assert.equal(await qualifies(100), false, 'matching tenth place is not beating it');
  assert.equal(await qualifies(101), true);
});

test('personal best is this browser\'s top run, ignoring everyone else', async () => {
  assert.equal(await getPersonalBest(), null);
  const me = getPlayerToken();
  await submitRun(run(9000));
  await submitRun(run(300, { playerToken: me }));
  await submitRun(run(700, { playerToken: me }));
  assert.equal((await getPersonalBest())?.score, 700);
});

test('a corrupt or foreign payload reads as an empty board', async () => {
  stored.set('laserhead.board.v1', '{not json');
  assert.deepEqual(await fetchTop(), []);
  stored.set('laserhead.board.v1', '{"an":"object"}');
  assert.deepEqual(await fetchTop(), []);
  assert.equal(await qualifies(10), true);
});

test('with storage unavailable the game still runs; it just forgets', async () => {
  const refuse = () => { throw new Error('storage disabled'); };
  installStorage({ getItem: refuse, setItem: refuse });
  assert.equal(getPlayerName(), DEFAULT_NAME);
  assert.equal(setPlayerName('jes'), 'JES');
  assert.ok(getPlayerToken());
  const board = await submitRun(run(123));
  assert.deepEqual(board.map(r => r.score), [123], 'the run is still ranked for this screen');
  assert.deepEqual(await fetchTop(), []);
});
