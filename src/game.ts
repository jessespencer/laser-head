import { refineryChapter } from './refinery';
import { drawRefineryBackground, drawFacilities } from './refinery-view';
import { unlockAudio, toggleSound, soundMuted, pauseAudio } from "./audio";
import { drawBoss } from "./boss-view";
import { drawEnemyShots } from "./enemy-shots";
import { setRenderBlend, renderX, renderY } from "./motion";
import { createClock } from "./timing";
import { CANVAS_W, CANVAS_H, BG_COLOR, setCanvasSize } from "./types";
import {
  initStarfield,
  drawStarfield,
  drawCRT,
  drawParticles,
  drawBlastRings,
  getShakeOffset,
} from "./effects";
import { drawPlayer } from "./player";
import { drawLasers, drawUltraLasers } from "./laser";
import { drawEnemies } from "./enemies-view";
import { drawHUD } from "./hud";
import {
  GAME_OVER_ASCII,
  BANNER_FONT_SIZE,
  BANNER_LINE_HEIGHT,
  BANNER_COLOR,
} from "./asciiTitle";
import { drawPowerUp } from "./powerup-view";
import {
  submitRun,
  qualifies,
  getPersonalBest,
  getPlayerToken,
  getPlayerName,
  setPlayerName,
  makeThumbnail,
  LEADERBOARD_SIZE,
  type RunSummary,
  type LeaderboardEntry,
} from "./leaderboard";
import { createSim, stepSim, type Sim, type SimInput } from "./sim";
import { createFrameStats, type FrameReport } from "./frame-stats";
import { particleCount } from "./effects";
import { getEnemies } from "./enemies";
import { seedRandom, unseedRandom } from "./rng";
import { driveScene, type SceneName } from "./stress";

// The browser shell around the simulation: canvas, input, the frame loop,
// rendering and the game-over / leaderboard screens. The rules themselves are
// in sim.ts and never touch anything in this file.

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let sim: Sim;
const input: SimInput = { keys: new Set(), fireRequested: false };
const keys = input.keys;
const clock = createClock();
let animId = 0;
let dpr = 1;
let onRestart: () => void;
let onUpload: () => void;

let runEnded = false; // endGame has started for this run

/** A seeded scene to fly on screen with frame timings instead of a player's
 * run. Opened with ?bench=<scene>; nothing it does reaches the leaderboard. */
export interface BenchScene { name: SceneName; seed: number }
let bench: BenchScene | null = null;
let benchTick = 0;
let benchLastFrame = 0; // rAF timestamp of the previous recorded frame; 0 = none
let benchLabel = "";
const frameStats = createFrameStats();
declare global {
  interface Window { __laserHeadBench?: () => FrameReport & { scene: string; seed: number; width: number; height: number; dpr: number } }
}

// Populated once when the run ends (see endGame). Read by drawGameOver.
let topBoard: LeaderboardEntry[] = [];
let personalBest: RunSummary | null = null; // best run so far, including this one
let isNewBest = false; // did this run set a new personal best?
let placedRank = 0; // this run's rank on the board (0 if it didn't place)
let priorBest: RunSummary | null = null; // best BEFORE this run, for isNewBest

// Arcade initials entry, shown on game over only when the run places.
const NAME_LEN = 3;
const NAME_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
let enteringName = false;
let nameChars: string[] = [];
let nameSlot = 0;

export function startGame(
  image: HTMLImageElement,
  restartCb: () => void,
  uploadCb: () => void,
  initialSector: 1 | 2 = 1,
  benchScene: BenchScene | null = null
) {
  canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  ctx = canvas.getContext("2d", { alpha: false })!;

  unlockAudio();
  pauseAudio(false);
  onRestart = restartCb;
  onUpload = uploadCb;

  // Size the canvas to the viewport before anything reads CANVAS_W/H.
  resize();
  window.addEventListener("resize", resize);

  bench = benchScene;
  benchTick = 0;
  benchLastFrame = 0;
  benchLabel = "";
  frameStats.reset();
  if (bench) {
    const { name, seed } = bench;
    seedRandom(seed);
    window.__laserHeadBench = () => ({ ...frameStats.report(), scene: name, seed, width: CANVAS_W, height: CANVAS_H, dpr });
  } else unseedRandom();

  sim = createSim(image, initialSector);

  input.fireRequested = false;
  clock.reset();
  runEnded = false;
  topBoard = [];
  personalBest = null;
  isNewBest = false;
  placedRank = 0;
  priorBest = null;
  enteringName = false;
  nameChars = [];
  nameSlot = 0;

  // Input
  keys.clear();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  // A bench keeps running while the window is merely unfocused, so it can be
  // left alone to collect frames.
  if (!bench) window.addEventListener("blur", pauseGame);
  document.addEventListener("visibilitychange", onVisibilityChange);

  // Start loop
  if (animId) cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}


