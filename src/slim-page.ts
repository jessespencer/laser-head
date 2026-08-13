/**
 * The stand-in host for Laser Head Slim.
 *
 * This file is NOT part of the package — it is the fifteen lines a real app
 * would write to use it, plus a fake job to have something to wait for. The
 * package itself is `src/slim/`, and nothing in there imports anything from
 * here.
 *
 * What it demonstrates, in order:
 *
 *  1. `shouldOfferGame` deciding when the banner is allowed to appear. The
 *     real gate is used, with the real two-minute threshold — the "skip the
 *     wait" button moves the fake job's start time, it does not bypass the
 *     predicate.
 *  2. `mountSlimBanner` docking the strip above the prompt field.
 *  3. `openSlimGame` opening the modal, and `setTurnDone` moving its status
 *     line when the job lands while someone is still playing.
 */

import "./slim/slim.css";

import {
  initialsFor,
  mountSlimBanner,
  openSlimGame,
  shouldOfferGame,
  type SlimBannerHandle,
  type SlimGameHandle,
} from "./slim";

const slot = document.getElementById("banner-slot")!;
const transcript = document.getElementById("transcript")!;
const prompt = document.getElementById("prompt") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send") as HTMLButtonElement;
const skipBtn = document.getElementById("skip") as HTMLButtonElement;
const finishBtn = document.getElementById("finish") as HTMLButtonElement;
const stateEl = document.getElementById("state")!;

const INITIALS = initialsFor("Jesse Spencer");

/** The fake job the wait belongs to. */
let startedAt: number | null = null;
/** When the fake job is due to land, if it has been told to. */
let landsAt: number | null = null;
let dismissed = false;
let banner: SlimBannerHandle | null = null;
let game: SlimGameHandle | null = null;

function say(who: string, what: string): void {
  const row = document.createElement("div");
  row.className = "msg";
  const b = document.createElement("b");
  b.textContent = who;
  const span = document.createElement("span");
  span.textContent = what;
  row.append(b, span);
  transcript.appendChild(row);
}

function play(): void {
  if (game) return;
  game = openSlimGame({
    initials: INITIALS,
    // Three-state on purpose: `false` is "still working", `undefined` would be
    // "there is no job behind this at all".
    turnDone: startedAt === null,
    onClose: () => {
      game = null;
      render();
    },
  });
  render();
}

/** The job landing on its own clock — nobody clicks this. */
function land(): void {
  if (startedAt === null) return;
  startedAt = null;
  landsAt = null;
  say("agent", "Done — 412 tests, all green.");
  // A game already open is TOLD, rather than closed out from under the player.
  game?.setTurnDone(true);
  render();
}

function render(): void {
  if (landsAt !== null && performance.now() >= landsAt) land();
  const working = startedAt !== null;
  const elapsedS = working ? (performance.now() - startedAt!) / 1000 : 0;
  const offer = shouldOfferGame({
    enabled: true,
    working,
    elapsedS,
    dismissed,
    playing: game !== null,
    needsHuman: false,
  });

  if (offer && !banner) {
    banner = mountSlimBanner(slot, {
      seed: INITIALS,
      onPlay: play,
      onDismiss: () => {
        dismissed = true;
        render();
      },
    });
  } else if (!offer && banner) {
    banner.destroy();
    banner = null;
  }

  const due =
    landsAt === null
      ? ""
      : ` · lands in ${Math.max(0, (landsAt - performance.now()) / 1000).toFixed(0)}s`;
  stateEl.textContent = game
    ? working
      ? `playing · job running${due}`
      : "playing · job done"
    : working
      ? `working · ${elapsedS.toFixed(0)}s${due}`
      : "idle";
  sendBtn.disabled = working;
  skipBtn.disabled = !working;
  finishBtn.disabled = !working || landsAt !== null;
}

sendBtn.addEventListener("click", () => {
  if (startedAt !== null) return;
  say("you", prompt.value.trim() || "Run the whole suite, please.");
  prompt.value = "";
  startedAt = performance.now();
  landsAt = null;
  dismissed = false;
  render();
});

skipBtn.addEventListener("click", () => {
  // Moves the job's start time back, so the real predicate is what lets the
  // banner in — nothing here reaches around it.
  if (startedAt !== null) startedAt -= 121_000;
  render();
});

// Five seconds out, on purpose: an open modal makes this button inert, so the
// only way the status line can move mid-run is the host telling the game.
finishBtn.addEventListener("click", () => {
  if (startedAt === null || landsAt !== null) return;
  landsAt = performance.now() + 5_000;
  render();
});

// The gate is re-evaluated on a slow tick: it is a pure predicate over state
// the host already has, so polling it twice a second costs nothing and keeps
// the wiring to one function.
setInterval(render, 500);
render();
