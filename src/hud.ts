import { GameState, CANVAS_W, ULTRA_DURATION } from "./types";

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

  // Ultra laser timer bar
  if (state.ultraTimer > 0) {
    const barW = 120;
    const barH = 8;
    const barX = 16;
    const barY = 68;
    const fill = state.ultraTimer / ULTRA_DURATION;

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = `rgba(255, ${Math.floor(120 + fill * 80)}, ${Math.floor(20 + fill * 40)}, 0.9)`;
    ctx.shadowColor = "rgba(255,80,0,0.8)";
    ctx.shadowBlur = 8;
    ctx.fillRect(barX, barY, barW * fill, barH);
    ctx.shadowBlur = 0;

    ctx.font = "bold 10px 'Roboto Mono', monospace";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText("ULTRA", barX + barW + 6, barY + 8);
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
