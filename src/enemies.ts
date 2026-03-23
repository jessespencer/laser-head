import {
  Enemy,
  EnemyType,
  ENEMY_TYPES,
  CANVAS_W,
  CANVAS_H,
} from "./types";

let enemies: Enemy[] = [];

// Preload enemy images
const enemyImages: Record<EnemyType, HTMLImageElement> = {} as any;
for (const [type, def] of Object.entries(ENEMY_TYPES)) {
  const img = new Image();
  img.src = def.image;
  enemyImages[type as EnemyType] = img;
}

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
    const img = enemyImages[e.type];
    const glow = e.flashFrames > 0 ? "#fff" : def.glowColor;
    const targetSize = e.size * 1.5;
    // Preserve aspect ratio: fit within targetSize box
    const aspect = img.naturalWidth && img.naturalHeight
      ? img.naturalWidth / img.naturalHeight
      : 1;
    const drawW = aspect >= 1 ? targetSize : targetSize * aspect;
    const drawH = aspect >= 1 ? targetSize / aspect : targetSize;
    const left = e.x - drawW / 2;
    const top = e.y - drawH / 2;

    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 15;

    if (img.complete && img.naturalWidth > 0) {
      if (e.flashFrames > 0) {
        // Hit flash: draw to offscreen canvas with white tint
        const off = document.createElement("canvas");
        off.width = drawW;
        off.height = drawH;
        const oc = off.getContext("2d")!;
        oc.drawImage(img, 0, 0, drawW, drawH);
        oc.globalCompositeOperation = "source-atop";
        oc.fillStyle = "#fff";
        oc.fillRect(0, 0, drawW, drawH);
        ctx.drawImage(off, left, top, drawW, drawH);
      } else {
        ctx.drawImage(img, left, top, drawW, drawH);
      }
    }

    ctx.restore();

    // HP pips for multi-HP enemies
    if (e.maxHp > 1) {
      const pipY = e.y + drawH / 2 + 6;
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
