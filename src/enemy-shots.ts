import { rememberPosition, renderX, renderY, shotHits } from './motion';
import { CANVAS_W, CANVAS_H, ENEMY_SHOT_SPEED, MAX_ENEMY_SHOTS, PLAYER_HURT_FRACTION } from './types';
const shots: {x:number; y:number; vx:number; vy:number; life:number}[] = [];
export function clearEnemyShots() { shots.length = 0; }
export function spawnEnemyShot(x:number, y:number, dx:number, dy:number, speed = ENEMY_SHOT_SPEED) {
  if (shots.length >= MAX_ENEMY_SHOTS) return;
  shots.push({x,y,vx:dx*speed,vy:dy*speed,life:240});
}
export function updateEnemyShots() {
  for (let i=shots.length-1;i>=0;i--) {
    const s=shots[i]; rememberPosition(s); s.x+=s.vx; s.y+=s.vy; s.life--;
    if(s.life<=0 || s.x < -30 || s.x > CANVAS_W+30 || s.y < -30 || s.y > CANVAS_H+30) shots.splice(i,1);
  }
}
export function enemyShotHits(player:{x:number;y:number;width:number;height:number}) {
  for(let i=shots.length-1;i>=0;i--) {
    if(shotHits(shots[i], player, player.width*PLAYER_HURT_FRACTION+5, player.height*PLAYER_HURT_FRACTION+5)) {
      shots.splice(i,1); return true;
    }
  }
  return false;
}
export function drawEnemyShots(ctx:CanvasRenderingContext2D) {
  ctx.save();
  for(const s of shots) {
    const x=renderX(s), y=renderY(s);
    ctx.fillStyle='#ff7038'; ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff1ac';ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
