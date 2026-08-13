/**
 * Laser Head Slim — the screen.
 *
 * Everything with a clock or a canvas in it lives here; the rules live in
 * `./laser-runner` and the sprite in `./laser-head-sprite`, which is what
 * makes the game testable at all and what lets a host reuse the rules under a
 * renderer of its own.
 *
 * Five things this file is careful about:
 *
 *  - **Fixed timestep.** rAF fires at whatever the display does; the world
 *    only ever advances in 1/60s ticks from an accumulator, so a 120Hz laptop
 *    and a throttled background tab agree on the physics. The accumulator is
 *    clamped, so returning to a backgrounded tab resumes rather than
 *    fast-forwarding into a wall of aliens.
 *  - **It is always night.** The game does not follow the host's theme: an
 *    arcade cabinet is dark, the whole read of the thing is a lit screen in a
 *    dark room, and a white play field would make the lasers invisible. The
 *    palette is the `--lh-arcade-*` layer in `slim.css`, sampled at paint
 *    time, never literals here.
 *  - **No colour literal in this file**, including as a fallback: an
 *    unresolved custom property falls back to another RESOLVED value.
 *  - **The keys are ours while it is open.** Space and the arrows are grabbed
 *    (with preventDefault) so shooting does not scroll the page behind the
 *    modal or press the focused button. They are released on close.
 *  - **The platform owns the modal.** A native `<dialog>` opened with
 *    `showModal()` brings the focus trap, Escape, the inert background and the
 *    top layer with it — which is why this package has no dependencies and
 *    still behaves like a real modal.
 */

import {
  buildHead,
  HEAD_COLS,
  HEAD_ROWS,
  textCells,
  textWidth,
  type HeadSprite,
} from "./laser-head-sprite";
import {
  alienBox,
  createWorld,
  eyeOrigin,
  FIELD_TOP,
  LIVES,
  MAX_MULTIPLIER,
  playerBox,
  step,
  totalScore,
  VIEW_H,
  VIEW_W,
  type Input,
  type World,
} from "./laser-runner";

const TICK_MS = 1000 / 60;
/** Device pixels per world pixel — chunky on purpose. */
const S = 2;
const DEFAULT_HI_KEY = "laser-head.slim.hiscore";

function readHi(key: string | null): number {
  if (!key || typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeHi(key: string | null, value: number): void {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* private mode / quota — the run still counted, it just does not persist */
  }
}

type Palette = {
  void: string;
  ink: string;
  dim: string;
  laser: string;
  scout: string;
  drone: string;
  tank: string;
};

function palette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const inherited = cs.color;
  const pick = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback;
  const ink = pick("--lh-arcade-ink", inherited);
  return {
    void: pick("--lh-arcade-void", "transparent"),
    ink,
    dim: pick("--lh-arcade-dim", ink),
    laser: pick("--lh-arcade-laser", ink),
    scout: pick("--lh-arcade-scout", ink),
    drone: pick("--lh-arcade-drone", ink),
    tank: pick("--lh-arcade-tank", ink),
  };
}

