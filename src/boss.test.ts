import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBoss,stepBoss,damageBossPart,bossPhase} from './boss.ts';
test('cannons protect the core; destroying each changes attacks and exposes it',()=>{
  const b=createBoss(1280,720),[core,a,c]=b.parts;
  assert.equal(damageBossPart(b,core),'shield');assert.equal(core.hp,90);
  for(let i=0;i<30;i++)damageBossPart(b,a);
  assert.equal(bossPhase(b),1);assert.equal(damageBossPart(b,core),'shield');
  for(let i=0;i<30;i++)damageBossPart(b,c);
  assert.equal(bossPhase(b),0);
  for(let i=0;i<90;i++)damageBossPart(b,core);
  assert.ok(b.dead);assert.equal(damageBossPart(b,core),'none');
  assert.equal(core.hp,0);
});
test('each phase telegraphs before firing, and destroyed weapons never shoot',()=>{
  for(const remaining of [2,1,0]){
    const b=createBoss(1280,720);
    if(remaining<2)b.parts[1].hp=0;
    if(remaining===0)b.parts[2].hp=0;
    let shots=0;
    for(let i=0;i<144;i++){
      const s=stepBoss(b,{x:100,y:300},1280,720);
      if(i<143)assert.equal(s.length,0);
      shots+=s.length;
    }
    assert.equal(shots,remaining===2?2:remaining===1?3:5);
  }
});
test('boss death finishes its animation without spawning more shots',()=>{
  const b=createBoss(1280,720);b.dead=true;
  for(let i=0;i<90;i++)assert.deepEqual(stepBoss(b,{x:0,y:0},1280,720),[]);
  assert.equal(b.deathTicks,90);
});
