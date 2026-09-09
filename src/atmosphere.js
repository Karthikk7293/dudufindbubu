import * as THREE from 'three';

export class ForestAtmosphere {
  constructor(scene,blossomSites=[]) {
    const flakeCanvas=document.createElement('canvas');flakeCanvas.width=32;flakeCanvas.height=32;
    const snowCtx=flakeCanvas.getContext('2d');snowCtx.fillStyle='#fffdf7';snowCtx.beginPath();snowCtx.arc(16,16,10,0,Math.PI*2);snowCtx.fill();
    const positions=new Float32Array(260*3);this.flakes=[];
    for(let i=0;i<260;i++){this.flakes.push({x:Math.random()*44-22,y:Math.random()*17,z:Math.random()*44-22,speed:.35+Math.random()*.5});}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.snow=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xfffdf4,size:2.8,sizeAttenuation:false,map:new THREE.CanvasTexture(flakeCanvas),transparent:true,opacity:.75,depthWrite:false,alphaTest:.1}));
    this.snow.frustumCulled=false;scene.add(this.snow);

    this.birds=[];
    const bodyGeo=new THREE.SphereGeometry(1,8,6),wingGeo=new THREE.BufferGeometry();
    wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.13,.8,.04,-.12,.38,0,-.3],3));wingGeo.computeVertexNormals();
    const birdMaterial=new THREE.MeshStandardMaterial({color:0x6e7a69,roughness:1,side:THREE.DoubleSide});
    for(let i=0;i<9;i++){
      const group=new THREE.Group(),body=new THREE.Mesh(bodyGeo,birdMaterial);body.scale.set(.1,.11,.27);group.add(body);
      const left=new THREE.Mesh(wingGeo,birdMaterial),right=new THREE.Mesh(wingGeo,birdMaterial);right.scale.x=-1;group.add(left,right);
      const head=new THREE.Mesh(bodyGeo,birdMaterial);head.position.set(0,.08,.23);head.scale.set(.095,.1,.12);group.add(head);
      const beak=new THREE.Mesh(new THREE.ConeGeometry(.055,.16,4),new THREE.MeshStandardMaterial({color:0xd4aa68}));beak.rotation.x=Math.PI/2;beak.position.set(0,.06,.37);group.add(beak);
      group.scale.setScalar(.5);scene.add(group);this.birds.push({group,left,right,phase:i*.72,radius:8+i*2.8});
    }
    this.leaves=new THREE.InstancedMesh(new THREE.SphereGeometry(1,5,3),new THREE.MeshStandardMaterial({color:0xc8b676,roughness:1}),32);
    this.leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.leaves.frustumCulled=false;scene.add(this.leaves);this.dummy=new THREE.Object3D();
    this.petals=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),new THREE.MeshStandardMaterial({color:0xf2bdd0,roughness:1,side:THREE.DoubleSide}),60);this.petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.petals.frustumCulled=false;scene.add(this.petals);this.blossomSites=blossomSites;
    this.fireflyData=[];const glowGeometry=new THREE.BufferGeometry(),glowPositions=new Float32Array(140*3);
    const patches=[[-6,32],[-9,8],[-23,-18],[4,-25],[24,17],[28,6],[-22,19]];
    for(let i=0;i<140;i++){const [x,z]=patches[i%patches.length];this.fireflyData.push({x:x+Math.sin(i*3.7)*3.5,z:z+Math.cos(i*2.3)*3.5,phase:i*.93});}
    glowGeometry.setAttribute('position',new THREE.BufferAttribute(glowPositions,3));
    const glowCanvas=document.createElement('canvas');glowCanvas.width=32;glowCanvas.height=32;const glowCtx=glowCanvas.getContext('2d'),gradient=glowCtx.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'#ffffeb');gradient.addColorStop(.2,'#fff8b2dd');gradient.addColorStop(1,'#fff8b200');glowCtx.fillStyle=gradient;glowCtx.fillRect(0,0,32,32);const glowTexture=new THREE.CanvasTexture(glowCanvas);
    this.fireflies=new THREE.Points(glowGeometry,new THREE.PointsMaterial({color:0xffed97,size:7,sizeAttenuation:false,map:glowTexture,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));this.fireflies.frustumCulled=false;scene.add(this.fireflies);

  }
  update(dt,time,position,reducedMotion,nightBlend=0) {
    // Sparse snow follows the camera's part of the forest; sunshine stays warm.
    const t=reducedMotion?0:time;
    const points=this.snow.geometry.attributes.position;
    this.flakes.forEach((flake,i)=>{
      if(!reducedMotion){flake.y-=dt*flake.speed;flake.x+=dt*(.38+Math.sin(time*.4)*.22);if(flake.y<.3)flake.y=17;if(flake.x>22)flake.x=-22;}
      points.setXYZ(i,position.x+flake.x+Math.sin(t*.45+i)*.3,flake.y,position.z+flake.z);
    });points.needsUpdate=true;
    this.birds.forEach(({group,left,right,phase,radius})=>{
      group.visible=nightBlend<.65;
      const a=t*.085+phase;group.position.set(Math.cos(a)*radius,9+Math.sin(t*.4+phase)*.35+phase*.45,Math.sin(a)*radius);
      group.rotation.y=-a;group.rotation.z=Math.sin(t*.4+phase)*.12;
      left.rotation.z=Math.sin(t*7+phase)*.5;right.rotation.z=-left.rotation.z;
    });
    for(let i=0;i<32;i++){
      const x=((i*7.37+t*.7)%72)-36,z=Math.sin(i*3.7)*29;
      this.dummy.position.set(x,.8+(Math.sin(t*.65+i)+1)*1.2,z+Math.sin(t*.4+i));this.dummy.rotation.set(t*.8+i,t*.6,i);this.dummy.scale.set(.12,.018,.065);this.dummy.updateMatrix();this.leaves.setMatrixAt(i,this.dummy.matrix);
    }this.leaves.instanceMatrix.needsUpdate=true;
    this.petals.visible=this.blossomSites.length>0;
    for(let i=0;i<60&&this.blossomSites.length;i++){
      const site=this.blossomSites[i%this.blossomSites.length],fall=(t*.35+i*.67)%4;
      this.dummy.position.set(site.x+Math.sin(i*4.1+t*.35)*1.8,4.2-fall,site.z+Math.cos(i*2.7+t*.2)*1.6);this.dummy.rotation.set(t*.6+i,t*.4,i);this.dummy.scale.set(.085,.012,.055);this.dummy.updateMatrix();this.petals.setMatrixAt(i,this.dummy.matrix);
    }this.petals.instanceMatrix.needsUpdate=true;
    const fireflies=this.fireflies.geometry.attributes.position;
    this.fireflyData.forEach(({x,z,phase},i)=>fireflies.setXYZ(i,x+Math.sin(t*.65+phase)*.8,.7+(Math.sin(t*.8+phase)+1)*.65,z+Math.cos(t*.5+phase)*.7));fireflies.needsUpdate=true;
    this.fireflies.visible=nightBlend>.1;this.fireflies.material.opacity=nightBlend*(reducedMotion?.85:.75+Math.sin(t*1.2)*.15);

  }
}