function onKeyDown(e: KeyboardEvent) {
  // Prevent browser default for game keys (space scrolls page, arrow keys too)
  if (e.key === " " || e.key.startsWith("Arrow")) {
    e.preventDefault();
  }
  // Initials entry owns all input while it's open (Enter confirms, Esc skips).
  if (enteringName) {
    e.preventDefault();
    handleNameEntryKey(e.key);
    return;
  }

  if (e.repeat) return;
  unlockAudio();
  if (e.key.toLowerCase() === "m") { toggleSound(); return; }
  // P toggles pause from either state. Esc isn't available for this — it
  // already quits to the upload screen.
  const state = sim.state;
  if (e.key.toLowerCase() === "p" && !state.gameOver) {
    if (state.paused) resumeGame(); else pauseGame();
    return;
  }
  if (state.paused && !state.gameOver) {
    if (e.key === "Enter") resumeGame();
    if (e.key !== "Escape") return;
  }
  keys.add(e.key.toLowerCase());

  if (e.key === " " && !state.gameOver) {
    input.fireRequested = true;
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

// Drive the 3-slot initials entry: type a character to set it and advance,
// arrows to cycle/move, Enter to confirm, Esc to skip (keep remembered name).
function handleNameEntryKey(key: string) {
  if (key === "Enter") {
    void finalizeRun(nameChars.join(""));
    return;
  }
  if (key === "Escape") {
    void finalizeRun(getPlayerName()); // skip — keep the remembered name
    return;
  }
  if (key === "ArrowLeft" || key === "Backspace") {
    nameSlot = Math.max(0, nameSlot - 1);
    return;
  }
  if (key === "ArrowRight") {
    nameSlot = Math.min(NAME_LEN - 1, nameSlot + 1);
    return;
  }
  if (key === "ArrowUp" || key === "ArrowDown") {
    const step = key === "ArrowUp" ? 1 : -1;
    const idx = NAME_CHARSET.indexOf(nameChars[nameSlot]);
    const next = (idx + step + NAME_CHARSET.length) % NAME_CHARSET.length;
    nameChars[nameSlot] = NAME_CHARSET[next];
    return;
  }
  // Direct typing of a valid character.
  const ch = key.length === 1 ? key.toUpperCase() : "";
  if (ch && NAME_CHARSET.includes(ch)) {
    nameChars[nameSlot] = ch;
    if (nameSlot < NAME_LEN - 1) nameSlot++;
  }
}

function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.key.toLowerCase());
}

function pauseGame() {
  pauseAudio(true);
  setRenderBlend(1);
  keys.clear();
  input.fireRequested = false;
  clock.reset();
  benchLastFrame = 0;
  if (!sim.state.gameOver) sim.state.paused = true;
}

function resumeGame() {
  sim.state.paused = false;
  clock.reset();
  pauseAudio(false);
}

function onVisibilityChange() {
  if (document.hidden) pauseGame();
}

function cleanup() {
  pauseAudio(true);
  cancelAnimationFrame(animId);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("resize", resize);
  window.removeEventListener("blur", pauseGame);
  document.removeEventListener("visibilitychange", onVisibilityChange);
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
  if (sim) {
    const player = sim.player;
    player.x = Math.min(player.x, w - player.width / 2);
    player.y = Math.min(player.y, h - player.height / 2);
  }
}

