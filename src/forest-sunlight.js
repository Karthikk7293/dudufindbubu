import * as THREE from 'three';

// A few soft shafts in the clearings; no fullscreen blur or extra render pass.
export class ForestSunlight {
  constructor(scene) {
    this.material=new THREE.MeshBasicMaterial({color:0xffe5a4,transparent:true,opacity:.065,depthWrite:false,side:THREE.DoubleSide});
    this.material.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec2 beamUv;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbeamUv=uv;');
      shader.fragmentShader='varying vec2 beamUv;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`diffuseColor.a*=pow(sin(beamUv.x*3.141593),2.0)*sin(beamUv.y*3.141593);\n#include <alphatest_fragment>`);
    };
    this.material.customProgramCacheKey=()=> 'soft-forest-sunbeams-v1';
    this.group=new THREE.Group();scene.add(this.group);
    const sites=[[-10,22,8],[7,15,10],[-19,10,9],[17,-12,10],[-18,-18,11],[4,-23,9]];
    for(const [x,z,height] of sites)for(let side=0;side<2;side++){
      const width=1.1,dx=side===0?width:0,dz=side===1?width:0,geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute([
        -dx,0,-dz,dx,0,dz,-height*.66-dx*.2,height,height*.48-dz*.2,-height*.66+dx*.2,height,height*.48+dz*.2
      ],3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));geometry.setIndex([0,1,2,1,3,2]);
      const mesh=new THREE.Mesh(geometry,this.material);mesh.position.set(x,.24,z);this.group.add(mesh);
    }
  }
  update(time,night,rain,reducedMotion) {
    this.material.opacity=(reducedMotion?.065:.065+Math.sin(time*.23)*.006)*(1-night)*(1-rain);
    this.group.visible=this.material.opacity>.002;
  }
}
