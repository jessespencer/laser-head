import { test } from 'node:test';
import assert from 'node:assert/strict';
import {resolveBlast, type BlastTarget} from './blast.ts';
const mine=(x:number):BlastTarget=>({x,y:0,type:'bomb'});
test('mines survive a neighboring explosion and propagate a delayed chain',()=>{
  const a=mine(0), b=mine(200), c=mine(400), alien={x:210,y:0,type:'scout'};
  const targets=[a,b,c,alien];
  const first=resolveBlast(targets,a,280);
  assert.deepEqual(first.victims,[alien]);
  assert.deepEqual(targets,[b,c]);
  assert.equal(b.detonateTimer,10);
  assert.equal(c.detonateTimer,undefined);
  assert.equal(first.bonus,0);
  const second=resolveBlast(targets,b,280);
  assert.equal(second.bonus,250);
  assert.equal(c.chainDepth,2);
  assert.equal(resolveBlast(targets,c,280).bonus,500);
  assert.deepEqual(targets,[]);
});
test('multiple neighboring mines get staggered fuses and cannot be rearmed',()=>{
  const a=mine(0), b=mine(100), c=mine(200), d=mine(50);
  const targets=[a,b,c,d];
  resolveBlast(targets,a,280);
  assert.deepEqual([b.detonateTimer,c.detonateTimer,d.detonateTimer],[10,16,22]);
  resolveBlast(targets,b,280);
  assert.equal(c.detonateTimer,16);
  assert.equal(c.chainDepth,1);
});
test('a resolved blast cannot award points twice and out-of-range targets survive',()=>{
  const a=mine(0), far=mine(300),targets=[a,far];
  a.chainDepth=2;
  assert.equal(resolveBlast(targets,a,280).bonus,500);
  assert.equal(resolveBlast(targets,a,280).bonus,0);
  assert.deepEqual(targets,[far]);
});
