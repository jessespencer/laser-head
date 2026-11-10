import { rememberPosition, renderX, renderY } from "./motion";
import { Laser, LASER_SPEED, CANVAS_W, CANVAS_H } from "./types";

let lasers: Laser[] = [];
let ultraLasers: Laser[] = [];

// --- Pre-baked laser sprite ---
// The beam glow (outer gradient + two blurred strokes) is expensive to draw
// per-laser per-frame. Bake it once into an offscreen canvas and blit it — a
// drawImage of a cached bitmap is orders of magnitude cheaper than live
// gradients + shadowBlur, and looks identical.

const LASER_ANCHOR_X = 24; // laser origin maps here in sprite space
const LASER_ANCHOR_Y = 24;
const laserSprites: Record<"base" | "hot", HTMLCanvasElement | null> = { base: null, hot: null };

/** `hot` is the overdrive beam: same shape, brighter core and a longer glow,
 * so the tier is readable from the shots alone. */
function getLaserSprite(hot = false): HTMLCanvasElement {
  const key = hot ? "hot" : "base";
  const cached = laserSprites[key];
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 48;
  const g = c.getContext("2d")!;
  const ax = LASER_ANCHOR_X;
  const ay = LASER_ANCHOR_Y;

  // Layer 1: outer glow
  const glowGrad = g.createLinearGradient(0, ay - 12, 0, ay + 12);
  glowGrad.addColorStop(0, "rgba(255,40,0,0)");
  glowGrad.addColorStop(0.5, hot ? "rgba(255,150,40,0.45)" : "rgba(255,40,0,0.3)");
  glowGrad.addColorStop(1, "rgba(255,40,0,0)");
  g.fillStyle = glowGrad;
  g.fillRect(ax - 10, ay - 12, hot ? 36 : 30, 24);

  // Layer 2: mid beam (blurred)
  g.save();
  g.strokeStyle = hot ? "rgba(255,160,60,0.85)" : "rgba(255,80,20,0.7)";
  g.lineWidth = hot ? 6 : 4;
  g.shadowColor = hot ? "rgba(255,140,30,1)" : "rgba(255,60,0,1)";
  g.shadowBlur = 20;
  g.beginPath();
  g.moveTo(ax - 5, ay);
  g.lineTo(ax + (hot ? 24 : 20), ay);
  g.stroke();
  g.restore();

  // Layer 3: core (blurred)
  g.save();
  g.strokeStyle = hot ? "rgba(255,246,225,1)" : "rgba(255,200,180,0.95)";
  g.lineWidth = hot ? 3 : 2;
  g.shadowColor = hot ? "rgba(255,230,190,1)" : "rgba(255,180,150,1)";
  g.shadowBlur = hot ? 14 : 10;
  g.beginPath();
  g.moveTo(ax - 3, ay);
  g.lineTo(ax + (hot ? 22 : 18), ay);
  g.stroke();
  g.restore();

  laserSprites[key] = c;
  return c;
}

export function getLasers(): Laser[] {
  return lasers;
}

export function clearLasers() {
  lasers = [];
}

export function spawnLaser(x: number, y: number, vy = 0, hot = false) {
  lasers.push({ x, y, vy, hot });
}

export function updateLasers() {
  for (let i = lasers.length - 1; i >= 0; i--) {
    rememberPosition(lasers[i]);
    lasers[i].x += LASER_SPEED;
    lasers[i].y += lasers[i].vy ?? 0;
    if (lasers[i].x > CANVAS_W + 30 || lasers[i].y < -30 || lasers[i].y > CANVAS_H + 30) {
      lasers.splice(i, 1);
    }
  }
}

export function drawLasers(ctx: CanvasRenderingContext2D) {
  if (lasers.length === 0) return;
  const base = getLaserSprite(false), hot = getLaserSprite(true);
  for (const l of lasers) {
    ctx.save();ctx.translate(renderX(l),renderY(l));ctx.rotate(Math.atan2(l.vy??0,LASER_SPEED));
    ctx.drawImage(l.hot ? hot : base,-LASER_ANCHOR_X,-LASER_ANCHOR_Y);ctx.restore();
  }
}

// --- Ultra lasers: separate array, batched rendering ---

export function getUltraLasers(): Laser[] {
  return ultraLasers;
}

export function clearUltraLasers() {
  ultraLasers = [];
}

export function spawnUltraLaser(x: number, y: number, vy = 0) {
  ultraLasers.push({ x, y, vy });
}

export function updateUltraLasers() {
  for (let i = ultraLasers.length - 1; i >= 0; i--) {
    rememberPosition(ultraLasers[i]);
    ultraLasers[i].x += LASER_SPEED;
    ultraLasers[i].y += ultraLasers[i].vy ?? 0;
    if (ultraLasers[i].x > CANVAS_W + 30 || ultraLasers[i].y < -30 || ultraLasers[i].y > CANVAS_H + 30) {
      ultraLasers.splice(i, 1);
    }
  }
}

let plasmaSprite: HTMLCanvasElement | null = null;
function getPlasmaSprite() {
  if (plasmaSprite) return plasmaSprite;
  const c = document.createElement("canvas");
  c.width = 72; c.height = 48;
  const g = c.getContext("2d")!;
  const glow = g.createLinearGradient(0, 16, 0, 32);
  glow.addColorStop(0, "rgba(50,160,255,0)");
  glow.addColorStop(0.5, "rgba(50,220,255,0.3)");
  glow.addColorStop(1, "rgba(50,160,255,0)");
  g.fillStyle = glow; g.fillRect(16, 16, 40, 16);
  g.shadowColor = "#4ceaff"; g.shadowBlur = 7;
  g.fillStyle = "#49ccff"; g.fillRect(20, 21, 34, 6);
  g.fillStyle = "#eaffff"; g.fillRect(24, 22.5, 32, 3);
  plasmaSprite = c;
  return c;
}

export function drawUltraLasers(ctx: CanvasRenderingContext2D) {
  if (ultraLasers.length === 0) return;
  const sprite = getPlasmaSprite();
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  for (const l of ultraLasers) {
    ctx.save();ctx.translate(renderX(l),renderY(l));ctx.rotate(Math.atan2(l.vy??0,LASER_SPEED));
    ctx.drawImage(sprite,-24,-24);ctx.restore();
  }
  ctx.globalCompositeOperation = prev;
}
