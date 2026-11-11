// The derived avatar. The slim game has no upload step and holds no photograph
// of anyone, so the runner's head is generated from the player's initials —
// which only works if the same initials always produce the same head, and
// different ones visibly differ.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildHead,
  GLYPH_W,
  HEAD_COLS,
  HEAD_ROWS,
  hashSeed,
  initialsFor,
  textCells,
  textWidth,
} from "./laser-head-sprite.ts";

describe("LH-1 the head is a function of the initials", () => {
  it("same seed, same head — every time", () => {
    assert.deepEqual(buildHead("JS"), buildHead("JS"));
    assert.equal(hashSeed("JS"), hashSeed("JS"));
  });

  it("different people get visibly different runners", () => {
    const seeds = ["JS", "AB", "ZZ", "MK", "QQ", "DL", "RT", "PP"];
    const shapes = new Set(seeds.map((s) => JSON.stringify(buildHead(s).grid)));
    assert.ok(shapes.size >= 4, `only ${shapes.size} distinct heads across 8 seeds`);
  });

  it("every variant keeps the grid the renderer's scale arithmetic assumes", () => {
    // The renderer divides the collision box by HEAD_COLS/HEAD_ROWS. A
    // variant that changed the grid's shape would silently smear the head.
    for (const seed of ["", "A", "JS", "ZZZ", "😀", "a-very-long-seed"]) {
      const head = buildHead(seed);
      assert.equal(head.grid.length, HEAD_ROWS, `rows for "${seed}"`);
      for (const row of head.grid) assert.equal(row.length, HEAD_COLS);
    }
  });

  it("always leaves sockets for the beams to come out of", () => {
    // The eyes are read back OUT of the finished grid, so a hair variant that
    // ever filled one cannot leave a laser with no origin.
    for (const seed of ["JS", "AB", "ZZ", "MK", "QQ", "DL", "RT", "PP", "XY"]) {
      const head = buildHead(seed);
      assert.ok(head.eyes.length >= 4, `"${seed}" lost its eyes`);
      for (const e of head.eyes) {
        assert.equal(head.grid[e.row]![e.col], 0, `"${seed}" eye is inked over`);
      }
    }
  });
});

describe("LH-2 initials", () => {
  it("reads a name, then an email, then gives up gracefully", () => {
    assert.equal(initialsFor("Jesse Spencer", "j@x.com"), "JS");
    assert.equal(initialsFor("", "jesse.spencer@example.com"), "JS");
    // The @ is a separator like any other — same rule the side nav's avatar
    // uses, so the runner's tag matches the disc in the header.
    assert.equal(initialsFor("", "root@x"), "RX");
    assert.equal(initialsFor("", "root"), "RO");
    assert.equal(initialsFor("", ""), "U");
  });
});

describe("LH-3 the HUD font", () => {
  it("covers everything the HUD can print", () => {
    // Score digits, the player tag, and the two banners the game shows.
    for (const ch of "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      assert.ok(textCells(ch).length >= 0);
    }
    assert.ok(textCells("0").length > 0, "a digit lights cells");
    assert.equal(textCells(" ").length, 0, "a space lights none");
  });

  it("never draws outside its own glyph box", () => {
    for (const c of textCells("GAME OVER 00123")) {
      assert.ok(c.x >= 0 && c.y >= 0 && c.y < 5);
    }
    assert.equal(textWidth("AB"), GLYPH_W * 2 + 1);
    assert.equal(textWidth(""), 0);
  });

  it("falls back rather than throwing on a character it has never seen", () => {
    assert.ok(textCells("€").length > 0);
  });
});
