import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WeatherState, rainPosition } from '../src/weather-state.js';
import { ForestRain } from '../src/rain.js';
import { ForestSurfaces } from '../src/forest-surfaces.js';

test('weather fades independently of frame rate and freezes when paused',()=>{
  const a=new WeatherState(),b=new WeatherState();a.set('rain');b.set('rain');
  for(let i=0;i<60;i++)a.update(1/60);
  for(let i=0;i<30;i++)b.update(1/30);
  assert.ok(a.blend>0&&a.blend<1);assert.ok(Math.abs(a.blend-b.blend)<1e-10);
  const saved={...a};a.update(0);a.update(NaN);assert.deepEqual({...a},saved);
  a.set('clear');a.update(1);assert.ok(a.blend<saved.blend);
  a.set('rain',true);assert.equal(a.blend,1);
  a.set('invalid',true);assert.equal(a.mode,'clear');assert.equal(a.blend,0);
});

test('rain stays bounded through long sessions without sticking to the explorer',()=>{
  const drop={phase:1.3,speed:12,x:3,z:6},out={};
  for(const time of [0,1,3600,86400]){
    rainPosition(drop,time,{x:20,z:-8},out);
    assert.ok(out.x>=3&&out.x<37);assert.ok(out.z>=-25&&out.z<9);assert.ok(out.y>.25&&out.y<=18.25);
  }
  const first={...rainPosition(drop,20,{x:0,z:0},out)};
  rainPosition(drop,20,{x:4,z:-3},out);assert.equal(out.x,first.x);assert.equal(out.z,first.z);
});

test('reduced motion retains wet ground without falling rain or moving ripples',()=>{
  const rain=new ForestRain(new THREE.Scene(),true),weather=new WeatherState();weather.set('rain',true);weather.update(.1);
  rain.update(weather,{x:0,z:0},0,false);
  assert.equal(rain.streaks.visible,true);assert.ok(rain.drops.length<=400);
  assert.ok(rain.puddles.count>20);assert.ok(rain.ripples.count>rain.puddles.count);
  assert.ok([...rain.streaks.geometry.attributes.position.array].every(Number.isFinite));
  const saved=rain.ripples.instanceMatrix.array.slice();
  rain.update(weather,{x:0,z:0},0,false);assert.deepEqual(rain.ripples.instanceMatrix.array,saved);
  rain.update(weather,{x:0,z:0},1,true);
  assert.equal(rain.streaks.visible,false);assert.equal(rain.ripples.visible,false);assert.equal(rain.puddles.visible,true);
  weather.set('clear',true);rain.update(weather,{x:0,z:0},1,false);assert.equal(rain.puddles.visible,false);
});

test('ground texture scale uses world dimensions and wetness restores dry materials',()=>{
  const surfaces=new ForestSurfaces(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshStandardMaterial({color:0xa7bf94}));
  mesh.rotation.x=-Math.PI/2;mesh.scale.set(3,2,1);mesh.position.set(4,0,2);surfaces.apply(mesh);
  const uv=mesh.geometry.attributes.uv;
  assert.ok(Math.abs(uv.getX(1)-uv.getX(0)-2)<1e-6);
  const dry=mesh.material.color.clone();surfaces.update(1);assert.ok(mesh.material.color.r<dry.r);assert.ok(mesh.material.roughness<.8);
  surfaces.update(0);assert.ok(mesh.material.color.equals(dry));
});
