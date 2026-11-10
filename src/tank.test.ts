import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTankAttack,stepTank,tankCharging,tankShotDirections,TANK_TELEGRAPH} from './tank.ts';

test('different rolls produce different variants, timing, patterns and volley counts',()=>{
  const a=createTankAttack(()=>0.1),b=createTankAttack(()=>0.9);
  assert.equal(a.variant,'hunter');assert.equal(b.variant,'spreader');
  assert.notDeepEqual(a.volleys,b.volleys);
  assert.equal(a.volleys.length,2);assert.equal(b.volleys.length,4);
});
test('aggression thickens an attack without shortening its charge warning',()=>{
  const shotCount=(a:ReturnType<typeof createTankAttack>)=>a.volleys.flatMap(v=>v.shots).length;
  for(const roll of [0.1,0.5,0.9]) {
    const calm=createTankAttack(()=>roll,0),hot=createTankAttack(()=>roll,1);
    assert.ok(hot.volleys.length>calm.volleys.length,`volleys grow at roll ${roll}`);
    assert.ok(shotCount(hot)>shotCount(calm),`shots grow at roll ${roll}`);
    // Every volley keeps the full telegraph at both ends of the range.
    for(const a of [calm,hot]) for(const v of a.volleys) assert.ok(v.shots[0]-v.start>=TANK_TELEGRAPH);
  }
});
test('only the hottest spreader fans widen, and every direction stays a unit vector',()=>{
  const wide=createTankAttack(()=>0.7,1);
  assert.equal(wide.variant,'spreader');
  assert.ok(wide.volleys.some(v=>v.mode==='fan'&&v.wide));
  assert.ok(createTankAttack(()=>0.7,0).volleys.every(v=>!v.wide));
  const body={x:1000,y:300,speed:5},target={x:100,y:300};
  for(let i=0;i<500 && wide.phase==='approach';i++) stepTank(body,wide,target,1280);
  while(wide.phase==='attack') {
    stepTank(body,wide,target,1280);
    const v=wide.volleys.find(v=>wide.tick>=v.start&&wide.tick<=v.shots.at(-1)!);
    if(!v) continue;
    const directions=tankShotDirections(wide);
    assert.equal(directions.length,v.mode!=='fan'?1:v.wide?5:3);
    for(const d of directions) assert.ok(Math.abs(Math.hypot(d.x,d.y)-1)<1e-9);
  }
});
test('all generated shots have a warning and locked aim; all tanks eventually leave',()=>{
  for(const roll of [0.05,0.25,0.5,0.75,0.95]) {
    const a=createTankAttack(()=>roll),body={x:1000,y:300,speed:5},target={x:100,y:300};
    for(let i=0;i<500 && a.phase==='approach';i++) stepTank(body,a,target,1280);
    assert.equal(a.phase,'attack');
    const planned=a.volleys.flatMap(v=>v.shots), fired:number[]=[];
    while(a.phase==='attack') {
      if(stepTank(body,a,target,1280)) fired.push(a.tick);
      for(const v of a.volleys) {
        assert.ok(v.shots[0]-v.start>=12);
        if(a.tick===v.start) {
          assert.ok(tankCharging(a));
          const directions=tankShotDirections(a);
          assert.equal(directions.length,v.mode==='fan'?3:1);
          for(const d of directions) assert.ok(Math.abs(Math.hypot(d.x,d.y)-1)<1e-9);
        }
      }
    }
    assert.deepEqual(fired,planned);
    const x=body.x;stepTank(body,a,target,1280);assert.ok(body.x<x);
  }
});
test('moving after the charge begins does not retarget an incoming salvo',()=>{
  const a=createTankAttack(()=>0.1),body={x:900,y:300,speed:5},target={x:100,y:300};
  a.phase='attack';
  while(a.tick<a.volleys[0].start)stepTank(body,a,target,1280);
  const aim=a.aimY;target.y=600;
  while(a.tick<a.volleys[0].shots.at(-1)!)stepTank(body,a,target,1280);
  assert.equal(a.aimY,aim);
});
