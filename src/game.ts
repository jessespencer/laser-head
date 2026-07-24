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
import {
  submitRun,
  getPersonalBest,
  getPlayerToken,
  getPlayerName,
  makeThumbnail,
  type RunSummary,
  type LeaderboardEntry,
} from "./leaderboard";
import { LASER_CORE, LASER_MID, LASER_GLOW } from "./types";
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

// Populated once when the run ends (see endGame). Read by drawGameOver.
let topBoard: LeaderboardEntry[] = [];
let personalBest: RunSummary | null = null; // best run so far, including this one
let isNewBest = false; // did this run set a new personal best?

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
    kills: 0,
    maxCombo: 0,
    shakeFrames: 0,
    gameOver: false,
    paused: false,
    frame: 0,
    ultraTimer: 0,
  };

  fireRequested = false;
  spawnTimer = 0;
  spawnInterval = 1200;
  topBoard = [];
  personalBest = null;
  isNewBest = false;

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

// A single kill-event: bump combo, apply the combo multiplier to `basePoints`,
// ramp difficulty, and record telemetry. `killCount` is how many enemies this
// event destroyed (>1 for a bomb blast) — it feeds run telemetry only; combo
// and the multiplier advance once per event, matching the original behavior.
function recordKill(basePoints: number, killCount: number) {
  state.combo++;
  state.comboTimer = COMBO_WINDOW;
  state.multiplier = Math.min(MAX_MULTIPLIER, Math.floor(state.combo / 2) + 1);
  state.score += basePoints * state.multiplier;
  state.difficulty = Math.floor(state.score / DIFFICULTY_INTERVAL);
  spawnInterval = Math.max(300, 1200 - state.difficulty * 80);

  state.kills += killCount;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;
}

