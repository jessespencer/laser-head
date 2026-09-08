import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRefinery,addFacility,hitFacility,stepRefinery,collectRefineryPickup,REFINERY_BOSS_TICK} from './refinery.ts';
import {createRefineryBoss,stepRefineryBoss,damageBossPart,bossPhase} from './boss.ts';
const player={x:100,y:300};
test('fuel detonates once, chains on a later tick, and destroys nearby defenses',()=>{
  const r=createRefinery(),a=addFacility(r,'fuel',500,300),b=addFacility(r,'fuel',575,300),gun=addFacility(r,'turret',430,300);
  for(let i=0;i<3;i++)hitFacility(a);
  assert.equal(a.fuse,12);
  let blasts=0,kills=0,first=0,last=0;
  for(let i=0;i<40;i++) {
    const result=stepRefinery(r,player,1000,600);
    if(result.blasts.length){if(!first)first=i;last=i;}
    blasts+=result.blasts.length;kills+=result.destroyed.length;
  }
  assert.equal(blasts,2);assert.equal(kills,3);assert.ok(last>first);
  assert.ok(gun.dead&&b.dead);assert.equal(r.units.length,0);
});
test('destroying a carrier guarantees a collectable upgrade; collection cannot repeat',()=>{
  const r=createRefinery(),u=addFacility(r,'carrier',500,300);
  for(let i=0;i<14;i++)hitFacility(u);
  stepRefinery(r,player,1000,600);assert.ok(r.pickup);
  assert.equal(collectRefineryPickup(r,player),false);
  assert.equal(collectRefineryPickup(r,{x:r.pickup!.x,y:r.pickup!.y}),true);
  assert.equal(collectRefineryPickup(r,{x:500,y:300}),false);
  stepRefinery(r,player,1000,600);assert.equal(r.pickup,null);
});
test('turrets lock aim during a visible charge and cannot fire once destroyed',()=>{
  const r=createRefinery(),u=addFacility(r,'turret',850,250);let warnings=0,shots=0;
  for(let i=0;i<106;i++) {
    const result=stepRefinery(r,i<60?player:{x:100,y:590},1000,600);
    if(u.charging)warnings++;
    for(const s of result.shots){assert.ok(warnings>=36);assert.equal(s.dx,u.aimX);assert.equal(s.dy,u.aimY);shots++;}
  }
  assert.equal(shots,2);
  for(let i=0;i<10;i++)hitFacility(u);
  assert.equal(stepRefinery(r,player,1000,600).shots.length,0);
});
test('the authored stage stops new facilities before the boss and bounds live objects',()=>{
  const r=createRefinery();let peak=0,carriers=0;
  for(let i=0;i<REFINERY_BOSS_TICK;i++) {
    stepRefinery(r,player,1280,720);peak=Math.max(peak,r.units.length);
    carriers+=r.units.filter(u=>u.kind==='carrier'&&u.tick===1).length;
  }
  assert.equal(carriers,3);assert.ok(peak<=12);assert.ok(r.units.every(u=>u.tick>10*60));
});
test('four cooling nodes protect the reactor and death stops all attacks',()=>{
  const b=createRefineryBoss(1280,720);
  assert.equal(bossPhase(b),4);assert.equal(damageBossPart(b,b.parts[0]),'shield');
  for(const p of b.parts.slice(1)) for(let i=0;i<24;i++)damageBossPart(b,p);
  assert.equal(bossPhase(b),0);
  for(let i=0;i<120;i++)damageBossPart(b,b.parts[0]);
  assert.ok(b.dead);
  for(let i=0;i<90;i++)assert.deepEqual(stepRefineryBoss(b,player,1280,720),[]);
  assert.equal(b.deathTicks,90);
});
test('reactor shots have a full warning and parts remain in the viewport at small sizes',()=>{
  for(const [w,h] of [[1280,720],[640,480],[390,700]]) {
    const b=createRefineryBoss(w,h),warns=new Map();let fired=0;
    for(let t=0;t<700;t++) {
      const shots=stepRefineryBoss(b,player,w,h);
      for(const p of b.parts) {
        if(p.charging)warns.set(p,(warns.get(p)||0)+1);
        if(t>149){assert.ok(p.y-p.half>=0&&p.y+p.half<=h);assert.ok(p.x+p.half<w);}
      }
      for(const shot of shots){const p=b.parts.find(p=>p.x===shot.x&&p.y===shot.y)!;assert.ok(warns.get(p)>=36);fired++;}
    }
    assert.ok(fired>0);
  }
});
test('an exposed reactor starts a fresh full warning regardless of when its last node falls',()=>{
  const b=createRefineryBoss(1280,720);
  for(let i=0;i<307;i++)stepRefineryBoss(b,player,1280,720);
  for(const p of b.parts.slice(1))p.hp=0;
  for(let i=0;i<36;i++) {
    assert.deepEqual(stepRefineryBoss(b,player,1280,720),[]);
    assert.ok(b.parts[0].charging);
  }
  assert.equal(stepRefineryBoss(b,player,1280,720).length,5);
});
