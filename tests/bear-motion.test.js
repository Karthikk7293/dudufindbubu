import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { animateBearPose, turnBear } from '../src/bear-motion.js';
import { BearExpression } from '../src/bear-expression.js';

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
test('shortest-angle turns match across frame rates and pause does not turn',()=>{
  const a=bear(),b=bear();a.rotation.y=b.rotation.y=Math.PI-.1;
  for(let i=0;i<60;i++)turnBear(a,-Math.PI+.1,1/60);
  for(let i=0;i<30;i++)turnBear(b,-Math.PI+.1,1/30);
  assert.ok(Math.abs(a.rotation.y-b.rotation.y)<1e-9);assert.ok(a.rotation.y>Math.PI);
  const angle=a.rotation.y;turnBear(a,0,0);assert.equal(a.rotation.y,angle);
});
test('shy paws fold at the elbows and gestures release when movement resumes',()=>{
  const model=bear(),data=model.userData;data.forearms=[new THREE.Group(),new THREE.Group()];data.expression=new BearExpression();
  data.expression.react('shy',3);data.expression.update(.4,{},true);
  for(let i=0;i<60;i++)animateBearPose(model,1/60,i/60,false);
  assert.ok(data.forearms[0].rotation.x<-.7);assert.ok(data.arms[0].rotation.z>.6);
  for(let i=0;i<60;i++){model.position.z+=4.6/60;animateBearPose(model,1/60,1+i/60,true);}
  assert.ok(Math.abs(data.forearms[0].rotation.x)<.01);
  assert.ok(Math.abs(data.arms[0].position.x+.52)<.01);
});
