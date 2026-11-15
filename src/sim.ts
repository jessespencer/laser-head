import { createRefinery, stepRefinery, hitFacility, collectRefineryPickup, REFINERY_BOSS_TICK, type Refinery } from "./refinery";
import { playSound } from "./audio";
import { createBoss, stepBoss, createRefineryBoss, stepRefineryBoss, damageBossPart, BOSS_ARRIVAL_TICK, type Boss } from "./boss";
import { resolveBlast } from "./blast";
import { spawnEnemyShot, clearEnemyShots, updateEnemyShots, enemyShotHits } from "./enemy-shots";
import { combatPace, encounterKind, mineCount, shouldOfferMine, WAVE_NAMES } from "./formations";
import { shotHits, rememberPosition } from "./motion";
import { random, fxRandom } from "./rng";
import {
  type GameState,
  type Player,
  CANVAS_W,
  CANVAS_H,
  COMBO_WINDOW,
  FIRE_RATE,
  MAX_MULTIPLIER,
  DIFFICULTY_INTERVAL,
  ENEMY_TYPES,
  BOMB_BLAST_RADIUS,
  BOMB_KILL_BONUS,
} from "./types";
import {
  initStarfield,
  updateStarfield,
  spawnExplosion,
  spawnBombExplosion,
  spawnBlastRing,
  updateParticles,
  clearParticles,
  updateBlastRings,
  clearBlastRings,
  triggerShake,
  updateShake,
} from "./effects";
import { createPlayer, updatePlayer, getEyePositions } from "./player";
import { spawnLaser, updateLasers, getLasers, clearLasers, spawnUltraLaser, updateUltraLasers, getUltraLasers, clearUltraLasers } from "./laser";
import {
  setCombatAggression,
  spawnWave,
  spawnAttackTank,
  spawnRandomEnemy,
  spawnMine,
  updateEnemies,
  getEnemies,
  removeEnemy,
  clearEnemies,
  detonateBomb,
} from "./enemies";
import { tryDropPowerUp, updatePowerUp, checkPowerUpCollision, clearPowerUp } from "./powerup";
import { POWER_TIERS, applyPickup, tierRank } from "./power";

// The simulation: one fixed 60 Hz tick of game rules, and nothing else. No
// canvas, no requestAnimationFrame, no keyboard listeners, no leaderboard.
// game.ts owns all of those and drives this; tests and the stress bench drive
// it directly. Anything that must be random draws from rng.ts, so a seeded run
// replays exactly.
//
// The entity lists (enemies, lasers, shots, particles) still live in their own
// modules, so there is one simulation at a time — createSim resets them.

/** What the player is doing this tick. The caller owns the object and keeps it
 * current; stepSim clears `fireRequested` once the tap has been consumed. */
export interface SimInput {
  /** Lower-cased `KeyboardEvent.key` values currently held. */
  keys: Set<string>;
  /** A fire tap since the last tick, so a quick press between ticks still shoots. */
  fireRequested: boolean;
}

export interface Notice { x: number; y: number; life: number; text: string }

export interface Sim {
  state: GameState;
  player: Player;
  boss: Boss | null;
  /** The sector's boss is dead; the player can no longer be hurt. */
  stageCleared: boolean;
  sector: 1 | 2;
  sectorFrame: number;
  /** Ticks left on the between-sector card; 0 when not transitioning. */
  transition: number;
  spread: boolean;
  refinery: Refinery;
  waveNumber: number;
  formationNumber: number;
  randomRemaining: number;
  randomTimer: number;
  waveLabel: string;
  waveRest: number;
  waveBanner: number;
  chainNotices: Notice[];
  lastMine: number;
  damageImmunity: number;
  shotCooldown: number;
}

/** Start a fresh run. Clears every entity list and re-seeds the starfield, so
 * set the canvas size (and any RNG seed) before calling. */
export function createSim(image: HTMLImageElement, initialSector: 1 | 2 = 1): Sim {
  const sim: Sim = {
    player: createPlayer(image),
    state: {
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
      peakTier: null,
    },
    boss: null,
    stageCleared: false,
    sector: initialSector,
    sectorFrame: 0,
    transition: 0,
    spread: false,
    refinery: createRefinery(),
    waveNumber: 0,
    formationNumber: 0,
    randomRemaining: 0,
    randomTimer: 0,
    waveLabel: "",
    waveRest: 30,
    waveBanner: 0,
    chainNotices: [],
    lastMine: -1200,
    damageImmunity: 0,
    shotCooldown: 0,
  };

  clearLasers();
  clearUltraLasers();
  clearEnemies();
  clearEnemyShots();
  clearParticles();
  clearBlastRings();
  clearPowerUp();
  initStarfield();
  return sim;
}