// End the run and submit its summary to the leaderboard exactly once. Async and
// fire-and-forget: drawGameOver renders immediately and picks up topBoard /
// personalBest on a later frame once the (currently local) store resolves.
async function endGame() {
  if (state.gameOver) return; // guard against double-submit
  state.gameOver = true;

  const summary: RunSummary = {
    name: getPlayerName(),
    score: state.score,
    kills: state.kills,
    maxCombo: state.maxCombo,
    framesSurvived: state.frame,
    difficulty: state.difficulty,
    avatarThumb: makeThumbnail(player.image),
    playerToken: getPlayerToken(),
    ts: Date.now(),
  };

  // Compare against the stored best BEFORE submitting to flag a new record.
  const prior = await getPersonalBest();
  isNewBest = prior === null || summary.score > prior.score;

  topBoard = await submitRun(summary);
  personalBest =
    topBoard.find((r) => r.playerToken === summary.playerToken) ?? summary;
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

          recordKill(def.points, 1);

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
          recordKill(def.points, 1);
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

      // Score — bomb itself plus every enemy caught in the blast
      const bombDef = ENEMY_TYPES["bomb"];
      recordKill(bombDef.points + blastKills * BOMB_KILL_BONUS, 1 + blastKills);

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
        void endGame();
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

// ── Leaderboard panel (game-over screen) ─────────────────────────────

const LB_MAX_ROWS = 5;
const LB_ROW_H = 44;
const LB_HEAD = 34;
const LB_WIDTH = 460;
const LB_HEADING_H = 22;
const LB_HEADING_GAP = 10;

// Decoded avatar thumbnails, cached by data URL so we build each Image once.
const thumbCache = new Map<string, HTMLImageElement>();

function getThumbImage(dataUrl: string): HTMLImageElement | null {
  if (!dataUrl) return null;
  let img = thumbCache.get(dataUrl);
  if (!img) {
    img = new Image();
    img.src = dataUrl;
    thumbCache.set(dataUrl, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function leaderboardHeight(rows: number): number {
  if (rows <= 0) return 0;
  return LB_HEADING_H + LB_HEADING_GAP + Math.min(rows, LB_MAX_ROWS) * LB_ROW_H;
}

// The top-N board: a heading, then one row per player — rank, avatar head,
// name, score. The #1 head fires a pair of animated lasers.
function drawLeaderboard(
  c: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  entries: LeaderboardEntry[]
) {
  const me = getPlayerToken();
  const left = centerX - LB_WIDTH / 2;

  c.save();
  c.textBaseline = "middle";

  // Heading
  c.textAlign = "center";
  c.font = "bold 13px 'Roboto Mono', monospace";
  c.fillStyle = "#556";
  c.fillText("— TOP HEADS —", centerX, topY + LB_HEADING_H / 2);

  const rows = entries.slice(0, LB_MAX_ROWS);
  let rowY = topY + LB_HEADING_H + LB_HEADING_GAP;

  for (const entry of rows) {
    const mid = rowY + LB_ROW_H / 2;
    const isMe = entry.playerToken === me;

    // Row background — highlight the current player's row.
    if (isMe) {
      c.fillStyle = "rgba(102,204,255,0.10)";
      c.fillRect(left, rowY + 2, LB_WIDTH, LB_ROW_H - 4);
    }

    // Rank
    c.textAlign = "left";
    c.font = "bold 18px 'Roboto Mono', monospace";
    c.fillStyle = entry.rank === 1 ? BANNER_COLOR : "#778";
    c.fillText(`#${entry.rank}`, left + 8, mid);

    // Avatar head (or a silhouette placeholder)
    const headX = left + 56;
    const headY = mid - LB_HEAD / 2;
    const img = getThumbImage(entry.avatarThumb);
    if (img) {
      c.drawImage(img, headX, headY, LB_HEAD, LB_HEAD);
    } else {
      c.fillStyle = "#223";
      c.beginPath();
      c.arc(headX + LB_HEAD / 2, mid, LB_HEAD / 2, 0, Math.PI * 2);
      c.fill();
    }

    // #1 fires lasers from its eyes.
    if (entry.rank === 1) {
      drawBoardLasers(c, mid, headX + LB_HEAD);
    }

    // Name
    c.textAlign = "left";
    c.font = "bold 15px 'Roboto Mono', monospace";
    c.fillStyle = isMe ? "#9df" : "#ccd";
    c.fillText(entry.name, headX + LB_HEAD + 16, mid);

    // Score, right-aligned
    c.textAlign = "right";
    c.font = "bold 15px 'Roboto Mono', monospace";
    c.fillStyle = "#fff";
    c.fillText(entry.score.toString().padStart(6, "0"), left + LB_WIDTH - 8, mid);

    rowY += LB_ROW_H;
  }

  c.restore();
}

// A short animated laser pair streaking off the #1 head, reusing the in-game
// laser gradient. Length pulses with the frame counter.
function drawBoardLasers(
  c: CanvasRenderingContext2D,
  eyeY: number,
  startX: number
) {
  const pulse = 0.6 + 0.4 * Math.sin(state.frame * 0.15);
  const len = 26 * pulse;
  const grad = c.createLinearGradient(startX, 0, startX + len, 0);
  grad.addColorStop(0, LASER_CORE);
  grad.addColorStop(0.4, LASER_MID);
  grad.addColorStop(1, LASER_GLOW);

  c.save();
  c.strokeStyle = grad;
  c.lineCap = "round";
  c.shadowColor = LASER_GLOW;
  c.shadowBlur = 8;
  for (const dy of [-5, 5]) {
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(startX, eyeY + dy);
    c.lineTo(startX + len, eyeY + dy);
    c.stroke();
  }
  c.restore();
}

function drawGameOver() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Dim overlay
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Banner, score, personal-best, leaderboard and instructions form one
  // vertically-centered stack — same visual flow as the other screens.
  const goH = bannerHeight(GAME_OVER_ASCII);
  const scoreH = 24;
  const bestH = 18;
  const instrH = 16;
  const boardH = leaderboardHeight(topBoard.length);
  const gap1 = 32; // between banner and score
  const gapBest = 12; // between score and personal-best
  const gapBoard = 28; // between personal-best and leaderboard
  const gap2 = 24; // between leaderboard and instructions
  const totalH =
    goH + gap1 + scoreH + gapBest + bestH +
    (boardH ? gapBoard + boardH : 0) + gap2 + instrH;
  const topY = (CANVAS_H - totalH) / 2;

  drawBanner(ctx, GAME_OVER_ASCII, topY);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const scoreY = topY + goH + gap1;
  ctx.font = "bold 24px 'Roboto Mono', monospace";
  ctx.fillStyle = "#fff";
  ctx.fillText(
    `FINAL SCORE: ${state.score.toString().padStart(6, "0")}`,
    CANVAS_W / 2,
    scoreY
  );

  // Personal best (or a "new best" flourish). Null until the async submit
  // resolves — a frame or two after game over — so guard it.
  const bestY = scoreY + scoreH + gapBest;
  ctx.font = "bold 16px 'Roboto Mono', monospace";
  if (isNewBest) {
    ctx.fillStyle = BANNER_COLOR;
    ctx.fillText("★ NEW PERSONAL BEST ★", CANVAS_W / 2, bestY);
  } else if (personalBest) {
    ctx.fillStyle = "#6cf";
    ctx.fillText(
      `PERSONAL BEST: ${personalBest.score.toString().padStart(6, "0")}`,
      CANVAS_W / 2,
      bestY
    );
  }

  ctx.restore();

  // Leaderboard panel (once the async submit has populated topBoard).
  const boardY = bestY + bestH + gapBoard;
  if (boardH) {
    drawLeaderboard(ctx, CANVAS_W / 2, boardY, topBoard);
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "16px 'Roboto Mono', monospace";
  ctx.fillStyle = "#888";
  ctx.fillText(
    "ENTER to restart  |  ESC for upload screen",
    CANVAS_W / 2,
    boardY + (boardH ? boardH + gap2 : 0)
  );
  ctx.restore();
}
