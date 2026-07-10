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
  // Scale star count with screen area so a fullscreen field isn't sparse.
  const areaFactor = Math.min(4, Math.max(1, (CANVAS_W * CANVAS_H) / (800 * 600)));
  for (const layer of STAR_LAYERS) {
    const count = Math.round(layer.count * areaFactor);
    for (let i = 0; i < count; i++) {
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
// A single repeating scanline pattern instead of hundreds of fillRects/frame.

let crtPattern: CanvasPattern | null = null;

export function drawCRT(ctx: CanvasRenderingContext2D) {
  if (!crtPattern) {
    const tile = document.createElement("canvas");
    tile.width = 1;
    tile.height = 3;
    const tctx = tile.getContext("2d")!;
    tctx.fillStyle = "rgba(0,0,0,0.06)";
    tctx.fillRect(0, 0, 1, 1); // 1px dark line every 3px
    crtPattern = ctx.createPattern(tile, "repeat");
  }
  if (crtPattern) {
    ctx.fillStyle = crtPattern;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
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
  // Hard cap: drop the oldest if simultaneous blasts pile up.
  if (particles.length > 700) {
    particles.splice(0, particles.length - 700);
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

export function spawnBombExplosion(x: number, y: number) {
  const colors = ["#f44", "#f80", "#ff0", "#fa0", "#f22", "#ff4", "#fff"];
  // Outer ring — fast, wide spread
  for (let i = 0; i < 40; i++) {
    const angle = (Math.PI * 2 * i) / 40 + (Math.random() - 0.5) * 0.2;
    const speed = 5 + Math.random() * 8;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      color: colors[i % colors.length],
      size: 5 + Math.random() * 8,
    });
  }
  // Mid ring — medium speed
  for (let i = 0; i < 20; i++) {
    const angle = (Math.PI * 2 * i) / 20 + 0.1;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      color: "#fff",
      size: 6 + Math.random() * 6,
    });
  }
  // Inner cluster — slow, big, bright
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 8 + Math.random() * 10,
    });
  }
  // Massive central flash
  particles.push({ x, y, vx: 0, vy: 0, alpha: 1, color: "#fff", size: 60 });
}

// --- Blast Rings ---

interface BlastRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

let blastRings: BlastRing[] = [];

export function spawnBlastRing(x: number, y: number, maxRadius: number) {
  blastRings.push({ x, y, radius: 10, maxRadius, alpha: 1 });
}

export function updateBlastRings() {
  for (let i = blastRings.length - 1; i >= 0; i--) {
    const r = blastRings[i];
    const expandSpeed = r.maxRadius / 20;
    r.radius += expandSpeed;
    r.alpha = Math.max(0, 1 - r.radius / r.maxRadius);
    if (r.alpha <= 0) {
      blastRings.splice(i, 1);
    }
  }
}

export function drawBlastRings(ctx: CanvasRenderingContext2D) {
  for (const r of blastRings) {
    const progress = r.radius / r.maxRadius;
    ctx.save();
    ctx.globalAlpha = r.alpha;
    ctx.strokeStyle = `rgb(255, ${Math.floor(100 + 155 * (1 - progress))}, 0)`;
    ctx.lineWidth = 4 * (1 - progress) + 1;
    ctx.shadowColor = "rgba(255, 60, 0, 0.8)";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function clearBlastRings() {
  blastRings = [];
}

// --- Screen Shake ---

let shakeFrames = 0;
let shakeDuration = 15;
let shakeX = 0;
let shakeY = 0;

export function triggerShake(frames = 15) {
  shakeFrames = frames;
  shakeDuration = frames;
}

export function updateShake() {
  if (shakeFrames > 0) {
    const intensity = shakeFrames / shakeDuration;
    shakeX = (Math.random() - 0.5) * 14 * intensity;
    shakeY = (Math.random() - 0.5) * 14 * intensity;
    shakeFrames--;
  } else {
    shakeX = 0;
    shakeY = 0;
  }
}

export function getShakeOffset(): { x: number; y: number } {
  return { x: shakeX, y: shakeY };
}
