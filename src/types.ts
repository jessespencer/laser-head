// Canvas dimensions
export const CANVAS_W = 800;
export const CANVAS_H = 600;

// Player
export const PLAYER_SPEED = 5;
export const PLAYER_SIZE = 112;

// Lasers
export const LASER_SPEED = 12;
export const FIRE_RATE = 4; // frames between shots

// Combo
export const COMBO_WINDOW = 120; // frames
export const MAX_MULTIPLIER = 8;

// Difficulty
export const DIFFICULTY_INTERVAL = 2000; // points

// Colors
export const BG_COLOR = "#05060f";
export const LASER_CORE = "rgba(255,200,180,0.95)";
export const LASER_MID = "rgba(255,80,20,0.7)";
export const LASER_GLOW = "rgba(255,40,0,0.3)";

export interface GameState {
  score: number;
  lives: number;
  combo: number;
  multiplier: number;
  comboTimer: number;
  difficulty: number;
  shakeFrames: number;
  gameOver: boolean;
  paused: boolean;
  frame: number;
}

export interface Player {
  x: number;
  y: number;
  image: HTMLImageElement;
  width: number;
  height: number;
  glowIntensity: number;
  firing: boolean;
}

export interface Laser {
  x: number;
  y: number;
}

export type EnemyType = "scout" | "drone" | "tank";

export interface EnemyTypeDef {
  type: EnemyType;
  size: number;
  hp: number;
  color: string;
  glowColor: string;
  points: number;
  speed: number;
  image: string;
}

export const ENEMY_TYPES: Record<EnemyType, EnemyTypeDef> = {
  scout: {
    type: "scout",
    size: 28,
    hp: 1,
    color: "#0f0",
    glowColor: "#0a0",
    points: 100,
    speed: 2.5,
    image: "/laser-head/figma.svg",
  },
  drone: {
    type: "drone",
    size: 36,
    hp: 2,
    color: "#ff0",
    glowColor: "#aa0",
    points: 250,
    speed: 1.8,
    image: "/laser-head/sketch.svg",
  },
  tank: {
    type: "tank",
    size: 48,
    hp: 4,
    color: "#f0f",
    glowColor: "#a0a",
    points: 500,
    speed: 1.2,
    image: "/laser-head/photoshop.svg",
  },
};

export interface Enemy {
  x: number;
  y: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  flashFrames: number;
  sineOffset: number;
  speed: number;
  size: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
}

export interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
}
