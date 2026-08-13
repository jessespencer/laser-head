/**
 * Laser Head Slim — the world, with no canvas in it.
 *
 * The mini version: your head hovers at a fixed x, you fly it UP and DOWN to
 * line your eyes up with what is coming, and you hold the trigger to fire two
 * horizontal beams out of them. Three lives, a combo multiplier that builds on
 * consecutive kills and decays if you stop landing them, and enemy types that
 * differ in size, speed and hit points.
 *
 * Two ancestors, deliberately:
 *
 *  - **Laser Head** (the mechanics) — the full-screen game in this repo.
 *  - **The T-Rex runner** (the shape): endless, one screen wide, speed ramping
 *    forever, nothing to collect and nowhere to go — you just last longer.
 *
 * There is no jumping and no gravity: the head FLIES. Left and right do
 * nothing on purpose — the horizontal axis belongs to the world.
 *
 * Everything here is arithmetic on plain objects: no DOM, no rAF, no images,
 * no `Date.now()`. The renderer owns all of that and calls `step` once per
 * fixed 1/60s tick. That split is what makes the game portable — this file
 * drops into any project, bundler or not, and can be exercised head-lessly.
 *
 * Two rules the numbers here have to keep:
 *
 *  1. Every spawn gap is measured in PIXELS and converted through the CURRENT
 *     speed, never chosen as a tick count. A tick gap that is fair at 3.4
 *     px/tick is a wall at 9.2, and the ramp reaches 9.2 inside a minute.
 *  2. A wave must always be DODGEABLE: the head's climb rate across the field
 *     has to beat the widest enemy's approach, or the only counter left is
 *     shooting, and a tank takes four beams.
 */

export const VIEW_W = 640;
export const VIEW_H = 200;
/** Ceiling — the HUD lives above this line and nothing may overlap it. */
export const SKY_Y = 26;
/** Floor. There is no GROUND here: the field is open space, and this is only
 *  the lower bound of the flight envelope — nothing is drawn on it. */
export const FLOOR_Y = VIEW_H - 10;

export const PLAYER_X = 56;
export const HEAD_W = 22;
export const HEAD_H = 24;
/** Pixels per tick the head climbs or dives. */
export const PLAYER_SPEED = 4.2;

export const START_SPEED = 3.4;
export const MAX_SPEED = 9.2;
/** Speed gained per pixel travelled — roughly 40s to full tilt. */
export const ACCEL = 0.00035;

/** Ticks between beams while the trigger is held (Laser Head's FIRE_RATE). */
export const FIRE_RATE = 5;
export const SHOT_SPEED = 13;

export const LIVES = 3;
/** Ticks of mercy after a hit: blinking, and nothing can touch you. */
export const INVULN_TICKS = 72;
/** Ticks a combo survives without a kill. */
export const COMBO_WINDOW = 150;
export const MAX_MULTIPLIER = 8;

/** Pixels of travel per point of distance score. */
export const PX_PER_POINT = 10;

export type AlienKind = "scout" | "drone" | "tank";

export type AlienDef = {
  size: number;
  hp: number;
  points: number;
  /** Closing speed ADDED to the world speed. */
  rush: number;
  /** Pixels of vertical bob. */
  bob: number;
};

/** The bestiary — Laser Head's own three, re-tuned for a 200px-tall field. */
export const ALIENS: Record<AlienKind, AlienDef> = {
  scout: { size: 18, hp: 1, points: 100, rush: 2.2, bob: 10 },
  drone: { size: 26, hp: 2, points: 250, rush: 1.2, bob: 22 },
  tank: { size: 34, hp: 4, points: 500, rush: 0.4, bob: 6 },
};

export type Alien = {
  id: number;
  kind: AlienKind;
  /** Left edge. */
  x: number;
  /** Centre of the bob, not the current top — see `alienBox`. */
  baseY: number;
  size: number;
  hp: number;
  /** Ticks since spawn: drives the bob and the renderer's wing frames. */
  phase: number;
  bob: number;
  rush: number;
  points: number;
};

export type Shot = { x: number; y: number };

/** Held-key state, sampled by the renderer. Edges are found here, not there. */
export type Input = { up: boolean; down: boolean; fire: boolean };

export type World = {
  tick: number;
  /** RNG state — the world is fully replayable from its seed. */
  rng: number;
  speed: number;
  distance: number;
  score: number;
  kills: number;
  lives: number;
  combo: number;
  comboTimer: number;
  multiplier: number;
  /** Top edge of the head. The head flies; there is no gravity. */
  playerY: number;
  /** Ticks of invulnerability left after a hit. */
  invuln: number;
  cooldown: number;
  aliens: Alien[];
  shots: Shot[];
  /** Pixels of travel until the next spawn. */
  spawnIn: number;
  nextId: number;
  over: boolean;
  /** Ticks left on the hit shake — cosmetic. */
  flash: number;
  /** Ticks left on the eye glow after a beam — cosmetic. */
  glow: number;
};

export type Box = { x: number; y: number; w: number; h: number };

