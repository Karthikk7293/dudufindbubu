import test from 'node:test';
import assert from 'node:assert/strict';
import { FollowCamera, clearCameraDistance, clampDistance, clampPitch, FOLLOW_MIN, FOLLOW_MAX } from '../src/follow-camera.js';

test('camera stops before a cottage and ignores trees behind the player',()=>{
  const origin={x:0,y:1.5,z:0},direction={x:0,y:0,z:1};
  const clear=clearCameraDistance(origin,direction,10,[{x:0,y:1.5,z:6,radius:2},{x:0,y:1.5,z:-3,radius:1}]);
  assert.ok(clear>3&&clear<4);
  assert.equal(clearCameraDistance(origin,direction,10,[{x:6,y:1.5,z:4,radius:1}]),10);
});
test('orbit cannot go underground or overhead and zoom has useful limits',()=>{
  assert.equal(clampDistance(0),FOLLOW_MIN);assert.equal(clampDistance(90),FOLLOW_MAX);
  assert.ok(clampPitch(-10)>0);assert.ok(clampPitch(10)<Math.PI/4);
  const rig=new FollowCamera();rig.orbit(100000,-100000);rig.zoom(.001);
  rig.update({x:0,z:0},[],1/60,true);
  assert.equal(rig.camera.isPerspectiveCamera,true);assert.ok(rig.camera.position.y>rig.target.y);
  assert.ok(Number.isFinite(rig.camera.position.x));
});
test('following eases toward Dudu, contracts immediately and extends gently',()=>{
  const rig=new FollowCamera();rig.yaw=0;rig.pitch=.22;rig.update({x:0,z:0},[],0,true);
  rig.update({x:2,z:0},[],.016);
  assert.ok(rig.target.x>0&&rig.target.x<2);
  rig.update({x:2,z:0},[{x:rig.target.x,y:2.4,z:6,radius:2}],.016);
  const shortened=rig.arm;assert.ok(shortened<6);
  assert.ok(rig.camera.fov>56&&rig.camera.fov<=102,'The lens compensates for a close obstruction');
  rig.update({x:2,z:0},[],.016);
  assert.ok(rig.arm>shortened&&rig.arm<rig.distance);
});
test('a blocking tree moves the view to a clear side without changing the chosen heading',()=>{
  const rig=new FollowCamera();rig.yaw=0;rig.update({x:0,z:0},[],0,true);
  const trees=[{x:0,z:4,minY:.2,maxY:8,radius:.75}];
  for(let i=0;i<180;i++)rig.update({x:0,z:0},trees,1/60);
  assert.equal(rig.yaw,0);assert.ok(Math.abs(rig.avoidYaw)>.2);assert.ok(rig.arm>8,'The view stays wide enough to see around the tree');
  const side=Math.sign(rig.avoidYaw);
  for(let i=0;i<60;i++){rig.update({x:.05*Math.sin(i),z:0},trees,1/60);assert.equal(Math.sign(rig.avoidYaw),side,'Avoidance does not flicker from side to side');}
  for(let i=0;i<360;i++)rig.update({x:0,z:0},[],1/60);
  assert.ok(Math.abs(rig.avoidYaw)<.01,'The chosen view returns after leaving the tree');
});
test('tall trunks block the camera between their endpoints',()=>{
  const hit=clearCameraDistance({x:0,y:5,z:0},{x:0,y:0,z:1},10,[{x:0,z:4,minY:.2,maxY:12,radius:.5}]);
  assert.ok(hit>2&&hit<4);
});
