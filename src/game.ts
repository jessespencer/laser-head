import {
  GameState,
  CANVAS_W,
  CANVAS_H,
  COMBO_WINDOW,
  MAX_MULTIPLIER,
  DIFFICULTY_INTERVAL,
  ENEMY_TYPES,
  BG_COLOR,
  setCanvasSize,
} from "./types";
import {
  initStarfield,
  updateStarfield,
  drawStarfield,
  drawCRT,
  spawnExplosion,
  spawnBombExplosion,
  spawnBlastRing,
  updateParticles,
  drawParticles,
  clearParticles,
  updateBlastRings,
  drawBlastRings,
  clearBlastRings,
  triggerShake,
  updateShake,
  getShakeOffset,
} from "./effects";
import { createPlayer, updatePlayer, drawPlayer, getEyePositions } from "./player";
import { spawnLaser, updateLasers, drawLasers, getLasers, clearLasers, spawnUltraLaser, updateUltraLasers, drawUltraLasers, getUltraLasers, clearUltraLasers } from "./laser";
import {
  spawnEnemy,
  updateEnemies,
  drawEnemies,
  getEnemies,
  removeEnemy,
  clearEnemies,
  detonateBomb,
} from "./enemies";
import { drawHUD } from "./hud";
import {
  GAME_OVER_ASCII,
  BANNER_FONT_SIZE,
  BANNER_LINE_HEIGHT,
  BANNER_COLOR,
} from "./asciiTitle";
import { trySpawnPowerUp, updatePowerUp, drawPowerUp, checkPowerUpCollision, clearPowerUp } from "./powerup";
import type { Player } from "./types";
import { ULTRA_DURATION, ULTRA_FIRE_RATE, BOMB_BLAST_RADIUS, BOMB_KILL_BONUS } from "./types";

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let player: Player;
let state: GameState;
let keys: Set<string> = new Set();
let fireRequested = false;
let spawnTimer = 0;
let spawnInterval = 1200;
let animId = 0;
let dpr = 1;
let onRestart: () => void;
let onUpload: () => void;

export function startGame(
  image: HTMLImageElement,
  restartCb: () => void,
  uploadCb: () => void
) {
  canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  ctx = canvas.getContext("2d", { alpha: false })!;

  onRestart = restartCb;
  onUpload = uploadCb;

  // Size the canvas to the viewport before anything reads CANVAS_W/H.
  resize();
  window.addEventListener("resize", resize);

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
    ultraTimer: 0,
  };

  fireRequested = false;
  spawnTimer = 0;
  spawnInterval = 1200;

  clearLasers();
  clearUltraLasers();
  clearEnemies();
  clearParticles();
  clearBlastRings();
  clearPowerUp();
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
  window.removeEventListener("resize", resize);
}

