import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DESTINATIONS, destinationLayout, destinationHeight, freshTravel, rememberLandmark } from '../src/destinations.js';
import { DestinationScene } from '../src/destination-scene.js';
import { DestinationTravel } from '../src/destination-travel.js';
import { freshState, findPath, isWalkable, moveWithCollisions } from '../src/game-state.js';
import { Companion } from '../src/companion.js';

test('every destination has reachable memories and safe entry points, independent of forest ponds',()=>{
  for(const place of DESTINATIONS.slice(1)){
    const scene=new DestinationScene(place,true);
    assert.ok(isWalkable(place.spawn.x,place.spawn.z,scene.obstacles,scene.layout),place.id+' spawn');
    for(const landmark of place.landmarks){
      const path=findPath(place.spawn,landmark,scene.obstacles,scene.layout);
      assert.ok(path.length,`${place.id}: ${landmark.id} is reachable`);
      const position={...place.spawn};
      for(const next of path)moveWithCollisions(position,next.x-position.x,next.z-position.z,scene.obstacles,scene.layout);
      assert.ok(Math.hypot(position.x-landmark.x,position.z-landmark.z)<.01,`${place.id}: collision-free path to ${landmark.id}`);
    }
    assert.ok(scene.static.children.length<45,'Static details are batched');
    scene.dispose();
  }
  assert.equal(isWalkable(-8.5,2,[],destinationLayout('village')),true);
  assert.equal(isWalkable(-8.5,2,[]),false,'The forest retains its pond');
  assert.equal(isWalkable(0,-12,[],destinationLayout('beach')),false);
  assert.equal(isWalkable(13,-11,[],destinationLayout('snowlands')),false);
  assert.equal(isWalkable(28,0,[],destinationLayout('city')),false);
});

test('memories are local, unique, separate from gifts, and cleared for a new adventure',()=>{
  const log=freshTravel(),state=freshState(),place=DESTINATIONS[1],landmark=place.landmarks[0];
  assert.equal(rememberLandmark(log,place.id,landmark.id,{x:20,z:20}),false);
  assert.equal(rememberLandmark(log,place.id,'missing',landmark),false);
  assert.equal(rememberLandmark(log,place.id,landmark.id,landmark),true);
  assert.equal(rememberLandmark(log,place.id,landmark.id,landmark),false);
  assert.deepEqual(state.collected,[]);assert.equal(state.bubuArrived,false);
  assert.equal(freshTravel().memories.length,0);assert.deepEqual(freshTravel().visited,['forest']);
});

test('Bubu follows destination paths without using the old forest ponds',()=>{
  const place=DESTINATIONS[3],scene=new DestinationScene(place,true),target=place.landmarks[0];
  const buddy=new Companion(place.spawn,scene.obstacles,scene.layout);
  for(let i=0;i<500;i++)buddy.update(.05,target);
  assert.ok(Math.hypot(buddy.position.x-target.x,buddy.position.z-target.z)<1.8);
  assert.ok(isWalkable(buddy.position.x,buddy.position.z,scene.obstacles,scene.layout));scene.dispose();
  assert.ok(destinationHeight('mountains',8,-7)>3.5);assert.equal(destinationHeight('beach',8,-7),.2);
});

function travelWorld(completed=false){
  const world={scene:new THREE.Scene(),state:{...freshState(),departed:true,completed,collected:['flowers']},story:'exploring',time:10,mobile:true,obstacles:[],cameraObstacles:[],follow:{yaw:.7},renderer:{compileAsync:async()=>{},shadowMap:{}},sky:{setPalette(){}},setCamera(){},cinematic:false};
  for(const name of ['ambient','sunLight','fillLight','dudu','bubu','clickMarker','guidance']){world[name]=new THREE.Group();world.scene.add(world[name]);}
  for(const bear of [world.dudu,world.bubu])bear.userData.umbrella={update(){}};
  world.bubu.visible=completed;world.bubu.position.set(6,.2,-27);world.reactions={mesh:new THREE.Group(),reset(){}};world.scene.add(world.reactions.mesh);
  world.rain={streaks:new THREE.Group(),puddles:new THREE.Group(),ripples:new THREE.Group()};world.scene.add(...Object.values(world.rain));
  world.scenery=new THREE.Group();world.scene.add(world.scenery);world.walkable=(x,z)=>isWalkable(x,z,world.obstacles,world.navigation);
  return world;
}
test('travel restores the exact forest state, limits active scenes, and rolls back failed loads',async()=>{
  for(const completed of [false,true]){
    const world=travelWorld(completed),travel=new DestinationTravel(world),original=structuredClone(world.state),obstacles=world.obstacles;
    assert.equal(await travel.visit('not-a-place'),false);
    world.cinematic=true;assert.equal(await travel.visit('city'),false);world.cinematic=false;
    assert.equal(await travel.visit('village'),true);assert.equal(travel.forestRoot.visible,false);assert.equal(world.bubu.visible,completed);assert.ok(world.companion||!completed);
    const old=travel.active;world.state.position={x:2,z:18};await travel.visit('beach');assert.equal(old.group.parent,null);
    assert.equal(travel.snapshot().sceneCount,1);assert.deepEqual(world.state.collected,original.collected);
    world.renderer.compileAsync=async()=>{throw Error('GPU warmup failed');};
    await assert.rejects(travel.visit('city'));assert.equal(travel.current.id,'beach');assert.ok(travel.active.group.parent);
    travel.returnHome();assert.deepEqual(world.state,original);assert.equal(world.obstacles,obstacles);assert.equal(travel.forestRoot.visible,true);assert.equal(world.bubu.visible,completed);
    assert.deepEqual(travel.log.positions.village,{x:2,z:18});assert.equal(travel.active,null);
    travel.reset();assert.deepEqual(travel.log,freshTravel());
  }
});

test('destination animation freezes while paused and reduced motion hides falling snow',()=>{
  const snow=new DestinationScene(DESTINATIONS[5],true);snow.update(1,1,0,false,[]);
  const before=snow.snow.geometry.attributes.position.array.slice();snow.update(0,1,0,false,[]);assert.deepEqual(snow.snow.geometry.attributes.position.array,before);
  assert.equal(snow.aurora.visible,true);snow.update(1,1,1,true,[]);assert.equal(snow.snow.visible,false);assert.equal(snow.time,1);
  snow.dispose();
});
