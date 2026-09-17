import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ForestHaptics, HAPTIC_PATTERNS } from '../src/haptics.js';
import { BearUmbrella, umbrellaAllowed } from '../src/bear-umbrella.js';
import { createBear } from '../src/world.js';
import { animateBearPose } from '../src/bear-motion.js';
import { underRainCover } from '../src/weather-state.js';

function device(){
  let time=1000;const calls=[],saved=new Map();
  const env={navigator:{vibrate:p=>{calls.push(p);return true;},userActivation:{hasBeenActive:true}},document:{hidden:false},performance:{now:()=>time},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},matchMedia:q=>({matches:q.includes('coarse')})};
  return {env,calls,advance:()=>time+=1000};
}
test('semantic haptics replace a short tap, survive the following click and respect off/hidden state',()=>{
  const {env,calls,advance}=device(),h=new ForestHaptics(env);
  assert.equal(h.pulse('tap'),true);assert.equal(h.pulse('gift'),true);assert.equal(h.pulse('tap'),false);
  assert.deepEqual(calls,[8,HAPTIC_PATTERNS.gift]);
  advance();assert.equal(h.pulse('friend'),true);h.setEnabled(false);assert.equal(calls.at(-1),0);
  advance();assert.equal(h.pulse('gift'),false);assert.equal(new ForestHaptics(env).enabled,false);
  h.setEnabled(true);env.document.hidden=true;assert.equal(h.pulse('celebrate'),false);
  env.document.hidden=false;env.navigator.userActivation.hasBeenActive=false;assert.equal(h.pulse('gift'),false);
});
test('unsupported devices, reduced motion, denied vibration and unavailable storage stay playable',()=>{
  const {env}=device();env.matchMedia=()=>({matches:true});const h=new ForestHaptics(env);
  assert.equal(h.enabled,false);h.setEnabled(true);assert.equal(h.enabled,true);
  env.navigator.vibrate=()=>false;assert.equal(h.pulse('tap'),false);
  env.navigator.vibrate=()=>{throw new Error('blocked');};assert.equal(h.pulse('tap'),false);assert.doesNotThrow(()=>h.stop());
  delete env.navigator.vibrate;assert.equal(h.supported,false);assert.equal(h.pulse('gift'),false);
  env.localStorage={getItem:()=>{throw Error();},setItem:()=>{throw Error();}};
  assert.doesNotThrow(()=>new ForestHaptics(env).setEnabled(false));
  const desktop=device();desktop.env.matchMedia=()=>({matches:false});assert.equal(new ForestHaptics(desktop.env).supported,false);
});
test('umbrellas follow the actual paw through walking and turning, and freeze when paused',()=>{
  for(const white of [false,true]){
    const bear=createBear(white),umbrella=new BearUmbrella(bear,white);
    umbrella.update(0,0);assert.equal(umbrella.active,false);
    for(let i=1;i<=40;i++){
      bear.position.set(i*.05,.2,2);bear.rotation.y=i*.025;
      animateBearPose(bear,.1,i*.1,true);umbrella.update(.1,1);
      const paw=bear.userData.forearms[umbrella.hand],expected=new THREE.Vector3(0,-.08,.035);
      paw.localToWorld(expected);assert.ok(umbrella.group.getWorldPosition(new THREE.Vector3()).distanceTo(expected)<1e-9);
      assert.ok(umbrella.cover.y>bear.position.y+1.7);assert.ok(umbrella.cover.radius>1);
    }
    const before=[...umbrella.group.position.toArray(),...bear.userData.arms[umbrella.hand].rotation.toArray()];
    umbrella.update(0,1);assert.deepEqual([...umbrella.group.position.toArray(),...bear.userData.arms[umbrella.hand].rotation.toArray()],before);
    umbrella.update(0,0);assert.equal(umbrella.group.visible,false);
    bear.visible=false;umbrella.update(.1,1);assert.equal(umbrella.active,false);
    bear.visible=true;umbrella.update(.1,1,false);assert.equal(umbrella.active,false);
  }
});
test('hands are free for the ladder and umbrellas open once clear of the doorway',()=>{
  for(const phase of ['approaching','climbing','descending'])assert.equal(umbrellaAllowed('moon','Dudu',5,phase),false);
  assert.equal(umbrellaAllowed('moon','Bubu',5,'stargazing'),true);
  assert.equal(umbrellaAllowed('departure','Dudu',1),false);assert.equal(umbrellaAllowed('departure','Dudu',2),true);
  assert.equal(umbrellaAllowed('arrival','Bubu',1),false);assert.equal(umbrellaAllowed('arrival','Dudu',1),true);
  assert.equal(umbrellaAllowed('party','Bubu',5),true);
});
test('rain is blocked below the canopy, while falling above and beside it',()=>{
  const covers=[{x:2,y:3,z:4,radius:1.2,height:.3}];
  assert.equal(underRainCover({x:2,y:1,z:4},covers),true);
  assert.equal(underRainCover({x:2,y:4,z:4},covers),false);
  assert.equal(underRainCover({x:4,y:1,z:4},covers),false);
  assert.equal(underRainCover({x:2,y:1,z:4},[]),false);
});
