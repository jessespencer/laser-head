import { createTankAttack, stepTank, tankShotDirections } from "./tank";
import { spawnEnemyShot } from "./enemy-shots";
import { flightPosition, planWave } from "./formations";
import { rememberPosition } from "./motion";
import { random } from "./rng";
import {
  type Enemy,
  type EnemyType,
  ENEMY_TYPES,
  CANVAS_W,
  CANVAS_H,
  BOMB_SINE_AMPLITUDE,
  BOMB_DETONATE_FRAMES,
  BOMB_LIFETIME,
  BOMB_DROP_SPEED,
  MAX_ATTACK_TANKS,
} from "./types";

// Enemy rules only: spawning, movement, removal. Drawing lives in
// enemies-view.ts, so this module loads without a DOM.

let enemies: Enemy[] = [];

// How hot the run has got (0..1). The game loop refreshes this each frame; it
// is read when a shooter spawns, so later tanks are born meaner than early ones.
let aggression = 0;
export function setCombatAggression(value: number) {
  aggression = Math.max(0, Math.min(1, value));
}
function addEnemy(enemy: Enemy) {
  if (enemy.type === "tank") {
    enemy.attack = createTankAttack(random, aggression);
    enemy.hp = enemy.maxHp = enemy.attack.variant === "spreader" ? 7 : 6;
  }
  enemies.push(enemy);
}

export function getEnemies(): Enemy[] {
  return enemies;
}

export function clearEnemies() {
  enemies = [];
}

export function spawnMine(count = 1) {
  const def = ENEMY_TYPES.bomb;
  const targetY = CANVAS_H * (0.25 + random() * 0.5);
  const centerX = CANVAS_W * (0.5 + random() * 0.15);
  const spacing = Math.min(205, CANVAS_W * 0.2);
  for (let slot = 0; slot < count; slot++) addEnemy({
    x: Math.max(def.size, Math.min(CANVAS_W - def.size, centerX + (slot - (count - 1) / 2) * spacing)), y: -def.size,
    type: "bomb", hp: def.hp, maxHp: def.hp, flashFrames: 0,
    sineOffset: random() * Math.PI * 2, speed: 0, size: def.size,
    bombTargetY: targetY, bombLifetime: BOMB_LIFETIME,
  });
}

export function spawnWave(wave: number, pace = 1) {
  for (const member of planWave(wave, random)) {
    member.flight.speed *= pace;
    const def = ENEMY_TYPES[member.kind];
    const position = flightPosition(member.flight, CANVAS_W, CANVAS_H, def.size);
    addEnemy({ ...position, type: member.kind, hp: def.hp, maxHp: def.hp,
      flashFrames: 0, sineOffset: 0, speed: member.flight.speed,
      size: def.size, flight: member.flight });
  }
}

export function spawnRandomEnemy(difficulty: number, pace: number) {
  const roll = random();
  const type: EnemyType =
    difficulty >= 1 && roll < 0.1 + Math.min(0.14, difficulty * 0.03) ? "tank" :
    roll < 0.45 ? "drone" : "scout";
  const def = ENEMY_TYPES[type];
  addEnemy({ x: CANVAS_W + def.size,
    y: def.size + random() * Math.max(0, CANVAS_H - def.size * 2),
    type, hp: def.hp, maxHp: def.hp, flashFrames: 0,
    sineOffset: random() * Math.PI * 2,
    speed: (type === "scout" ? 6 + random() * 2 : def.speed * 2 + random() * 1.2) * pace, size: def.size });
}

export function spawnAttackTank(pace: number) {
  // Late runs sustain one more shooter than the opening does.
  const cap = aggression >= 0.5 ? MAX_ATTACK_TANKS : MAX_ATTACK_TANKS - 1;
  if (enemies.filter(e => e.type === "tank").length >= cap) return;
  const def = ENEMY_TYPES.tank;
  addEnemy({x:CANVAS_W+def.size, y:CANVAS_H*(0.25+random()*0.5),
    type:"tank",hp:def.hp,maxHp:def.hp,flashFrames:0,sineOffset:0,
    speed:4.5*pace,size:def.size});
}

export function updateEnemies(frame: number, player: {x:number;y:number}) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    rememberPosition(e);
    if (e.type === "bomb") {
      // Drop phase: fall to target Y
      if (e.bombTargetY !== undefined) {
        e.y += BOMB_DROP_SPEED;
        if (e.y >= e.bombTargetY) {
          e.y = e.bombTargetY;
          e.bombHoverY = e.y;
          e.bombTargetY = undefined; // now hovering
        }
      } else if (e.detonateTimer === undefined) {
        // Hover phase: gentle bob in place
        e.bombHoverY ??= e.y;
        e.y = e.bombHoverY + Math.sin(frame * 0.03 + e.sineOffset) * BOMB_SINE_AMPLITUDE;
        // Lifetime countdown
        if (e.bombLifetime !== undefined) {
          e.bombLifetime--;
          if (e.bombLifetime <= 0) {
            enemies.splice(i, 1);
            continue;
          }
        }
      }
      // Detonation countdown
      if (e.detonateTimer !== undefined && e.detonateTimer > 0) {
        e.detonateTimer--;
        e.flashFrames = (e.detonateTimer % 3 < 2) ? 1 : 0;
      }
    } else {
      if (e.type === "tank") {
        if (e.flight && e.flight.age < 0) { e.flight.age++; continue; }
        e.flight = undefined;
        e.attack ??= createTankAttack(random, aggression);
        if (stepTank(e, e.attack, player, CANVAS_W)) {
          for (const aim of tankShotDirections(e.attack)) {
            spawnEnemyShot(e.x + aim.x * 34, e.y + aim.y * 34, aim.x, aim.y);
          }
        }
      } else if (e.flight) {
        e.flight.age++;
        const position = flightPosition(e.flight, CANVAS_W, CANVAS_H, e.size);
        e.x = position.x;
        e.y = position.y;
      } else {
        e.x -= e.speed;
        e.y += Math.sin(frame * 0.03 + e.sineOffset) * 1.2;
      }
      if (e.flashFrames > 0) e.flashFrames--;
    }

    // Remove if off left edge (non-bombs only; bombs removed by lifetime)
    if (e.type !== "bomb" && e.x < -e.size * 2) {
      enemies.splice(i, 1);
    }
  }
}

export function detonateBomb(index: number) {
  const e = enemies[index];
  if (e.type === "bomb" && e.detonateTimer === undefined) {
    e.detonateTimer = BOMB_DETONATE_FRAMES;
  }
}

export function removeEnemy(index: number) {
  enemies.splice(index, 1);
}