// A single kill-event: bump combo, apply the combo multiplier to `basePoints`,
// ramp difficulty, and record telemetry. `killCount` is how many enemies this
// event destroyed (>1 for a bomb blast) — it feeds run telemetry only; combo
// and the multiplier advance once per event, matching the original behavior.
function recordKill(sim: Sim, basePoints: number, killCount: number) {
  const state = sim.state;
  state.combo++;
  state.comboTimer = COMBO_WINDOW;
  state.multiplier = Math.min(MAX_MULTIPLIER, Math.floor(state.combo / 2) + 1);
  state.score += basePoints * state.multiplier;
  state.difficulty = Math.floor(state.score / DIFFICULTY_INTERVAL);

  playSound("kill", state.multiplier);
  state.kills += killCount;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;
}

/** Advance the run by one tick. Sets `state.gameOver` when the run ends; the
 * caller decides what happens next (the browser shell submits the score). */
export function stepSim(sim: Sim, input: SimInput) {
  const { state, player } = sim;
  const keys = input.keys;
  if (sim.damageImmunity > 0) sim.damageImmunity--;
  state.frame++;
  if (sim.transition > 0) {
    updateStarfield(); updateParticles(); updateBlastRings(); updateShake();
    if (--sim.transition === 0) beginRefinery(sim);
    return;
  }
  sim.sectorFrame++;

  // --- Update ---
  updateStarfield();

  const firing = keys.has(" ");
  updatePlayer(player, keys, firing);

  // Alternate coordinated formations with independently arriving raiders.
  if (sim.waveBanner > 0) sim.waveBanner--;
  sim.chainNotices = sim.chainNotices.filter(n => --n.life > 0);
  if (!sim.boss && sim.sectorFrame >= (sim.sector === 1 ? BOSS_ARRIVAL_TICK : REFINERY_BOSS_TICK)) {
    sim.boss = sim.sector === 1 ? createBoss(CANVAS_W, CANVAS_H) : createRefineryBoss(CANVAS_W, CANVAS_H);
    sim.refinery.units = [];
    // The boss arrives on a timer, so there are usually enemies still alive.
    // Its arrival shockwave detonates them rather than deleting them silently,
    // and the player keeps the points they were already owed.
    const caught = getEnemies();
    if (caught.length > 0) {
      for (const e of caught) spawnExplosion(e.x, e.y, ENEMY_TYPES[e.type].color);
      recordKill(sim, caught.reduce((sum, e) => sum + ENEMY_TYPES[e.type].points, 0), caught.length);
      spawnBlastRing(sim.boss.x, sim.boss.y, CANVAS_W * 1.2);
      triggerShake(30);
      playSound("blast");
    }
    clearEnemies(); clearEnemyShots();
    sim.randomRemaining = 0; sim.waveBanner = 0;
    playSound("warning");
  }
  const boss = sim.boss;
  if (boss) {
    rememberPosition(boss);
    for (const part of boss.parts) rememberPosition(part);
    for (const shot of (sim.sector === 1 ? stepBoss : stepRefineryBoss)(boss, player, CANVAS_W, CANVAS_H)) spawnEnemyShot(shot.x, shot.y, shot.dx, shot.dy);
    if (boss.dead && boss.deathTicks % 15 === 0 && boss.deathTicks < 90) {
      spawnBombExplosion(boss.x + (fxRandom()-0.5)*100, boss.y + (fxRandom()-0.5)*170);
      playSound("blast"); triggerShake(12);
    }
    if (boss.dead && boss.deathTicks >= 90) {
      state.gameOver = true;
      return;
    }
  }
  const pace = combatPace(state.frame, state.difficulty);
  // combatPace runs 1 -> 2.25; normalise it into the 0..1 aggression shooters read.
  setCombatAggression((pace - 1) / 1.25);
  if (sim.sector === 1 && !boss && sim.randomRemaining > 0 && --sim.randomTimer <= 0) {
    spawnRandomEnemy(state.difficulty, pace);
    sim.randomRemaining--;
    sim.randomTimer = Math.max(18, Math.round((30 + random() * 24) / pace));
  }
  if (sim.sector === 1 && !boss && sim.randomRemaining === 0 && !getEnemies().some(e => e.type !== "bomb")) {
    if (--sim.waveRest <= 0) {
      sim.waveNumber++;
      if (encounterKind(sim.waveNumber) === "formation") {
        sim.formationNumber++;
        spawnWave(sim.formationNumber, pace);
        if (sim.formationNumber >= 2) spawnAttackTank(pace);
        sim.waveLabel = WAVE_NAMES[(sim.formationNumber - 1) % 3];
      } else {
        sim.randomRemaining = Math.min(12, 6 + Math.floor(sim.waveNumber / 3));
        sim.randomTimer = 1;
        sim.waveLabel = "ROAMING RAIDERS";
      }
      sim.waveRest = 45;
      sim.waveBanner = 100;
      if (shouldOfferMine(sim.waveNumber, state.frame, sim.lastMine, random()) &&
          !getEnemies().some(e => e.type === "bomb")) {
        spawnMine(mineCount(random()));
        sim.lastMine = state.frame;
      }
    }
  }
  if (sim.sector === 2 && !boss) {
    const refinery = sim.refinery;
    for (const u of refinery.units) rememberPosition(u);
    const result = stepRefinery(refinery, player, CANVAS_W, CANVAS_H);
    for (const shot of result.shots) spawnEnemyShot(shot.x,shot.y,shot.dx,shot.dy);
    for (const blast of result.blasts) {
      spawnBombExplosion(blast.x,blast.y);spawnBlastRing(blast.x,blast.y,165);triggerShake(10);playSound('blast');
      const victims=getEnemies().filter(e=>e.type!=='bomb'&&Math.hypot(e.x-blast.x,e.y-blast.y)<165);
      for(const e of victims){spawnExplosion(e.x,e.y,'#ffd08a');recordKill(sim,ENEMY_TYPES[e.type].points,1);removeEnemy(getEnemies().indexOf(e));}
    }
    for (const u of result.destroyed) { recordKill(sim,u.kind==='fuel'?200:u.kind==='carrier'?700:500,1);spawnExplosion(u.x,u.y,'#ffca79'); }
    if (sim.sectorFrame < 65*60 && sim.sectorFrame%480===180) {
      spawnWave(1+Math.floor(sim.sectorFrame/480),1.1);
    }
    if (sim.sectorFrame===35*60 || sim.sectorFrame===55*60) spawnAttackTank(1.1);
  }
  if(sim.sector===2) {
    const refinery = sim.refinery;
    // Late carrier rewards remain available when the guardian arrives.
    if(boss && refinery.pickup) {
      refinery.pickup.x-=1.8;
      if(--refinery.pickup.life<=0 || refinery.pickup.x < -30)refinery.pickup=null;
    }
    if(collectRefineryPickup(refinery,player)) {
      sim.spread=true;state.lives=Math.min(8,state.lives+1);playSound('pickup');
      sim.chainNotices.push({x:player.x,y:player.y,life:100,text:'SPREAD ONLINE · SHIELD REPAIRED'});
    }
  }
  updateEnemies(state.frame, player);
  updateEnemyShots();

  // Power-up. Cores are dropped by dying enemies; this only carries the one on
  // the field and checks whether the player reached it.
  updatePowerUp(state.frame);
  const collected = checkPowerUpCollision(player);
  if (collected) {
    const next = applyPickup(state.powerTier, state.powerTimer, collected);
    state.powerTier = next.tier;
    state.powerTimer = next.timer;
    // High-water mark for the run: the next core offers the rung above this,
    // whether or not this power is still running when that core drops.
    if (tierRank(collected) > tierRank(state.peakTier)) state.peakTier = collected;
    playSound("pickup");
    sim.chainNotices.push({x:player.x,y:player.y,life:90,text:`${POWER_TIERS[next.tier].label} ONLINE`});
  }
  if (state.powerTimer > 0) {
    state.powerTimer--;
    player.firing = true;
    if (state.powerTimer === 0) state.powerTier = null;
  }

  // Immediate first shot, then a steady stream while held. Ultra doubles cadence.
  if (sim.shotCooldown > 0) sim.shotCooldown--;
  if ((firing || input.fireRequested) && sim.shotCooldown === 0) {
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
    if (sim.spread) { spawn(leftEye.x,leftEye.y,-5);spawn(rightEye.x,rightEye.y,5); }
    sim.shotCooldown = state.powerTier ? POWER_TIERS[state.powerTier].fireRate : FIRE_RATE;
  }
  input.fireRequested = false;
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
    if (hitFacilityShot(sim, l) || hitBoss(sim, l)) { lasers.splice(li, 1); continue; }
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

          recordKill(sim, def.points, 1);
          // Cores are hidden in the wreckage: you find them by killing the
          // things that shoot back, not by waiting for one to drift past.
          tryDropPowerUp(e.x, e.y, state.difficulty, e.type, state.peakTier);

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
    if (hitFacilityShot(sim, l) || hitBoss(sim, l)) { uLasers.splice(li, 1); continue; }
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
          recordKill(sim, def.points, 1);
          tryDropPowerUp(e.x, e.y, state.difficulty, e.type, state.peakTier);
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
      tryDropPowerUp(victim.x, victim.y, state.difficulty, victim.type, state.peakTier);
    }
    recordKill(sim, ENEMY_TYPES.bomb.points + blast.victims.length * BOMB_KILL_BONUS + blast.bonus, 1 + blast.victims.length);
    if (blast.bonus > 0) {
      sim.chainNotices.push({x:e.x,y:e.y,life:70,text:`CHAIN +${blast.bonus * state.multiplier}`});
      if (sim.chainNotices.length > 6) sim.chainNotices.shift();
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
    if (e.type === "bomb" || sim.damageImmunity > 0) continue;
    const halfSize = e.size * 0.4;
    if (
      player.x - pw < e.x + halfSize &&
      player.x + pw > e.x - halfSize &&
      player.y - ph < e.y + halfSize &&
      player.y + ph > e.y - halfSize
    ) {
      removeEnemy(ei);
      damagePlayer(sim);
      break;
    }
  }

  if (!state.gameOver && sim.damageImmunity === 0 && enemyShotHits(player)) damagePlayer(sim);

  updateParticles();
  updateBlastRings();
  updateShake();
}

