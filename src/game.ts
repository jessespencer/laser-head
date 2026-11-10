import {createRefinery, stepRefinery, hitFacility, collectRefineryPickup, refineryChapter, REFINERY_BOSS_TICK} from './refinery';
import {drawRefineryBackground, drawFacilities} from './refinery-view';
import { unlockAudio, toggleSound, soundMuted, pauseAudio, playSound } from "./audio";
import { createBoss, stepBoss, createRefineryBoss, stepRefineryBoss, damageBossPart, BOSS_ARRIVAL_TICK, type Boss } from "./boss";
import { drawBoss } from "./boss-view";
import { spawnEnemyShot } from "./enemy-shots";
import { resolveBlast } from "./blast";
import { clearEnemyShots, updateEnemyShots, enemyShotHits, drawEnemyShots } from "./enemy-shots";
import { combatPace, encounterKind, mineCount, shouldOfferMine, WAVE_NAMES } from "./formations";
import { setRenderBlend, renderX, renderY, shotHits, rememberPosition } from "./motion";
import { createClock } from "./timing";
import {
  GameState,
  CANVAS_W,
  CANVAS_H,
  COMBO_WINDOW,
  FIRE_RATE,
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
  setCombatAggression,
  spawnWave,
  spawnAttackTank,
  spawnRandomEnemy,
  spawnMine,
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
import { tryDropPowerUp, updatePowerUp, drawPowerUp, checkPowerUpCollision, clearPowerUp } from "./powerup";
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
import type { Player } from "./types";
import { BOMB_BLAST_RADIUS, BOMB_KILL_BONUS } from "./types";
import { POWER_TIERS, applyPickup } from "./power";

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let player: Player;
let state: GameState;
let keys: Set<string> = new Set();
const clock = createClock();
let fireRequested = false;
let damageImmunity = 0;
let shotCooldown = 0;
let boss: Boss | null = null;
let stageCleared = false;
let sector: 1 | 2 = 1;
let sectorFrame = 0;
let transition = 0;
let spread = false;
let refinery = createRefinery();
let waveNumber = 0;
let formationNumber = 0;
let randomRemaining = 0;
let randomTimer = 0;
let waveLabel = "";
let waveRest = 30;
let waveBanner = 0;
let chainNotices: {x:number;y:number;life:number;text:string}[] = [];
let lastMine = -1200;
let animId = 0;
let dpr = 1;
let onRestart: () => void;
let onUpload: () => void;

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
  initialSector: 1 | 2 = 1
) {
  canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  ctx = canvas.getContext("2d", { alpha: false })!;

  unlockAudio();
  pauseAudio(false);
  boss = null;
  stageCleared = false;
  sector = initialSector; sectorFrame = 0; transition = 0; spread = false; refinery = createRefinery();
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
    powerTier: null,
    powerTimer: 0,
  };

  fireRequested = false;
  damageImmunity = 0;
  shotCooldown = 0;
  clock.reset();
  waveNumber = 0;
  formationNumber = 0;
  randomRemaining = 0;
  randomTimer = 0;
  waveLabel = "";
  waveRest = 30;
  waveBanner = 0;
  chainNotices = [];
  lastMine = -1200;
  topBoard = [];
  personalBest = null;
  isNewBest = false;
  placedRank = 0;
  priorBest = null;
  enteringName = false;
  nameChars = [];
  nameSlot = 0;

  clearLasers();
  clearUltraLasers();
  clearEnemies();
  clearEnemyShots();
  clearParticles();
  clearBlastRings();
  clearPowerUp();
  initStarfield();

  // Input
  keys.clear();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", pauseGame);
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
  fireRequested = false;
  clock.reset();
  if (!state.gameOver) state.paused = true;
}

function resumeGame() {
  state.paused = false;
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

  playSound("kill", state.multiplier);
  state.kills += killCount;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;
}

