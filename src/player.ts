import { Player, CANVAS_W, CANVAS_H, PLAYER_SPEED, PLAYER_SIZE } from "./types";

let glowCanvas: OffscreenCanvas | null = null;
let glowCtx: OffscreenCanvasRenderingContext2D | null = null;

export function createPlayer(image: HTMLImageElement): Player {
  return {
    x: 120,
    y: CANVAS_H / 2,
    image,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    glowIntensity: 0,
    firing: false,
  };
}

export function updatePlayer(
  player: Player,
  keys: Set<string>,
  firing: boolean
) {
  // Movement
  if (keys.has("ArrowUp") || keys.has("w")) player.y -= PLAYER_SPEED;
  if (keys.has("ArrowDown") || keys.has("s")) player.y += PLAYER_SPEED;
  if (keys.has("ArrowLeft") || keys.has("a")) player.x -= PLAYER_SPEED;
  if (keys.has("ArrowRight") || keys.has("d")) player.x += PLAYER_SPEED;

  // Clamp to bounds
  const hw = player.width / 2;
  const hh = player.height / 2;
  player.x = Math.max(hw, Math.min(CANVAS_W - hw, player.x));
  player.y = Math.max(hh, Math.min(CANVAS_H - hh, player.y));

  // Glow intensity
  player.firing = firing;
  if (firing) {
    player.glowIntensity = Math.min(1, player.glowIntensity + 1 / 6);
  } else {
    player.glowIntensity = Math.max(0, player.glowIntensity - 1 / 12);
  }
}

export function drawPlayer(player: Player, ctx: CanvasRenderingContext2D) {
  const { x, y, width, height, image, glowIntensity } = player;
  const left = x - width / 2;
  const top = y - height / 2;

  // Red halo behind head
  if (glowIntensity > 0) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(x, y, 0, x, y, width * 0.8);
    grad.addColorStop(0, `rgba(255,30,0,${0.4 * glowIntensity})`);
    grad.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, width * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = prev;
  }

  // Draw the head
  ctx.drawImage(image, left, top, width, height);

  // Red tint overlay on the face when glowing
  if (glowIntensity > 0) {
    // Use offscreen canvas for source-atop compositing
    if (!glowCanvas) {
      glowCanvas = new OffscreenCanvas(width, height);
      glowCtx = glowCanvas.getContext("2d");
    }
    if (glowCtx) {
      glowCanvas.width = width;
      glowCanvas.height = height;
      glowCtx.clearRect(0, 0, width, height);
      glowCtx.drawImage(image, 0, 0, width, height);
      glowCtx.globalCompositeOperation = "source-atop";
      const grad = glowCtx.createRadialGradient(
        width / 2,
        height * 0.35,
        0,
        width / 2,
        height * 0.35,
        width * 0.6
      );
      grad.addColorStop(0, `rgba(255,0,0,${0.5 * glowIntensity})`);
      grad.addColorStop(1, `rgba(255,0,0,${0.1 * glowIntensity})`);
      glowCtx.fillStyle = grad;
      glowCtx.fillRect(0, 0, width, height);
      glowCtx.globalCompositeOperation = "source-over";

      ctx.drawImage(glowCanvas, left, top);
    }
  }
}

/** Get the two eye laser origin positions */
export function getEyePositions(
  player: Player
): [{ x: number; y: number }, { x: number; y: number }] {
  const eyeY = player.y; // eyes at center of cropped/aligned image
  return [
    { x: player.x - player.width * 0.08, y: eyeY }, // left eye
    { x: player.x + player.width * 0.08, y: eyeY }, // right eye
  ];
}
