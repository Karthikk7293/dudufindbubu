import test from 'node:test';
import assert from 'node:assert/strict';
import { MoonJourney, ladderFoot, nestSeat } from '../src/moon-journey.js';
import { MOON_NEST, findPath } from '../src/game-state.js';
test('both bears reach the ladder, climb through dusk, pause, watch and return safely',()=>{
  const obstacles=[{x:MOON_NEST.x,z:MOON_NEST.z,radius:1},{x:-14,z:-22,radius:.5}];
  const journey=new MoonJourney({x:-12,z:-24},{x:-10,z:-25},obstacles,0);
  assert.equal(journey.valid,true);assert.equal(journey.descend(),false);
  for(let i=0;i<500&&journey.phase==='approaching';i++)journey.update(.05);
  assert.equal(journey.phase,'climbing');
  const heights=[];for(let i=0;i<100;i++){journey.update(.05);heights.push(journey.bears[0].position.y);}
  assert.ok(journey.nightBlend>.4&&journey.nightBlend<.6);assert.ok(heights.every((v,i)=>!i||v>=heights[i-1]));
  const frozen=JSON.stringify(journey.bears);journey.update(0);assert.equal(JSON.stringify(journey.bears),frozen);
  for(let i=0;i<101;i++)journey.update(.05);
  assert.equal(journey.phase,'stargazing');assert.equal(journey.nightBlend,1);
  journey.bears.forEach((bear,i)=>assert.deepEqual(bear.position,nestSeat(i)));
  journey.update(20);assert.equal(journey.phase,'stargazing','The player decides when to leave');
  assert.equal(journey.descend(),true);assert.equal(journey.descend(),false);
  for(let i=0;i<201;i++)journey.update(.05);
  assert.equal(journey.phase,'finished');assert.equal(journey.nightBlend,1);
  journey.bears.forEach((bear,i)=>{assert.deepEqual(bear.position,ladderFoot(i));assert.ok(findPath(bear.position,{x:-12,z:-25},obstacles).length);});
  assert.deepEqual(journey.events,['moon-climbing','moon-arrived','moon-descending','moon-finished']);
});
test('a blocked ladder cannot start a visit, and an existing night never flashes to day',()=>{
  const blocked=new MoonJourney(MOON_NEST.entry,MOON_NEST.entry,[{...MOON_NEST.entry,radius:3}]);assert.equal(blocked.valid,false);
  const night=new MoonJourney(ladderFoot(0),ladderFoot(1),[],1);
  for(let i=0;i<300;i++){night.update(.05);assert.equal(night.nightBlend,1);}
  assert.equal(night.phase,'stargazing');
});
test('bears climb outside the deck and only step inside after reaching its height',()=>{
  const journey=new MoonJourney(ladderFoot(0),ladderFoot(1),[],0);
  for(let i=0;i<201;i++){
    journey.update(.05);
    for(const bear of journey.bears)if(bear.position.y<MOON_NEST.height)assert.ok(bear.position.z>MOON_NEST.z+5.4,'The head stays in front of the deck, clear of its underside');
  }
  assert.equal(journey.phase,'stargazing');
});
