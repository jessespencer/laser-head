import { getPowerUp } from "./powerup";
import { renderX, renderY } from "./motion";
import { POWER_TIERS, type PowerTier } from "./power";

// Power-up drawing, split from powerup.ts so the rules can run headless.

// Preload one pickup sprite per tier.
const tierImages = {} as Record<PowerTier, HTMLImageElement>;
for (const def of Object.values(POWER_TIERS)) {
  const img = new Image();
  img.src = def.image;
  tierImages[def.tier] = img;
}

export function drawPowerUp(ctx: CanvasRenderingContext2D, frame: number) {
  const p = getPowerUp();
  if (!p) return;

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
