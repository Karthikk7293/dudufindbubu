import * as THREE from 'three';
import { MOON_NEST } from './game-state.js';

export function buildMoonNest(land,obstacles,cameraObstacles){
  const root=new THREE.Group();root.name='Moonwatch tree';root.position.set(MOON_NEST.x,0,MOON_NEST.z);land.add(root);
  const materials=new Map();
  const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:1}));return materials.get(color);};
  const part=(geometry,color,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
  const bar=(a,b,radius,color)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const mesh=part(new THREE.CylinderGeometry(radius*.8,radius,delta.length(),8),color,...start.add(end).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;};
  const ellipsoid=(x,y,z,sx,sy,sz,color)=>{const mesh=part(new THREE.IcosahedronGeometry(1,2),color,x,y,z);mesh.scale.set(sx,sy,sz);return mesh;};
  part(new THREE.CylinderGeometry(.48,.92,11.7,12),0x826141,0,5.95,0);
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;bar([0,1,0],[Math.cos(a)*1.65,.21,Math.sin(a)*1.65],.2,0x826141);}
  // An open, high fork supports the nest; its crowns grow behind the lookout.
  [[-3.1,11.3,-1.5,2.35,1.8,2],[2.8,12.4,-2,2.2,2,2],[-.5,13.4,-3,2.4,1.75,1.9]].forEach(([x,y,z,sx,sy,sz],i)=>{
    bar([0,6.5,0],[x*.75,y-.4,z],.28,0x8b6944);
    ellipsoid(x,y,z,sx,sy,sz,[0x6c8954,0x829c5f,0x90a669][i]);
    for(let j=0;j<4;j++){const a=j*Math.PI/2;ellipsoid(x+Math.cos(a)*1.1,y+.6,z+Math.sin(a)*1,1.2,.85,1.1,[0x78985c,0x9ab474,0x87a564][j%3]);}
    cameraObstacles.push({x:MOON_NEST.x+x,y,z:MOON_NEST.z+z,radius:Math.max(sx,sy,sz)});
  });
  obstacles.push({x:MOON_NEST.x,z:MOON_NEST.z,radius:.96});
  cameraObstacles.push({x:MOON_NEST.x,z:MOON_NEST.z,minY:.2,maxY:11.5,radius:.9});
  const h=MOON_NEST.height;
  // The open bowl is woven around a wooden deck, with a front ladder opening.
  part(new THREE.CylinderGeometry(2.55,2.2,.25,48),0xa78353,0,h-.13,2.3);
  for(let i=-4;i<=4;i++){const z=2.3+i*.5,width=2*Math.sqrt(Math.max(0,2.48**2-(i*.5)**2));const plank=part(new THREE.BoxGeometry(width,.035,.45),i%2?0xbe9e6d:0xb39461,0,h+.015,z);plank.castShadow=false;}
  for(const side of [-1,1])bar([side*.4,6.8,0],[side*1.5,h-.3,3.5],.14,0x8c6947);
  for(let layer=0;layer<4;layer++)for(let i=0;i<36;i++){
    const a=i/36*Math.PI*2,b=(i+1.3)/36*Math.PI*2;
    if(Math.sin(a)>.85)continue;
    const r=2.35+layer*.06,y=h+.16+layer*.13;
    bar([Math.cos(a)*r,y,2.3+Math.sin(a)*r],[Math.cos(b)*r,y+.08,2.3+Math.sin(b)*r],.065,[0x92704c,0xb09062,0xc3a171][(layer+i)%3]);
  }
  for(const x of [-.78,.78])ellipsoid(x,h+.055,2.8,.59,.08,.6,x<0?0xb08c85:0x93a0ad);
  for(const x of [-1.15,0,1.15])bar([x,.22,6.48],[x,h+.5,5.13],.062,0xbfa073);
  for(let i=0;i<28;i++){const t=i/27;bar([-1.15,.35+t*(h-.15),6.45-t*1.25],[1.15,.35+t*(h-.15),6.45-t*1.25],.052,0xd2b685);}
  // Two little lanterns and bunting make the destination visible from the path.
  for(const x of [-2.1,2.1]){
    bar([x,h,3.1],[x,h+1.25,3.1],.055,0x83674b);
    const glass=part(new THREE.CylinderGeometry(.13,.16,.3,8),0xffd394,x,h+1.2,3.1);glass.material.emissive.setHex(0xffb85b);glass.material.emissiveIntensity=.7;
    part(new THREE.ConeGeometry(.22,.18,8),0x846347,x,h+1.45,3.1);
  }
  bar([-2.2,.2,7],[-2.2,1.5,7],.075,0x927451);
  const sign=part(new THREE.BoxGeometry(2.1,.82,.14),0xdbbd86,-2.2,1.6,7);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#e8d6aa';ctx.fillRect(0,0,512,192);ctx.fillStyle='#564c37';ctx.textAlign='center';ctx.font='bold 33px Georgia';ctx.fillText('☾  MOONWATCH NEST',256,69);ctx.font='24px sans-serif';ctx.fillText('After the birthday · Climb together',256,119);ctx.font='21px sans-serif';ctx.fillText('A little closer to the stars',256,158);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Mesh(new THREE.PlaneGeometry(2.02,.76),new THREE.MeshBasicMaterial({map:texture}));label.position.z=.076;sign.add(label);
  // A small light reaches the bears while the rest of the forest turns blue.
  const light=new THREE.PointLight(0xffd49a,3,9,2);light.position.set(MOON_NEST.x,h+3,MOON_NEST.z+4);land.parent.add(light);
  return {group:root,light};
}
