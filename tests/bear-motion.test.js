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
// The fuller cast also carries ankles, elbows, ears and a chosen waving paw.
function fullBear(){
  const group=bear(),data=group.userData;
  data.feet=[new THREE.Group(),new THREE.Group()];
  data.forearms=[new THREE.Group(),new THREE.Group()];
  data.ears=[-1,1].map(side=>{const ear=new THREE.Group();ear.position.set(side*.68,.61,-.06);return ear;});
  data.expression=new BearExpression();data.waveHand=1;
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
test('soles stay level under the bear, push off the toes, then settle flat',()=>{
  const model=fullBear(),{legs,feet}=model.userData;
  let hip=0,ankle=0,together=0;
  for(let i=0;i<240;i++){
    model.position.z+=4.6/60;animateBearPose(model,1/60,i/60,true);
    if(i<60)continue;
    hip=Math.max(hip,Math.abs(legs[0].rotation.x));
    ankle=Math.max(ankle,Math.abs(feet[0].rotation.x));
    // A sole that keeps itself level turns against the leg it hangs from.
    together+=legs[0].rotation.x*feet[0].rotation.x;
  }
  assert.ok(hip>.15,'the hip swings through a full stride');
  assert.ok(ankle>.05,'the ankle works through the step');
  assert.ok(together<0,'the ankle turns against the hip instead of following it');
  for(let i=0;i<180;i++)animateBearPose(model,1/60,5+i/60,false);
  assert.ok(Math.abs(feet[0].rotation.x)<.001,'stopping settles the ankles');
});
test('a greeting waves with the chosen paw and releases when walking resumes',()=>{
  const model=fullBear(),{arms,expression}=model.userData;
  expression.react('greet',4);expression.update(.4,{},true);
  for(let i=0;i<60;i++)animateBearPose(model,1/60,i/60,false);
  assert.ok(arms[1].rotation.z>.6,'the free paw lifts out to wave');
  assert.ok(Math.abs(arms[0].rotation.z)<.25,'the other paw stays down');
  for(let i=0;i<120;i++){model.position.z+=4.6/60;animateBearPose(model,1/60,1+i/60,true);}
  assert.ok(Math.abs(arms[1].rotation.z)<.15,'walking puts the paw away');
});
test('ears lift when something is interesting and fold when the bear is sleepy',()=>{
  const model=fullBear(),{ears,expression}=model.userData;
  expression.react('curious',4);expression.update(.4,{},true);
  for(let i=0;i<60;i++)animateBearPose(model,1/60,3.5,false);
  const lifted=ears[0].position.y;
  assert.ok(lifted>.62,'curious ears lift off the head');
  expression.react('sleepy',4);expression.update(.4,{},true);
  for(let i=0;i<60;i++)animateBearPose(model,1/60,3.5,false);
  assert.ok(ears[0].position.y<.6,'sleepy ears fold back down');
  for(let i=0;i<60;i++)animateBearPose(model,1/60,3.5,false,true);
  assert.ok(Math.abs(ears[0].rotation.z)>0,'reduced motion keeps the mood, not the twitch');
});
test('starting tips the weight forward and turning on the spot lets the torso trail',()=>{
  const model=fullBear();
  animateBearPose(model,1/60,0,false);
  model.position.z+=4.6/60;animateBearPose(model,1/60,1/60,true);
  assert.ok(model.userData.body.rotation.x>0,'a start leans into the walk');
  const turning=fullBear();
  for(let i=0;i<30;i++){turning.rotation.y+=.05;animateBearPose(turning,1/60,i/60,false);}
  assert.ok(turning.userData.body.rotation.y<-.01,'the shoulders trail a standing turn');
  assert.ok(turning.userData.head.rotation.y>.005,'and the head leads it');
  const still=fullBear();
  for(let i=0;i<30;i++){still.rotation.y+=.05;animateBearPose(still,1/60,i/60,false,true);}
  assert.equal(still.userData.body.rotation.y,0,'reduced motion turns without the flourish');
});