// The run is over (the simulation set state.gameOver). If the score places on
// the board, open the arcade initials entry and defer submission until the
// player confirms (or skips); otherwise submit straight away under the
// remembered name. Async and fire-and-forget — drawGameOver renders each frame
// off the module state these set.
async function endGame() {
  if (runEnded) return; // guard against re-entry
  runEnded = true;

  // Stored best BEFORE this run, so finalizeRun can flag a new record.
  priorBest = await getPersonalBest();

  if (await qualifies(sim.state.score)) {
    // Seed the initials from the remembered name so returning players can just
    // hit Enter; fall back to the default placeholder.
    const seed = (getPlayerName().replace(/[^A-Z0-9]/gi, "").toUpperCase() + "AAA").slice(0, NAME_LEN);
    nameChars = seed.split("");
    nameSlot = 0;
    enteringName = true;
  } else {
    await finalizeRun(getPlayerName());
  }
}

// Build and submit this run's summary under `name`, then populate the board
// state the game-over screen reads. Also remembers the name for next time.
async function finalizeRun(name: string) {
  enteringName = false;
  const clean = setPlayerName(name);

  const summary: RunSummary = {
    name: clean,
    score: sim.state.score,
    kills: sim.state.kills,
    maxCombo: sim.state.maxCombo,
    framesSurvived: sim.state.frame,
    difficulty: sim.state.difficulty,
    avatarThumb: makeThumbnail(sim.player.image),
    playerToken: getPlayerToken(),
    ts: Date.now(),
  };

  isNewBest = priorBest === null || summary.score > priorBest.score;
  topBoard = await submitRun(summary);
  personalBest =
    topBoard.find((r) => r.playerToken === summary.playerToken) ?? summary;
  placedRank = topBoard.find((r) => r.ts === summary.ts)?.rank ?? 0;
}

function loop(now: number) {
  animId = requestAnimationFrame(loop);
  const state = sim.state;
  const running = !state.gameOver && !state.paused;
  const updateStart = bench ? performance.now() : 0;
  if (running) setRenderBlend(clock.advance(now, () => {
    if (state.gameOver) return;
    if (bench) driveScene(bench.name, sim, input, benchTick++);
    stepSim(sim, input);
  }));
  // A bench that reaches the end of its sector just holds its last frame.
  if (state.gameOver && !bench) { void endGame(); drawGameOver(); return; }
  const renderStart = bench ? performance.now() : 0;
  renderGame();
  if (bench) {
    if (running) {
      if (benchLastFrame) frameStats.record(now - benchLastFrame, renderStart - updateStart, performance.now() - renderStart);
      benchLastFrame = now;
    }
    drawBenchOverlay();
  }
  if (state.paused) {
    ctx.fillStyle = "rgba(5,6,15,0.8)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px monospace";
    ctx.fillText("PAUSED", CANVAS_W / 2, CANVAS_H / 2);
    ctx.font = "16px monospace";
    ctx.fillText("ENTER or P to resume", CANVAS_W / 2, CANVAS_H / 2 + 34);
    ctx.restore();
  }
}

// One line of live numbers, refreshed twice a second so reading them does not
// become part of what is being measured.
function drawBenchOverlay() {
  if (!bench) return;
  if (!benchLabel || benchTick % 30 === 0) {
    const r = frameStats.report();
    const ms = (v: number) => v.toFixed(1);
    benchLabel =
      `BENCH ${bench.name} · seed ${bench.seed} · frame p50 ${ms(r.interval.p50)} p95 ${ms(r.interval.p95)} p99 ${ms(r.interval.p99)} ms` +
      ` · update ${ms(r.update.mean)} · draw ${ms(r.render.mean)} · slow ${(r.slow * 100).toFixed(1)}%` +
      ` · ${getEnemies().length} enemies · ${particleCount()} particles`;
  }
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(5,6,15,0.75)";
  ctx.fillRect(0, CANVAS_H - 26, CANVAS_W, 26);
  ctx.fillStyle = "#b7f3d7";
  ctx.fillText(benchLabel, 12, CANVAS_H - 9);
  ctx.restore();
}

