type Volley = { start:number; shots:number[]; mode:'aimed'|'fan' };
export type TankAttack = { phase:'approach'|'attack'|'exit'; tick:number; aimX:number; aimY:number; variant:'hunter'|'spreader'; volleys:Volley[]; end:number };
export function createTankAttack(random:()=>number = Math.random):TankAttack {
  const variant = random()<0.6 ? 'hunter' : 'spreader';
  const volleys:Volley[]=[];
  let start=1+Math.floor(random()*18);
  const count=1+Math.floor(random()*3);
  for(let i=0;i<count;i++) {
    const mode = random()<(variant==='hunter'?0.15:0.8) ? 'fan' : 'aimed';
    const first=start+12+Math.floor(random()*7);
    const shots=[first];
    // Some attacks are a single shot/fan; others are short salvos.
    if(random()<0.45) {
      const gap=4+Math.floor(random()*4);
      shots.push(first+gap,first+gap*2);
    }
    volleys.push({start,shots,mode});
    start=shots[shots.length-1]+12+Math.floor(random()*31);
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
  const angles=volley(a)?.mode==='fan'?[-0.24,0,0.24]:[0];
  return angles.map(angle=>({x:a.aimX*Math.cos(angle)-a.aimY*Math.sin(angle), y:a.aimX*Math.sin(angle)+a.aimY*Math.cos(angle)}));
}
