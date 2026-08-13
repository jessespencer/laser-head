/**
 * Your head, at 11×12.
 *
 * The slim game has no photograph of anyone and no upload step — that is the
 * full-screen game's job — so "use the player's face" has to mean DERIVE one.
 * Given the same seed you always get the same head: the hash picks hair,
 * glasses, a beard and an antenna, and two people with different initials get
 * visibly different runners.
 *
 * Monochrome on purpose. The T-Rex runner is two-tone, and so is this: ink for
 * the head, paper for the holes (eyes, mouth), and the ONLY colour in the whole
 * game is the laser. That also makes the sprite theme-proof — the renderer
 * samples ink and paper from CSS custom properties, so the head is legible on
 * any host surface without a second asset.
 *
 * Pure data: a grid of 0/1 and the eye holes' coordinates. No canvas here.
 */

export const HEAD_COLS = 11;
export const HEAD_ROWS = 12;

export type HeadSprite = {
  /** `grid[row][col]` — 1 is ink, 0 is paper. */
  grid: number[][];
  /** Paper cells that fill with laser light while the eyes are hot. */
  eyes: { col: number; row: number }[];
  /** Which variants the hash chose — the renderer never reads these; they are
   *  what make "same seed, same head" checkable. */
  traits: { hair: number; glasses: boolean; beard: boolean; antenna: boolean };
};

/** FNV-1a. Stable across reloads and machines, which is the whole point. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Two letters for the HUD tag and the sprite seed. */
export function initialsFor(name: string, email = ""): string {
  const base = (name || email || "U").trim();
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return base.slice(0, 2).toUpperCase() || "U";
}

const O = 0;
const I = 1;

/** The base skull. Hair sits on rows 0–3, the face below it. */
function baseGrid(): number[][] {
  return [
    [O, O, I, I, I, I, I, I, I, O, O],
    [O, I, I, I, I, I, I, I, I, I, O],
    [I, I, I, I, I, I, I, I, I, I, I],
    [I, I, I, I, I, I, I, I, I, I, I],
    [I, I, I, I, I, I, I, I, I, I, I],
    [I, I, O, O, I, I, I, O, O, I, I],
    [I, I, O, O, I, I, I, O, O, I, I],
    [I, I, I, I, I, I, I, I, I, I, I],
    [I, I, I, I, O, O, O, I, I, I, I],
    [I, I, I, I, I, I, I, I, I, I, I],
    [O, I, I, I, I, I, I, I, I, I, O],
    [O, O, I, I, I, I, I, I, I, O, O],
  ];
}

/**
 * Build the head for a seed string (initials, usually).
 *
 * Every variant only ADDS or CLEARS whole cells — nothing here can produce a
 * grid of another size, so the renderer's scale arithmetic is safe by
 * construction.
 */
export function buildHead(seed: string): HeadSprite {
  const h = hashSeed(seed || "U");
  const hair = h % 4;
  const glasses = ((h >> 3) & 1) === 1;
  const beard = ((h >> 5) & 1) === 1;
  const antenna = ((h >> 7) & 1) === 1;
  const grid = baseGrid();

  if (hair === 1) {
    // Spiked: bite the crown into teeth.
    grid[0] = [O, O, I, O, I, O, I, O, I, O, O];
    grid[1] = [O, I, I, I, I, O, I, I, I, I, O];
  } else if (hair === 2) {
    // Long: sideburns down past the jaw.
    for (const r of [5, 6, 7, 8, 9]) {
      grid[r]![0] = I;
      grid[r]![10] = I;
    }
    grid[10]![0] = I;
    grid[10]![10] = I;
  } else if (hair === 3) {
    // Bald: the crown recedes and the brow shows.
    grid[0] = [O, O, O, I, I, I, I, I, O, O, O];
    grid[1] = [O, O, I, I, I, I, I, I, I, O, O];
  }

  if (glasses) {
    // Frames: widen both eye holes by a column and bridge them with ink.
    for (const r of [5, 6]) {
      grid[r]![1] = O;
      grid[r]![9] = O;
    }
    grid[5]![5] = I;
  }
  if (beard) {
    grid[9] = [I, I, I, I, I, I, I, I, I, I, I];
    grid[10] = [O, I, I, I, I, I, I, I, I, I, O];
    grid[8] = [I, I, I, I, O, O, O, I, I, I, I];
  }
  if (antenna) {
    grid[0]![5] = I;
    grid[1]![5] = I;
  }

  // The eye holes, taken from the finished grid rather than assumed — a hair
  // variant that ever filled one would otherwise leave a beam with no socket.
  const eyes: { col: number; row: number }[] = [];
  for (const row of [5, 6]) {
    for (let col = 1; col <= 9; col++) {
      if (grid[row]![col] === O && col !== 5) eyes.push({ col, row });
    }
  }

  return { grid, eyes, traits: { hair, glasses, beard, antenna } };
}