function renderGame() {
  const { state, player, boss, sector, sectorFrame, refinery, spread, transition,
    chainNotices, waveBanner, waveNumber, waveLabel, damageImmunity } = sim;
  // --- Render ---
  // Base transform maps CSS-pixel world coords onto the DPR-scaled backing store.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const shake = getShakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(-10, -10, CANVAS_W + 20, CANVAS_H + 20);

  if (sector===2) drawRefineryBackground(ctx,sectorFrame,CANVAS_W,CANVAS_H);
  else drawStarfield(ctx);
  if (sector===2) drawFacilities(ctx,refinery);
  drawPlayer(player, ctx, state.powerTier === "plasma");
  if (damageImmunity > 0) {
    ctx.save();
    ctx.strokeStyle = "#8ef";
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(damageImmunity);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(renderX(player), renderY(player), player.width * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawLasers(ctx);
  drawUltraLasers(ctx);
  drawEnemies(ctx, state.frame);
  drawPowerUp(ctx, state.frame);
  drawParticles(ctx);
  drawBlastRings(ctx);
  drawEnemyShots(ctx);
  if (boss) drawBoss(ctx, boss);

  ctx.restore();

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "bold 18px monospace";
  ctx.fillStyle = "#ffe49b";
  for (const notice of chainNotices) {
    ctx.globalAlpha = Math.min(1, notice.life / 20);
    ctx.fillText(notice.text, Math.max(90, Math.min(CANVAS_W - 90, notice.x)), Math.max(110, notice.y - (70 - notice.life) * 0.6));
  }
  ctx.restore();
  drawHUD(ctx, state);
  ctx.save(); ctx.textAlign = "right"; ctx.font = "12px monospace"; ctx.fillStyle = "#91a0b6";
  ctx.fillText(soundMuted() ? "M · SOUND OFF" : "M · SOUND ON", CANVAS_W - 16, 24);
  ctx.fillText(`SECTOR 0${sector} · ${Math.floor(sectorFrame / 60)}s`, CANVAS_W - 16, 43);
  ctx.restore();
  if (sector===2 && !boss) {
    ctx.save();ctx.textAlign='center';ctx.font='12px monospace';ctx.fillStyle='#94bdb4';
    ctx.fillText(refineryChapter(sectorFrame),CANVAS_W/2,86);
    ctx.textAlign='left';ctx.fillStyle=spread?'#b4ffcd':'#889b9a';ctx.fillText(spread?'SPREAD ONLINE':'DESTROY SUPPLY SHIPS FOR SPREAD + REPAIR',16,CANVAS_H-22);ctx.restore();
  }
  if (transition>0 || (sector===2 && sectorFrame<210)) {
    ctx.save();ctx.fillStyle='rgba(5,12,19,0.72)';ctx.fillRect(0,CANVAS_H/2-72,CANVAS_W,144);
    ctx.textAlign='center';ctx.fillStyle='#b7f3d7';ctx.font=`bold ${Math.min(32,CANVAS_W/22)}px monospace`;
    ctx.fillText(transition?'SECTOR 01 CLEARED':'SECTOR 02 · HELIOFORGE',CANVAS_W/2,CANVAS_H/2-12);
    ctx.font='14px monospace';ctx.fillText(transition?'NEXT: ALIEN REFINERY · +2 SHIELDS':'BREAK THE FUEL NETWORK. SILENCE THE REACTOR.',CANVAS_W/2,CANVAS_H/2+25);ctx.restore();
  }
  if (waveBanner > 0) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#a7dfff";
    ctx.globalAlpha = Math.min(1, waveBanner / 20);
    ctx.fillText(`WAVE ${waveNumber} · ${waveLabel}`, CANVAS_W / 2, 86);
    ctx.restore();
  }
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

const LB_MAX_ROWS = LEADERBOARD_SIZE;
const LB_ROW_H = 34;
const LB_HEAD = 26;
const LB_WIDTH = 460;
const LB_HEADING_H = 20;
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
    c.font = "bold 14px 'Roboto Mono', monospace";
    c.fillStyle = entry.rank === 1 ? BANNER_COLOR : "#778";
    c.fillText(`#${entry.rank}`, left + 8, mid);

    // Avatar head (or a silhouette placeholder)
    const headX = left + 52;
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

    // Name
    c.textAlign = "left";
    c.font = "bold 14px 'Roboto Mono', monospace";
    c.fillStyle = isMe ? "#9df" : "#ccd";
    c.fillText(entry.name, headX + LB_HEAD + 14, mid);

    // Score, right-aligned
    c.textAlign = "right";
    c.font = "bold 14px 'Roboto Mono', monospace";
    c.fillStyle = "#fff";
    c.fillText(entry.score.toString().padStart(6, "0"), left + LB_WIDTH - 8, mid);

    rowY += LB_ROW_H;
  }

  c.restore();
}

