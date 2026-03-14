import {
  Enemy,
  EnemyType,
  ENEMY_TYPES,
  CANVAS_W,
  CANVAS_H,
} from "./types";

let enemies: Enemy[] = [];

export function getEnemies(): Enemy[] {
  return enemies;
}

export function clearEnemies() {
  enemies = [];
}

export function spawnEnemy(difficulty: number) {
  // Weight shifts toward harder enemies with difficulty
  const weights = {
    scout: Math.max(1, 10 - difficulty),
    drone: 3 + Math.min(difficulty, 5),
    tank: Math.min(difficulty, 6),
  };
  const total = weights.scout + weights.drone + weights.tank;
  const roll = Math.random() * total;

  let type: EnemyType;
  if (roll < weights.scout) type = "scout";
  else if (roll < weights.scout + weights.drone) type = "drone";
  else type = "tank";

  const def = ENEMY_TYPES[type];

  enemies.push({
    x: CANVAS_W + def.size,
    y: def.size + Math.random() * (CANVAS_H - def.size * 2),
    type,
    hp: def.hp,
    maxHp: def.hp,
    flashFrames: 0,
    sineOffset: Math.random() * Math.PI * 2,
    speed: def.speed + difficulty * 0.15,
    size: def.size,
  });
}

export function updateEnemies(frame: number) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.x -= e.speed;
    e.y += Math.sin(frame * 0.03 + e.sineOffset) * 1.2;

    if (e.flashFrames > 0) e.flashFrames--;

    // Remove if off left edge
    if (e.x < -e.size * 2) {
      enemies.splice(i, 1);
    }
  }
}

export function removeEnemy(index: number) {
  enemies.splice(index, 1);
}

export function drawEnemies(ctx: CanvasRenderingContext2D) {
  for (const e of enemies) {
    const def = ENEMY_TYPES[e.type];
    const color = e.flashFrames > 0 ? "#fff" : def.color;
    const glow = e.flashFrames > 0 ? "#fff" : def.glowColor;

    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    // Alien skull: ellipse head
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, e.size * 0.5, e.size * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Almond eyes
    const eyeW = e.size * 0.2;
    const eyeH = e.size * 0.12;
    const eyeY = e.y - e.size * 0.1;

    ctx.fillStyle = color;
    // Left eye
    ctx.beginPath();
    ctx.ellipse(e.x - e.size * 0.15, eyeY, eyeW, eyeH, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Right eye
    ctx.beginPath();
    ctx.ellipse(e.x + e.size * 0.15, eyeY, eyeW, eyeH, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Zigzag mouth
    ctx.beginPath();
    const mouthY = e.y + e.size * 0.2;
    const mouthW = e.size * 0.25;
    ctx.moveTo(e.x - mouthW, mouthY);
    for (let j = 0; j < 4; j++) {
      const mx = e.x - mouthW + ((mouthW * 2) / 4) * (j + 0.5);
      const my = mouthY + (j % 2 === 0 ? 5 : -5);
      ctx.lineTo(mx, my);
    }
    ctx.lineTo(e.x + mouthW, mouthY);
    ctx.stroke();

    ctx.restore();

    // HP pips for multi-HP enemies
    if (e.maxHp > 1) {
      const pipY = e.y + e.size * 0.6 + 6;
      const pipSpacing = 8;
      const startX = e.x - ((e.maxHp - 1) * pipSpacing) / 2;
      for (let p = 0; p < e.maxHp; p++) {
        ctx.fillStyle = p < e.hp ? def.color : "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.arc(startX + p * pipSpacing, pipY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
