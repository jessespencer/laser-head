// The rules of Laser Head Slim, asserted where they can be: the world is
// plain arithmetic on plain objects, so the flight model, the fairness of the
// spawner, the combo and the three lives are all checkable in bare Node — no
// DOM, no canvas, no bundler. That the renderer is NOT checkable here is the
// whole reason the rules do not live in it.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALIENS,
  alienBox,
  COMBO_WINDOW,
  createWorld,
  eyeOrigin,
  FIELD_BOTTOM,
  FIELD_TOP,
  FIRE_RATE,
  gameMustYield,
  gapFloorPx,
  HEAD_H,
  INVITE_AFTER_S,
  INVULN_TICKS,
  LIVES,
  MAX_MULTIPLIER,
  MAX_SPEED,
  playerBox,
  PLAYER_SPEED,
  PX_PER_POINT,
  shouldOfferGame,
  START_SPEED,
  step,
  totalScore,
  VIEW_W,
  type Alien,
  type AlienKind,
  type Input,
  type World,
} from "./laser-runner.ts";

const IDLE: Input = { up: false, down: false, fire: false };
const inp = (p: Partial<Input>): Input => ({ ...IDLE, ...p });

/** Run n ticks with one held input. */
function run(w: World, n: number, input: Input = IDLE): World {
  for (let i = 0; i < n; i++) step(w, input);
  return w;
}

/** A world with an empty sky — the spawner disarmed so a scenario can place
 *  exactly the alien it is about. */
function clear(w: World): World {
  w.aliens = [];
  w.spawnIn = Number.MAX_SAFE_INTEGER;
  return w;
}

/** An alien parked dead ahead of the head's eyes, with no bob to dodge with. */
function ahead(w: World, kind: AlienKind, x = 300): Alien {
  const def = ALIENS[kind];
  const a: Alien = {
    id: 900,
    kind,
    x,
    baseY: eyeOrigin(w).y - def.size / 2,
    size: def.size,
    hp: def.hp,
    phase: 0,
    bob: 0,
    rush: def.rush,
    points: def.points,
  };
  w.aliens.push(a);
  return a;
}

describe("LR-1 the head flies — no gravity, no jumping, no sideways", () => {
  it("climbs and dives while the key is held", () => {
    const w = clear(createWorld(7));
    const start = w.playerY;
    run(w, 10, inp({ up: true }));
    // Float accumulation, not a rounded position — compare with a tolerance.
    assert.ok(
      Math.abs(w.playerY - (start - PLAYER_SPEED * 10)) < 0.001,
      "up is held thrust",
    );
    run(w, 20, inp({ down: true }));
    assert.ok(w.playerY > start, "and down brings it back past where it began");
  });

  it("stops at the ceiling and the floor, never inside them", () => {
    const w = clear(createWorld(7));
    run(w, 300, inp({ up: true }));
    assert.equal(w.playerY, FIELD_TOP, "the HUD line is a hard ceiling");
    run(w, 300, inp({ down: true }));
    assert.equal(w.playerY, FIELD_BOTTOM - HEAD_H, "the floor is a hard floor");
    assert.equal(playerBox(w).y + playerBox(w).h, FIELD_BOTTOM);
  });

  it("does not drift when nothing is held — the head hovers", () => {
    const w = clear(createWorld(7));
    const y = w.playerY;
    run(w, 120);
    assert.equal(w.playerY, y, "no gravity anywhere in this game");
  });
});

