/**
 * Laser Head Slim — a self-contained mini game.
 *
 * The whole package is this folder. It has no dependencies, no framework and
 * no build step of its own: copy `src/slim/` into any project, import the CSS
 * once, and call two functions.
 *
 *   import { mountSlimBanner, openSlimGame } from "./slim";
 *   import "./slim/slim.css";
 *
 *   mountSlimBanner(aboveTheComposer, {
 *     seed: "JS",
 *     onPlay: () => openSlimGame({ initials: "JS", turnDone: false }),
 *     onDismiss: () => banner.destroy(),
 *   });
 *
 * Three layers, deliberately separable:
 *
 *  - `laser-runner`      — the rules. No DOM, no clock, no images. Bring your
 *                          own renderer if you want a different look.
 *  - `laser-head-sprite` — the 11×12 head and the 3×5 HUD font, as data.
 *  - `slim-game` /
 *    `slim-banner`       — the canvas, the native `<dialog>`, and the strip
 *                          that offers the game.
 *
 * `shouldOfferGame` and `gameMustYield` (from `laser-runner`) are the policy
 * for WHEN a host should show the banner and when an open game has to get out
 * of the way. They are pure predicates — a host passes its own state in.
 */

export {
  mountSlimBanner,
  type SlimBannerHandle,
  type SlimBannerOptions,
} from "./slim-banner";

export {
  openSlimGame,
  paint,
  type SlimGameHandle,
  type SlimGameOptions,
} from "./slim-game";

export {
  buildHead,
  GLYPH_H,
  GLYPH_W,
  HEAD_COLS,
  HEAD_ROWS,
  hashSeed,
  initialsFor,
  textCells,
  textWidth,
  type HeadSprite,
} from "./laser-head-sprite";

export {
  alienBox,
  ALIENS,
  createWorld,
  eyeOrigin,
  gameMustYield,
  gapFloorPx,
  INVITE_AFTER_S,
  LIVES,
  MAX_MULTIPLIER,
  playerBox,
  shouldOfferGame,
  step,
  totalScore,
  VIEW_H,
  VIEW_W,
  type Alien,
  type AlienKind,
  type GameGate,
  type Input,
  type World,
} from "./laser-runner";
