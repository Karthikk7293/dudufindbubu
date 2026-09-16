import * as THREE from 'three';

// Small, seamless procedural textures: no downloads and no extra geometry.
function grainTexture(kind) {
  const size=128,data=new Uint8Array(size*size*4);
  let seed=kind==='grass'?271:419;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const broad=Math.sin(x/size*Math.PI*4+Math.sin(y/size*Math.PI*2))*Math.cos(y/size*Math.PI*6);
    const noise=random(),fleck=kind==='grass'?(noise>.91?-24:0):(noise>.985?-46:0);
    const value=Math.round(222+broad*9+(noise-.5)*25+fleck),i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=2;texture.needsUpdate=true;
  return texture;
}

export class ForestSurfaces {
  constructor(){this.textures={grass:grainTexture('grass'),path:grainTexture('path')};this.materials=new Map();}
  apply(mesh,kind='grass') {
    const original=mesh.material,key=`${kind}-${original.color.getHex()}`;
    if(!this.materials.has(key)){
      const material=new THREE.MeshStandardMaterial({color:original.color,map:this.textures[kind],bumpMap:this.textures[kind],bumpScale:kind==='grass'?.055:.028,roughness:.96,side:original.side});
      this.materials.set(key,{material,dry:original.color.clone()});
    }
    mesh.material=this.materials.get(key).material;
    // World-space UVs keep grains the same size on wide clearings and thin paths.
    mesh.updateWorldMatrix(true,false);
    const positions=mesh.geometry.attributes.position,uv=new Float32Array(positions.count*2),point=new THREE.Vector3();
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
      uv[i*2]=point.x/3;uv[i*2+1]=point.z/3;
    }
    mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  }
  update(wetness) {
    for(const {material,dry} of this.materials.values()){
      material.color.copy(dry).multiplyScalar(1-wetness*.16);
      material.roughness=.96-wetness*.3;
    }
  }
}
