import {
  Enemy,
  EnemyType,
  ENEMY_TYPES,
  CANVAS_W,
  CANVAS_H,
  BOMB_SPAWN_CHANCE,
  BOMB_SINE_AMPLITUDE,
  BOMB_DETONATE_FRAMES,
  BOMB_EYE_BLINK_CYCLE,
  BOMB_EYE_BLINK_DURATION,
  BOMB_LIFETIME,
  BOMB_DROP_SPEED,
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
  // Rare chance to spawn a bomb — drops in from above
  if (Math.random() < BOMB_SPAWN_CHANCE) {
    const def = ENEMY_TYPES["bomb"];
    const targetY = def.size + Math.random() * (CANVAS_H - def.size * 2);
    enemies.push({
      x: CANVAS_W * 0.3 + Math.random() * CANVAS_W * 0.5, // within visible area
      y: -def.size,                                          // start above screen
      type: "bomb",
      hp: def.hp,
      maxHp: def.hp,
      flashFrames: 0,
      sineOffset: Math.random() * Math.PI * 2,
      speed: 0,                                              // doesn't drift left
      size: def.size,
      bombTargetY: targetY,
      bombLifetime: BOMB_LIFETIME,
    });
    return;
  }

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
    if (e.type === "bomb") {
      // Drop phase: fall to target Y
      if (e.bombTargetY !== undefined) {
        e.y += BOMB_DROP_SPEED;
        if (e.y >= e.bombTargetY) {
          e.y = e.bombTargetY;
          e.bombTargetY = undefined; // now hovering
        }
      } else if (e.detonateTimer === undefined) {
        // Hover phase: gentle bob in place
        e.y += Math.sin(frame * 0.03 + e.sineOffset) * BOMB_SINE_AMPLITUDE;
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
      e.x -= e.speed;
      e.y += Math.sin(frame * 0.03 + e.sineOffset) * 1.2;
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

export function drawEnemies(ctx: CanvasRenderingContext2D, frame: number) {
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

    // Bombs fade out in last 60 frames (~1 second)
    if (e.type === "bomb" && e.bombLifetime !== undefined && e.bombLifetime < 60) {
      ctx.globalAlpha = Math.max(0, e.bombLifetime / 60);
    }

    if (img.complete && img.naturalWidth > 0) {
      if (e.flashFrames > 0) {
        // Hit flash: draw to offscreen canvas with tint
        const off = document.createElement("canvas");
        off.width = drawW;
        off.height = drawH;
        const oc = off.getContext("2d")!;
        oc.drawImage(img, 0, 0, drawW, drawH);
        oc.globalCompositeOperation = "source-atop";
        // Bombs alternate white/yellow during detonation
        if (e.type === "bomb" && e.detonateTimer !== undefined) {
          oc.fillStyle = (e.detonateTimer % 6 < 3) ? "#fff" : "#ff0";
        } else {
          oc.fillStyle = "#fff";
        }
        oc.fillRect(0, 0, drawW, drawH);
        ctx.drawImage(off, left, top, drawW, drawH);
      } else {
        ctx.drawImage(img, left, top, drawW, drawH);
      }
    }

    ctx.restore();

    // Bomb eye blink (overlay red rects over eye positions)
    if (e.type === "bomb" && e.detonateTimer === undefined) {
      const cyclePos = frame % BOMB_EYE_BLINK_CYCLE;
      if (cyclePos < BOMB_EYE_BLINK_DURATION) {
        ctx.fillStyle = "#e00";
        const eyeW = drawW * 0.065;
        const eyeH = drawH * 0.08;
        const eyeY = top + drawH * 0.34;
        ctx.fillRect(left + drawW * 0.36 - eyeW / 2, eyeY, eyeW, eyeH);
        ctx.fillRect(left + drawW * 0.64 - eyeW / 2, eyeY, eyeW, eyeH);
      }
    }

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