/**
 * 3×5 bitmap font for the HUD, one hex nibble per row (bit 2 = leftmost).
 *
 * Small enough to keep the score crisp at 1:1 device pixels, which a webfont
 * at 8px is not — the T-Rex score is a bitmap for the same reason.
 */
const FONT: Record<string, number[]> = {
  "0": [0x7, 0x5, 0x5, 0x5, 0x7],
  "1": [0x2, 0x6, 0x2, 0x2, 0x7],
  "2": [0x7, 0x1, 0x7, 0x4, 0x7],
  "3": [0x7, 0x1, 0x3, 0x1, 0x7],
  "4": [0x5, 0x5, 0x7, 0x1, 0x1],
  "5": [0x7, 0x4, 0x7, 0x1, 0x7],
  "6": [0x7, 0x4, 0x7, 0x5, 0x7],
  "7": [0x7, 0x1, 0x1, 0x2, 0x2],
  "8": [0x7, 0x5, 0x7, 0x5, 0x7],
  "9": [0x7, 0x5, 0x7, 0x1, 0x7],
  A: [0x7, 0x5, 0x7, 0x5, 0x5],
  B: [0x6, 0x5, 0x6, 0x5, 0x6],
  C: [0x7, 0x4, 0x4, 0x4, 0x7],
  D: [0x6, 0x5, 0x5, 0x5, 0x6],
  E: [0x7, 0x4, 0x7, 0x4, 0x7],
  F: [0x7, 0x4, 0x7, 0x4, 0x4],
  G: [0x7, 0x4, 0x5, 0x5, 0x7],
  H: [0x5, 0x5, 0x7, 0x5, 0x5],
  I: [0x7, 0x2, 0x2, 0x2, 0x7],
  J: [0x1, 0x1, 0x1, 0x5, 0x7],
  K: [0x5, 0x5, 0x6, 0x5, 0x5],
  L: [0x4, 0x4, 0x4, 0x4, 0x7],
  M: [0x5, 0x7, 0x7, 0x5, 0x5],
  N: [0x5, 0x7, 0x7, 0x7, 0x5],
  O: [0x7, 0x5, 0x5, 0x5, 0x7],
  P: [0x7, 0x5, 0x7, 0x4, 0x4],
  Q: [0x7, 0x5, 0x5, 0x7, 0x3],
  R: [0x7, 0x5, 0x7, 0x6, 0x5],
  S: [0x7, 0x4, 0x7, 0x1, 0x7],
  T: [0x7, 0x2, 0x2, 0x2, 0x2],
  U: [0x5, 0x5, 0x5, 0x5, 0x7],
  V: [0x5, 0x5, 0x5, 0x5, 0x2],
  W: [0x5, 0x5, 0x7, 0x7, 0x5],
  X: [0x5, 0x5, 0x2, 0x5, 0x5],
  Y: [0x5, 0x5, 0x2, 0x2, 0x2],
  Z: [0x7, 0x1, 0x2, 0x4, 0x7],
  " ": [0x0, 0x0, 0x0, 0x0, 0x0],
  "·": [0x0, 0x0, 0x2, 0x0, 0x0],
  "!": [0x2, 0x2, 0x2, 0x0, 0x2],
  "?": [0x7, 0x1, 0x3, 0x0, 0x2],
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;

/** Lit cells for a string, in glyph-grid coordinates (x right, y down). */
export function textCells(text: string): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  const chars = text.toUpperCase().split("");
  chars.forEach((ch, i) => {
    const rows = FONT[ch] ?? FONT["?"]!;
    rows.forEach((bits, r) => {
      for (let c = 0; c < GLYPH_W; c++) {
        if (bits & (1 << (GLYPH_W - 1 - c))) {
          cells.push({ x: i * (GLYPH_W + 1) + c, y: r });
        }
      }
    });
  });
  return cells;
}

/** Width in glyph cells of `text` — the renderer's right-align arithmetic. */
export function textWidth(text: string): number {
  return text.length ? text.length * (GLYPH_W + 1) - 1 : 0;
}
