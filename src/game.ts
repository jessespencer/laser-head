import {
  GameState,
  CANVAS_W,
  CANVAS_H,
  COMBO_WINDOW,
  MAX_MULTIPLIER,
  DIFFICULTY_INTERVAL,
  ENEMY_TYPES,
  BG_COLOR,
} from "./types";
import {
  initStarfield,
  updateStarfield,
  drawStarfield,
  drawCRT,
  spawnExplosion,
  updateParticles,
  drawParticles,
  clearParticles,
  triggerShake,
  updateShake,
  getShakeOffset,
} from "./effects";
import { createPlayer, updatePlayer, drawPlayer, getEyePositions } from "./player";
import { spawnLaser, updateLasers, drawLasers, getLasers, clearLasers } from "./laser";
import {
  spawnEnemy,
  updateEnemies,
  drawEnemies,
  getEnemies,
  removeEnemy,
  clearEnemies,
} from "./enemies";
import { drawHUD } from "./hud";
import type { Player } from "./types";

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let player: Player;
let state: GameState;
let keys: Set<string> = new Set();
let fireRequested = false;
let spawnTimer = 0;
let spawnInterval = 1200;
let animId = 0;
let onRestart: () => void;
let onUpload: () => void;

export function startGame(
  image: HTMLImageElement,
  restartCb: () => void,
  uploadCb: () => void
) {
  canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  ctx = canvas.getContext("2d")!;

  onRestart = restartCb;
  onUpload = uploadCb;

  // Init state
  player = createPlayer(image);
  state = {
    score: 0,
    lives: 8,
    combo: 0,
    multiplier: 1,
    comboTimer: 0,
    difficulty: 0,
    shakeFrames: 0,
    gameOver: false,
    paused: false,
    frame: 0,
  };

  fireRequested = false;
  spawnTimer = 0;
  spawnInterval = 1200;

  clearLasers();
  clearEnemies();
  clearParticles();
  initStarfield();

  // Input
  keys.clear();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Start loop
  if (animId) cancelAnimationFrame(animId);
  loop();
}

function onKeyDown(e: KeyboardEvent) {
  // Prevent browser default for game keys (space scrolls page, arrow keys too)
  if (e.key === " " || e.key.startsWith("Arrow")) {
    e.preventDefault();
  }
  if (e.repeat) return;
  keys.add(e.key);

  if (e.key === " " && !state.gameOver) {
    fireRequested = true;
  }

  if (state.gameOver) {
    if (e.key === "Enter") {
      cleanup();
      onRestart();
    } else if (e.key === "Escape") {
      cleanup();
      onUpload();
    }
  } else if (e.key === "Escape") {
    cleanup();
    onUpload();
  }
}

function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.key);
}

function cleanup() {
  cancelAnimationFrame(animId);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
}

function loop() {
  animId = requestAnimationFrame(loop);

  if (state.gameOver) {
    drawGameOver();
    return;
  }

  state.frame++;

  // --- Update ---
  updateStarfield();

  const firing = keys.has(" ");
  updatePlayer(player, keys, firing);

  // Spawn enemies
  spawnTimer++;
  if (spawnTimer >= spawnInterval / 16.67) {
    // approximate frame-based interval
    spawnEnemy(state.difficulty);
    spawnTimer = 0;
  }
  updateEnemies(state.frame);

  // Fire lasers (one shot per press)
  if (fireRequested) {
    fireRequested = false;
    const [leftEye, rightEye] = getEyePositions(player);
    spawnLaser(leftEye.x, leftEye.y);
    spawnLaser(rightEye.x, rightEye.y);
  }
  updateLasers();

  // Combo timer
  if (state.comboTimer > 0) {
    state.comboTimer--;
    if (state.comboTimer <= 0) {
      state.combo = 0;
      state.multiplier = 1;
    }
  }

  // Collisions: lasers vs enemies
  const lasers = getLasers();
  const enemies = getEnemies();

  for (let li = lasers.length - 1; li >= 0; li--) {
    const l = lasers[li];
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      const halfSize = e.size * 0.5;
      if (
        l.x > e.x - halfSize &&
        l.x < e.x + halfSize &&
        l.y > e.y - halfSize * 1.2 &&
        l.y < e.y + halfSize * 1.2
      ) {
        // Hit!
        lasers.splice(li, 1);
        e.hp--;
        e.flashFrames = 4;

        if (e.hp <= 0) {
          // Destroyed
          const def = ENEMY_TYPES[e.type];
          spawnExplosion(e.x, e.y, def.color);

          // Score with combo
          state.combo++;
          state.comboTimer = COMBO_WINDOW;
          state.multiplier = Math.min(MAX_MULTIPLIER, Math.floor(state.combo / 2) + 1);
          state.score += def.points * state.multiplier;

          // Difficulty ramp
          state.difficulty = Math.floor(state.score / DIFFICULTY_INTERVAL);
          spawnInterval = Math.max(300, 1200 - state.difficulty * 80);

          removeEnemy(ei);
        }
        break;
      }
    }
  }

  // Collisions: enemies vs player
  const pw = player.width * 0.4;
  const ph = player.height * 0.4;
  for (let ei = enemies.length - 1; ei >= 0; ei--) {
    const e = enemies[ei];
    const halfSize = e.size * 0.4;
    if (
      player.x - pw < e.x + halfSize &&
      player.x + pw > e.x - halfSize &&
      player.y - ph < e.y + halfSize &&
      player.y + ph > e.y - halfSize
    ) {
      // Player hit
      state.lives--;
      state.combo = 0;
      state.multiplier = 1;
      state.comboTimer = 0;
      triggerShake(15);
      spawnExplosion(e.x, e.y, "#f44");
      removeEnemy(ei);

      if (state.lives <= 0) {
        state.gameOver = true;
      }
    }
  }

  updateParticles();
  updateShake();

  // --- Render ---
  const shake = getShakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(-10, -10, CANVAS_W + 20, CANVAS_H + 20);

  drawStarfield(ctx);
  drawPlayer(player, ctx);
  drawLasers(ctx);
  drawEnemies(ctx);
  drawParticles(ctx);

  ctx.restore();

  drawHUD(ctx, state);
  drawCRT(ctx);
}

function drawGameOver() {
  // Dim overlay
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.save();
  ctx.textAlign = "center";

  // GAME OVER
  ctx.font = "bold 48px 'Courier New', monospace";
  ctx.fillStyle = "#f22";
  ctx.shadowColor = "#f00";
  ctx.shadowBlur = 20;
  ctx.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 40);

  // Final score
  ctx.font = "bold 24px 'Courier New', monospace";
  ctx.fillStyle = "#fff";
  ctx.shadowBlur = 0;
  ctx.fillText(
    `FINAL SCORE: ${state.score.toString().padStart(8, "0")}`,
    CANVAS_W / 2,
    CANVAS_H / 2 + 10
  );

  // Instructions
  ctx.font = "16px 'Courier New', monospace";
  ctx.fillStyle = "#888";
  ctx.fillText("ENTER to restart  |  ESC for upload screen", CANVAS_W / 2, CANVAS_H / 2 + 50);

  ctx.restore();
}
