```txt
 ████                                          █████                             █████
░░███                                         ░░███                             ░░███
 ░███   ██████    █████   ██████  ████████     ░███████    ██████   ██████    ███████
 ░███  ░░░░░███  ███░░   ███░░███░░███░░███    ░███░░███  ███░░███ ░░░░░███  ███░░███
 ░███   ███████ ░░█████ ░███████  ░███ ░░░     ░███ ░███ ░███████   ███████ ░███ ░███
 ░███  ███░░███  ░░░░███░███░░░   ░███         ░███ ░███ ░███░░░   ███░░███ ░███ ░███
 █████░░████████ ██████ ░░██████  █████        ████ █████░░██████ ░░████████░░████████
░░░░░  ░░░░░░░░ ░░░░░░   ░░░░░░  ░░░░░        ░░░░ ░░░░░  ░░░░░░   ░░░░░░░░  ░░░░░░░░
```

# Laser Head

A browser-based arcade shoot-em-up where you use your own face to shoot lasers and destroy incoming enemies. Upload a photo, align your eyes, and fire away.

## Features

- **Custom Avatars** — upload a photo with automatic ML-based background removal, or use the default head
- **Eye Alignment Tool** — pan and zoom to position your eyes for accurate laser origin
- **4 Enemy Types** — Scouts, Drones, Tanks, and Bombs with progressive difficulty scaling
- **Combo System** — consecutive kills build a multiplier up to 8x
- **Tiered Power-Ups** — cores are hidden in the wreckage of the enemies that shoot back: destroy a shooter and it may leave one behind. They climb a two-tier ladder: Overdrive (amber, ~9s of the full-rate laser) and Plasma (cyan, ~7s of faster cyan bolts). Each core offers the rung above the best you have reached this run, and a lower tier never downgrades an active higher one
- **Visual Effects** — screen shake, particle explosions, CRT scanlines, animated starfield

## Tech Stack

- TypeScript + Vite
- HTML5 Canvas for rendering
- @imgly/background-removal for ML-powered image processing
- Roboto Mono via Google Fonts; deployed to GitHub Pages

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm run dev      # http://localhost:5173/laser-head/
pnpm run build    # Production build to dist/ (both pages)
pnpm run preview  # Serve production build
pnpm test         # Game rules and the slim package, on bare Node
pnpm bench        # Cost of a simulation tick on the seeded stress scenes
```

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move |
| Spacebar | Fire lasers |
| P | Pause / resume (Enter also resumes) |
| ESC | Quit to menu |

## Tests and benchmarks

The rules run without a browser. `src/sim.ts` is one fixed 60 Hz tick of the
game and touches no canvas, keyboard or clock; `src/game.ts` is the browser
shell that drives it. Every random draw goes through `src/rng.ts`, so a seeded
run replays exactly.

- `pnpm test` runs the suite on Node's own type stripping; there is no test
  framework to install.
- `pnpm bench [seed]` flies two seeded scenes headless and prints the cost of a
  simulation tick, peak entity counts, and a digest of the run. A change that
  is meant to be behaviour-neutral should leave the digests unchanged.
- `?bench=swarm` (or `?bench=sector1`, optionally `&seed=3`) on the dev server
  flies the same scene on screen with live frame timings; the full report is
  `window.__laserHeadBench()` in the console. Nothing a bench plays reaches the
  leaderboard.

---

# Laser Head Slim

A second, separate page: **`/slim.html`**. Same head, same lasers, one twelfth
the size — a banner that docks above a prompt field, a modal, and a small
canvas, for entertaining someone through a long wait.

It is not a mode of the full-screen game and shares no code with it. The whole
thing is **`src/slim/`**: no framework, no dependencies, no build step of its
own. Copy that folder into another project and it works there.

```
src/slim/
├── index.ts              the public surface — two functions and the types
├── slim-banner.ts        the "Insert coin?" strip that docks above a composer
├── slim-game.ts          the canvas, the fixed-timestep loop, the <dialog>
├── laser-runner.ts       the rules — no DOM, no clock, no images
├── laser-head-sprite.ts  the 11×12 head and the 3×5 HUD font, as data
└── slim.css              self-contained; every value is an overridable var
```

## Using it

```ts
import { mountSlimBanner, openSlimGame, shouldOfferGame } from "./slim";
import "./slim/slim.css";

// `shouldOfferGame` is the policy: only while something is genuinely working,
// only after two minutes, never while a question is waiting on the human.
if (shouldOfferGame({ enabled, working, elapsedS, dismissed, playing, needsHuman })) {
  const banner = mountSlimBanner(elementAboveYourPromptField, {
    seed: "JS",                                   // initials → the player's own head
    onPlay: () => openSlimGame({ initials: "JS", turnDone: false }),
    onDismiss: () => banner.destroy(),
  });
}
```

`openSlimGame` returns a handle with `close()` and `setTurnDone()`. Call
`setTurnDone(true)` when the job lands and the modal says so and offers the way
back, rather than closing itself out from under the player.

## Design notes

- **No dependencies, and no modal library.** It is a native `<dialog>` opened
  with `showModal()`, so the focus trap, Escape, the inert background and the
  top layer all come from the platform.
- **The rules are separable.** `laser-runner.ts` is arithmetic on plain
  objects — no DOM, no `Date.now()`, no rAF — which is what makes the 35 tests
  possible and what lets you keep the game and replace the renderer.
- **Fixed 1/60s timestep** from a clamped accumulator, so a 120Hz display and a
  backgrounded tab agree on the physics, and returning to a background tab
  resumes rather than fast-forwarding into a wall of aliens.
- **The field is always night**, deliberately, whatever the host's theme: on a
  white background the lasers — the only bright thing in the game — would be
  invisible. The chrome around it does follow the host.
- **Retheme with CSS alone.** No colour literal exists in the TS. The chrome
  reads `--lh-slim-*` and the play field reads `--lh-arcade-*`; set them on
  `:root` and everything follows. `data-lh-slim-theme="dark|light"` forces a
  mode, otherwise the OS preference decides.
- **Keyboard only**, same as the full game: ↑/↓ fly, Space fires and also
  restarts a finished run. Keys are grabbed while the modal is open so Space
  cannot scroll the page behind it, and released on close.

`slim.html` and `src/slim-page.ts` are a stand-in host demonstrating all of the
above — a fake chat with a fake job to wait for. Neither is part of the
package, and nothing in `src/slim/` imports from them.
