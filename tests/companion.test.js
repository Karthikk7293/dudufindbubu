import test from 'node:test';
import assert from 'node:assert/strict';
import { Companion, companionStart } from '../src/companion.js';
import { PONDS, findPath, isWalkable } from '../src/game-state.js';

test('Bubu follows a moving Dudu over both bridges without crossing the water',()=>{
  for(const pond of PONDS){
    const target={x:pond.x-7,z:pond.z},follower=new Companion({x:pond.x-9,z:pond.z},[]);
    const route=findPath(target,{x:pond.x+7,z:pond.z},[]);
    for(const waypoint of route){
      for(let step=0;step<40;step++){
        const dx=waypoint.x-target.x,dz=waypoint.z-target.z,length=Math.hypot(dx,dz),travel=Math.min(.1,length);
        if(length>0){target.x+=dx/length*travel;target.z+=dz/length*travel;}
        const before={...follower.position};follower.update(.025,target);
        assert.ok(isWalkable(follower.position.x,follower.position.z));
        assert.ok(Math.hypot(follower.position.x-before.x,follower.position.z-before.z)<.22,'Bubu walks instead of teleporting');
      }
    }
    assert.ok(follower.position.x>pond.x+4,'Bubu reaches the other bank');
    assert.ok(Math.hypot(follower.position.x-target.x,follower.position.z-target.z)<2);
  }
});
test('Bubu finds a route around a tree and waits close to Dudu',()=>{
  const obstacles=[{x:3,z:8,radius:1.5}],target={x:7,z:8},follower=new Companion({x:0,z:8},obstacles);
  for(let i=0;i<400;i++){follower.update(.025,target);assert.ok(isWalkable(follower.position.x,follower.position.z,obstacles));}
  assert.ok(Math.hypot(follower.position.x-target.x,follower.position.z-target.z)<1.7);
  const settled={...follower.position};follower.update(1,target);assert.deepEqual(follower.position,settled);
});
test('a returning couple starts at a safe saved place, with a nearby fallback',()=>{
  const state={position:{x:4,z:8},companionPosition:{x:3,z:8}};
  assert.deepEqual(companionStart(state,[]),state.companionPosition);
  const obstacles=[{x:3,z:8,radius:1}];const start=companionStart(state,obstacles);
  assert.ok(isWalkable(start.x,start.z,obstacles));assert.ok(Math.hypot(start.x-4,start.z-8)<5);
});
