import { Laser, LASER_SPEED, CANVAS_W } from "./types";

let lasers: Laser[] = [];
let ultraLasers: Laser[] = [];

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
  for (const l of lasers) {
    // Layer 1: Outer glow
    const glowGrad = ctx.createLinearGradient(l.x, l.y - 12, l.x, l.y + 12);
    glowGrad.addColorStop(0, "rgba(255,40,0,0)");
    glowGrad.addColorStop(0.5, "rgba(255,40,0,0.3)");
    glowGrad.addColorStop(1, "rgba(255,40,0,0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(l.x - 10, l.y - 12, 30, 24);

    // Layer 2: Mid beam
    ctx.save();
    ctx.strokeStyle = "rgba(255,80,20,0.7)";
    ctx.lineWidth = 4;
    ctx.shadowColor = "rgba(255,60,0,1)";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(l.x - 5, l.y);
    ctx.lineTo(l.x + 20, l.y);
    ctx.stroke();
    ctx.restore();

    // Layer 3: Core
    ctx.save();
    ctx.strokeStyle = "rgba(255,200,180,0.95)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255,180,150,1)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(l.x - 3, l.y);
    ctx.lineTo(l.x + 18, l.y);
    ctx.stroke();
    ctx.restore();
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

  // Mid beam — single batched path with one shadow
  ctx.save();
  ctx.strokeStyle = "rgba(255,80,20,0.7)";
  ctx.lineWidth = 4;
  ctx.shadowColor = "rgba(255,60,0,1)";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  for (const l of ultraLasers) {
    ctx.moveTo(l.x - 5, l.y);
    ctx.lineTo(l.x + 20, l.y);
  }
  ctx.stroke();
  ctx.restore();

  // Core — single batched path with one shadow
  ctx.save();
  ctx.strokeStyle = "rgba(255,200,180,0.95)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(255,180,150,1)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  for (const l of ultraLasers) {
    ctx.moveTo(l.x - 3, l.y);
    ctx.lineTo(l.x + 18, l.y);
  }
  ctx.stroke();
  ctx.restore();
}
