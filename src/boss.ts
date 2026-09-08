export const BOSS_ARRIVAL_TICK=70*60;
export type BossPart={kind:'core'|'gun';x:number;y:number;hp:number;maxHp:number;half:number;aimX:number;aimY:number;charging:boolean};
export type Boss={variant?:'refinery';coreStart?:number;tick:number;x:number;y:number;scale:number;parts:BossPart[];dead:boolean;deathTicks:number};
export function createBoss(width:number,height:number):Boss {
  const scale=Math.min(1,height/600,width/900);
  return {tick:0,x:width+180,y:height/2,scale,dead:false,deathTicks:0,
    parts:([['core',90,36],['gun',30,28],['gun',30,28]] as const).map(([kind,hp,half])=>({kind,x:width+180,y:height/2,hp,maxHp:hp,half:half*scale,aimX:-1,aimY:0,charging:false}))};
}
export function bossPhase(b:Boss){return b.parts.filter(p=>p.kind==='gun'&&p.hp>0).length;}
export function damageBossPart(b:Boss,p:BossPart){
  if(b.dead||p.hp<=0)return 'none';
  if(p.kind==='core'&&bossPhase(b)>0)return 'shield';
  p.hp--;if(p.hp>0)return 'hit';
  if(p.kind==='core'){b.dead=true;b.deathTicks=0;}
  return 'destroyed';
}
export function stepBoss(b:Boss,player:{x:number;y:number},width:number,height:number){
  const shots:{x:number;y:number;dx:number;dy:number}[]=[];
  if(b.dead){b.deathTicks++;return shots;}
  b.tick++;b.scale=Math.min(1,height/600,width/900);
  b.x+=(width*0.8-b.x)*0.035;
  b.y=height/2+Math.sin(Math.max(0,b.tick-120)*0.012)*height*0.18;
  const phase=bossPhase(b),cycle=phase===0?84:120;
  const t=(b.tick-120)%cycle;
  b.parts.forEach((p,i)=>{
    p.half=(p.kind==='core'?36:28)*b.scale;
    p.x=b.x-(i?35:0)*b.scale;
    p.y=b.y+(i===1?-105:i===2?105:0)*b.scale;
    const active=p.hp>0&&(phase===0?p.kind==='core':p.kind==='gun');
    p.charging=active&&b.tick>=120&&t>=0&&t<24;
    if(!active||b.tick<120)return;
    if(t===0){const dx=player.x-p.x,dy=player.y-p.y,len=Math.hypot(dx,dy)||1;p.aimX=dx/len;p.aimY=dy/len;}
    if(t===24||t===30||t===36){
      const angles=phase===2?[0]:phase===1?[-0.18,0,0.18]:[-0.34,-0.17,0,0.17,0.34];
      for(const a of angles)shots.push({x:p.x,y:p.y,dx:p.aimX*Math.cos(a)-p.aimY*Math.sin(a),dy:p.aimX*Math.sin(a)+p.aimY*Math.cos(a)});
    }
  });return shots;
}

export function createRefineryBoss(width:number,height:number):Boss {
  const b=createBoss(width,height);b.variant='refinery';
  b.parts[0].hp=b.parts[0].maxHp=120;
  b.parts=b.parts.slice(0,1).concat(Array.from({length:4},()=>({kind:'gun' as const,x:b.x,y:b.y,hp:24,maxHp:24,half:24*b.scale,aimX:-1,aimY:0,charging:false})));
  return b;
}
export function stepRefineryBoss(b:Boss,player:{x:number;y:number},width:number,height:number) {
  const shots:{x:number;y:number;dx:number;dy:number}[]=[];
  if(b.dead){b.deathTicks++;return shots;}
  b.tick++;b.scale=Math.min(1,height/650,width/1000);
  b.x+=(width*0.8-b.x)*0.035;b.y=height/2;
  const active=bossPhase(b);
  if(active===0 && b.coreStart===undefined)b.coreStart=b.tick;
  b.parts.forEach((p,i)=>{
    p.half=(i?24:40)*b.scale;
    p.x=b.x+(i?Math.cos((i-1)*Math.PI/2+b.tick*0.003)*115*b.scale:0);
    p.y=b.y+(i?Math.sin((i-1)*Math.PI/2+b.tick*0.003)*180*b.scale:0);
    p.charging=false;
    if(p.hp<=0||b.tick<150||(active>0&&i===0))return;
    const elapsed=i?b.tick-150-i*32:b.tick-(b.coreStart??150);
    if(elapsed<0)return;
    const t=elapsed%(active?160:110);
    if(t===0){const dx=player.x-p.x,dy=player.y-p.y,len=Math.hypot(dx,dy)||1;p.aimX=dx/len;p.aimY=dy/len;}
    p.charging=t<36;
    if(t===36){
      for(const a of (active?[-0.12,0,0.12]:[-0.48,-0.24,0,0.24,0.48]))
        shots.push({x:p.x,y:p.y,dx:p.aimX*Math.cos(a)-p.aimY*Math.sin(a),dy:p.aimX*Math.sin(a)+p.aimY*Math.cos(a)});
    }
  });return shots;
}
