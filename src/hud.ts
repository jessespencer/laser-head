import { GameState, CANVAS_W } from "./types";
import { POWER_TIERS } from "./power";

export function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.save();

  // Score — top-left
  ctx.font = "bold 20px 'Roboto Mono', monospace";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE: ${state.score.toString().padStart(6, "0")}`, 16, 32);

  // Lives — red dots below score
  for (let i = 0; i < state.lives; i++) {
    ctx.fillStyle = "#f22";
    ctx.beginPath();
    ctx.arc(24 + i * 20, 52, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Active power-up tier: one bar, coloured and labelled by tier.
  if (state.powerTier && state.powerTimer > 0) {
    const def = POWER_TIERS[state.powerTier];
    const barW = 120;
    const barH = 8;
    const barX = 16;
    const barY = 68;
    const fill = Math.min(1, state.powerTimer / def.duration);

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = def.color;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 8;
    ctx.fillRect(barX, barY, barW * fill, barH);
    ctx.shadowBlur = 0;

    // Trailing pips (one per rank) make the ladder legible mid-fight.
    ctx.font = "bold 10px 'Roboto Mono', monospace";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(`${def.label} ${"\u25b8".repeat(def.rank)}`, barX + barW + 6, barY + 8);
  }

  // Combo — top center
  if (state.multiplier > 1) {
    ctx.textAlign = "center";
    ctx.font = "bold 24px 'Roboto Mono', monospace";
    ctx.fillStyle = `rgba(255,${100 + state.multiplier * 20},0,${0.7 + state.multiplier * 0.04})`;
    ctx.shadowColor = "rgba(255,60,0,0.8)";
    ctx.shadowBlur = 10;
    ctx.fillText(`${state.multiplier}x COMBO`, CANVAS_W / 2, 36);
  }

  ctx.restore();
}