describe("LR-2 the eyes", () => {
  it("fires straight ahead while the trigger is held, paced by FIRE_RATE", () => {
    const w = clear(createWorld(9));
    step(w, inp({ fire: true }));
    assert.equal(w.shots.length, 2, "two eyes, two beams");
    // Held: the next volley waits out the rate, it does not stream.
    run(w, FIRE_RATE - 1, inp({ fire: true }));
    assert.equal(w.shots.length, 2, "still one volley inside the window");
    step(w, inp({ fire: true }));
    assert.equal(w.shots.length, 4, "and a second one once it lapses");
  });

  it("beams travel level — lining the head up IS the game", () => {
    const w = clear(createWorld(9));
    const eye = eyeOrigin(w);
    step(w, inp({ fire: true }));
    run(w, 6, IDLE);
    for (const s of w.shots) {
      assert.ok(Math.abs(s.y - eye.y) <= 2, "no homing, no arc");
      assert.ok(s.x > eye.x, "and they go forwards");
    }
  });

  it("kills a scout in one, and a tank in four", () => {
    for (const [kind, beams] of [
      ["scout", 1],
      ["drone", 2],
      ["tank", 4],
    ] as const) {
      const w = clear(createWorld(9));
      ahead(w, kind, 420);
      for (let i = 0; i < beams; i++) {
        step(w, inp({ fire: true }));
        run(w, FIRE_RATE, IDLE);
      }
      run(w, 40, IDLE);
      assert.equal(w.aliens.length, 0, `${kind} should die to ${beams} volleys`);
    }
  });

  it("misses what it is not lined up with", () => {
    const w = clear(createWorld(9));
    ahead(w, "scout", 300);
    run(w, 14, inp({ up: true })); // climb well clear of it
    step(w, inp({ fire: true }));
    run(w, 30, IDLE);
    assert.equal(w.aliens.length, 1, "the beam went over its head");
    assert.equal(w.kills, 0);
  });
});

describe("LR-3 the combo", () => {
  it("builds on consecutive kills, caps, and decays when they stop", () => {
    const w = clear(createWorld(3));
    for (let i = 0; i < 24; i++) {
      ahead(w, "scout", 200);
      step(w, inp({ fire: true }));
      run(w, 30, IDLE);
    }
    assert.equal(w.multiplier, MAX_MULTIPLIER, "it tops out, and stays there");
    run(w, COMBO_WINDOW + 2, IDLE);
    assert.equal(w.multiplier, 1, "and lapses back once the window closes");
    assert.equal(w.combo, 0);
  });

  it("pays the kill at the multiplier it was earned with", () => {
    const w = clear(createWorld(3));
    ahead(w, "scout", 200);
    step(w, inp({ fire: true }));
    run(w, 30, IDLE);
    assert.equal(w.score, ALIENS.scout.points, "first kill is worth 1×");
    assert.ok(w.multiplier >= 1);
  });
});

describe("LR-4 three lives, then it is over", () => {
  it("costs a life per hit and ends the run on the third", () => {
    const w = clear(createWorld(5));
    for (let i = 1; i <= LIVES; i++) {
      ahead(w, "scout", playerBox(w).x + 2);
      w.invuln = 0;
      step(w, IDLE);
      assert.equal(w.lives, LIVES - i, `hit ${i} costs a life`);
    }
    assert.equal(w.over, true, "and the third ends it");
  });

  it("gives mercy frames, so one body cannot take two lives", () => {
    const w = clear(createWorld(5));
    const a = ahead(w, "tank", playerBox(w).x + 2);
    a.rush = 0;
    step(w, IDLE);
    assert.equal(w.lives, LIVES - 1);
    assert.ok(w.invuln > 0, "the window opens on the hit");
    // The alien that hit is removed, and nothing else can land while blinking.
    ahead(w, "tank", playerBox(w).x + 2);
    run(w, 3, IDLE);
    assert.equal(w.lives, LIVES - 1, "still one hit, not four");
    assert.ok(w.invuln <= INVULN_TICKS);
  });

  it("resets the combo on a hit — the multiplier is a streak, not a bank", () => {
    const w = clear(createWorld(5));
    for (let i = 0; i < 6; i++) {
      ahead(w, "scout", 200);
      step(w, inp({ fire: true }));
      run(w, 30, IDLE);
    }
    assert.ok(w.multiplier > 1);
    ahead(w, "scout", playerBox(w).x + 2);
    w.invuln = 0;
    step(w, IDLE);
    assert.equal(w.multiplier, 1);
  });

  it("freezes once it is over", () => {
    const w = clear(createWorld(5));
    w.lives = 1;
    ahead(w, "scout", playerBox(w).x + 2);
    w.invuln = 0;
    step(w, IDLE);
    assert.equal(w.over, true);
    const frozen = { score: totalScore(w), tick: w.tick, y: w.playerY };
    run(w, 60, inp({ up: true, fire: true }));
    assert.deepEqual(
      { score: totalScore(w), tick: w.tick, y: w.playerY },
      frozen,
      "a finished run does not keep scoring or moving",
    );
  });
});

