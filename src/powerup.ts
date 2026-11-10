import { rememberPosition, renderX, renderY } from "./motion";
import {
  PowerUp,
  Player,
  EnemyType,
  CANVAS_H,
  POWERUP_COOLDOWN,
} from "./types";
import { POWER_TIERS, PowerTier, dropChance, pickPowerTier } from "./power";

const POWERUP_SIZE = 40;
// Slower than the enemies that dropped it, so a core from a kill at the left
// edge is still catchable instead of scrolling straight off.
const POWERUP_DRIFT = 1.1;

// Preload one pickup sprite per tier.
const tierImages = {} as Record<PowerTier, HTMLImageElement>;
for (const def of Object.values(POWER_TIERS)) {
  const img = new Image();
  img.src = def.image;
  tierImages[def.tier] = img;
}

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
  if (Math.random() > dropChance(enemyType)) return;
  const tier = pickPowerTier(difficulty, Math.random(), peak);
  if (!tier) return;

  powerUp = {
    tier,
    x,
    // Nudge clear of the edges so the core doesn't hug the frame on its way out.
    y: Math.max(POWERUP_SIZE, Math.min(CANVAS_H - POWERUP_SIZE, y)),
    size: POWERUP_SIZE,
    sineOffset: Math.random() * Math.PI * 2,
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

export function drawPowerUp(ctx: CanvasRenderingContext2D, frame: number) {
  if (!powerUp) return;
  const p = powerUp;

  const def = POWER_TIERS[p.tier];
  const img = tierImages[p.tier];

  ctx.save();
  const pulse = 0.6 + Math.sin(frame * 0.08) * 0.4;
  ctx.shadowColor = def.color;
  ctx.shadowBlur = 20 + pulse * 10;

  // Higher tiers wear an extra halo so their value reads at a glance.
  if (def.rank > 1) {
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35 + pulse * 0.4;
    ctx.beginPath();
    ctx.arc(renderX(p), renderY(p), p.size * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (img.complete && img.naturalWidth > 0) {
    const aspect = img.naturalWidth / img.naturalHeight;
    const drawW = aspect >= 1 ? p.size : p.size * aspect;
    const drawH = aspect >= 1 ? p.size / aspect : p.size;
    ctx.drawImage(img, renderX(p) - drawW / 2, renderY(p) - drawH / 2, drawW, drawH);
  }

  ctx.restore();
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
