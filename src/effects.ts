import { Star, Particle, CANVAS_W, CANVAS_H } from "./types";

// --- Starfield ---

const STAR_LAYERS = [
  { count: 40, speed: 0.5, size: 1, alpha: 0.3 },
  { count: 30, speed: 1.2, size: 1.5, alpha: 0.5 },
  { count: 20, speed: 2.5, size: 2, alpha: 0.8 },
];

let stars: Star[] = [];

export function initStarfield() {
  stars = [];
  for (const layer of STAR_LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      stars.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        speed: layer.speed,
        size: layer.size,
        alpha: layer.alpha,
      });
    }
  }
}

export function updateStarfield() {
  for (const s of stars) {
    s.x -= s.speed;
    if (s.x < 0) {
      s.x = CANVAS_W;
      s.y = Math.random() * CANVAS_H;
    }
  }
}

export function drawStarfield(ctx: CanvasRenderingContext2D) {
  for (const s of stars) {
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = "#fff";
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

// --- CRT Overlay ---

export function drawCRT(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  for (let y = 0; y < CANVAS_H; y += 3) {
    ctx.fillRect(0, y, CANVAS_W, 1);
  }
}

// --- Explosions (Particle Systems) ---

let particles: Particle[] = [];

export function spawnExplosion(x: number, y: number, color: string) {
  // 8 radial particles
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const speed = 2 + Math.random() * 3;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      color,
      size: 3 + Math.random() * 3,
    });
  }
  // Central flash
  particles.push({
    x,
    y,
    vx: 0,
    vy: 0,
    alpha: 1,
    color: "#fff",
    size: 12,
  });
}

export function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.025; // ~40 frames to fade
    p.size *= 0.97;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D) {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = prev;
  ctx.globalAlpha = 1;
}

export function clearParticles() {
  particles = [];
}

// --- Screen Shake ---

let shakeFrames = 0;
let shakeX = 0;
let shakeY = 0;

export function triggerShake(frames = 15) {
  shakeFrames = frames;
}

export function updateShake() {
  if (shakeFrames > 0) {
    const intensity = shakeFrames / 15;
    shakeX = (Math.random() - 0.5) * 10 * intensity;
    shakeY = (Math.random() - 0.5) * 10 * intensity;
    shakeFrames--;
  } else {
    shakeX = 0;
    shakeY = 0;
  }
}

export function getShakeOffset(): { x: number; y: number } {
  return { x: shakeX, y: shakeY };
}
