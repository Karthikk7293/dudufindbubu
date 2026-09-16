import test from 'node:test';
import assert from 'node:assert/strict';
import { ForestWorld, createBear } from '../src/world.js';
import { MoonJourney } from '../src/moon-journey.js';
import { freshState, BUBU } from '../src/game-state.js';

function actors(){
  const world=Object.create(ForestWorld.prototype);
  Object.assign(world,{state:freshState(),dudu:createBear(),bubu:createBear(true),obstacles:[],events:[],time:0,storyTime:0,reducedMotion:false,playing:true});
  for(const bear of [world.dudu,world.bubu])bear.userData.groundShadow={visible:true};
  return world;
}
function pose(bear){
  const {body,head,arms,legs,forearms}=bear.userData;
  return [body,head,...arms,...legs,...forearms].map(part=>[...part.position.toArray(),...part.rotation.toArray()]);
}
test('finishing the birthday preserves the joyful pose until it can ease back to walking',()=>{
  const world=actors();world.story='party';world.partyStart={x:BUBU.x-1.8,z:BUBU.z+.5};world.state.position={...world.partyStart};
  world.dudu.position.set(world.partyStart.x,.23,world.partyStart.z);world.bubu.position.set(BUBU.x,.23,BUBU.z);
  world.candleFlame={visible:true};world.releaseConfetti=()=>{};
  for(let i=0;i<81;i++){
    world.updateBearExpressions(.1,false);world.storyTime+=.1;world.time+=.1;world.updateParty(.1);
    if(world.story==='exploring')break;
  }
  assert.equal(world.state.completed,true);assert.equal(world.candleFlame.visible,false);
  assert.ok(world.dudu.userData.arms[0].rotation.z<-.8,'Raised paws should not snap down at the ending dialog');
  assert.ok(world.bubu.userData.arms[1].rotation.z>.8);
});
test('pausing the ladder approach preserves both movement flags and every articulated pose',()=>{
  const world=actors();world.story='moon';world.nightBlend=0;
  world.moonJourney=new MoonJourney({x:-12,z:-24},{x:-11,z:-23},[],0);
  world.time=.1;world.updateMoonJourney(.1);
  assert.equal(world.moonJourney.phase,'approaching');assert.ok(world.moonJourney.bears.some(b=>b.moving));
  const before=[pose(world.dudu),pose(world.bubu)],moving=world.moonJourney.bears.map(b=>b.moving);
  world.updateMoonJourney(0);
  assert.deepEqual(world.moonJourney.bears.map(b=>b.moving),moving);
  assert.deepEqual([pose(world.dudu),pose(world.bubu)],before);
});
