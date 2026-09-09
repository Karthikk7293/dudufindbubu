import * as THREE from 'three';
import { TRAILS, GIFTS, DUDU_NEST, BUBU_NEST, MOON_NEST, PONDS, isWalkable } from './game-state.js';

export class RoadLighting {
  constructor(scene,land,obstacles){
    this.sites=[];this.lights=[];
    const metal=new THREE.MeshStandardMaterial({color:0x687267,roughness:.8}),stone=new THREE.MeshStandardMaterial({color:0xbeb99c,roughness:1});
    this.glass=new THREE.MeshStandardMaterial({color:0xf9df9f,emissive:0xffbf64,emissiveIntensity:0,roughness:.5});
    const add=(geo,mat,x,y,z)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;land.add(mesh);return mesh;};
    for(const trail of TRAILS){
      const curve=new THREE.CatmullRomCurve3(trail.points.map(([x,z])=>new THREE.Vector3(x,0,z))),count=Math.floor(curve.getLength()/7);
      for(let i=0;i<=count;i++){
        const t=(i+.25)/(count+1),p=curve.getPointAt(t),tangent=curve.getTangentAt(t),side=i%2?1:-1,offset=(trail.width/2+.72)*side;
        const x=p.x-tangent.z*offset,z=p.z+tangent.x*offset;
        if(Math.hypot(x-MOON_NEST.entry.x,z-MOON_NEST.entry.z)<2.2)continue;
        if(!isWalkable(x,z,obstacles)||this.sites.some(s=>Math.hypot(s.x-x,s.z-z)<5.5)||GIFTS.some(g=>Math.hypot(g.x-x,g.z-z)<1.8)||[DUDU_NEST,BUBU_NEST].some(n=>Math.hypot(n.x-x,n.z-z)<4)||PONDS.some(p=>((x-p.x)/(p.rx+.7))**2+((z-p.z)/(p.rz+.7))**2<1))continue;
        this.sites.push({x,z});obstacles.push({x,z,radius:.11});
        add(new THREE.CylinderGeometry(.17,.22,.15,10),stone,x,.26,z);
        add(new THREE.CylinderGeometry(.048,.075,2.9,8),metal,x,1.72,z);
        add(new THREE.ConeGeometry(.29,.20,6),metal,x,3.23,z);
        add(new THREE.BoxGeometry(.34,.42,.34),this.glass,x,2.93,z).castShadow=false;
        add(new THREE.CylinderGeometry(.23,.20,.08,6),metal,x,2.69,z);
        for(const sx of [-1,1])for(const sz of [-1,1])add(new THREE.CylinderGeometry(.018,.018,.45,5),metal,x+sx*.18,2.93,z+sz*.18);
        add(new THREE.SphereGeometry(.055,8,6),metal,x,3.38,z);
      }
    }
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#fff0c9dd');gradient.addColorStop(.35,'#ffda9670');gradient.addColorStop(1,'#ffca7b00');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const texture=new THREE.CanvasTexture(canvas);
    this.pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(5.3,5.3),new THREE.MeshBasicMaterial({color:0xffca82,map:texture,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}),this.sites.length);this.pools.frustumCulled=false;scene.add(this.pools);
    this.halos=new THREE.InstancedMesh(new THREE.SphereGeometry(.4,10,7),new THREE.MeshBasicMaterial({color:0xffd98d,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}),this.sites.length);scene.add(this.halos);
    const dummy=new THREE.Object3D();this.sites.forEach((s,i)=>{dummy.rotation.x=-Math.PI/2;dummy.position.set(s.x,.251,s.z);dummy.updateMatrix();this.pools.setMatrixAt(i,dummy.matrix);dummy.rotation.x=0;dummy.position.y=2.93;dummy.updateMatrix();this.halos.setMatrixAt(i,dummy.matrix);});this.pools.instanceMatrix.needsUpdate=this.halos.instanceMatrix.needsUpdate=true;
    // A fixed small light pool illuminates nearby bears and trees. Every roadside
    // lamp still has its own luminous glass and soft pool, even in overview.
    for(let i=0;i<6;i++){const light=new THREE.PointLight(0xffca85,0,8,2);scene.add(light);this.lights.push(light);}
  }
  update(blend,position){
    this.glass.emissiveIntensity=blend*2.4;this.pools.material.opacity=blend*.48;this.halos.material.opacity=blend*.095;
    this.pools.visible=this.halos.visible=blend>.01;
    const nearest=this.sites.slice().sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z));
    this.lights.forEach((light,i)=>{const s=nearest[i];light.intensity=s?blend*16:0;if(s)light.position.set(s.x,2.75,s.z);});
  }
}