/** mulberry32 — small, seedable, and good enough for spawning aliens. */
function rand(w: World): number {
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = w.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Vertical room the head has to work with. */
export const FIELD_TOP = SKY_Y;
export const FIELD_BOTTOM = FLOOR_Y;

/**
 * The pixel gap between waves, at the current difficulty.
 *
 * Bounded below by the DODGE budget rather than by taste: the head needs
 * enough ticks to cross the field before the next thing arrives, or a wave
 * that spawns opposite you is unavoidable. The floor is that crossing time in
 * pixels at the closing speed, and it holds at every speed because the whole
 * quantity is recomputed from `speed`.
 */
export function gapFloorPx(speed: number): number {
  const crossTicks = (FIELD_BOTTOM - FIELD_TOP - HEAD_H) / PLAYER_SPEED;
  return Math.ceil(crossTicks * (speed + ALIENS.tank.rush)) + ALIENS.tank.size;
}

export function createWorld(seed = 1): World {
  return {
    tick: 0,
    rng: seed | 0,
    speed: START_SPEED,
    distance: 0,
    score: 0,
    kills: 0,
    lives: LIVES,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    playerY: Math.round((FIELD_TOP + FIELD_BOTTOM - HEAD_H) / 2),
    invuln: 0,
    cooldown: 0,
    aliens: [],
    shots: [],
    spawnIn: 300,
    nextId: 1,
    over: false,
    flash: 0,
    glow: 0,
  };
}

/** The head's collision box. */
export function playerBox(w: World): Box {
  return { x: PLAYER_X, y: w.playerY, w: HEAD_W, h: HEAD_H };
}

/** Where the beams leave the face — front of the head, eye height. */
export function eyeOrigin(w: World): { x: number; y: number } {
  return { x: PLAYER_X + HEAD_W - 4, y: w.playerY + 11 };
}

/** An alien's box THIS tick — the bob is part of its position, so a shot
 *  aimed at where it was is a shot that misses. */
export function alienBox(a: Alien): Box {
  const y = a.baseY + Math.sin(a.phase / 18) * a.bob;
  return { x: a.x, y, w: a.size, h: a.size };
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/** What the sky is allowed to send, by how far you have got. */
function pickKind(w: World): AlienKind {
  const roll = rand(w);
  if (w.score < 400) return "scout";
  if (w.score < 1200) return roll < 0.7 ? "scout" : "drone";
  if (roll < 0.45) return "scout";
  if (roll < 0.8) return "drone";
  return "tank";
}

function spawn(w: World): void {
  const kind = pickKind(w);
  const def = ALIENS[kind];
  // Clamped so the bob can never carry it into the HUD or under the floor.
  const lo = FIELD_TOP + def.bob;
  const hi = FIELD_BOTTOM - def.size - def.bob;
  const baseY = lo + rand(w) * Math.max(1, hi - lo);
  w.aliens.push({
    id: w.nextId++,
    kind,
    x: VIEW_W,
    baseY,
    size: def.size,
    hp: def.hp,
    phase: Math.floor(rand(w) * 100),
    bob: def.bob,
    rush: def.rush,
    points: def.points,
  });
}

function fire(w: World): void {
  const eye = eyeOrigin(w);
  // Two eyes, two beams, three pixels apart — straight ahead, always. Lining
  // them up is the game; nothing here aims for you.
  w.shots.push({ x: eye.x, y: eye.y - 2 });
  w.shots.push({ x: eye.x, y: eye.y + 2 });
  w.cooldown = FIRE_RATE;
  w.glow = 6;
}

/** A hit: one life, the combo, and a shake. Death is running out of lives. */
function takeHit(w: World): void {
  w.lives -= 1;
  w.combo = 0;
  w.comboTimer = 0;
  w.multiplier = 1;
  w.flash = 16;
  w.invuln = INVULN_TICKS;
  if (w.lives <= 0) {
    w.lives = 0;
    w.over = true;
  }
}

/**
 * One tick of the world, at a fixed 1/60s. Mutates and returns `w` — the
 * renderer holds one world for the life of a run and never diffs it.
 */
export function step(w: World, input: Input): World {
  if (w.over) return w;
  w.tick += 1;
  w.speed = Math.min(MAX_SPEED, START_SPEED + w.distance * ACCEL);
  w.distance += w.speed;
  if (w.flash > 0) w.flash -= 1;
  if (w.glow > 0) w.glow -= 1;
  if (w.invuln > 0) w.invuln -= 1;

  // ── the head flies ────────────────────────────────────────────────────
  if (input.up) w.playerY -= PLAYER_SPEED;
  if (input.down) w.playerY += PLAYER_SPEED;
  w.playerY = Math.max(FIELD_TOP, Math.min(FIELD_BOTTOM - HEAD_H, w.playerY));

  // ── the eyes ──────────────────────────────────────────────────────────
  if (w.cooldown > 0) w.cooldown -= 1;
  // Held, not tapped: Laser Head's trigger is continuous, paced by FIRE_RATE.
  if (input.fire && w.cooldown === 0) fire(w);

  // ── the sky closes in ─────────────────────────────────────────────────
  for (const a of w.aliens) {
    a.x -= w.speed + a.rush;
    a.phase += 1;
  }
  w.aliens = w.aliens.filter((a) => a.x + a.size > -20);

  for (const s of w.shots) s.x += SHOT_SPEED;
  w.shots = w.shots.filter((s) => s.x < VIEW_W + 20);

  // ── beams meet aliens ─────────────────────────────────────────────────
  for (const s of w.shots) {
    const sb: Box = { x: s.x - 5, y: s.y - 1, w: 10, h: 3 };
    for (const a of w.aliens) {
      if (a.hp <= 0) continue;
      if (!overlaps(sb, alienBox(a))) continue;
      a.hp -= 1;
      s.x = VIEW_W + 999; // spent — filtered below
      if (a.hp <= 0) {
        w.kills += 1;
        // Consecutive kills build the multiplier; the window is what makes
        // "consecutive" mean anything. Score is banked at the CURRENT
        // multiplier, then the kill raises it for the next one.
        w.score += a.points * w.multiplier;
        w.combo += 1;
        w.comboTimer = COMBO_WINDOW;
        w.multiplier = Math.min(MAX_MULTIPLIER, 1 + Math.floor(w.combo / 2));
      }
      break;
    }
  }
  w.aliens = w.aliens.filter((a) => a.hp > 0);
  w.shots = w.shots.filter((s) => s.x < VIEW_W + 20);

  // ── the combo decays ──────────────────────────────────────────────────
  if (w.comboTimer > 0) {
    w.comboTimer -= 1;
    if (w.comboTimer === 0) {
      w.combo = 0;
      w.multiplier = 1;
    }
  }

  // ── spawning, in pixels ───────────────────────────────────────────────
  w.spawnIn -= w.speed;
  if (w.spawnIn <= 0) {
    spawn(w);
    const floor = gapFloorPx(w.speed);
    w.spawnIn = floor + rand(w) * floor * 0.6;
  }

  // ── contact ───────────────────────────────────────────────────────────
  if (w.invuln === 0) {
    const box = playerBox(w);
    for (const a of w.aliens) {
      if (!overlaps(box, alienBox(a))) continue;
      // The alien goes too: surviving a hit only to be hit again by the same
      // body on the next tick is not mercy, it is a stutter.
      a.hp = 0;
      takeHit(w);
      break;
    }
    w.aliens = w.aliens.filter((a) => a.hp > 0);
  }

  return w;
}

/** What the HUD shows: banked kill score plus distance survived. `w.score`
 *  holds kills alone so the multiplier arithmetic has one home. */
export function totalScore(w: World): number {
  return w.score + Math.floor(w.distance / PX_PER_POINT);
}

/** Seconds a job must be running before the host offers a game. Two minutes:
 *  long enough that the wait is real and not a job about to land. */
export const INVITE_AFTER_S = 120;

/** Everything the host app can be doing that involves the human. */
export type GameGate = {
  /** The reader's own switch. Opt-OUT: it is on until someone turns it off,
   *  and when it is off nothing here fires. */
  enabled: boolean;
  /** The host is working — the only condition the game exists for. */
  working: boolean;
  elapsedS: number;
  /** This wait's offer was declined. */
  dismissed: boolean;
  /** The game is already open. */
  playing: boolean;
  /**
   * Something is parked on the reader: a pending decision, a prompt, a
   * confirmation, a notice waiting to be read. The game must never be the
   * reason one of those went unanswered.
   */
  needsHuman: boolean;
};

/**
 * Whether the "insert coin?" banner belongs above the prompt field.
 *
 * Deliberately narrow: it appears only while the host is ACTUALLY working, so
 * a finished job takes the offer away rather than leaving a toy parked over
 * the input. `dismissed` and `playing` are the reader's two ways of saying no
 * more of that — a dismissal should last for the wait it was made in (key it
 * by job), never for the session.
 *
 * `needsHuman` is the one that is not about taste. A question waiting on the
 * reader is the opposite of a wait to be entertained through: the whole
 * premise of the offer ("nothing for you to do right now") is false the
 * moment one exists.
 */
export function shouldOfferGame(s: GameGate): boolean {
  return (
    s.enabled &&
    s.working &&
    !s.needsHuman &&
    !s.dismissed &&
    !s.playing &&
    s.elapsedS >= INVITE_AFTER_S
  );
}

/**
 * Whether an OPEN game has to get out of the way right now.
 *
 * The offer being suppressed is not enough once the modal is up: a modal is a
 * focus trap drawn over the page, so a question arriving behind it is not
 * merely competing for attention — it is unreachable until the game is
 * closed. So the game yields, every time, no matter how good the run was
 * going. Nothing is lost that was not already lost: the high score is banked
 * as the run ends, not as it closes.
 */
export function gameMustYield(s: {
  playing: boolean;
  needsHuman: boolean;
}): boolean {
  return s.playing && s.needsHuman;
}