describe("LR-5 the spawner is measured in pixels, and stays dodgeable", () => {
  it("leaves room to cross the field before the next wave, at FULL speed", () => {
    // The invariant the constants exist for: the head has to be able to get
    // out of the way, or the only counter left is shooting — and a tank takes
    // four volleys.
    const crossTicks = (FIELD_BOTTOM - FIELD_TOP - HEAD_H) / PLAYER_SPEED;
    assert.ok(
      gapFloorPx(MAX_SPEED) >= crossTicks * MAX_SPEED,
      "the gap floor must cover a full crossing",
    );
    assert.ok(gapFloorPx(MAX_SPEED) > gapFloorPx(START_SPEED), "and it scales");
  });

  it("holds that floor in PIXELS once the ramp has topped out", () => {
    const w = createWorld(11);
    // Survive on paper: this is about the geometry of what arrives, not about
    // being good at the game.
    for (let i = 0; i < 20_000; i++) {
      step(w, IDLE);
      w.lives = LIVES;
      w.over = false;
    }
    assert.equal(w.speed, MAX_SPEED, "the ramp tops out");
    const spawnedAt: number[] = [];
    for (let i = 0; i < 4000; i++) {
      const beforeId = w.nextId;
      step(w, IDLE);
      w.lives = LIVES;
      w.over = false;
      if (w.nextId > beforeId) spawnedAt.push(w.distance);
    }
    assert.ok(spawnedAt.length >= 4, "several waves in 4000 ticks");
    for (let i = 1; i < spawnedAt.length; i++) {
      const gap = spawnedAt[i]! - spawnedAt[i - 1]!;
      assert.ok(
        gap >= gapFloorPx(MAX_SPEED) - 1,
        `wave ${i} arrived ${Math.round(gap)}px later — under the floor ${gapFloorPx(MAX_SPEED)}`,
      );
    }
  });

  it("never spawns an alien whose bob carries it into the HUD or the floor", () => {
    const w = createWorld(21);
    for (let i = 0; i < 12_000; i++) {
      step(w, IDLE);
      w.lives = LIVES;
      w.over = false;
      for (const a of w.aliens) {
        // Sampled at the extremes of its own bob, not just where it is now.
        for (const phase of [a.phase, a.phase + 14, a.phase + 28]) {
          const box = alienBox({ ...a, phase });
          assert.ok(box.y >= FIELD_TOP - 1, "above the HUD line");
          assert.ok(box.y + box.h <= FIELD_BOTTOM + 1, "below the floor");
        }
      }
    }
  });

  it("ramps from START_SPEED and never past MAX_SPEED", () => {
    const w = clear(createWorld(3));
    assert.equal(w.speed, START_SPEED);
    run(w, 200);
    assert.ok(w.speed > START_SPEED, "it accelerates");
    run(w, 20_000);
    assert.equal(w.speed, MAX_SPEED, "and it stops accelerating");
  });

  it("sends only scouts at the start, and tanks only once you have earned them", () => {
    const w = createWorld(31);
    const early = new Set<AlienKind>();
    for (let i = 0; i < 600; i++) {
      step(w, IDLE);
      w.lives = LIVES;
      w.over = false;
      for (const a of w.aliens) early.add(a.kind);
    }
    assert.deepEqual([...early], ["scout"], "the first minute is scouts only");
  });
});