/** Stable pseudo-noise for scenery, keyed on world x so it does not swim. */
function noise(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function paint(
  ctx: CanvasRenderingContext2D,
  w: World,
  head: HeadSprite,
  tag: string,
  hi: number,
  pal: Palette,
  shake: boolean,
): void {
  // Every rect lands on a whole world pixel — position AND size. A sprite
  // unit like 26/9 is fractional, and an unrounded width is how a two-tone
  // pixel game grows soft grey edges at the upscale.
  const px = (x: number, y: number, cw = 1, ch = 1) => {
    const w2 = Math.round(cw);
    const h2 = Math.round(ch);
    if (w2 <= 0 || h2 <= 0) return;
    ctx.fillRect(Math.round(x) * S, Math.round(y) * S, w2 * S, h2 * S);
  };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Cleared before the void goes down, because the palette is allowed to
  // resolve to transparent — a fill alone would stack frames.
  ctx.clearRect(0, 0, VIEW_W * S, VIEW_H * S);
  ctx.fillStyle = pal.void;
  ctx.fillRect(0, 0, VIEW_W * S, VIEW_H * S);
  if (shake && w.flash > 0) {
    const k = w.flash % 2 === 0 ? 1 : -1;
    ctx.setTransform(1, 0, 0, 1, k * 2 * S, 0);
  }

  // ── the sky ───────────────────────────────────────────────────────────
  // Two starfield layers at different parallax. There is no ground line and
  // no floor: the field is open space top to bottom, so the parallax is the
  // ONLY thing carrying speed — which is why there are two layers and not
  // one. `FIELD_BOTTOM` is a flight bound, never a surface.
  ctx.fillStyle = pal.dim;
  for (let i = 0; i < 52; i++) {
    const span = VIEW_W;
    const drift = i % 2 === 0 ? w.distance / 4 : w.distance / 2;
    const x = (((i * 53 - drift) % span) + span) % span;
    const y = FIELD_TOP + noise(i * 3.7) * (VIEW_H - FIELD_TOP - 4);
    px(x, y, 1, 1);
  }
  ctx.fillStyle = pal.ink;
  for (let i = 0; i < 16; i++) {
    const span = VIEW_W;
    const x = (((i * 97 - w.distance) % span) + span) % span;
    const y = FIELD_TOP + noise(i * 9.1 + 0.5) * (VIEW_H - FIELD_TOP - 4);
    px(x, y, 1, 1);
  }

  // ── aliens ────────────────────────────────────────────────────────────
  for (const a of w.aliens) {
    const b = alienBox(a);
    const flap = Math.floor(a.phase / 6) % 2 === 0;
    ctx.fillStyle =
      a.kind === "scout" ? pal.scout : a.kind === "drone" ? pal.drone : pal.tank;
    const u = b.w / 9; // sprite unit — every alien is drawn on a 9×9 grid
    if (a.kind === "scout") {
      // A darting little saucer: dome, hull, two blinking lamps.
      px(b.x + 3 * u, b.y + u, 3 * u, u);
      px(b.x + u, b.y + 2 * u, 7 * u, 2 * u);
      px(b.x, b.y + 4 * u, 9 * u, u);
      px(b.x + 2 * u, b.y + 5 * u, u, flap ? u : 0);
      px(b.x + 6 * u, b.y + 5 * u, u, flap ? 0 : u);
    } else if (a.kind === "drone") {
      // Bigger, with two legs that stride, and an eye that shows as void.
      px(b.x + 2 * u, b.y + u, 5 * u, 5 * u);
      px(b.x, b.y + 3 * u, 2 * u, flap ? 2 * u : u);
      px(b.x + 7 * u, b.y + 3 * u, 2 * u, flap ? u : 2 * u);
      px(b.x + 3 * u, b.y + 6 * u, u, 2 * u);
      px(b.x + 5 * u, b.y + 6 * u, u, 2 * u);
      ctx.fillStyle = pal.void;
      px(b.x + 4 * u, b.y + 3 * u, 2 * u, u);
    } else {
      // A slab that soaks four beams: hull, treads, a jaw that opens.
      px(b.x, b.y + u, 9 * u, 5 * u);
      px(b.x + u, b.y, 7 * u, u);
      px(b.x, b.y + 6 * u, 2 * u, 2 * u);
      px(b.x + 7 * u, b.y + 6 * u, 2 * u, 2 * u);
      ctx.fillStyle = pal.void;
      px(b.x + 2 * u, b.y + 3 * u, 5 * u, flap ? u : 2 * u);
    }
    // Damage: the hull lightens as it loses hit points.
    if (a.hp === 1 && a.kind !== "scout") {
      ctx.fillStyle = pal.dim;
      px(b.x + u, b.y + 2 * u, 2 * u, u);
      px(b.x + 6 * u, b.y + 4 * u, 2 * u, u);
    }
  }

  // ── the head ──────────────────────────────────────────────────────────
  const box = playerBox(w);
  // Blink through the mercy window so a hit is legible without a banner.
  const hidden = w.invuln > 0 && Math.floor(w.invuln / 4) % 2 === 0;
  if (!hidden) {
    const cellW = box.w / HEAD_COLS;
    const cellH = box.h / HEAD_ROWS;
    ctx.fillStyle = pal.ink;
    for (let r = 0; r < HEAD_ROWS; r++) {
      for (let c = 0; c < HEAD_COLS; c++) {
        if (!head.grid[r]![c]) continue;
        px(box.x + c * cellW, box.y + r * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
    // The eyes: void when cold, laser when hot.
    ctx.fillStyle = w.glow > 0 ? pal.laser : pal.void;
    for (const e of head.eyes) {
      px(
        box.x + e.col * cellW,
        box.y + e.row * cellH,
        Math.ceil(cellW),
        Math.ceil(cellH),
      );
    }
    // The thruster puff under a flying head, so it reads as hovering.
    ctx.fillStyle = pal.dim;
    const puff = Math.floor(w.tick / 4) % 2 === 0 ? 2 : 1;
    px(box.x + 6, box.y + box.h, 3, puff);
    px(box.x + box.w - 9, box.y + box.h, 3, 3 - puff);
  }

  // ── beams ─────────────────────────────────────────────────────────────
  for (const s of w.shots) {
    ctx.fillStyle = pal.laser;
    px(s.x - 6, s.y - 1, 8, 2);
    ctx.fillStyle = pal.ink;
    px(s.x - 2, s.y, 2, 1);
  }
  // The muzzle flare, drawn from the eye the beam actually left.
  if (w.glow > 0 && !hidden) {
    const eye = eyeOrigin(w);
    ctx.fillStyle = pal.laser;
    px(eye.x, eye.y - 3, 2, 7);
  }

  // ── HUD ───────────────────────────────────────────────────────────────
  const write = (text: string, x: number, y: number) => {
    for (const c of textCells(text)) px(x + c.x, y + c.y, 1, 1);
  };
  const pad = (n: number) => String(Math.min(99999, n)).padStart(5, "0");
  const score = totalScore(w);
  const right = `${tag} ${pad(score)}`;
  ctx.fillStyle = pal.dim;
  write(`HI ${pad(hi)}`, VIEW_W - textWidth(right) - textWidth("HI 00000") - 20, 10);
  ctx.fillStyle = pal.ink;
  write(right, VIEW_W - textWidth(right) - 8, 10);

  // Lives, as little heads. Spent ones stay as dim outlines — a row that
  // shrinks tells you less than a row that greys out.
  for (let i = 0; i < LIVES; i++) {
    ctx.fillStyle = i < w.lives ? pal.ink : pal.dim;
    const x = 8 + i * 9;
    px(x + 1, 10, 4, 1);
    px(x, 11, 6, 3);
    px(x + 1, 14, 4, 1);
    if (i < w.lives) {
      ctx.fillStyle = pal.laser;
      px(x + 1, 12, 1, 1);
      px(x + 4, 12, 1, 1);
    }
  }
  if (w.multiplier > 1) {
    ctx.fillStyle = w.multiplier >= MAX_MULTIPLIER ? pal.laser : pal.ink;
    write(`X${w.multiplier}`, 8 + LIVES * 9 + 6, 10);
  }

  if (w.over) {
    ctx.fillStyle = pal.ink;
    const over = "GAME OVER";
    write(over, Math.round((VIEW_W - textWidth(over)) / 2), VIEW_H / 2 - 12);
    ctx.fillStyle = pal.dim;
    const again = "SPACE TO FLY AGAIN";
    write(again, Math.round((VIEW_W - textWidth(again)) / 2), VIEW_H / 2 + 2);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export type SlimGameOptions = {
  /** The player's two letters — seeds the head and tags the score. */
  initials?: string;
  /**
   * Whether the job that made this offer has finished — the game says so and
   * offers the way back rather than closing itself out from under the player.
   *
   * Omitted entirely when there is no job behind the game at all (someone
   * opened it cold), which is a THIRD state, not a `false`: "still working in
   * the background" would be a lie there.
   */
  turnDone?: boolean;
  /** Override the status line outright, whatever `turnDone` says. */
  status?: string;
  title?: string;
  /** Called after the dialog closes, however it closed (button, Escape). */
  onClose?: () => void;
  /** Where the `<dialog>` is appended. Defaults to `document.body`. */
  parent?: HTMLElement;
  /**
   * localStorage key for the high score. Pass `null` to keep the run
   * in-memory — useful when several games share a page.
   */
  scoreKey?: string | null;
};

export type SlimGameHandle = {
  /** Close and tear down. Idempotent. */
  close(): void;
  /** Move the status line between its three states without reopening. */
  setTurnDone(done: boolean | undefined): void;
  /** The `<dialog>` itself, for a host that wants to restyle or position it. */
  readonly dialog: HTMLDialogElement;
};

function statusFor(turnDone: boolean | undefined): string {
  if (turnDone === true) {
    return "Your job finished — it is waiting whenever you are.";
  }
  if (turnDone === false) {
    return "Fly up and down, line up your eyes, and burn them. Your job runs on.";
  }
  return "Fly up and down, line up your eyes, and burn them.";
}

/**
 * Open the game. Returns a handle; the dialog tears itself down on close, so
 * a caller that never touches the handle still leaks nothing.
 */
export function openSlimGame(options: SlimGameOptions = {}): SlimGameHandle {
  const initials = (options.initials || "U").slice(0, 2).toUpperCase();
  const scoreKey =
    options.scoreKey === undefined ? DEFAULT_HI_KEY : options.scoreKey;
  let turnDone = options.turnDone;

  const dialog = document.createElement("dialog");
  dialog.className = "lh-slim-dialog";
  dialog.innerHTML = `
    <div class="lh-slim-head">
      <h2 class="lh-slim-title"></h2>
      <button type="button" class="lh-slim-btn lh-slim-btn-icon" data-lh="x"
              aria-label="Close the game">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
             fill="none" stroke="currentColor" stroke-width="1.6"
             stroke-linecap="round">
          <path d="M2 2 L10 10 M10 2 L2 10" />
        </svg>
      </button>
    </div>
    <div class="lh-slim-body">
      <span class="lh-slim-status" role="status"></span>
      <span class="lh-slim-screen">
        <canvas class="lh-slim-canvas"></canvas>
      </span>
      <div class="lh-slim-keys">
        <span><kbd>↑</kbd> <kbd>↓</kbd> fly · <kbd>Space</kbd> lasers</span>
        <button type="button" class="lh-slim-btn" data-lh="back"></button>
      </div>
    </div>
  `;
  // Set as text, never as markup: a host-supplied title is untrusted here.
  const titleEl = dialog.querySelector<HTMLElement>(".lh-slim-title")!;
  titleEl.textContent = options.title ?? "Laser Head";
  const titleId = `lh-slim-title-${Math.random().toString(36).slice(2, 8)}`;
  titleEl.id = titleId;
  dialog.setAttribute("aria-labelledby", titleId);

  const statusEl = dialog.querySelector<HTMLElement>(".lh-slim-status")!;
  const backBtn = dialog.querySelector<HTMLButtonElement>('[data-lh="back"]')!;
  const closeBtn = dialog.querySelector<HTMLButtonElement>('[data-lh="x"]')!;
  const canvas = dialog.querySelector<HTMLCanvasElement>(".lh-slim-canvas")!;

  const paintStatus = () => {
    statusEl.textContent = options.status ?? statusFor(turnDone);
    // The way out is the primary control once there is somewhere to go back
    // to; until then it is the quiet one, so it does not compete with the run.
    backBtn.textContent = turnDone === true ? "Back to work" : "Stop playing";
    backBtn.classList.toggle("lh-slim-btn-primary", turnDone === true);
  };
  paintStatus();

  (options.parent ?? document.body).appendChild(dialog);

  const world = { current: createWorld((Math.random() * 2 ** 31) | 0) };
  const keys: Input = { up: false, down: false, fire: false };
  let hi = readHi(scoreKey);

  const restart = () => {
    world.current = createWorld((Math.random() * 2 ** 31) | 0);
  };

  // Keys belong to the game while it is open: space must shoot, not scroll
  // the page or press whatever the dialog focused.
  const set = (e: KeyboardEvent, down: boolean) => {
    const k = e.key;
    let taken = true;
    if (k === "ArrowUp" || k === "w" || k === "W") keys.up = down;
    else if (k === "ArrowDown" || k === "s" || k === "S") keys.down = down;
    else if (k === " " || k === "Spacebar") keys.fire = down;
    else taken = false;
    if (!taken) return;
    e.preventDefault();
    // Space is both the trigger and the continue — a finished run restarts on
    // the press, and the same press does not also fire into the new one.
    if (down && k !== "ArrowUp" && k !== "ArrowDown" && world.current.over) {
      restart();
    }
  };
  const onDown = (e: KeyboardEvent) => set(e, true);
  const onUp = (e: KeyboardEvent) => set(e, false);
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);

  const ctx = canvas.getContext("2d");
  canvas.width = VIEW_W * S;
  canvas.height = VIEW_H * S;
  const head = buildHead(initials);
  const shake = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let raf = 0;
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Clamped: a backgrounded tab must resume, never fast-forward.
      acc = Math.min(acc + (now - last), 200);
      last = now;
      const w = world.current;
      const wasOver = w.over;
      while (acc >= TICK_MS) {
        acc -= TICK_MS;
        step(w, keys);
      }
      if (w.over && !wasOver && totalScore(w) > hi) {
        hi = totalScore(w);
        writeHi(scoreKey, hi);
      }
      // The label is refreshed twice a second, not sixty times: it exists for
      // screen readers, and rewriting an attribute every frame to move a
      // number nobody is reading is the one way a toy could cost the page
      // behind it anything.
      if (w.tick % 30 === 0 || w.over) {
        canvas.setAttribute(
          "aria-label",
          `Laser Head. Score ${totalScore(w)}. Best ${hi}.`,
        );
      }
      paint(ctx, w, head, initials, hi, palette(canvas), shake);
    };
    raf = requestAnimationFrame(frame);
  }

  let torn = false;
  const teardown = () => {
    if (torn) return;
    torn = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    dialog.removeEventListener("close", teardown);
    dialog.remove();
    options.onClose?.();
  };

  // Escape closes a native dialog without going through our buttons, so the
  // platform's own event is what teardown hangs off — not the click handlers.
  dialog.addEventListener("close", teardown);
  const close = () => {
    if (dialog.open) dialog.close();
    else teardown();
  };
  backBtn.addEventListener("click", close);
  closeBtn.addEventListener("click", close);

  dialog.showModal();

  return {
    close,
    setTurnDone(done) {
      turnDone = done;
      paintStatus();
    },
    dialog,
  };
}
