import test from 'node:test';
import assert from 'node:assert/strict';
import { forestScreen,forestQuality } from '../src/screen-support.js';
import { Wildlife } from '../src/wildlife-state.js';
import { isWalkable } from '../src/game-state.js';

test('phones keep a landscape layout and quality budget in either orientation',()=>{
  const phone={width:390,height:844,screenWidth:390,screenHeight:844,coarse:true};
  assert.deepEqual(forestScreen(phone),{phone:true,rotate:true,compact:false});
  assert.deepEqual(forestScreen({...phone,width:844,height:390}),{phone:true,rotate:false,compact:true});
  assert.equal(forestScreen({width:768,height:1024,coarse:true}).rotate,false);
  assert.equal(forestScreen({width:500,height:900}).phone,false);
  assert.equal(forestQuality(true,3).pixelRatio,1.1);
  assert.equal(forestQuality(false,2).pixelRatio,1.5);
});
test('wildlife wanders locally, rests and never crosses blocked ground',()=>{
  const obstacles=[{x:10,z:25,radius:.65}],far={x:-30,z:-30};
  for(const kind of ['rabbit','sheep','fox','deer']){
    const animal=new Wildlife(kind,9,23,4),actions=new Set();let distance=0;
    for(let i=0;i<6000;i++){
      animal.update(1/30,far,(x,z)=>isWalkable(x,z,obstacles));actions.add(animal.mode);
      assert.ok(isWalkable(animal.position.x,animal.position.z,obstacles));
      assert.ok(Math.hypot(animal.position.x-9,animal.position.z-23)<4.21);
      distance=animal.distance;
    }
    assert.ok(actions.has(kind==='rabbit'?'hop':'walk'));
    assert.ok(actions.has(kind==='fox'?'idle':'graze'));
    assert.ok(distance>3);
  }
});
test('nearby bears cause an alert then retreat; night and pause preserve state',()=>{
  const animal=new Wildlife('rabbit',0,20,3),player={x:0,z:21};
  animal.update(.1,player,()=>true);assert.equal(animal.mode,'alert');
  for(let i=0;i<20;i++)animal.update(.1,player,()=>true);
  assert.ok(animal.position.z<20);
  const before=JSON.stringify(animal);animal.update(0,player,()=>true,1);assert.equal(JSON.stringify(animal),before);
  const sleepy=new Wildlife('deer',0,20,2);
  sleepy.update(.1,{x:30,z:30},()=>true,1);assert.equal(sleepy.mode,'sleep');
  const resting={...sleepy.position};sleepy.update(5,{x:30,z:30},()=>true,1);assert.deepEqual(sleepy.position,resting);
  sleepy.update(.1,{x:30,z:30},()=>true,0);assert.equal(sleepy.mode,'idle');
});
test('blocked wildlife stops instead of teleporting through obstacles',()=>{
  const animal=new Wildlife('sheep',2,24,5);animal.timer=0;
  for(let i=0;i<100;i++)animal.update(.1,{x:30,z:30},()=>false);
  assert.deepEqual(animal.position,{x:2,z:24});assert.equal(animal.distance,0);
});
