/** Sector 02 encounter rules. Positions are in the same plane as player shots;
 * decks are decorative, while their mounted guns are targetable. */
export type Facility = { kind: 'turret' | 'fuel' | 'carrier'; x: number; y: number; hp: number; maxHp: number; tick: number; aimX: number; aimY: number; charging: boolean; fuse: number; dead: boolean };
export type Refinery = { tick: number; wrecks: {x:number;y:number;life:number}[]; units: Facility[]; pickup: {x:number;y:number;life:number} | null };
export const REFINERY_BOSS_TICK = 75 * 60;
export function createRefinery(): Refinery { return {tick:0, wrecks:[], units:[], pickup:null}; }
export function addFacility(r: Refinery, kind: Facility['kind'], x:number, y:number) {
  const hp = kind === 'turret' ? 10 : kind === 'carrier' ? 14 : 3;
  const u: Facility = {kind,x,y,hp,maxHp:hp,tick:0,aimX:-1,aimY:0,charging:false,fuse:0,dead:false};
  r.units.push(u); return u;
}
export function hitFacility(u: Facility) {
  if(u.dead || u.fuse > 0) return false;
  u.hp--;
  if(u.hp <= 0) { if(u.kind === 'fuel') u.fuse=12; else u.dead=true; }
  return true;
}
export function stepRefinery(r:Refinery, player:{x:number;y:number}, w:number,h:number) {
  r.tick++;
  for(const wreck of r.wrecks){wreck.x-=1.8;wreck.life--;}
  r.wrecks=r.wrecks.filter(w=>w.x>-70&&w.life>0);
  const shots:{x:number;y:number;dx:number;dy:number}[]=[];
  const blasts:{x:number;y:number}[]=[];
  const destroyed:Facility[]=[];
  // Authored banks alternate above and below the flight corridor.
  if(r.tick < 65*60 && r.tick % 360 === 120) {
    const side = Math.floor(r.tick/360)%2;
    const y = h*(side ? 0.73 : 0.27);
    addFacility(r,'turret',w+70,y);
    addFacility(r,'fuel',w+155,y);
    addFacility(r,'fuel',w+230,y);
  }
  if([18*60,42*60,61*60].includes(r.tick)) addFacility(r,'carrier',w+60,h*0.5);
  for(const u of r.units) {
    u.tick++;
    u.x -= u.kind === 'carrier' ? 2.5 : 1.8;
    u.charging=false;
    if(u.dead) continue;
    if(u.fuse > 0) {
      u.fuse--;
      if(u.fuse===0) {
        u.dead=true; blasts.push({x:u.x,y:u.y});
        for(const other of r.units) {
          if(other===u || other.dead || Math.hypot(other.x-u.x,other.y-u.y)>165) continue;
          if(other.kind==='fuel') { if(other.fuse===0) other.fuse=12; }
          else { other.hp-=12; if(other.hp<=0) other.dead=true; }
        }
      }
    }
    if(u.kind!=='turret' || u.dead || u.x>w-40 || u.x<90) continue;
    const t=u.tick%150;
    if(t===60) {const dx=player.x-u.x,dy=player.y-u.y,len=Math.hypot(dx,dy)||1;u.aimX=dx/len;u.aimY=dy/len;}
    u.charging=t>=60&&t<96;
    if(t===96 || t===105) shots.push({x:u.x,y:u.y,dx:u.aimX,dy:u.aimY});
  }
  for(const u of r.units) if(u.dead) {
    destroyed.push(u);
    if(u.kind!=='carrier')r.wrecks.push({x:u.x,y:u.y,life:900});
    if(u.kind==='carrier') r.pickup={x:u.x,y:u.y,life:900};
  }
  r.units=r.units.filter(u=>!u.dead && u.x>-140);
  if(r.pickup) {r.pickup.x-=1.8;if(--r.pickup.life<=0 || r.pickup.x < -30) r.pickup=null;}
  return {shots,blasts,destroyed};
}
export function collectRefineryPickup(r:Refinery,p:{x:number;y:number}) {
  if(!r.pickup || Math.hypot(r.pickup.x-p.x,r.pickup.y-p.y)>65) return false;
  r.pickup=null;return true;
}
export function refineryChapter(tick:number) {
  return tick<18*60?'BREACH THE OUTER DECKS':tick<42*60?'FUEL NETWORK':tick<65*60?'REACTOR APPROACH':'GUARDIAN INBOUND';
}
