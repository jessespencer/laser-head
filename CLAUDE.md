# Laser Head

Global preferences apply. This file records only what is specific to this repo.

## Commands

- `pnpm dev`, `pnpm build` (runs `tsc` first), `pnpm test`, `pnpm bench [seed]`.
- Tests run on Node's type stripping, with `scripts/ts-resolve.mjs` resolving
  the source's extensionless imports. No test framework, no `@types/node`:
  test files are excluded from `tsc`, and import siblings with a `.ts` suffix.

## Architecture

- `src/sim.ts` is the game: one fixed 60 Hz tick, no DOM. `src/game.ts` is the
  browser shell (canvas, input, frame loop, game-over screens) that drives it.
- Rules and drawing live in separate files: `enemies.ts` / `enemies-view.ts`,
  `powerup.ts` / `powerup-view.ts`, `boss.ts` / `boss-view.ts`. Anything the
  simulation imports must load without a DOM, so no `new Image()` or
  `document` at module scope outside a `-view` file.
- `src/slim/` is a separate page and shares no code with the rest of `src/`.

## Conventions

- Never call `Math.random` in game code. Use `random()` from `src/rng.ts` for
  anything the player can feel and `fxRandom()` for anything purely visual.
  Seeded runs depend on it, and a test enforces it.
- Type-only imports must be marked `type` (`verbatimModuleSyntax`); an unmarked
  one fails at runtime under Node.
- A change meant to be behaviour-neutral must leave the `pnpm bench` digests
  unchanged. Tie performance work to a bench or profile number.
- This is plain TypeScript on canvas, not React.
