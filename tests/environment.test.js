import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ForestMeadow, meadowGround, meadowSpace } from '../src/forest-floor.js';
import { ForestSunlight } from '../src/forest-sunlight.js';
import { GIFTS, TRAILS, PONDS, DUDU_NEST, BUBU_NEST, BUBU } from '../src/game-state.js';

test('plant placement leaves curved trails, gifts, water and gathering areas clear',()=>{
  for(const trail of TRAILS){
    const curve=new THREE.CatmullRomCurve3(trail.points.map(([x,z])=>new THREE.Vector3(x,0,z)));
    for(const point of curve.getPoints(200))assert.equal(meadowSpace(point.x,point.z),false);
  }
  for(const site of [...GIFTS,...PONDS,DUDU_NEST,BUBU_NEST,BUBU])assert.equal(meadowSpace(site.x,site.z),false);
  assert.equal(meadowSpace(40,0),false);
});

test('the mobile meadow has bounded geometry, shares resources and freezes decorative motion',()=>{
  const scene=new THREE.Scene(),meadow=new ForestMeadow(scene,true),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  assert.ok(meadow.tufts>4000&&meadow.tufts<6500);
  assert.ok(meadow.cells.length<60);
  const geometry=meadow.cells[0].geometry;
  assert.ok(geometry.index.count/3*meadow.tufts<350000);
  for(const cell of meadow.cells){
    assert.equal(cell.geometry,geometry);assert.equal(cell.material,meadow.material);assert.equal(cell.castShadow,false);
    for(let i=0;i<cell.count;i++){cell.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert.ok(meadowSpace(point.x,point.z,.39));}
  }
  meadow.update(10,false,0,{x:3,z:7});const time=meadow.uniforms.time.value;
  meadow.update(10,false,0,{x:3,z:7});assert.equal(meadow.uniforms.time.value,time);
  meadow.update(20,true,1,{x:3,z:7});assert.equal(meadow.uniforms.breeze.value,0);assert.equal(meadow.uniforms.time.value,0);
  assert.ok(meadow.material.color.r<1);meadow.update(20,true,0,{x:3,z:7});assert.equal(meadow.material.color.r,1);
  assert.ok(meadow.cells.some(cell=>cell.visible));assert.ok(meadow.cells.some(cell=>!cell.visible));
  meadow.update(20,true,0,{x:3,z:7},false);assert.ok(meadow.cells.every(cell=>!cell.visible));
  const ground=meadowGround();assert.ok([...ground.attributes.normal.array].every(Number.isFinite));assert.equal(ground.attributes.normal.getY(0),1);
});

test('daylight shafts fade out completely at night and in rain',()=>{
  const light=new ForestSunlight(new THREE.Scene());
  light.update(0,0,0,true);assert.ok(light.group.visible);const opacity=light.material.opacity;
  light.update(20,0,0,true);assert.equal(light.material.opacity,opacity);
  light.update(20,1,0,false);assert.equal(light.group.visible,false);
  light.update(20,0,1,false);assert.equal(light.group.visible,false);
  light.update(20,0,0,false);assert.equal(light.group.visible,true);
});
