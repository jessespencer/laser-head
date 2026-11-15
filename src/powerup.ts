import { rememberPosition } from "./motion";
import { random } from "./rng";
import {
  type PowerUp,
  type Player,
  type EnemyType,
  CANVAS_H,
  POWERUP_COOLDOWN,
} from "./types";
import { type PowerTier, dropChance, pickPowerTier } from "./power";

// Power-up rules only. Drawing lives in powerup-view.ts, so this module loads
// without a DOM.

const POWERUP_SIZE = 40;
// Slower than the enemies that dropped it, so a core from a kill at the left
// edge is still catchable instead of scrolling straight off.
const POWERUP_DRIFT = 1.1;

let powerUp: PowerUp | null = null;
let spawnCooldown = 0;

export function getPowerUp(): PowerUp | null {
  return powerUp;
}

export function clearPowerUp() {
  powerUp = null;
  spawnCooldown = 0;
}

/** Called when an enemy is destroyed: it may leave a core behind at the wreck.
 * Only one core exists at a time, and POWERUP_COOLDOWN keeps a hot streak from
 * stacking them up. */
export function tryDropPowerUp(
  x: number,
  y: number,
  difficulty: number,
  enemyType: EnemyType,
  peak: PowerTier | null,
) {
  if (spawnCooldown > 0) return;
  if (powerUp) return;
  if (random() > dropChance(enemyType)) return;
  const tier = pickPowerTier(difficulty, random(), peak);
  if (!tier) return;

  powerUp = {
    tier,
    x,
    // Nudge clear of the edges so the core doesn't hug the frame on its way out.
    y: Math.max(POWERUP_SIZE, Math.min(CANVAS_H - POWERUP_SIZE, y)),
    size: POWERUP_SIZE,
    sineOffset: random() * Math.PI * 2,
    speed: POWERUP_DRIFT,
  };
  spawnCooldown = POWERUP_COOLDOWN;
}

export function updatePowerUp(frame: number) {
  // The cooldown ticks every frame now that drops are driven by kills rather
  // than by this function being polled.
  if (spawnCooldown > 0) spawnCooldown--;
  if (!powerUp) return;
  rememberPosition(powerUp);
  powerUp.x -= powerUp.speed;
  powerUp.y += Math.sin(frame * 0.02 + powerUp.sineOffset) * 0.8;

  if (powerUp.x < -powerUp.size * 2) {
    powerUp = null;
  }
}

/** Returns the collected tier, or null if nothing was picked up this frame. */
export function checkPowerUpCollision(player: Player): PowerTier | null {
  if (!powerUp) return null;
  const pw = player.width * 0.4;
  const ph = player.height * 0.4;
  const halfSize = powerUp.size * 0.4;

  if (
    player.x - pw < powerUp.x + halfSize &&
    player.x + pw > powerUp.x - halfSize &&
    player.y - ph < powerUp.y + halfSize &&
    player.y + ph > powerUp.y - halfSize
  ) {
    const tier = powerUp.tier;
    powerUp = null;
    return tier;
  }
  return null;
}