describe("LR-6 the score", () => {
  it("counts distance survived as well as kills, and only goes up", () => {
    const w = clear(createWorld(4));
    let last = 0;
    for (let i = 0; i < 600; i++) {
      step(w, IDLE);
      assert.ok(totalScore(w) >= last, "monotonic");
      last = totalScore(w);
    }
    assert.equal(totalScore(w), Math.floor(w.distance / PX_PER_POINT));
    assert.ok(last > 0, "surviving is worth something on its own");
  });
});

describe("LR-7 the world is replayable", () => {
  it("same seed, same inputs, same run — the spawner has no hidden clock", () => {
    const a = createWorld(1234);
    const b = createWorld(1234);
    for (let i = 0; i < 1500; i++) {
      const input = inp({ up: i % 53 < 12, down: i % 91 < 9, fire: i % 7 === 0 });
      step(a, input);
      step(b, input);
    }
    assert.equal(totalScore(a), totalScore(b));
    assert.equal(a.over, b.over);
    assert.deepEqual(
      a.aliens.map((x) => [x.kind, Math.round(x.x), Math.round(x.baseY)]),
      b.aliens.map((x) => [x.kind, Math.round(x.x), Math.round(x.baseY)]),
    );
  });

  it("spawns at the right edge, and reaps what leaves at the left", () => {
    const w = createWorld(77);
    for (let i = 0; i < 3000; i++) {
      step(w, IDLE);
      w.lives = LIVES;
      w.over = false;
      for (const a of w.aliens) {
        assert.ok(a.x <= VIEW_W, "nothing appears mid-field");
        assert.ok(a.x + a.size > -20, "and nothing lingers off the left");
      }
    }
  });
});

describe("LR-8 when the host offers the game", () => {
  const base = {
    enabled: true,
    working: true,
    elapsedS: INVITE_AFTER_S,
    dismissed: false,
    playing: false,
    needsHuman: false,
  };

  it("only after two minutes, and only while something is actually working", () => {
    assert.equal(INVITE_AFTER_S, 120);
    assert.equal(shouldOfferGame(base), true);
    assert.equal(shouldOfferGame({ ...base, elapsedS: INVITE_AFTER_S - 1 }), false);
    assert.equal(shouldOfferGame({ ...base, working: false }), false);
  });

  it("takes no for an answer, and does not offer what is already open", () => {
    assert.equal(shouldOfferGame({ ...base, elapsedS: 300, dismissed: true }), false);
    assert.equal(shouldOfferGame({ ...base, elapsedS: 300, playing: true }), false);
  });

  it("says nothing at all when the reader has switched the arcade off", () => {
    // User preferences → Arcade. Off means off: no elapsed time, no idle
    // turn, nothing else here can put the card back on the screen.
    assert.equal(
      shouldOfferGame({ ...base, enabled: false, elapsedS: 86_400 }),
      false,
    );
  });

  it("never offers while something is waiting on the human", () => {
    // A question parked on the reader makes the offer's premise ("nothing for
    // you to do right now") false — however long the turn has been running.
    assert.equal(
      shouldOfferGame({ ...base, elapsedS: 3600, needsHuman: true }),
      false,
    );
  });
});

describe("LR-9 the game yields to the human in the loop", () => {
  it("an OPEN game closes the moment something needs an answer", () => {
    // Suppressing the offer is not enough once the modal is up: it is a focus
    // trap over the transcript, so a decision card, a gate ask or an
    // interview question behind it would be unreachable, not just ignored.
    assert.equal(gameMustYield({ playing: true, needsHuman: true }), true);
  });

  it("and does not close for anything else", () => {
    assert.equal(gameMustYield({ playing: true, needsHuman: false }), false);
    assert.equal(gameMustYield({ playing: false, needsHuman: true }), false);
  });
});
