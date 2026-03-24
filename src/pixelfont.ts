// Pixel font: each letter is a 5x7 grid of 0s and 1s
// Rendered as chunky blocks with inner offset for layered depth effect

const GLYPHS: Record<string, number[][]> = {
  L: [
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1],
  ],
  A: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  S: [
    [0,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [0,1,1,1,0],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [1,1,1,1,0],
  ],
  E: [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1],
  ],
  R: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  H: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  D: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
  ],
  C: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  O: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  N: [
    [1,0,0,0,1],
    [1,1,0,0,1],
    [1,0,1,0,1],
    [1,0,1,0,1],
    [1,0,0,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  T: [
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
  ],
  G: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,0],
    [1,0,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  M: [
    [1,0,0,0,1],
    [1,1,0,1,1],
    [1,0,1,0,1],
    [1,0,1,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  V: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,0,1,0],
    [0,1,0,1,0],
    [0,0,1,0,0],
  ],
  " ": [
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
  ],
};

const BLOCK_SIZE = 10;
const INNER_OFFSET = 2;
const GAP = 2; // gap between blocks
const LETTER_GAP = 6; // extra gap between letters
const FILL_COLOR = "#ff2020";
const INNER_COLOR = "#cc1100";
const OUTLINE_COLOR = "#8a0a00";

export function getPixelTextWidth(text: string): number {
  const stride = BLOCK_SIZE + GAP;
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    width += 5 * stride + LETTER_GAP;
  }
  return width - LETTER_GAP; // no trailing letter gap
}

export function getPixelTextHeight(): number {
  return 7 * (BLOCK_SIZE + GAP) - GAP;
}

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  startX: number,
  startY: number,
) {
  const stride = BLOCK_SIZE + GAP;
  let cursorX = startX;

  for (const char of text) {
    const glyph = GLYPHS[char];
    if (!glyph) { cursorX += 5 * stride + LETTER_GAP; continue; }

    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (!glyph[row][col]) continue;
        const x = cursorX + col * stride;
        const y = startY + row * stride;

        // Outer block
        ctx.fillStyle = OUTLINE_COLOR;
        ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);

        // Main fill
        ctx.fillStyle = FILL_COLOR;
        ctx.fillRect(x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

        // Inner offset rectangle (the layered depth effect)
        ctx.fillStyle = INNER_COLOR;
        ctx.fillRect(
          x + INNER_OFFSET,
          y + INNER_OFFSET,
          BLOCK_SIZE - INNER_OFFSET * 2,
          BLOCK_SIZE - INNER_OFFSET * 2,
        );

        // Highlight on top-left edge
        ctx.fillStyle = FILL_COLOR;
        ctx.fillRect(x + INNER_OFFSET, y + INNER_OFFSET, BLOCK_SIZE - INNER_OFFSET * 2 - 1, 1);
        ctx.fillRect(x + INNER_OFFSET, y + INNER_OFFSET, 1, BLOCK_SIZE - INNER_OFFSET * 2 - 1);
      }
    }

    cursorX += 5 * stride + LETTER_GAP;
  }
}

export function renderPixelTitle(text: string): HTMLCanvasElement {
  const width = getPixelTextWidth(text);
  const height = getPixelTextHeight();
  const padding = 8;

  const canvas = document.createElement("canvas");
  canvas.width = width + padding * 2;
  canvas.height = height + padding * 2;

  const ctx = canvas.getContext("2d")!;
  drawPixelText(ctx, text, padding, padding);

  return canvas;
}
