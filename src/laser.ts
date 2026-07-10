import { Laser, LASER_SPEED, CANVAS_W } from "./types";

let lasers: Laser[] = [];
let ultraLasers: Laser[] = [];

// --- Pre-baked laser sprite ---
// The beam glow (outer gradient + two blurred strokes) is expensive to draw
// per-laser per-frame. Bake it once into an offscreen canvas and blit it — a
// drawImage of a cached bitmap is orders of magnitude cheaper than live
// gradients + shadowBlur, and looks identical.

const LASER_ANCHOR_X = 24; // laser origin maps here in sprite space
const LASER_ANCHOR_Y = 24;
let laserSprite: HTMLCanvasElement | null = null;

function getLaserSprite(): HTMLCanvasElement {
  if (laserSprite) return laserSprite;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 48;
  const g = c.getContext("2d")!;
  const ax = LASER_ANCHOR_X;
  const ay = LASER_ANCHOR_Y;

  // Layer 1: outer glow
  const glowGrad = g.createLinearGradient(0, ay - 12, 0, ay + 12);
  glowGrad.addColorStop(0, "rgba(255,40,0,0)");
  glowGrad.addColorStop(0.5, "rgba(255,40,0,0.3)");
  glowGrad.addColorStop(1, "rgba(255,40,0,0)");
  g.fillStyle = glowGrad;
  g.fillRect(ax - 10, ay - 12, 30, 24);

  // Layer 2: mid beam (blurred)
  g.save();
  g.strokeStyle = "rgba(255,80,20,0.7)";
  g.lineWidth = 4;
  g.shadowColor = "rgba(255,60,0,1)";
  g.shadowBlur = 20;
  g.beginPath();
  g.moveTo(ax - 5, ay);
  g.lineTo(ax + 20, ay);
  g.stroke();
  g.restore();

  // Layer 3: core (blurred)
  g.save();
  g.strokeStyle = "rgba(255,200,180,0.95)";
  g.lineWidth = 2;
  g.shadowColor = "rgba(255,180,150,1)";
  g.shadowBlur = 10;
  g.beginPath();
  g.moveTo(ax - 3, ay);
  g.lineTo(ax + 18, ay);
  g.stroke();
  g.restore();

  laserSprite = c;
  return laserSprite;
}

export function getLasers(): Laser[] {
  return lasers;
}

export function clearLasers() {
  lasers = [];
}

export function spawnLaser(x: number, y: number) {
  lasers.push({ x, y });
}

export function updateLasers() {
  for (let i = lasers.length - 1; i >= 0; i--) {
    lasers[i].x += LASER_SPEED;
    if (lasers[i].x > CANVAS_W + 30) {
      lasers.splice(i, 1);
    }
  }
}

export function drawLasers(ctx: CanvasRenderingContext2D) {
  if (lasers.length === 0) return;
  const sprite = getLaserSprite();
  for (const l of lasers) {
    ctx.drawImage(sprite, l.x - LASER_ANCHOR_X, l.y - LASER_ANCHOR_Y);
  }
}

// --- Ultra lasers: separate array, batched rendering ---

export function getUltraLasers(): Laser[] {
  return ultraLasers;
}

export function clearUltraLasers() {
  ultraLasers = [];
}

export function spawnUltraLaser(x: number, y: number) {
  ultraLasers.push({ x, y });
}

export function updateUltraLasers() {
  for (let i = ultraLasers.length - 1; i >= 0; i--) {
    ultraLasers[i].x += LASER_SPEED;
    if (ultraLasers[i].x > CANVAS_W + 30) {
      ultraLasers.splice(i, 1);
    }
  }
}

export function drawUltraLasers(ctx: CanvasRenderingContext2D) {
  if (ultraLasers.length === 0) return;
  const sprite = getLaserSprite();
  // Additive blend so a dense ultra stream reads as one blazing beam.
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  for (const l of ultraLasers) {
    ctx.drawImage(sprite, l.x - LASER_ANCHOR_X, l.y - LASER_ANCHOR_Y);
  }
  ctx.globalCompositeOperation = prev;
}
