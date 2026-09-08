import type { TankAttack } from "./tank";
import type { Flight } from "./formations";
// Canvas dimensions — mutable so the play field fills the viewport.
// Read as live bindings inside functions; never destructured at module load.
export let CANVAS_W = 800;
export let CANVAS_H = 600;

export function setCanvasSize(w: number, h: number) {
  CANVAS_W = w;
  CANVAS_H = h;
}

// Player
export const PLAYER_SPEED = 10;
export const PLAYER_SIZE = 112;

// Lasers
export const LASER_SPEED = 24;
export const FIRE_RATE = 4; // frames between shots

// Combo
export const COMBO_WINDOW = 120; // frames
export const MAX_MULTIPLIER = 8;

// Difficulty
export const DIFFICULTY_INTERVAL = 2000; // points

// Ultra laser power-up
export const ULTRA_DURATION = 600; // frames (~10 seconds)
export const ULTRA_FIRE_RATE = 2; // frames between shots in ultra mode
export const BOMB_DETONATE_FRAMES = 18;
export const BOMB_BLAST_RADIUS = 280;        // massive blast
export const BOMB_SINE_AMPLITUDE = 4;        // gentle hover bob
export const BOMB_KILL_BONUS = 150;
export const BOMB_EYE_BLINK_CYCLE = 240;
export const BOMB_EYE_BLINK_DURATION = 6;
export const BOMB_LIFETIME = 300;            // ~5 seconds then disappears
export const BOMB_DROP_SPEED = 3;            // speed while dropping into position

export const POWERUP_MIN_DIFFICULTY = 3;
export const POWERUP_COOLDOWN = 1800; // frames (~30 seconds)
export const POWERUP_CHANCE = 0.0015; // per frame when eligible

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
  kills: number;    // total enemies destroyed (run telemetry)
  maxCombo: number; // highest combo reached (run telemetry)
  shakeFrames: number;
  gameOver: boolean;
  paused: boolean;
  frame: number;
  ultraTimer: number;
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
  vy?: number;
  x: number;
  y: number;
}

export type EnemyType = "scout" | "drone" | "tank" | "bomb";

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
    image: "/laser-head/alien-scout.svg",
  },
  drone: {
    type: "drone",
    size: 36,
    hp: 2,
    color: "#ff0",
    glowColor: "#aa0",
    points: 250,
    speed: 1.8,
    image: "/laser-head/alien-drone.svg",
  },
  tank: {
    type: "tank",
    size: 48,
    hp: 4,
    color: "#f0f",
    glowColor: "#a0a",
    points: 500,
    speed: 1.2,
    image: "/laser-head/alien-tank.svg",
  },
  bomb: {
    type: "bomb",
    size: 26,
    hp: 1,
    color: "#f44",
    glowColor: "#a00",
    points: 750,
    speed: 1.5,
    image: "/laser-head/alien-mine.svg",
  },
};

export interface Enemy {
  attack?: TankAttack;
  flight?: Flight;
  x: number;
  y: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  flashFrames: number;
  sineOffset: number;
  speed: number;
  size: number;
  detonateTimer?: number;
  chainDepth?: number;
  bombLifetime?: number;   // counts down; bomb disappears at 0
  bombHoverY?: number;
  bombTargetY?: number;    // Y position to drop to; undefined = already hovering
}

export interface PowerUp {
  x: number;
  y: number;
  size: number;
  sineOffset: number;
  speed: number;
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
