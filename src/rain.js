import * as THREE from 'three';
import { TRAILS, PONDS, DUDU_NEST, BUBU_NEST, MOON_NEST } from './game-state.js';
import { rainPosition, wrap } from './weather-state.js';

export class ForestRain {
  constructor(scene,phone=false) {
    let seed=916;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    this.drops=Array.from({length:phone?380:760},()=>({x:random()*34,z:random()*34,phase:random()*18,speed:10+random()*4,length:.45+random()*.35}));
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.drops.length*6),3).setUsage(THREE.DynamicDrawUsage));
    this.streaks=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xdcebf4,transparent:true,opacity:0,depthWrite:false}));
    this.streaks.frustumCulled=false;scene.add(this.streaks);

    this.sites=[];
    for(const trail of TRAILS){
      const curve=new THREE.CatmullRomCurve3(trail.points.map(([x,z])=>new THREE.Vector3(x,0,z)));
      for(let i=0;i<4;i++){
        const p=curve.getPoint((i+.35+random()*.3)/4);
        if(PONDS.some(pond=>((p.x-pond.x)/6.3)**2+((p.z-pond.z)/5)**2<1))continue;
        if([DUDU_NEST,BUBU_NEST,MOON_NEST.entry].some(home=>Math.hypot(p.x-home.x,p.z-home.z)<3.4))continue;
        this.sites.push({x:p.x+(random()-.5)*.2,y:.224,z:p.z,rx:Math.min(trail.width*.35,.58+random()*.3),rz:.35+random()*.32,angle:random()*Math.PI});
      }
    }
    const puddleGeometry=new THREE.CircleGeometry(1,28),vertices=puddleGeometry.attributes.position;
    for(let i=1;i<vertices.count;i++){const a=Math.atan2(vertices.getY(i),vertices.getX(i)),r=1+Math.sin(a*3+.4)*.09+Math.cos(a*5)*.035;vertices.setXY(i,Math.cos(a)*r,Math.sin(a)*r);}
    puddleGeometry.computeVertexNormals();
    this.puddles=new THREE.InstancedMesh(puddleGeometry,new THREE.MeshStandardMaterial({color:0x9bb5c2,roughness:.23,metalness:.12,transparent:true,opacity:0,depthWrite:false}),this.sites.length);
    this.puddles.receiveShadow=true;this.puddles.frustumCulled=false;scene.add(this.puddles);
    this.dummy=new THREE.Object3D();this.point={x:0,y:0,z:0};
    this.sites.forEach((site,i)=>{this.dummy.position.set(site.x,site.y,site.z);this.dummy.rotation.set(-Math.PI/2,0,site.angle);this.dummy.scale.set(site.rx,site.rz,1);this.dummy.updateMatrix();this.puddles.setMatrixAt(i,this.dummy.matrix);});
    this.puddles.instanceMatrix.needsUpdate=true;
    this.rippleSites=this.sites.map(site=>({...site,phase:random(),radius:Math.min(site.rx,site.rz)*.85}));
    for(const pond of PONDS)for(let i=0;i<(phone?8:16);i++){
      const a=random()*Math.PI*2,x=Math.cos(a)*(1+random()*2.8),z=Math.sin(a)*(1+random()*1.6);
      if(Math.abs(z)<1.1)continue;
      this.rippleSites.push({x:pond.x+x,y:.265,z:pond.z+z,phase:random(),radius:.25+random()*.22});
    }
    const ring=new THREE.RingGeometry(.88,1,20);ring.rotateX(-Math.PI/2);
    ring.setAttribute('rippleAlpha',new THREE.InstancedBufferAttribute(new Float32Array(this.rippleSites.length),1).setUsage(THREE.DynamicDrawUsage));
    const rippleMaterial=new THREE.MeshBasicMaterial({color:0xe0ebeb,transparent:true,opacity:0,depthWrite:false});
    rippleMaterial.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float rippleAlpha; varying float vRippleAlpha;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRippleAlpha=rippleAlpha;');
      shader.fragmentShader='varying float vRippleAlpha;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vRippleAlpha;');
    };
    rippleMaterial.customProgramCacheKey=()=> 'forest-ripple-fade';
    this.ripples=new THREE.InstancedMesh(ring,rippleMaterial,this.rippleSites.length);
    this.ripples.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.ripples.frustumCulled=false;scene.add(this.ripples);
  }
  update(weather,focus,night,reducedMotion) {
    const {blend,time}=weather,animated=blend>.01&&!reducedMotion;
    this.streaks.visible=this.ripples.visible=animated;this.puddles.visible=blend>.01;
    this.streaks.material.opacity=blend*(.58-night*.18);
    this.puddles.material.opacity=blend*.52;
    this.ripples.material.opacity=blend*(.62-night*.18);
    if(!animated)return;
    const positions=this.streaks.geometry.attributes.position;
    this.drops.forEach((drop,i)=>{
      const p=rainPosition(drop,time,focus,this.point);
      positions.setXYZ(i*2,p.x,p.y,p.z);
      positions.setXYZ(i*2+1,p.x-.09,p.y+drop.length,p.z-.025);
    });positions.needsUpdate=true;
    const alpha=this.ripples.geometry.attributes.rippleAlpha;
    this.rippleSites.forEach((site,i)=>{
      const age=wrap(time*.85+site.phase,1),radius=site.radius*(.15+age*.85);
      this.dummy.position.set(site.x,site.y+.002,site.z);this.dummy.rotation.set(0,0,0);
      alpha.setX(i,Math.sin(age*Math.PI)*(1-age));
      this.dummy.scale.setScalar(radius);this.dummy.updateMatrix();this.ripples.setMatrixAt(i,this.dummy.matrix);
    });this.ripples.instanceMatrix.needsUpdate=true;alpha.needsUpdate=true;
  }
}
