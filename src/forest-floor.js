import * as THREE from 'three';
import { TRAILS, PONDS, GIFTS, DUDU_NEST, BUBU_NEST, BUBU, MOON_NEST } from './game-state.js';

function random(seed) { return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296; }; }

// Sample the same curved paths used by the renderer, including their bends.
const paths=TRAILS.map(trail=>({width:trail.width,points:new THREE.CatmullRomCurve3(trail.points.map(([x,z])=>new THREE.Vector3(x,0,z))).getPoints(160)}));
export function meadowSpace(x,z,margin=.25) {
  if(Math.hypot(x,z)>39.5-margin)return false;
  if(PONDS.some(p=>((x-p.x)/(5.5+margin))**2+((z-p.z)/(4.15+margin))**2<1))return false;
  if([DUDU_NEST,BUBU_NEST].some(p=>Math.hypot(x-p.x,z-p.z)<3.25+margin))return false;
  if(Math.hypot(x-BUBU.x,z-BUBU.z)<3.5+margin||Math.hypot(x+16,z+5)<2.25+margin)return false;
  if(Math.hypot(x-MOON_NEST.entry.x,z-MOON_NEST.entry.z)<1.1+margin)return false;
  if(GIFTS.some(p=>Math.hypot(x-p.x,z-p.z)<1.1+margin))return false;
  for(const {width,points} of paths)for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
    const t=length?THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/length,0,1):0;
    if((x-a.x-dx*t)**2+(z-a.z-dz*t)**2<(width*.5+margin)**2)return false;
  }
  return true;
}

// Broad, continuous colour changes replace the separate oval ground patches.
export function meadowTone(x,z) {
  return THREE.MathUtils.clamp(.5+Math.sin(x*.23+Math.sin(z*.16))*.23+Math.cos(z*.31-x*.09)*.19,0,1);
}
export function meadowGround() {
  const rings=64,segments=128,positions=[0,0,0],colors=[],indices=[];
  const shade=new THREE.Color(0x698145),sun=new THREE.Color(0x98aa57),color=new THREE.Color();
  const tint=(x,z)=>{color.copy(shade).lerp(sun,meadowTone(x,z));colors.push(color.r,color.g,color.b);};tint(0,0);
  for(let r=1;r<=rings;r++)for(let a=0;a<segments;a++){
    const angle=a/segments*Math.PI*2,x=Math.cos(angle)*r/rings*40.2,z=Math.sin(angle)*r/rings*40.2;
    positions.push(x,0,z);tint(x,z);
    const current=1+(r-1)*segments+a,next=1+(r-1)*segments+(a+1)%segments;
    if(r===1)indices.push(0,next,current);
    else {const previous=current-segments,previousNext=next-segments;indices.push(previous,next,current,previous,previousNext,next);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

function tuftGeometry() {
  const rng=random(771),positions=[],colors=[],indices=[];
  const root=new THREE.Color(0x536b35),tip=new THREE.Color(0xc5c97f),tint=new THREE.Color();
  for(let i=0;i<18;i++){
    const angle=rng()*Math.PI*2,x=(rng()-.5)*.75,z=(rng()-.5)*.75,h=.10+rng()*.14,w=.005+rng()*.006,bend=.035+rng()*.065;
    const dx=Math.cos(angle),dz=Math.sin(angle),k=positions.length/3;
    positions.push(x-dx*w,0,z-dz*w,x+dx*w,0,z+dz*w,
      x-dx*w*.55+dz*bend*.35,h*.58,z-dz*w*.55+dx*bend*.35,
      x+dx*w*.55+dz*bend*.35,h*.58,z+dz*w*.55+dx*bend*.35,
      x+dz*bend,h,z+dx*bend);
    for(const weight of [0,0,.58,.58,1]){tint.copy(root).lerp(tip,weight);colors.push(tint.r,tint.g,tint.b);}
    indices.push(k,k+1,k+2,k+1,k+3,k+2,k+2,k+3,k+4);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  // Bias blade normals upward to approximate light passing through thin grass.
  const normals=geo.attributes.normal,normal=new THREE.Vector3();
  for(let i=0;i<normals.count;i++){normal.fromBufferAttribute(normals,i).multiplyScalar(.3);normal.y=.9;normal.normalize();normals.setXYZ(i,normal.x,normal.y,normal.z);}
  return geo;
}

export class ForestMeadow {
  constructor(scene,phone=false) {
    this.uniforms={time:{value:0},breeze:{value:1},explorer:{value:new THREE.Vector2(100,100)}};
    this.material=new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide});
    this.material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{meadowTime:this.uniforms.time,meadowBreeze:this.uniforms.breeze,explorer:this.uniforms.explorer});
      shader.vertexShader='uniform float meadowTime; uniform float meadowBreeze; uniform vec2 explorer;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 meadowWorld=(modelMatrix*instanceMatrix*vec4(position,1.0)).xyz;
        float bladeHeight=clamp(position.y/.24,0.0,1.0);
        float gust=sin(meadowTime*1.3+meadowWorld.x*.65+meadowWorld.z*.42);
        transformed.x+=gust*.065*bladeHeight*bladeHeight*meadowBreeze;
        transformed.z+=sin(meadowTime*.85+meadowWorld.x*.35)*.025*bladeHeight*meadowBreeze;
        float footfall=1.0-smoothstep(.12,.7,distance(meadowWorld.xz,explorer));
        transformed.y*=1.0-footfall*.55;
      `);
      // Both sides transmit daylight; flipping the biased normal on the back
      // would otherwise make half the fine blades look black.
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal *= gl_FrontFacing ? 1.0 : -1.0;');
    };
    this.material.customProgramCacheKey=()=> 'meadow-bent-blades-v1';
    const rng=random(8271),cells=new Map(),target=phone?7800:14500;
    for(let i=0;i<target;i++){
      const angle=rng()*Math.PI*2,r=Math.sqrt(rng())*39.3,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      if(!meadowSpace(x,z,.4))continue;
      const key=`${Math.floor(x/12)},${Math.floor(z/12)}`;
      if(!cells.has(key))cells.set(key,[]);
      cells.get(key).push({x,z,rotation:rng()*Math.PI*2,scale:.7+rng()*.65});
    }
    const geo=tuftGeometry(),dummy=new THREE.Object3D(),color=new THREE.Color();this.tufts=0;this.cells=[];
    for(const sites of cells.values()){
      const mesh=new THREE.InstancedMesh(geo,this.material,sites.length);
      sites.forEach((site,i)=>{
        dummy.position.set(site.x,.185,site.z);dummy.rotation.y=site.rotation;dummy.scale.setScalar(site.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        color.setHSL(.22+Math.sin(site.x*.23)*.018,.12,.75+meadowTone(site.x,site.z)*.2);mesh.setColorAt(i,color);
      });
      mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.15;scene.add(mesh);this.cells.push(mesh);this.tufts+=sites.length;
    }
  }
  update(time,reducedMotion,rain,position,detail=true) {
    this.uniforms.time.value=reducedMotion?0:time;this.uniforms.breeze.value=reducedMotion?0:1+rain*.5;
    this.uniforms.explorer.value.set(position.x,position.z);
    this.material.color.setScalar(1-rain*.13);
    for(const cell of this.cells){
      const bounds=cell.boundingSphere;
      cell.visible=detail&&Math.hypot(bounds.center.x-position.x,bounds.center.z-position.z)<28+bounds.radius;
    }
  }
}