// The arcade "NEW HIGH SCORE — enter your initials" screen, shown while
// enteringName. Three slots; the active one blinks with a caret.
function drawNameEntry() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const titleH = bannerHeight(GAME_OVER_ASCII);
  const promptH = 20;
  const slotsH = 64;
  const hintH = 16;
  const gapA = 28; // banner → prompt
  const gapB = 28; // prompt → slots
  const gapC = 28; // slots → hint
  const totalH = titleH + gapA + promptH + gapB + slotsH + gapC + hintH;
  const topY = (CANVAS_H - totalH) / 2;

  if (sim.stageCleared) {
    ctx.save();ctx.textAlign="center";ctx.fillStyle="#a5efff";ctx.font="bold 36px monospace";
    ctx.fillText("SECTOR CLEARED",CANVAS_W/2,topY+45);ctx.restore();
  } else drawBanner(ctx, GAME_OVER_ASCII, topY);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const promptY = topY + titleH + gapA;
  ctx.font = "bold 18px 'Roboto Mono', monospace";
  ctx.fillStyle = BANNER_COLOR;
  ctx.fillText("★ NEW HIGH SCORE ★  ENTER YOUR INITIALS", CANVAS_W / 2, promptY);

  // Three character slots, evenly spaced around center.
  const slotsY = promptY + promptH + gapB;
  const slotW = 56;
  const slotGap = 24;
  const totalW = NAME_LEN * slotW + (NAME_LEN - 1) * slotGap;
  let sx = CANVAS_W / 2 - totalW / 2;
  const blink = Math.floor(performance.now() / 333) % 2 === 0;
  ctx.textBaseline = "middle";
  for (let i = 0; i < NAME_LEN; i++) {
    const active = i === nameSlot;
    // Slot underline — the active slot's blinks to signal "editing here".
    ctx.strokeStyle = active ? (blink ? BANNER_COLOR : "#663") : "#445";
    ctx.lineWidth = active ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(sx, slotsY + slotsH);
    ctx.lineTo(sx + slotW, slotsY + slotsH);
    ctx.stroke();
    // Character — always visible; the active one is highlighted white.
    ctx.font = "bold 48px 'Roboto Mono', monospace";
    ctx.fillStyle = active ? "#fff" : "#aab";
    ctx.textAlign = "center";
    ctx.fillText(nameChars[i] ?? "A", sx + slotW / 2, slotsY + slotsH / 2);
    sx += slotW + slotGap;
  }

  const hintY = slotsY + slotsH + gapC;
  ctx.font = "13px 'Roboto Mono', monospace";
  ctx.fillStyle = "#778";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(
    "TYPE  or  ↑↓ CYCLE  ←→ MOVE   —   ENTER to confirm  |  ESC to skip",
    CANVAS_W / 2,
    hintY
  );
  ctx.restore();
}

function drawGameOver() {
  if (enteringName) {
    drawNameEntry();
    return;
  }

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

  if (sim.stageCleared) {
    ctx.save();ctx.textAlign="center";ctx.fillStyle="#a5efff";ctx.font="bold 36px monospace";
    ctx.fillText("SECTOR CLEARED",CANVAS_W/2,topY+45);ctx.restore();
  } else drawBanner(ctx, GAME_OVER_ASCII, topY);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const scoreY = topY + goH + gap1;
  ctx.font = "bold 24px 'Roboto Mono', monospace";
  ctx.fillStyle = "#fff";
  ctx.fillText(
    `FINAL SCORE: ${sim.state.score.toString().padStart(6, "0")}`,
    CANVAS_W / 2,
    scoreY
  );

  // A status line: new record > board placement > plain personal best. Null
  // until the async submit resolves a frame or two after game over, so guard.
  const bestY = scoreY + scoreH + gapBest;
  ctx.font = "bold 16px 'Roboto Mono', monospace";
  if (isNewBest) {
    ctx.fillStyle = BANNER_COLOR;
    ctx.fillText("★ NEW PERSONAL BEST ★", CANVAS_W / 2, bestY);
  } else if (placedRank > 0) {
    ctx.fillStyle = BANNER_COLOR;
    ctx.fillText(`YOU PLACED #${placedRank}`, CANVAS_W / 2, bestY);
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
