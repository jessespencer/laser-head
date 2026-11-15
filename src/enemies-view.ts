import { tankCharging, tankShotDirections } from "./tank";
import { getEnemies } from "./enemies";
import { renderX, renderY } from "./motion";
import {
  type EnemyType,
  ENEMY_TYPES,
  BOMB_EYE_BLINK_CYCLE,
  BOMB_EYE_BLINK_DURATION,
} from "./types";

// Enemy drawing. Split from enemies.ts so the rules can run headless; this
// half owns the images and baked sprites.

// Preload enemy images
const enemyImages: Record<EnemyType, HTMLImageElement> = {} as any;
for (const [type, def] of Object.entries(ENEMY_TYPES)) {
  const img = new Image();
  img.src = def.image;
  enemyImages[type as EnemyType] = img;
}

// --- Pre-baked enemy sprites (image + glow baked once per type) ---
// Avoids a per-frame shadowBlur pass on every enemy and the per-frame
// createElement("canvas") that the old hit-flash path allocated.

const GLOW_PAD = 20; // room for shadowBlur bleed

interface EnemySprites {
  drawW: number;
  drawH: number;
  normal: HTMLCanvasElement;
  flashWhite: HTMLCanvasElement;
  flashYellow: HTMLCanvasElement; // only meaningful for bombs
}

const spriteCache: Record<string, EnemySprites> = {};
const spreaderImage = new Image();
spreaderImage.src = "/laser-head/alien-spreader.svg";

function bakeSprite(
  img: HTMLImageElement,
  drawW: number,
  drawH: number,
  glowColor: string,
  tint: string | null
): HTMLCanvasElement {
  // Tinted (or plain) silhouette first...
  const temp = document.createElement("canvas");
  temp.width = drawW;
  temp.height = drawH;
  const tc = temp.getContext("2d")!;
  tc.drawImage(img, 0, 0, drawW, drawH);
  if (tint) {
    tc.globalCompositeOperation = "source-atop";
    tc.fillStyle = tint;
    tc.fillRect(0, 0, drawW, drawH);
  }
  // ...then blit it with a baked shadow to produce the glow.
  const out = document.createElement("canvas");
  out.width = drawW + GLOW_PAD * 2;
  out.height = drawH + GLOW_PAD * 2;
  const oc = out.getContext("2d")!;
  oc.shadowColor = glowColor;
  oc.shadowBlur = 15;
  oc.drawImage(temp, GLOW_PAD, GLOW_PAD);
  return out;
}

function getSprites(type: EnemyType, spreader = false): EnemySprites | null {
  const key = spreader ? "spreader" : type;
  const cached = spriteCache[key];
  if (cached) return cached;
  const img = spreader ? spreaderImage : enemyImages[type];
  if (!img.complete || img.naturalWidth === 0) return null;

  const def = ENEMY_TYPES[type];
  const targetSize = def.size * 1.5;
  const aspect = img.naturalWidth / img.naturalHeight;
  const drawW = aspect >= 1 ? targetSize : targetSize * aspect;
  const drawH = aspect >= 1 ? targetSize / aspect : targetSize;

  const sprites: EnemySprites = {
    drawW,
    drawH,
    normal: bakeSprite(img, drawW, drawH, def.glowColor, null),
    flashWhite: bakeSprite(img, drawW, drawH, "#fff", "#fff"),
    flashYellow: bakeSprite(img, drawW, drawH, "#fff", "#ff0"),
  };
  spriteCache[key] = sprites;
  return sprites;
}

export function drawEnemies(ctx: CanvasRenderingContext2D, frame: number) {
  for (const e of getEnemies()) {
    if (e.flight && e.flight.age < 0) continue;
    const def = ENEMY_TYPES[e.type];
    const sprites = getSprites(e.type, e.attack?.variant === "spreader");
    if (!sprites) continue; // image not loaded yet
    const { drawW, drawH } = sprites;
    const left = renderX(e) - drawW / 2;
    const top = renderY(e) - drawH / 2;

    // Bombs fade out in last 60 frames (~1 second)
    const alpha =
      e.type === "bomb" && e.bombLifetime !== undefined && e.bombLifetime < 60
        ? Math.max(0, e.bombLifetime / 60)
        : 1;

    // Pick the pre-baked variant (glow already inside the sprite).
    let sprite = sprites.normal;
    if (e.flashFrames > 0) {
      sprite =
        e.type === "bomb" && e.detonateTimer !== undefined && e.detonateTimer % 6 >= 3
          ? sprites.flashYellow
          : sprites.flashWhite;
    }

    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, left - GLOW_PAD, top - GLOW_PAD);
    if (alpha !== 1) ctx.globalAlpha = 1;

    if (e.type === "bomb") {
      ctx.save();
      ctx.globalAlpha = alpha * (0.45 + Math.sin(frame * 0.08) * 0.2);
      ctx.strokeStyle = "#ffc879";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(renderX(e), renderY(e), drawW * 0.65, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Bomb eye blink (overlay red rects over eye positions)
    if (e.type === "bomb" && e.detonateTimer === undefined) {
      const cyclePos = frame % BOMB_EYE_BLINK_CYCLE;
      if (cyclePos < BOMB_EYE_BLINK_DURATION) {
        ctx.fillStyle = "#e00";
        const eyeW = drawW * 0.065;
        const eyeH = drawH * 0.08;
        const eyeY = top + drawH * 0.34;
        ctx.fillRect(left + drawW * 0.36 - eyeW / 2, eyeY, eyeW, eyeH);
        ctx.fillRect(left + drawW * 0.64 - eyeW / 2, eyeY, eyeW, eyeH);
      }
    }

    if (e.attack) {
      // Hunters carry a single long cannon; spreaders have paired fins/barrels.
      const x = renderX(e), y = renderY(e);
      ctx.save();
      ctx.fillStyle = e.attack.variant === "hunter" ? "#8cdfff" : "#ffc16e";
      if (e.attack.variant === "hunter") {
        ctx.fillRect(x - drawW * 0.65, y - 3, drawW * 0.3, 6);
        ctx.fillRect(x - 4, top + 5, 8, 5);
      }
      ctx.restore();
    }
    if (e.attack && tankCharging(e.attack)) {
      ctx.save();
      ctx.strokeStyle = "#ffad50";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const aim of tankShotDirections(e.attack)) {
        ctx.moveTo(renderX(e) + aim.x * 30, renderY(e) + aim.y * 30);
        ctx.lineTo(renderX(e) + aim.x * 100, renderY(e) + aim.y * 100);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(renderX(e), renderY(e), drawW * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // HP pips for multi-HP enemies
    if (e.maxHp > 1) {
      const pipY = renderY(e) + drawH / 2 + 6;
      const pipSpacing = 8;
      const startX = renderX(e) - ((e.maxHp - 1) * pipSpacing) / 2;
      for (let p = 0; p < e.maxHp; p++) {
        ctx.fillStyle = p < e.hp ? def.color : "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.arc(startX + p * pipSpacing, pipY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
