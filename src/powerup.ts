import { rememberPosition, renderX, renderY } from "./motion";
import {
  PowerUp,
  Player,
  CANVAS_W,
  CANVAS_H,
  POWERUP_MIN_DIFFICULTY,
  POWERUP_COOLDOWN,
  POWERUP_CHANCE,
} from "./types";

const POWERUP_SIZE = 40;
const POWERUP_SPEED = 1.5;

// Preload the plasma-core pickup
const plasmaImg = new Image();
plasmaImg.src = "/laser-head/plasma-core.svg";

let powerUp: PowerUp | null = null;
let spawnCooldown = 0;

export function getPowerUp(): PowerUp | null {
  return powerUp;
}

export function clearPowerUp() {
  powerUp = null;
  spawnCooldown = 0;
}

export function trySpawnPowerUp(difficulty: number) {
  if (spawnCooldown > 0) {
    spawnCooldown--;
    return;
  }
  if (powerUp) return;
  if (difficulty < POWERUP_MIN_DIFFICULTY) return;
  if (Math.random() > POWERUP_CHANCE) return;

  powerUp = {
    x: CANVAS_W + POWERUP_SIZE,
    y: POWERUP_SIZE + Math.random() * (CANVAS_H - POWERUP_SIZE * 2),
    size: POWERUP_SIZE,
    sineOffset: Math.random() * Math.PI * 2,
    speed: POWERUP_SPEED,
  };
  spawnCooldown = POWERUP_COOLDOWN;
}

export function updatePowerUp(frame: number) {
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

  ctx.save();
  const pulse = 0.6 + Math.sin(frame * 0.08) * 0.4;
  ctx.shadowColor = `rgba(80, 220, 255, ${pulse})`;
  ctx.shadowBlur = 20 + pulse * 10;

  if (plasmaImg.complete && plasmaImg.naturalWidth > 0) {
    const aspect = plasmaImg.naturalWidth / plasmaImg.naturalHeight;
    const drawW = aspect >= 1 ? p.size : p.size * aspect;
    const drawH = aspect >= 1 ? p.size / aspect : p.size;
    ctx.drawImage(plasmaImg, renderX(p) - drawW / 2, renderY(p) - drawH / 2, drawW, drawH);
  }

  ctx.restore();
}

export function checkPowerUpCollision(player: Player): boolean {
  if (!powerUp) return false;
  const pw = player.width * 0.4;
  const ph = player.height * 0.4;
  const halfSize = powerUp.size * 0.4;

  if (
    player.x - pw < powerUp.x + halfSize &&
    player.x + pw > powerUp.x - halfSize &&
    player.y - ph < powerUp.y + halfSize &&
    player.y + ph > powerUp.y - halfSize
  ) {
    powerUp = null;
    return true;
  }
  return false;
}
