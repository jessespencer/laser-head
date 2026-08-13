/**
 * "Insert coin?" — the banner that sits above the prompt field.
 *
 * The one place a working app is allowed to be silly. It docks directly above
 * the composer — the same slot notices use, for the same reason: it is about
 * what to do NEXT, so it belongs where the eye already is before typing.
 *
 * The copy is doing real work. "Tired of waiting?" — the obvious line — makes
 * the product apologise for itself and plants the idea that the wait is a
 * fault; a long job is usually a big job being done properly. The default
 * line says the opposite about the same fact, and the arcade's own idiom does
 * the inviting. Pass your own `message` if your product has a better joke.
 *
 * It should only exist while the host is genuinely working (see
 * `shouldOfferGame` in `./laser-runner`), it is dismissible, and a dismissal
 * should last the rest of that wait. Nothing here interrupts, blocks or steals
 * focus: the banner is a suggestion the reader can ignore forever.
 */

import { buildHead, HEAD_COLS, HEAD_ROWS } from "./laser-head-sprite";

export type SlimBannerOptions = {
  /** Initials — seeds the head so the banner shows the reader's own runner. */
  seed?: string;
  message?: string;
  playLabel?: string;
  /** Accessible name for the dismiss button. */
  dismissLabel?: string;
  onPlay: () => void;
  /** Omit to hide the dismiss button entirely. */
  onDismiss?: () => void;
};

export type SlimBannerHandle = {
  /** Remove the banner from the page. Idempotent. */
  destroy(): void;
  /** The banner element, for a host that wants to move or restyle it. */
  readonly element: HTMLElement;
};

/** The player's own head, 11×12, drawn small enough to read as a favicon. */
function paintHead(canvas: HTMLCanvasElement, seed: string): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cell = 2;
  canvas.width = HEAD_COLS * cell;
  canvas.height = HEAD_ROWS * cell;
  // Sampled from the host's theme, and the fallback is another RESOLVED value
  // (the inherited text colour) rather than a hex — no second palette.
  const cs = getComputedStyle(canvas);
  const ink = cs.getPropertyValue("--lh-slim-ink").trim() || cs.color;
  const laser = cs.getPropertyValue("--lh-slim-accent").trim() || ink;
  const head = buildHead(seed);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = ink;
  for (let r = 0; r < HEAD_ROWS; r++) {
    for (let c = 0; c < HEAD_COLS; c++) {
      if (head.grid[r]![c]) ctx.fillRect(c * cell, r * cell, cell, cell);
    }
  }
  // The eyes are already charged — that is the invitation.
  ctx.fillStyle = laser;
  for (const e of head.eyes) ctx.fillRect(e.col * cell, e.row * cell, cell, cell);
}

/**
 * Build the banner and append it to `host`.
 *
 * The host decides WHERE — pass the wrapper that sits directly above your
 * prompt field. The banner carries its own bottom margin so it does not need
 * a gap from the layout around it.
 */
export function mountSlimBanner(
  host: HTMLElement,
  options: SlimBannerOptions,
): SlimBannerHandle {
  const seed = (options.seed || "U").slice(0, 2).toUpperCase();

  const el = document.createElement("div");
  el.className = "lh-slim-banner";

  const canvas = document.createElement("canvas");
  canvas.className = "lh-slim-banner-head";
  canvas.setAttribute("aria-hidden", "true");
  el.appendChild(canvas);

  const text = document.createElement("span");
  text.className = "lh-slim-banner-text";
  // textContent, never innerHTML: the message is host-supplied.
  text.textContent = options.message ?? "The lasers are warm while you wait.";
  el.appendChild(text);

  const play = document.createElement("button");
  play.type = "button";
  play.className = "lh-slim-btn";
  // The invitation lives on the button, so the sentence no longer carries it
  // — saying "insert coin?" twice in one strip reads as a typo, not a joke.
  play.textContent = options.playLabel ?? "Insert coin?";
  play.addEventListener("click", () => options.onPlay());
  el.appendChild(play);

  if (options.onDismiss) {
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "lh-slim-btn lh-slim-btn-icon";
    dismiss.setAttribute("aria-label", options.dismissLabel ?? "Not now");
    dismiss.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
           fill="none" stroke="currentColor" stroke-width="1.6"
           stroke-linecap="round">
        <path d="M2 2 L10 10 M10 2 L2 10" />
      </svg>`;
    dismiss.addEventListener("click", () => options.onDismiss!());
    el.appendChild(dismiss);
  }

  host.appendChild(el);
  // After it is in the document: the head samples custom properties, and off
  // the tree there is nothing to sample from.
  paintHead(canvas, seed);

  return {
    destroy() {
      el.remove();
    },
    get element() {
      return el;
    },
  };
}
