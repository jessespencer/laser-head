// Leaderboard store — Tier 0.
//
// This is the swap seam. The public surface (submitRun / fetchTop /
// getPersonalBest) is async and provider-neutral so a later tier can replace
// the localStorage body with a `fetch` backend without touching any caller.
// See docs/LEADERBOARD.md for the tier plan and the four portability rules.

// The run summary. This shape is the local record, the eventual POST body, and
// the anti-cheat validation input — flat and JSON-serializable on purpose.
export interface RunSummary {
  name: string;
  score: number;
  kills: number;
  maxCombo: number;
  framesSurvived: number;
  difficulty: number; // max difficulty reached
  avatarThumb: string; // 64×64 WebP as a base64 data URL ("" if none)
  playerToken: string; // stable per-browser UUID
  ts: number; // epoch ms
}

// A row as returned by the store: a RunSummary plus its board rank (1-based).
export interface LeaderboardEntry extends RunSummary {
  rank: number;
}

const TOKEN_KEY = "laserhead.playerToken";
const NAME_KEY = "laserhead.playerName";
const BOARD_KEY = "laserhead.board.v1";

export const DEFAULT_NAME = "AAA";
export const MAX_NAME_LEN = 12;

// The visible board size: how many rows we show and the bar for "placing".
export const LEADERBOARD_SIZE = 10;

// The display name for this browser, remembered across runs. Sanitized on write
// so the board never holds control chars or oversized strings.
export function getPlayerName(): string {
  return safeGet(NAME_KEY) || DEFAULT_NAME;
}

export function setPlayerName(name: string): string {
  const clean = sanitizeName(name);
  safeSet(NAME_KEY, clean);
  return clean;
}

// Uppercased, visible ASCII only, trimmed and length-capped. Empty falls back
// to DEFAULT_NAME. (Tier 1 adds a server-side blocklist for the public board.)
export function sanitizeName(name: string): string {
  const clean = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ._-]/g, "")
    .trim()
    .slice(0, MAX_NAME_LEN);
  return clean || DEFAULT_NAME;
}

// Stable per-browser identity, generated once and reused. Not a login — just a
// dedup key so the board shows distinct people rather than one player's runs.
export function getPlayerToken(): string {
  let token = safeGet(TOKEN_KEY);
  if (!token) {
    token = generateUUID();
    safeSet(TOKEN_KEY, token);
  }
  return token;
}

// How many runs we retain locally. Bounds localStorage; well above the top-N
// we ever display. (Per-player dedup is deliberately NOT done here — a local
// board is arcade-style, every run competes for a slot, repeats allowed. The
// Tier 1 global board revisits this so one player can't hog every slot.)
const MAX_STORED = 50;

// Persist a finished run, then return the resulting top board. Every run is a
// distinct entry; we keep the highest MAX_STORED by score.
export async function submitRun(summary: RunSummary): Promise<LeaderboardEntry[]> {
  const board = readBoard();
  board.push(summary);
  const trimmed = [...board]
    .sort((a, b) => b.score - a.score || a.ts - b.ts)
    .slice(0, MAX_STORED);
  writeBoard(trimmed);
  return rank(trimmed);
}

// Read the top `limit` rows, best score first.
export async function fetchTop(limit = LEADERBOARD_SIZE): Promise<LeaderboardEntry[]> {
  return rank(readBoard()).slice(0, limit);
}

// Would this score earn a spot on the visible board? True if the board isn't
// full yet, or the score beats the current lowest shown entry. Zero never
// places. This is the "enter your initials" gate.
export async function qualifies(score: number): Promise<boolean> {
  if (score <= 0) return false;
  const ranked = rank(readBoard());
  if (ranked.length < LEADERBOARD_SIZE) return true;
  return score > ranked[LEADERBOARD_SIZE - 1].score;
}

// This browser's best score, or null if it has never submitted a run.
export async function getPersonalBest(): Promise<RunSummary | null> {
  const token = getPlayerToken();
  const mine = readBoard().filter((r) => r.playerToken === token);
  if (mine.length === 0) return null;
  return mine.reduce((best, r) => (r.score > best.score ? r : best));
}

// Downscale an avatar to a tiny square WebP data URL for board rows. 64px keeps
// it at ~2–4 KB so it can live inline in the record — no object storage needed
// (a Tier-portability rule; see docs/LEADERBOARD.md). WebP preserves the head's
// transparent background. Returns "" if encoding isn't available.
export function makeThumbnail(img: HTMLImageElement, size = 64): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return "";

  // Contain the source within the square, preserving aspect ratio.
  const s = Math.min(size / img.width, size / img.height);
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

  const url = c.toDataURL("image/webp", 0.8);
  // Browsers without WebP encoding return a PNG data URL instead; accept it.
  return url.startsWith("data:image/") ? url : "";
}

// ── internals ────────────────────────────────────────────────────────

function rank(board: RunSummary[]): LeaderboardEntry[] {
  return [...board]
    .sort((a, b) => b.score - a.score || a.ts - b.ts) // ties: earlier run wins
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

function readBoard(): RunSummary[] {
  const raw = safeGet(BOARD_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // corrupt payload — start clean rather than throw
  }
}

function writeBoard(board: RunSummary[]): void {
  safeSet(BOARD_KEY, JSON.stringify(board));
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers without crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// localStorage can throw (private mode, quota, disabled). Degrade to a
// no-op / null rather than crashing the game.
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore — leaderboard is best-effort in Tier 0 */
  }
}
