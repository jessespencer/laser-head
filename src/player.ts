import { rememberPosition, renderX, renderY } from "./motion";
import { Player, CANVAS_W, CANVAS_H, PLAYER_SPEED, PLAYER_SIZE } from "./types";

let tintSprite: HTMLCanvasElement | null = null;
let tintImage: HTMLImageElement | null = null;

function getTint(image: HTMLImageElement, width: number, height: number) {
  if (tintSprite && tintImage === image && tintSprite.width === width && tintSprite.height === height) return tintSprite;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d")!;
  g.drawImage(image, 0, 0, width, height);
  g.globalCompositeOperation = "source-in";
  const gradient = g.createRadialGradient(width / 2, height * 0.35, 0, width / 2, height * 0.35, width * 0.6);
  gradient.addColorStop(0, "rgba(255,0,0,0.5)");
  gradient.addColorStop(1, "rgba(255,0,0,0.1)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, width, height);
  tintSprite = c;
  tintImage = image;
  return c;
}

// Pre-baked red halo disc (drawn additively, scaled by glow intensity).
let haloSprite: HTMLCanvasElement | null = null;
let haloRadius = 0;
function getHalo(width: number): HTMLCanvasElement {
  if (haloSprite && haloRadius === width * 0.8) return haloSprite;
  haloRadius = width * 0.8;
  const d = Math.ceil(haloRadius * 2);
  const c = document.createElement("canvas");
  c.width = d;
  c.height = d;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(
    haloRadius, haloRadius, 0,
    haloRadius, haloRadius, haloRadius
  );
  grad.addColorStop(0, "rgba(255,30,0,0.4)");
  grad.addColorStop(1, "rgba(255,0,0,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(haloRadius, haloRadius, haloRadius, 0, Math.PI * 2);
  g.fill();
  haloSprite = c;
  return haloSprite;
}

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
  rememberPosition(player);
  // Movement
  const dx = Number(keys.has("arrowright") || keys.has("d")) - Number(keys.has("arrowleft") || keys.has("a"));
  const dy = Number(keys.has("arrowdown") || keys.has("s")) - Number(keys.has("arrowup") || keys.has("w"));
  const scale = dx && dy ? Math.SQRT1_2 : 1;
  player.x += dx * PLAYER_SPEED * scale;
  player.y += dy * PLAYER_SPEED * scale;

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

export function drawPlayer(player: Player, ctx: CanvasRenderingContext2D, plasma = false) {
  const { width, height, image, glowIntensity } = player;
  const x = renderX(player), y = renderY(player);
  const left = x - width / 2;
  const top = y - height / 2;

  // Red halo behind head — baked disc, additive, intensity via alpha
  if (glowIntensity > 0) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = glowIntensity;
    const halo = getHalo(width);
    ctx.drawImage(halo, x - halo.width / 2, y - halo.height / 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }

  // Draw the head
  ctx.drawImage(image, left, top, width, height);

  if (plasma) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#baffff";
    ctx.strokeStyle = "#43dfff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, width * 0.58, -0.55, 0.55);
    ctx.stroke();
    ctx.restore();
  }

  // The avatar mask and gradient are baked once; only intensity changes.
  if (glowIntensity > 0) {
    ctx.save();
    ctx.globalAlpha = glowIntensity;
    ctx.drawImage(getTint(image, width, height), left, top);
    ctx.restore();
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
