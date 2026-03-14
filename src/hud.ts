import { GameState, CANVAS_W } from "./types";

export function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.save();

  // Score — top-left
  ctx.font = "bold 20px 'Courier New', monospace";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE: ${state.score.toString().padStart(8, "0")}`, 16, 32);

  // Lives — red dots below score
  for (let i = 0; i < state.lives; i++) {
    ctx.fillStyle = "#f22";
    ctx.beginPath();
    ctx.arc(24 + i * 20, 52, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Combo — top center
  if (state.multiplier > 1) {
    ctx.textAlign = "center";
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.fillStyle = `rgba(255,${100 + state.multiplier * 20},0,${0.7 + state.multiplier * 0.04})`;
    ctx.shadowColor = "rgba(255,60,0,0.8)";
    ctx.shadowBlur = 10;
    ctx.fillText(`${state.multiplier}x COMBO`, CANVAS_W / 2, 36);
  }

  ctx.restore();
}