// End the run. If the score places on the board, open the arcade initials
// entry and defer submission until the player confirms (or skips); otherwise
// submit straight away under the remembered name. Async and fire-and-forget —
// drawGameOver renders each frame off the module state these set.
async function endGame() {
  if (state.gameOver) return; // guard against re-entry
  state.gameOver = true;

  // Stored best BEFORE this run, so finalizeRun can flag a new record.
  priorBest = await getPersonalBest();

  if (await qualifies(state.score)) {
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
    score: state.score,
    kills: state.kills,
    maxCombo: state.maxCombo,
    framesSurvived: state.frame,
    difficulty: state.difficulty,
    avatarThumb: makeThumbnail(player.image),
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
  if (state.gameOver) { drawGameOver(); return; }
  if (!state.paused) setRenderBlend(clock.advance(now, () => {
    if (!state.gameOver) updateGame();
  }));
  if (state.gameOver) { drawGameOver(); return; }
  renderGame();
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

function updateGame() {
  if (damageImmunity > 0) damageImmunity--;
  state.frame++;
  if (transition > 0) {
    updateStarfield(); updateParticles(); updateBlastRings(); updateShake();
    if (--transition === 0) beginRefinery();
    return;
  }
  sectorFrame++;

  // --- Update ---
  updateStarfield();

  const firing = keys.has(" ");
  updatePlayer(player, keys, firing);

  // Alternate coordinated formations with independently arriving raiders.
  if (waveBanner > 0) waveBanner--;
  chainNotices = chainNotices.filter(n => --n.life > 0);
  if (!boss && sectorFrame >= (sector === 1 ? BOSS_ARRIVAL_TICK : REFINERY_BOSS_TICK)) {
    boss = sector === 1 ? createBoss(CANVAS_W, CANVAS_H) : createRefineryBoss(CANVAS_W, CANVAS_H);
    refinery.units = [];
    // The boss arrives on a timer, so there are usually enemies still alive.
    // Its arrival shockwave detonates them rather than deleting them silently,
    // and the player keeps the points they were already owed.
    const caught = getEnemies();
    if (caught.length > 0) {
      for (const e of caught) spawnExplosion(e.x, e.y, ENEMY_TYPES[e.type].color);
      recordKill(caught.reduce((sum, e) => sum + ENEMY_TYPES[e.type].points, 0), caught.length);
      spawnBlastRing(boss.x, boss.y, CANVAS_W * 1.2);
      triggerShake(30);
      playSound("blast");
    }
    clearEnemies(); clearEnemyShots();
    randomRemaining = 0; waveBanner = 0;
    playSound("warning");
  }
  if (boss) {
    rememberPosition(boss);
    for (const part of boss.parts) rememberPosition(part);
    for (const shot of (sector === 1 ? stepBoss : stepRefineryBoss)(boss, player, CANVAS_W, CANVAS_H)) spawnEnemyShot(shot.x, shot.y, shot.dx, shot.dy);
    if (boss.dead && boss.deathTicks % 15 === 0 && boss.deathTicks < 90) {
      spawnBombExplosion(boss.x + (Math.random()-0.5)*100, boss.y + (Math.random()-0.5)*170);
      playSound("blast"); triggerShake(12);
    }
    if (boss.dead && boss.deathTicks >= 90) {
      void endGame();
      return;
    }
  }
  const pace = combatPace(state.frame, state.difficulty);
  // combatPace runs 1 -> 2.25; normalise it into the 0..1 aggression shooters read.
  setCombatAggression((pace - 1) / 1.25);
  if (sector === 1 && !boss && randomRemaining > 0 && --randomTimer <= 0) {
    spawnRandomEnemy(state.difficulty, pace);
    randomRemaining--;
    randomTimer = Math.max(18, Math.round((30 + Math.random() * 24) / pace));
  }
  if (sector === 1 && !boss && randomRemaining === 0 && !getEnemies().some(e => e.type !== "bomb")) {
    if (--waveRest <= 0) {
      waveNumber++;
      if (encounterKind(waveNumber) === "formation") {
        formationNumber++;
        spawnWave(formationNumber, pace);
        if (formationNumber >= 2) spawnAttackTank(pace);
        waveLabel = WAVE_NAMES[(formationNumber - 1) % 3];
      } else {
        randomRemaining = Math.min(12, 6 + Math.floor(waveNumber / 3));
        randomTimer = 1;
        waveLabel = "ROAMING RAIDERS";
      }
      waveRest = 45;
      waveBanner = 100;
      if (shouldOfferMine(waveNumber, state.frame, lastMine, Math.random()) &&
          !getEnemies().some(e => e.type === "bomb")) {
        spawnMine(mineCount(Math.random()));
        lastMine = state.frame;
      }
    }
  }
  if (sector === 2 && !boss) {
    for (const u of refinery.units) rememberPosition(u);
    const result = stepRefinery(refinery, player, CANVAS_W, CANVAS_H);
    for (const shot of result.shots) spawnEnemyShot(shot.x,shot.y,shot.dx,shot.dy);
    for (const blast of result.blasts) {
      spawnBombExplosion(blast.x,blast.y);spawnBlastRing(blast.x,blast.y,165);triggerShake(10);playSound('blast');
      const victims=getEnemies().filter(e=>e.type!=='bomb'&&Math.hypot(e.x-blast.x,e.y-blast.y)<165);
      for(const e of victims){spawnExplosion(e.x,e.y,'#ffd08a');recordKill(ENEMY_TYPES[e.type].points,1);removeEnemy(getEnemies().indexOf(e));}
    }
    for (const u of result.destroyed) { recordKill(u.kind==='fuel'?200:u.kind==='carrier'?700:500,1);spawnExplosion(u.x,u.y,'#ffca79'); }
    if (sectorFrame < 65*60 && sectorFrame%480===180) {
      spawnWave(1+Math.floor(sectorFrame/480),1.1);
    }
    if (sectorFrame===35*60 || sectorFrame===55*60) spawnAttackTank(1.1);
  }
  if(sector===2) {
    // Late carrier rewards remain available when the guardian arrives.
    if(boss && refinery.pickup) {
      refinery.pickup.x-=1.8;
      if(--refinery.pickup.life<=0 || refinery.pickup.x < -30)refinery.pickup=null;
    }
    if(collectRefineryPickup(refinery,player)) {
      spread=true;state.lives=Math.min(8,state.lives+1);playSound('pickup');
      chainNotices.push({x:player.x,y:player.y,life:100,text:'SPREAD ONLINE · SHIELD REPAIRED'});
    }
  }
  updateEnemies(state.frame, player);
  updateEnemyShots();

  // Power-up. Cores are dropped by dying enemies (see killEnemy); this only
  // carries the one on the field and checks whether the player reached it.
  updatePowerUp(state.frame);
  const collected = checkPowerUpCollision(player);
  if (collected) {
    const next = applyPickup(state.powerTier, state.powerTimer, collected);
    state.powerTier = next.tier;
    state.powerTimer = next.timer;
    playSound("pickup");
    chainNotices.push({x:player.x,y:player.y,life:90,text:`${POWER_TIERS[next.tier].label} ONLINE`});
  }
  if (state.powerTimer > 0) {
    state.powerTimer--;
    player.firing = true;
    if (state.powerTimer === 0) state.powerTier = null;
  }

  // Immediate first shot, then a steady stream while held. Ultra doubles cadence.
  if (shotCooldown > 0) shotCooldown--;
  if ((firing || fireRequested) && shotCooldown === 0) {
    const [leftEye, rightEye] = getEyePositions(player);
    // Only plasma swaps the projectile; overdrive fires a hotter normal beam.
    const plasma = state.powerTier === "plasma";
    const hot = state.powerTier === "overdrive";
    const spawn = plasma
      ? (x: number, y: number, vy = 0) => spawnUltraLaser(x, y, vy)
      : (x: number, y: number, vy = 0) => spawnLaser(x, y, vy, hot);
    playSound(plasma ? "plasma" : "laser");
    spawn(leftEye.x, leftEye.y);
    spawn(rightEye.x, rightEye.y);
    if (spread) { spawn(leftEye.x,leftEye.y,-5);spawn(rightEye.x,rightEye.y,5); }
    shotCooldown = state.powerTier ? POWER_TIERS[state.powerTier].fireRate : FIRE_RATE;
  }
  fireRequested = false;
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
    if (hitFacilityShot(l) || hitBoss(l)) { lasers.splice(li, 1); continue; }
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      const halfSize = e.size * 0.5;
      if (
        shotHits(l, e, halfSize, halfSize * 1.2)
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

        playSound("hit");
        e.hp--;
        e.flashFrames = 4;

        if (e.hp <= 0) {
          // Destroyed
          const def = ENEMY_TYPES[e.type];
          spawnExplosion(e.x, e.y, def.color);

          recordKill(def.points, 1);
          // Cores are hidden in the wreckage: you find them by killing the
          // things that shoot back, not by waiting for one to drift past.
          tryDropPowerUp(e.x, e.y, state.difficulty, e.type, state.powerTier);

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
    if (hitFacilityShot(l) || hitBoss(l)) { uLasers.splice(li, 1); continue; }
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      const halfSize = e.size * 0.5;
      if (
        shotHits(l, e, halfSize, halfSize * 1.2)
      ) {
        uLasers.splice(li, 1);

        if (e.type === "bomb") {
          if (e.detonateTimer === undefined) {
            detonateBomb(ei);
          }
          break;
        }

        spawnExplosion(l.x, l.y, "#67efff");
        playSound("hit");
        e.hp--;
        e.flashFrames = 4;

        if (e.hp <= 0) {
          const def = ENEMY_TYPES[e.type];
          spawnExplosion(e.x, e.y, "#67efff");
          recordKill(def.points, 1);
          tryDropPowerUp(e.x, e.y, state.difficulty, e.type, state.powerTier);
          removeEnemy(ei);
        }
        break;
      }
    }
  }

  // Snapshot ready mines so secondary fuses cannot explode in the same update.
  const readyMines = enemies.filter(e => e.type === "bomb" && e.detonateTimer !== undefined && e.detonateTimer <= 0);
  for (const e of readyMines) {
    if (!enemies.includes(e)) continue;
    const blast = resolveBlast(enemies, e, BOMB_BLAST_RADIUS);
    for (const victim of blast.victims) {
      spawnExplosion(victim.x, victim.y, ENEMY_TYPES[victim.type].color);
      tryDropPowerUp(victim.x, victim.y, state.difficulty, victim.type, state.powerTier);
    }
    recordKill(ENEMY_TYPES.bomb.points + blast.victims.length * BOMB_KILL_BONUS + blast.bonus, 1 + blast.victims.length);
    if (blast.bonus > 0) {
      chainNotices.push({x:e.x,y:e.y,life:70,text:`CHAIN +${blast.bonus * state.multiplier}`});
      if (chainNotices.length > 6) chainNotices.shift();
    }
    playSound("blast");
    spawnBombExplosion(e.x, e.y);
    spawnBlastRing(e.x, e.y, BOMB_BLAST_RADIUS);
    triggerShake(25);
  }

  // Collisions: enemies vs player
  const pw = player.width * 0.4;
  const ph = player.height * 0.4;
  for (let ei = enemies.length - 1; ei >= 0; ei--) {
    const e = enemies[ei];
    // Bombs don't deal contact damage
    if (e.type === "bomb" || damageImmunity > 0) continue;
    const halfSize = e.size * 0.4;
    if (
      player.x - pw < e.x + halfSize &&
      player.x + pw > e.x - halfSize &&
      player.y - ph < e.y + halfSize &&
      player.y + ph > e.y - halfSize
    ) {
      removeEnemy(ei);
      damagePlayer();
      break;
    }
  }

  if (!state.gameOver && damageImmunity === 0 && enemyShotHits(player)) damagePlayer();

  updateParticles();
  updateBlastRings();
  updateShake();

}

function beginRefinery() {
  sector=2;sectorFrame=0;boss=null;stageCleared=false;refinery=createRefinery();
  clearEnemies();clearEnemyShots();clearLasers();clearUltraLasers();clearPowerUp();
  clearParticles();clearBlastRings();
  state.lives=Math.min(8,state.lives+2);state.combo=0;state.multiplier=1;state.comboTimer=0;
  damageImmunity=120;shotCooldown=0;waveBanner=0;state.powerTier=null;state.powerTimer=0;
  player.x=CANVAS_W*0.15;player.y=CANVAS_H/2;rememberPosition(player);
}
function hitFacilityShot(shot:{x:number;y:number}) {
  if(sector!==2 || boss) return false;
  for(const u of refinery.units) {
    if(u.dead || u.fuse>0)continue;
    if(!shotHits(shot,u,u.kind==='fuel'?18:u.kind==='carrier'?44:28,u.kind==='carrier'?28:u.kind==='fuel'?24:28))continue;
    hitFacility(u);spawnExplosion(shot.x,shot.y,'#b4ffdb');playSound('hit');return true;
  }
  return false;
}
function hitBoss(shot: {x:number;y:number}) {
  if (!boss || boss.dead || boss.tick < 120) return false;
  for (const part of boss.parts) {
    if (part.hp <= 0 || !shotHits(shot, part, part.half, part.half)) continue;
    const result = damageBossPart(boss, part);
    playSound("hit");
    if (result === "destroyed") {
      spawnBombExplosion(part.x, part.y); triggerShake(18); playSound("blast");
      recordKill(part.kind === "core" ? 5000 : 1000, 1);
      if (boss.dead) {
        stageCleared = true; clearEnemyShots(); clearEnemies();
        playSound("victory");
      }
    } else if (result !== "shield") spawnExplosion(shot.x, shot.y, "#9effff");
    return true;
  }
  return false;
}

function damagePlayer() {
  if (stageCleared) return;
  playSound("damage");
  state.lives--;
  damageImmunity = 45;
  state.combo = 0; state.multiplier = 1; state.comboTimer = 0;
  triggerShake(15);
  spawnExplosion(player.x, player.y, "#ff7038");
  if (state.lives <= 0) void endGame();
}

function renderGame() {
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

  if (stageCleared) {
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

  if (stageCleared) {
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
    `FINAL SCORE: ${state.score.toString().padStart(6, "0")}`,
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
