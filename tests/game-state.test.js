import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,restoreState,collectGift,canCelebrate,isWalkable,moveWithCollisions,findPath,GIFTS,BUBU,START,DESTINATION,WORLD_RADIUS,PONDS,shouldRevealBubu,clampZoom,guidanceTarget} from '../src/game-state.js';

test('invalid saves recover and untrusted gift ids are rejected',()=>{
  assert.deepEqual(restoreState('{broken'),freshState());
  assert.deepEqual(restoreState('null'),freshState());
  const restored=restoreState(JSON.stringify({position:{x:500,z:NaN},collected:['flowers','flowers','invalid'],completed:true}));
  assert.deepEqual(restored.collected,['flowers']);assert.deepEqual(restored.position,freshState().position);assert.equal(restored.completed,false);
});
test('gifts require proximity and can only be collected once',()=>{
  const state=freshState();assert.equal(collectGift(state,'flowers'),false);
  state.position={x:GIFTS[0].x,z:GIFTS[0].z};assert.equal(collectGift(state,'flowers'),true);assert.equal(collectGift(state,'flowers'),false);assert.equal(collectGift(state,'nope'),false);
});
test('the birthday requires all gifts and reaching Bubu',()=>{
  const state=freshState();state.collected=GIFTS.map(g=>g.id);assert.equal(canCelebrate(state),false);
  state.position={...BUBU};assert.equal(canCelebrate(state),false);state.bubuArrived=true;assert.equal(canCelebrate(state),true);state.collected.pop();assert.equal(canCelebrate(state),false);
});
test('water is blocked and the bridge remains crossable',()=>{
  assert.equal(isWalkable(-8.5,2),false);assert.equal(isWalkable(-8.5,0),true);assert.equal(isWalkable(WORLD_RADIUS+1,0),false);
  const position={x:-15,z:0};moveWithCollisions(position,11,0,[]);assert.ok(position.x>-5);
  const shoreline={x:-8.5,z:4.5};moveWithCollisions(shoreline,0,-3,[]);assert.ok(shoreline.z>=3.5);
});
test('movement cannot tunnel through solid obstacles even with a large step',()=>{
  const p={x:0,z:0};moveWithCollisions(p,10,0,[{x:3,z:0,radius:1}]);assert.ok(p.x<1.7);
});
test('click routes avoid water and cross the bridge when useful',()=>{
  const start={x:-15,z:1},goal={x:-2,z:1},route=findPath(start,goal,[]);
  assert.ok(route.length>0);assert.deepEqual(route.at(-1),goal);route.forEach(p=>assert.ok(isWalkable(p.x,p.z)));
  assert.deepEqual(findPath(start,{x:-8.5,z:2},[]),[]);
});
test('routes exist to every gift and Bubu',()=>{
  let start=freshState().position;
  for(const destination of [...GIFTS,BUBU]){const route=findPath(start,destination,[]);assert.ok(route.length>0);start=destination;}
});

test('Bubu needs all eight gifts as well as Dudu arriving from home',()=>{
  const state=freshState();assert.deepEqual(state.position,START);assert.equal(shouldRevealBubu(state),false);
  state.position={...DESTINATION};assert.equal(shouldRevealBubu(state),false);
  state.departed=true;assert.equal(shouldRevealBubu(state),false);
  state.collected=GIFTS.slice(0,-1).map(g=>g.id);assert.equal(shouldRevealBubu(state),false);
  state.collected.push(GIFTS.at(-1).id);assert.equal(shouldRevealBubu(state),true);
  state.bubuArrived=true;assert.equal(shouldRevealBubu(state),false);
});
test('old saves migrate to the nest while keeping gifts',()=>{
  const state=restoreState(JSON.stringify({position:{x:1,z:12},collected:['flowers','honey'],completed:false}));
  assert.deepEqual(state.position,START);assert.deepEqual(state.collected,['flowers','honey']);assert.equal(state.departed,false);assert.equal(state.bubuArrived,false);
  state.departed=true;state.position={...DESTINATION};assert.deepEqual(restoreState(JSON.stringify(state)),state);
  state.bubuArrived=true;assert.equal(restoreState(JSON.stringify(state)).bubuArrived,false,'Old early arrivals return Bubu to her nest');
});
test('zoom is bounded and both ponds have crossing routes',()=>{
  assert.equal(clampZoom(2),14);assert.equal(clampZoom(1000),108);assert.equal(clampZoom(30),30);
  for(const p of PONDS){assert.equal(isWalkable(p.x,p.z+2),false);assert.equal(isWalkable(p.x,p.z),true);assert.ok(findPath({x:p.x-7,z:p.z},{x:p.x+7,z:p.z},[]).length);}
});


test('guidance tracks the love letter, moves on after collecting it, then leads home',()=>{
  const state=freshState();assert.equal(guidanceTarget(state,'letter').id,'letter');
  state.collected=['letter'];assert.notEqual(guidanceTarget(state,'letter').id,'letter');
  state.collected=GIFTS.map(g=>g.id);assert.equal(guidanceTarget(state,'letter').id,'bubu');
  assert.equal(guidanceTarget(state).z,DESTINATION.z);state.bubuArrived=true;assert.equal(guidanceTarget(state).z,BUBU.z,'After the door opens the pointer leads to Bubu herself');
  state.completed=true;assert.equal(guidanceTarget(state,'letter').id,'moon-nest');assert.equal(canCelebrate(state),false);
});
test('saved companionship requires a finished birthday and a safe position',()=>{
  const state={...freshState(),collected:GIFTS.map(g=>g.id),bubuArrived:true,companionPosition:{x:3,z:4}};
  assert.equal(restoreState(JSON.stringify(state)).companionPosition,null);
  state.completed=true;assert.deepEqual(restoreState(JSON.stringify(state)).companionPosition,{x:3,z:4});
  state.companionPosition={x:-8.5,z:2};assert.equal(restoreState(JSON.stringify(state)).companionPosition,null);
});