function beginRefinery(sim: Sim) {
  const { state, player } = sim;
  sim.sector=2;sim.sectorFrame=0;sim.boss=null;sim.stageCleared=false;sim.refinery=createRefinery();
  clearEnemies();clearEnemyShots();clearLasers();clearUltraLasers();clearPowerUp();
  clearParticles();clearBlastRings();
  state.lives=Math.min(8,state.lives+2);state.combo=0;state.multiplier=1;state.comboTimer=0;
  sim.damageImmunity=120;sim.shotCooldown=0;sim.waveBanner=0;state.powerTier=null;state.powerTimer=0;
  player.x=CANVAS_W*0.15;player.y=CANVAS_H/2;rememberPosition(player);
}

function hitFacilityShot(sim: Sim, shot:{x:number;y:number}) {
  if(sim.sector!==2 || sim.boss) return false;
  for(const u of sim.refinery.units) {
    if(u.dead || u.fuse>0)continue;
    if(!shotHits(shot,u,u.kind==='fuel'?18:u.kind==='carrier'?44:28,u.kind==='carrier'?28:u.kind==='fuel'?24:28))continue;
    hitFacility(u);spawnExplosion(shot.x,shot.y,'#b4ffdb');playSound('hit');return true;
  }
  return false;
}

function hitBoss(sim: Sim, shot: {x:number;y:number}) {
  const boss = sim.boss;
  if (!boss || boss.dead || boss.tick < 120) return false;
  for (const part of boss.parts) {
    if (part.hp <= 0 || !shotHits(shot, part, part.half, part.half)) continue;
    const result = damageBossPart(boss, part);
    playSound("hit");
    if (result === "destroyed") {
      spawnBombExplosion(part.x, part.y); triggerShake(18); playSound("blast");
      recordKill(sim, part.kind === "core" ? 5000 : 1000, 1);
      if (boss.dead) {
        sim.stageCleared = true; clearEnemyShots(); clearEnemies();
        playSound("victory");
      }
    } else if (result !== "shield") spawnExplosion(shot.x, shot.y, "#9effff");
    return true;
  }
  return false;
}

function damagePlayer(sim: Sim) {
  const { state, player } = sim;
  if (sim.stageCleared) return;
  playSound("damage");
  state.lives--;
  sim.damageImmunity = 45;
  state.combo = 0; state.multiplier = 1; state.comboTimer = 0;
  triggerShake(15);
  spawnExplosion(player.x, player.y, "#ff7038");
  if (state.lives <= 0) state.gameOver = true;
}
