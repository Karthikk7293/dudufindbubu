import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { freshAdventure, discoverPlaces, befriend, birthdayChapter, PLACES } from '../src/adventure.js';
import { freshState, GIFTS, MOON_NEST, canCelebrate, shouldRevealBubu, DESTINATION } from '../src/game-state.js';
import { Wildlife } from '../src/wildlife-state.js';
import { ForestReactions } from '../src/forest-reactions.js';
import { PostcardCamera, portraitComposition } from '../src/postcard.js';
import { clearCameraDistance } from '../src/follow-camera.js';

test('discoveries are local, once per adventure, and start after leaving home',()=>{
  const adventure=freshAdventure(),game=freshState(),bridge=PLACES.find(p=>p.id==='bridge');
  assert.deepEqual(discoverPlaces(adventure,game,bridge),[]);
  game.departed=true;assert.deepEqual(discoverPlaces(adventure,game,{x:35,z:30}),[]);
  assert.deepEqual(discoverPlaces(adventure,game,bridge).map(p=>p.id),['bridge']);
  assert.deepEqual(discoverPlaces(adventure,game,bridge),[]);
  assert.deepEqual(adventure.places,['bridge']);assert.deepEqual(freshAdventure().places,[]);
});
test('Moonwatch is discovered in the nest after the birthday, not at the ladder',()=>{
  const adventure=freshAdventure(),game={...freshState(),departed:true},nest={x:MOON_NEST.x,z:MOON_NEST.z+2.8,y:MOON_NEST.height};
  assert.deepEqual(discoverPlaces(adventure,game,nest),[]);
  game.completed=true;
  assert.ok(!discoverPlaces(adventure,game,{...MOON_NEST.entry,y:0}).some(p=>p.id==='moonwatch'));
  assert.ok(discoverPlaces(adventure,game,nest).some(p=>p.id==='moonwatch'));
});
test('friends are unique species and optional memories cannot bypass the birthday',()=>{
  const adventure=freshAdventure(),game={...freshState(),departed:true,position:{...DESTINATION}};
  assert.equal(befriend(adventure,'sheep'),true);assert.equal(befriend(adventure,'sheep'),false);assert.equal(befriend(adventure,'dragon'),false);
  for(const place of PLACES)discoverPlaces(adventure,game,{...place,y:0});
  assert.equal(shouldRevealBubu(game),false);assert.equal(canCelebrate(game),false);
  assert.equal(birthdayChapter(game).number,1);
  game.collected=GIFTS.map(g=>g.id);assert.equal(birthdayChapter(game).number,2);assert.equal(shouldRevealBubu(game),true);
  game.bubuArrived=true;assert.equal(birthdayChapter(game).number,3);
  game.completed=true;assert.equal(birthdayChapter(game).number,4);
  assert.deepEqual(freshAdventure(),{places:[],friends:[],postcards:0});
});
test('greetings stop wildlife, face the player, pause and have a cooldown',()=>{
  for(const kind of ['rabbit','sheep','deer','fox']){
    const animal=new Wildlife(kind,5,20),player={x:6,z:21};
    assert.equal(animal.greet({x:30,z:30}),false);assert.equal(animal.greet(player,1),false);
    animal.target={x:6,z:20};assert.equal(animal.greet(player),true);
    assert.equal(animal.target,null);assert.equal(animal.mode,'friendly');assert.equal(animal.greet(player),false);
    const before=JSON.stringify(animal);animal.update(0,player,()=>true);assert.equal(JSON.stringify(animal),before);
    animal.update(2,player,()=>true);assert.deepEqual(animal.position,{x:5,z:20});assert.equal(animal.heading,Math.PI/4);
    animal.update(3,player,()=>true);assert.equal(animal.mode,'idle');assert.equal(animal.canGreet(player),false);
    animal.update(4,player,()=>true);assert.equal(animal.canGreet(player),true);
    animal.mode='sleep';assert.equal(animal.greet(player),false);
  }
});
test('heart effects stay bounded, freeze when paused and clear after their lifetime',()=>{
  const effects=new ForestReactions(new THREE.Scene(),new THREE.PlaneGeometry(1,1)),camera=new THREE.PerspectiveCamera();
  for(let i=0;i<20;i++)effects.emit({x:0,y:1,z:0});
  effects.update(.5,camera);assert.equal(effects.mesh.count,24);
  const before=effects.mesh.instanceMatrix.array.slice();effects.update(0,camera);assert.deepEqual(effects.mesh.instanceMatrix.array,before);
  effects.update(2,camera);assert.equal(effects.mesh.count,0);
  effects.emit({x:0,y:1,z:0},true);effects.update(0,camera);const still=effects.mesh.instanceMatrix.array.slice();
  effects.update(.5,camera);assert.equal(effects.mesh.count,1);assert.deepEqual(effects.mesh.instanceMatrix.array,still);
  effects.reset();assert.equal(effects.mesh.count,0);
});

test('portrait framing finds a clear side when a tree hides Dudu',()=>{
  const bear=new THREE.Vector3(0,.2,0),obstacles=[{x:.6,z:3,minY:0,maxY:9,radius:1}];
  const empty=portraitComposition(bear,0),clear=portraitComposition(bear,0,obstacles);
  assert.notDeepEqual(clear.position,empty.position);
  const offset=clear.position.clone().sub(clear.target),distance=offset.length();
  assert.ok(distance>4.5);assert.ok(clearCameraDistance(clear.target,offset.normalize(),distance,obstacles)>=distance-.001);
  const world={cinematic:true,moonJourney:{phase:'climbing'}},photo=new PostcardCamera(world);
  assert.equal(photo.available,false);world.moonJourney.phase='stargazing';assert.equal(photo.available,true);
  world.cinematic=false;world.moonJourney=null;assert.equal(photo.available,true);
});
