import * as THREE from 'three';

// A bounded pool shares one geometry/material, including repeated greetings.
export class ForestReactions {
  constructor(scene,geometry){
    this.particles=[];this.dummy=new THREE.Object3D();
    this.mesh=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:0xf0b2a7,side:THREE.DoubleSide,depthWrite:false}),24);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.count=0;scene.add(this.mesh);
  }
  emit(position,reducedMotion=false){
    const count=reducedMotion?1:7;
    for(let i=0;i<count;i++){
      const angle=i/count*Math.PI*2;
      this.particles.push({x:position.x+Math.sin(angle)*.35,y:(position.y||0)+1.1,z:position.z+Math.cos(angle)*.35,age:0,phase:angle,still:reducedMotion});
    }
    this.particles=this.particles.slice(-24);
  }
  reset(){this.particles=[];this.mesh.count=0;}
  update(dt,camera){
    this.particles.forEach(p=>p.age+=dt);this.particles=this.particles.filter(p=>p.age<1.8);
    this.particles.forEach((p,i)=>{
      const rise=p.still?0:p.age*.7,drift=p.still?0:Math.sin(p.age+p.phase)*.18;
      this.dummy.position.set(p.x+drift,p.y+rise,p.z);this.dummy.quaternion.copy(camera.quaternion);
      this.dummy.scale.setScalar(p.still?.17:.17*Math.min(1,(1.8-p.age)*3));this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);
    });
    this.mesh.count=this.particles.length;if(this.mesh.count)this.mesh.instanceMatrix.needsUpdate=true;
  }
}