// Fill the viewport at device resolution (DPR capped so 4K/retina fill rate
// stays sane). The world coordinate system tracks CSS pixels 1:1.
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  setCanvasSize(w, h);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  // Re-seed the starfield to the new area and keep the player in-bounds.
  initStarfield();
  if (player) {
    player.x = Math.min(player.x, w - player.width / 2);
    player.y = Math.min(player.y, h - player.height / 2);
  }
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

  // Power-up
  trySpawnPowerUp(state.difficulty);
  updatePowerUp(state.frame);
  if (checkPowerUpCollision(player)) {
    state.ultraTimer = ULTRA_DURATION;
  }
  if (state.ultraTimer > 0) {
    state.ultraTimer--;
    player.firing = true;
  }

  // Fire lasers — normal: one shot per press; ultra: hold space for rapid stream
  if (state.ultraTimer > 0 && firing && state.frame % ULTRA_FIRE_RATE === 0) {
    fireRequested = false;
    const [leftEye, rightEye] = getEyePositions(player);
    spawnUltraLaser(leftEye.x, leftEye.y);
    spawnUltraLaser(rightEye.x, rightEye.y);
  } else if (fireRequested) {
    fireRequested = false;
    const [leftEye, rightEye] = getEyePositions(player);
    spawnLaser(leftEye.x, leftEye.y);
    spawnLaser(rightEye.x, rightEye.y);
  }
  updateLasers();
  updateUltraLasers();

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

        // Bombs trigger detonation instead of taking damage
        if (e.type === "bomb") {
          if (e.detonateTimer === undefined) {
            detonateBomb(ei);
          }
          break;
        }

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

  // Collisions: ultra lasers vs enemies
  const uLasers = getUltraLasers();
  for (let li = uLasers.length - 1; li >= 0; li--) {
    const l = uLasers[li];
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      const halfSize = e.size * 0.5;
      if (
        l.x > e.x - halfSize &&
        l.x < e.x + halfSize &&
        l.y > e.y - halfSize * 1.2 &&
        l.y < e.y + halfSize * 1.2
      ) {
        uLasers.splice(li, 1);

        if (e.type === "bomb") {
          if (e.detonateTimer === undefined) {
            detonateBomb(ei);
          }
          break;
        }

        e.hp--;
        e.flashFrames = 4;

        if (e.hp <= 0) {
          const def = ENEMY_TYPES[e.type];
          spawnExplosion(e.x, e.y, def.color);
          state.combo++;
          state.comboTimer = COMBO_WINDOW;
          state.multiplier = Math.min(MAX_MULTIPLIER, Math.floor(state.combo / 2) + 1);
          state.score += def.points * state.multiplier;
          state.difficulty = Math.floor(state.score / DIFFICULTY_INTERVAL);
          spawnInterval = Math.max(300, 1200 - state.difficulty * 80);
          removeEnemy(ei);
        }
        break;
      }
    }
  }

  // Bomb detonation resolution
  for (let ei = enemies.length - 1; ei >= 0; ei--) {
    const e = enemies[ei];
    if (e.type === "bomb" && e.detonateTimer !== undefined && e.detonateTimer <= 0) {
      // Blast radius kills nearby enemies
      let blastKills = 0;
      for (let oi = enemies.length - 1; oi >= 0; oi--) {
        if (oi === ei) continue;
        const other = enemies[oi];
        const dx = other.x - e.x;
        const dy = other.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BOMB_BLAST_RADIUS) {
          const oDef = ENEMY_TYPES[other.type];
          spawnExplosion(other.x, other.y, oDef.color);
          blastKills++;
          removeEnemy(oi);
          if (oi < ei) ei--;
        }
      }

      // Score
      const bombDef = ENEMY_TYPES["bomb"];
      state.combo++;
      state.comboTimer = COMBO_WINDOW;
      state.multiplier = Math.min(MAX_MULTIPLIER, Math.floor(state.combo / 2) + 1);
      state.score += (bombDef.points + blastKills * BOMB_KILL_BONUS) * state.multiplier;
      state.difficulty = Math.floor(state.score / DIFFICULTY_INTERVAL);
      spawnInterval = Math.max(300, 1200 - state.difficulty * 80);

      // Effects — big blast
      spawnBombExplosion(e.x, e.y);
      spawnBlastRing(e.x, e.y, BOMB_BLAST_RADIUS);
      triggerShake(35);

      removeEnemy(ei);
    }
  }

  // Collisions: enemies vs player
  const pw = player.width * 0.4;
  const ph = player.height * 0.4;
  for (let ei = enemies.length - 1; ei >= 0; ei--) {
    const e = enemies[ei];
    // Bombs don't deal contact damage
    if (e.type === "bomb") continue;
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
  updateBlastRings();
  updateShake();

  // --- Render ---
  // Base transform maps CSS-pixel world coords onto the DPR-scaled backing store.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const shake = getShakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(-10, -10, CANVAS_W + 20, CANVAS_H + 20);

  drawStarfield(ctx);
  drawPlayer(player, ctx);
  drawLasers(ctx);
  drawUltraLasers(ctx);
  drawEnemies(ctx, state.frame);
  drawPowerUp(ctx, state.frame);
  drawParticles(ctx);
  drawBlastRings(ctx);

  ctx.restore();

  drawHUD(ctx, state);
  drawCRT(ctx);
}

const BANNER_LINE_H = BANNER_FONT_SIZE * BANNER_LINE_HEIGHT;

function bannerHeight(art: string): number {
  return art.split("\n").length * BANNER_LINE_H;
}

// Canvas twin of main.ts's asciiTitle(): the red block banner, horizontally
// centered, drawn with its top edge at topY.
function drawBanner(c: CanvasRenderingContext2D, art: string, topY: number) {
  const lines = art.split("\n");
  const maxCols = Math.max(...lines.map((l) => l.length));
  const width = maxCols * BANNER_FONT_SIZE * 0.6; // Roboto Mono advance ≈ 0.6em
  const startX = (CANVAS_W - width) / 2;

  c.save();
  c.textAlign = "left";
  c.textBaseline = "top";
  c.font = `${BANNER_FONT_SIZE}px 'Roboto Mono', monospace`;
  c.fillStyle = BANNER_COLOR;
  c.shadowColor = "rgba(255,40,0,0.55)";
  c.shadowBlur = 6;
  lines.forEach((line, i) => {
    c.fillText(line, startX, topY + i * BANNER_LINE_H);
  });
  c.restore();
}

function drawGameOver() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Dim overlay
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Banner, score and instructions form one vertically-centered stack — same
  // visual flow as the upload / align / controls screens.
  const goH = bannerHeight(GAME_OVER_ASCII);
  const scoreH = 24;
  const instrH = 16;
  const gap1 = 32; // between banner and score
  const gap2 = 24; // between score and instructions
  const totalH = goH + gap1 + scoreH + gap2 + instrH;
  const topY = (CANVAS_H - totalH) / 2;

  drawBanner(ctx, GAME_OVER_ASCII, topY);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "bold 24px 'Roboto Mono', monospace";
  ctx.fillStyle = "#fff";
  ctx.fillText(
    `FINAL SCORE: ${state.score.toString().padStart(6, "0")}`,
    CANVAS_W / 2,
    topY + goH + gap1
  );

  ctx.font = "16px 'Roboto Mono', monospace";
  ctx.fillStyle = "#888";
  ctx.fillText(
    "ENTER to restart  |  ESC for upload screen",
    CANVAS_W / 2,
    topY + goH + gap1 + scoreH + gap2
  );
  ctx.restore();
}
