import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { animateBearPose } from '../src/bear-motion.js';

function bear(){
  const group=new THREE.Group();
  group.userData={body:new THREE.Group(),head:new THREE.Group(),legs:[new THREE.Group(),new THREE.Group()],arms:[new THREE.Group(),new THREE.Group()],ears:[],blinkOffset:0};
  group.userData.legs.forEach(leg=>leg.position.y=.24);
  animateBearPose(group,0,0,false);
  return group;
}
test('walking blends into rest without changing the character position',()=>{
  const model=bear();
  for(let i=0;i<20;i++){model.position.z+=4.6/60;animateBearPose(model,1/60,i/60,true);}
  const position=model.position.clone(),leg=model.userData.legs[0];
  assert.ok(Math.abs(leg.rotation.x)>.03);
  animateBearPose(model,1/60,1,false);assert.ok(Math.abs(leg.rotation.x)>.001,'Stopping should settle, not snap');
  for(let i=0;i<120;i++)animateBearPose(model,1/60,1+i/60,false);
  assert.ok(Math.abs(leg.rotation.x)<.001);assert.ok(Math.abs(leg.position.y-.24)<.001);assert.ok(model.position.equals(position));
});
test('pausing preserves the current pose and reduced motion keeps the torso still',()=>{
  const model=bear();
  model.position.z+=.1;animateBearPose(model,1/30,2,true);
  const saved=model.userData.body.rotation.clone(),leg=model.userData.legs[0].rotation.clone();
  animateBearPose(model,0,100,true);assert.ok(model.userData.body.rotation.equals(saved));assert.ok(model.userData.legs[0].rotation.equals(leg));
  const still=bear();
  for(let i=0;i<60;i++){still.position.z+=.1;animateBearPose(still,1/60,i/60,true,true);}
  assert.equal(still.userData.body.position.y,0);assert.equal(still.userData.body.rotation.z,0);assert.equal(still.userData.head.rotation.z,0);
});
