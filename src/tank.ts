/** Frames of visible charge-up before every volley. Kept local so this
 * module stays import-free for the node test runner. */
export const TANK_TELEGRAPH = 12;
type Volley = { start:number; shots:number[]; mode:'aimed'|'fan'; wide?:boolean };
export type TankAttack = { phase:'approach'|'attack'|'exit'; tick:number; aimX:number; aimY:number; variant:'hunter'|'spreader'; volleys:Volley[]; end:number };
/** `heat` (0 = first contact, 1 = late run) thickens an attack: more volleys,
 * longer salvos, tighter gaps, wider fans. The TANK_TELEGRAPH charge warning
 * before every volley is deliberately NOT scaled — pressure rises, but each
 * individual shot stays dodgeable. */
export function createTankAttack(random:()=>number = Math.random, aggression = 0):TankAttack {
  const heat = Math.max(0, Math.min(1, aggression));
  const variant = random()<0.6 ? 'hunter' : 'spreader';
  const volleys:Volley[]=[];
  let start=1+Math.floor(random()*18);
  const count=2+Math.floor(random()*3)+Math.round(heat*2);
  for(let i=0;i<count;i++) {
    const mode = random()<(variant==='hunter'?0.3:0.85) ? 'fan' : 'aimed';
    const first=start+TANK_TELEGRAPH+Math.floor(random()*7);
    const shots=[first];
    // Most attacks are short salvos; a lone shot is now the exception.
    if(random()<0.7+heat*0.25) {
      const gap=3+Math.floor(random()*3);
      shots.push(first+gap,first+gap*2);
      if(random()<heat*0.7) shots.push(first+gap*3);
    }
    volleys.push({start,shots,mode,wide:mode==='fan'&&variant==='spreader'&&random()<heat*0.75});
    start=shots[shots.length-1]+10+Math.floor(random()*Math.max(7,31-Math.round(heat*20)));
  }
  return {phase:'approach',tick:0,aimX:-1,aimY:0,variant,volleys,end:start};
}
function volley(a:TankAttack) {
  return a.volleys.find(v=>a.tick>=v.start && a.tick<=v.shots[v.shots.length-1]);
}
export function stepTank(body:{x:number;y:number;speed:number}, attack:TankAttack, player:{x:number;y:number}, width:number):boolean {
  if(attack.phase==='approach') {
    const distance=body.x-width*0.72;
    body.x-=Math.min(Math.max(1,distance*0.085),body.speed*1.25);
    if(distance<=2) {attack.phase='attack';attack.tick=0;}
    return false;
  }
  if(attack.phase==='exit') {body.x-=body.speed*1.35;return false;}
  attack.tick++;
  const v=volley(attack);
  if(v && attack.tick===v.start) {
    const dx=player.x-body.x,dy=player.y-body.y,length=Math.hypot(dx,dy)||1;
    attack.aimX=dx/length;attack.aimY=dy/length;
  }
  if(attack.tick>=attack.end) attack.phase='exit';
  return v?.shots.includes(attack.tick) ?? false;
}
export function tankCharging(a:TankAttack) {
  const v=volley(a);
  return a.phase==='attack' && !!v && a.tick<v.shots[0];
}
export function tankShotDirections(a:TankAttack) {
  const v=volley(a);
  const angles=v?.mode==='fan'?(v.wide?[-0.44,-0.22,0,0.22,0.44]:[-0.24,0,0.24]):[0];
  return angles.map(angle=>({x:a.aimX*Math.cos(angle)-a.aimY*Math.sin(angle), y:a.aimX*Math.sin(angle)+a.aimY*Math.cos(angle)}));
}
