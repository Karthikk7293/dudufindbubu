import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GIFTS, PONDS, DUDU_NEST, BUBU_NEST, TRAILS, isWalkable } from './game-state.js';
import { meadowSpace } from './forest-floor.js';

const soft=new THREE.SphereGeometry(1,8,6),materials=new Map();
function canopyGeometry(segments,rings){
  const geo=new THREE.SphereGeometry(1,segments,rings),positions=geo.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),r=1+Math.sin(x*7+y*3)*Math.sin(z*6-y*4)*.075;
    positions.setXYZ(i,x*r,y*r,z*r);
  }
  geo.computeVertexNormals();return geo;
}
const round=canopyGeometry(12,8),phoneCrown=canopyGeometry(9,6);
const canopyPixels=new Uint8Array(128*128*4);canopyPixels.fill(180);
for(let i=3;i<canopyPixels.length;i+=4)canopyPixels[i]=255;
const canopyRandom=random(584);
for(let leaf=0;leaf<75;leaf++){
  const x=canopyRandom()*128,y=canopyRandom()*128,a=canopyRandom()*6.28,w=5+canopyRandom()*4,h=9+canopyRandom()*5,shade=195+canopyRandom()*35;
  for(let dy=-17;dy<=17;dy++)for(let dx=-17;dx<=17;dx++){
    const u=(dx*Math.cos(a)-dy*Math.sin(a))/w,v=(dx*Math.sin(a)+dy*Math.cos(a))/h,r=u*u+v*v;
    if(r>1)continue;
    const index=(((Math.round(y+dy)%128+128)%128)*128+(Math.round(x+dx)%128+128)%128)*4;
    const value=Math.min(255,Math.round(shade+(1-r)*18-u*14+(Math.abs(u)<.07?10:0)));
    canopyPixels[index]=canopyPixels[index+1]=canopyPixels[index+2]=value;
  }
}
const canopyTexture=new THREE.DataTexture(canopyPixels,128,128);canopyTexture.wrapS=canopyTexture.wrapT=THREE.RepeatWrapping;canopyTexture.repeat.set(3,2);canopyTexture.magFilter=THREE.LinearFilter;canopyTexture.minFilter=THREE.LinearMipmapLinearFilter;canopyTexture.generateMipmaps=true;canopyTexture.needsUpdate=true;
const wind={time:{value:0},strength:{value:1}};
function material(color,leaves=false,canopy=false){
  const key=`${color}-${leaves}-${canopy}`;
  if(!materials.has(key)){
    const mat=new THREE.MeshStandardMaterial({color,roughness:leaves?.84:1});
    if(canopy){mat.map=canopyTexture;mat.bumpMap=canopyTexture;mat.bumpScale=.055;}
    if(leaves){mat.onBeforeCompile=shader=>{shader.uniforms.forestTime=wind.time;shader.uniforms.windStrength=wind.strength;shader.vertexShader='uniform float forestTime; uniform float windStrength;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(forestTime * 0.75 + position.x * 0.7 + position.z * 0.4) * 0.045 * windStrength;\ntransformed.z += cos(forestTime * 0.55 + position.z * 0.5) * 0.025 * windStrength;');};mat.customProgramCacheKey=()=> 'forest-leaf-wind';}
    materials.set(key,mat);
    mat.userData.forestLeaf=leaves;
    mat.userData.forestCanopy=canopy;
  }
  return materials.get(key);
}
// Vertex colors allow all canopy tones in one spatial batch.
export function batchFoliageMaterial(canopy=false){const mat=material(0xffffff,true,canopy);mat.vertexColors=true;mat.side=THREE.DoubleSide;return mat;}
function part(parent,geo,color,x,y,z,sx=1,sy=sx,sz=sx,leaves=false){const m=new THREE.Mesh(geo,material(color,leaves,leaves&&(geo===round||geo===phoneCrown)));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const barkPixels=new Uint8Array(64*128*4);
for(let y=0;y<128;y++)for(let x=0;x<64;x++){
  const i=(y*64+x)*4,ridge=Math.sin(x*.8+Math.sin(y*.12)*.7)+Math.sin(x*2.9+y*.028)*.35;
  const value=Math.round(140+ridge*35);barkPixels[i]=barkPixels[i+1]=barkPixels[i+2]=value;barkPixels[i+3]=255;
}
const barkTexture=new THREE.DataTexture(barkPixels,64,128);barkTexture.wrapS=barkTexture.wrapT=THREE.RepeatWrapping;barkTexture.magFilter=THREE.LinearFilter;barkTexture.needsUpdate=true;
function barkMaterial(color){
  const key=`bark-${color}`;
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.97,bumpMap:barkTexture,bumpScale:.065}));
  return materials.get(key);
}
function branch(parent,points,radius,color=0x91704c){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),geometry=new THREE.TubeGeometry(curve,12,radius,6,false),positions=geometry.attributes.position;
  for(let i=0;i<=12;i++){const center=curve.getPointAt(i/12),taper=1-i/12*.72;for(let j=0;j<=6;j++){const k=i*7+j;positions.setXYZ(k,center.x+(positions.getX(k)-center.x)*taper,center.y+(positions.getY(k)-center.y)*taper,center.z+(positions.getZ(k)-center.z)*taper);}}
  geometry.computeVertexNormals();const mesh=part(parent,geometry,color,0,0,0);if(radius>=.04)mesh.material=barkMaterial(color);return mesh;
}
// Rounded leaves with a raised midrib catch the warm canopy light.
const leafShape=new THREE.BufferGeometry();leafShape.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.4,0,.25,-.43,0,.65,0,0,1,.43,0,.65,.4,0,.25,0,.13,.48],3));leafShape.setIndex([0,1,6,1,2,6,2,3,6,3,4,6,4,5,6,5,0,6]);leafShape.computeVertexNormals();
function crownLeaves(parent,rng,color,cx,cy,cz,rx,ry,rz,count){
  const tones=[-.025,.045,.11].map(offset=>new THREE.Color(color).offsetHSL(0,.025,offset).getHex());
  const pieces=[[],[],[]],pose=new THREE.Object3D(),upAxis=new THREE.Vector3(0,1,0),normal=new THREE.Vector3();
  for(let i=0;i<count;i++){
    const azimuth=i*2.39996,up=-.85+rng()*1.8,r=Math.sqrt(1-up*up);
    normal.set(Math.cos(azimuth)*r,up,Math.sin(azimuth)*r);
    pose.position.set(cx+normal.x*rx,cy+normal.y*ry,cz+normal.z*rz);pose.scale.set(.24,.24,.36);
    pose.quaternion.setFromUnitVectors(upAxis,normal);pose.rotateY(rng()*Math.PI*2);pose.updateMatrix();
    pieces[i%3].push(leafShape.clone().applyMatrix4(pose.matrix));
  }
  for(let i=0;i<3;i++){
    if(!pieces[i].length)continue;
    const leaves=part(parent,mergeGeometries(pieces[i]),tones[i],0,0,0,1,1,1,true);leaves.material.side=THREE.DoubleSide;leaves.castShadow=false;leaves.userData.canopyDetail=true;
    pieces[i].forEach(g=>g.dispose());
  }
}

function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const petal=new THREE.SphereGeometry(1,6,4);
function makeBloom(petals=5){
  const pieces=[];
  for(let i=0;i<petals;i++){const a=i/petals*Math.PI*2,g=petal.clone();g.scale(.44,.12,.23);g.rotateY(-a);g.translate(Math.cos(a)*.31,0,Math.sin(a)*.31);pieces.push(g);}
  const geometry=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());return geometry;
}
const blossom=makeBloom(),daisy=makeBloom(8),sunflower=makeBloom(10);
export const TREE_TYPES=['oak','blossom','umbrella','willow','birch','pine'];
export function treeDimensions(type,size,seed){
  const profiles=[[.72,.86],[.86,1.2],[1.08,1.6],[.94,1.95],[1.3,1.45]];
  const [width,height]=profiles[Math.abs(Math.imul(seed,31))%profiles.length];
  return {width:size*width,height:size*height*(type==='birch'?1.16:type==='pine'?1.12:1)};
}

export function createForestTree(type='oak',color=0x82a362,seed=1,detail=1){
  const group=new THREE.Group(),rng=random(seed);group.userData.treeType=type;
  const crown=detail<.75?phoneCrown:round;
  const bark=type==='birch'?0xd9d3bc:type==='umbrella'?0x8c7047:0x735b40;
  const trunk=part(group,new THREE.CylinderGeometry(type==='oak'?.21:.13,.28,2.8,8),bark,0,1.4,0);
  trunk.material=barkMaterial(bark);
  trunk.rotation.z=type==='umbrella'?.08:-.035;
  if(type==='pine'){
    // Uneven radial boughs give each fir a broken, layered edge.
    for(let tier=0;tier<5;tier++){
      const radius=1.04-tier*.19,y=1.24+tier*.51;
      const core=part(group,new THREE.ConeGeometry(radius*.8,1.18,11),tier%2?0x56794b:color,.05*Math.sin(seed+tier),y+.35,0,1,1,1,true);core.userData.cameraCrown=true;
      for(let j=0;j<6;j++){
        const a=j*Math.PI/3+tier*.65,r=radius*(.72+rng()*.2);
        const bough=part(group,new THREE.ConeGeometry(.36,.92,7),tier%2?color:0x658c55,Math.cos(a)*r*.7,y,Math.sin(a)*r*.7,1,.58,1.3,true);
        bough.rotation.set(Math.sin(a)*.25,a,-Math.cos(a)*.25);
        crownLeaves(group,rng,color,Math.cos(a)*r*.7,y+.06,Math.sin(a)*r*.7,.3,.25,.4,Math.ceil(4*detail));
      }
    }
    return group;
  }
  // The spreading roots and curved forks come from the supplied tree drawings.
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2;branch(group,[[0,.5,0],[Math.cos(a)*.27,.17,Math.sin(a)*.27],[Math.cos(a)*.69,.015,Math.sin(a)*.69]],.07,bark);}
  if(type==='birch'){
    for(let i=0;i<7;i++){const stripe=part(group,new THREE.CylinderGeometry(.145+i*.011,.15+i*.011,.055,8,1,true,0,1.2),0x7a7b62,0,2.55-i*.32,0);stripe.rotation.y=i*2.1;}
  }
  const count=type==='umbrella'?9:type==='birch'?5:8;
  const spread=type==='umbrella'?1.38:type==='birch'?.72:1.04;
  const crowns=[];
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2,x=Math.cos(a)*spread,z=Math.sin(a)*spread,y=type==='umbrella'?2.75+rng()*.22:2.75+rng()*.65;
    branch(group,[[0,1.05+rng()*.3,0],[x*.34,2.05,z*.34],[x*.9,y,z*.9]],.075+(i%3)*.017,bark);
    crownLeaves(group,rng,color,x,y,z,type==='birch'?.66:.94,type==='umbrella'?.57:.79,.85,Math.ceil(60*detail));
    const tone=new THREE.Color(color).offsetHSL(0,0,[-.055,0,.055][i%3]);
    part(group,crown,tone.getHex(),x,y,z,type==='birch'?.65:.92,type==='umbrella'?.55:.78,.83,true).userData.cameraCrown=true;crowns.push({x,y,z});
    for(let j=0;j<2;j++){
      const ca=a+j*2.2;
      part(group,crown,tone.clone().offsetHSL(0,0,.035).getHex(),x+Math.cos(ca)*.42,y+.18+rng()*.13,z+Math.sin(ca)*.4,.36,.32,.36,true);
    }
  }
  part(group,crown,color,0,type==='umbrella'?3.1:3.5,0,1.1,type==='umbrella'?.6:.76,1.0,true).userData.cameraCrown=true;
  crownLeaves(group,rng,color,0,type==='umbrella'?3.1:3.5,0,1.12,type==='umbrella'?.62:.78,1.02,Math.ceil(90*detail));
  if(type==='blossom'){
    for(let i=0;i<60;i++){
      const c=crowns[i%crowns.length],a=rng()*Math.PI*2,tilt=rng()*Math.PI*.6;
      const flower=part(group,blossom,[0xe5acc1,0xf8dfe3,0xf5c5d5][i%3],c.x+Math.cos(a)*Math.sin(tilt)*1.03,c.y+Math.cos(tilt)*.96,c.z+Math.sin(a)*Math.sin(tilt)*.99,.26,.26,.26,true);
      flower.rotation.set(Math.sin(a)*tilt,0,-Math.cos(a)*tilt);flower.castShadow=false;
    }
    for(let i=0;i<18;i++){const a=rng()*Math.PI*2,r=rng()*1.65;part(group,blossom,0xedbacb,Math.cos(a)*r,.035,Math.sin(a)*r,.13,.08,.13).castShadow=false;}
  }
  if(type==='willow'||type==='umbrella'){
    const vines=type==='willow'?20:5;
    for(let i=0;i<vines;i++){
      const a=i/vines*Math.PI*2,r=type==='willow'?1.68:1.45,top=2.95,bottom=type==='willow'?1.2+rng()*.45:2;
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      branch(group,[[x*.86,top,z*.86],[x*1.05,(top+bottom)/2,z*1.05],[x,bottom,z]],.014,0x729452);
      for(let j=0;j<(type==='willow'?6:3);j++){const leaf=part(group,soft,color,x+(j%2?-.055:.055),top-(top-bottom)*j/6,z,.08,.17,.035,true);leaf.rotation.z=j%2?.4:-.4;}
    }
  }
  return group;
}

const BED_SITES=[[-3,34,'daisy'],[4,28,'sunflower'],[11,24,'tulip'],[-18,19,'lavender'],[-10,10,'daisy'],[11,12,'sunflower'],[26,8,'tulip'],[-25,-18,'bluebell'],[3,-24,'rose'],[16,-10,'bluebell'],[-3,-10,'lavender'],[25,20,'daisy'],[-22,7,'rose'],[-13,25,'tulip'],[17,-22,'lavender']];
function nearRoad(x,z){return TRAILS.some(trail=>trail.points.slice(1).some(([bx,bz],i)=>{const [ax,az]=trail.points[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-dx*t,z-az-dz*t)<trail.width*.5+.2;}));}
export function buildFlowerBeds(land,obstacles){
  const rng=random(492);let count=0;const beds=[];
  for(const [bx,bz,type] of BED_SITES){
    let planted=0;
    for(let i=0;i<30;i++){
      const a=rng()*Math.PI*2,r=Math.sqrt(rng())*2.2,x=bx+Math.cos(a)*r,z=bz+Math.sin(a)*r;
      if(!isWalkable(x,z,obstacles)||nearRoad(x,z)||GIFTS.some(g=>Math.hypot(g.x-x,g.z-z)<1.35)||[DUDU_NEST,BUBU_NEST].some(n=>Math.hypot(n.x-x,n.z-z)<3.5)||PONDS.some(p=>((x-p.x)/(p.rx+.3))**2+((z-p.z)/(p.rz+.3))**2<1))continue;
      const flower=new THREE.Group();flower.position.set(x,.2,z);flower.rotation.y=rng()*6.28;land.add(flower);
      const h=(type==='sunflower'?.83:.47)+rng()*.22;
      part(flower,new THREE.CylinderGeometry(.012,.02,h,5),0x73914f,0,h/2,0).castShadow=false;
      [-1,1].forEach(side=>{const leaf=part(flower,soft,0x87a65b,side*.07,h*.46,0,.10,.024,.045);leaf.rotation.z=side*.55;leaf.castShadow=false;});
      if(type==='lavender')for(let j=0;j<6;j++)part(flower,soft,j%2?0xb49acb:0x9c87bb,Math.sin(j*2)*.035,h-.14+j*.055,Math.cos(j*2)*.035,.06,.055,.06).castShadow=false;
      else if(type==='tulip'){
        for(let j=0;j<3;j++){const a=j*2.094;part(flower,soft,i%2?0xe2a5b1:0xe5b58b,Math.cos(a)*.06,h,Math.sin(a)*.06,.11,.18,.10).castShadow=false;}
      }else if(type==='bluebell'){
        branch(flower,[[0,h-.18,0],[.05,h+.06,0],[.12,h,0]],.012,0x73914f);
        const bell=part(flower,new THREE.ConeGeometry(.12,.17,7,1,true),0x9eabd5,.12,h-.065,0);bell.rotation.z=Math.PI;bell.castShadow=false;
      }else if(type==='rose'){
        for(let j=0;j<3;j++){const bloom=part(flower,blossom,[0xcf879e,0xe6aabd,0xf5ccd5][j],0,h+j*.035,0,.24-j*.045,.2,.24-j*.045);bloom.rotation.y=j*.6;bloom.castShadow=false;}
      }else{
        part(flower,type==='sunflower'?sunflower:daisy,type==='sunflower'?0xe8c65d:0xfff2d9,0,h,0,type==='sunflower'?.36:.23,.23,type==='sunflower'?.36:.23).castShadow=false;
        part(flower,soft,type==='sunflower'?0x8b633e:0xdbb454,0,h+.035,0,type==='sunflower'?.115:.065,.035,type==='sunflower'?.115:.065).castShadow=false;
      }
      planted++;count++;
    }
    beds.push({x:bx,z:bz,type,count:planted});
  }
  return {beds,count};
}

export function buildUnderstory(land,trees,detail=1){
  const rng=random(981),sites=[];
  // Ferns gather at the roots. Every plant stays
  // below the bears' faces and outside the paths, doorways and gift rings.
  for(const tree of trees)for(let i=0;i<(detail<.75?2:3);i++){
    const angle=rng()*Math.PI*2,r=.7+rng()*1.2,x=tree.x+Math.cos(angle)*r,z=tree.z+Math.sin(angle)*r;
    if(!meadowSpace(x,z,.5))continue;
    const fern=new THREE.Group();fern.position.set(x,.2,z);fern.rotation.y=rng()*6.28;fern.scale.setScalar(.65+rng()*.5);land.add(fern);
    for(let f=0;f<6;f++){
      const a=f*Math.PI/3,length=.4+rng()*.22;
      const frond=new THREE.Group();frond.rotation.y=a;fern.add(frond);
      for(let j=0;j<5;j++)for(const side of [-1,1]){
        const t=(j+1)/6,leaf=part(frond,leafShape,j%2?0x668b43:0x4e733c,side*.035,Math.sin(t*Math.PI*.8)*.26,length*t,.17*(1-t*.55),.15,.2*(1-t*.4),true);
        leaf.rotation.y=side*1.1;leaf.rotation.x=-.35;leaf.castShadow=false;
      }
    }
    sites.push({x,z});
  }
  return {count:sites.length,sites};
}

const wingMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}),wingGeometries=new Map();
function butterflyWing(kind){
  if(wingGeometries.has(kind))return wingGeometries.get(kind);
  const colors={monarch:[0x65503c,0xe6ac63],blue:[0x506e8b,0x99cddd],rose:[0x8d6484,0xe4adcd],lemon:[0xb6ac62,0xf4dfa1]},[edge,fill]=colors[kind],pieces=[];
  const add=(color,x,y,z,sx,sy,sz)=>{const g=soft.clone().toNonIndexed();g.scale(sx,sy,sz);g.translate(x,y,z);const rgb=new THREE.Color(color),arr=new Float32Array(g.attributes.position.count*3);for(let i=0;i<arr.length;i+=3){arr[i]=rgb.r;arr[i+1]=rgb.g;arr[i+2]=rgb.b;}g.setAttribute('color',new THREE.BufferAttribute(arr,3));pieces.push(g);};
  add(edge,.18,0,.10,.20,.018,.24);add(edge,.14,0,-.19,.15,.018,.16);
  add(fill,.17,.014,.10,.167,.012,.20);add(fill,.13,.014,-.19,.12,.012,.13);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2;add(0xfff3d8,.18+Math.cos(a)*.13,.029,.10+Math.sin(a)*.16,.017,.007,.022);}
  if(kind==='rose')add(edge,.14,0,-.36,.035,.012,.10);
  const geometry=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());wingGeometries.set(kind,geometry);return geometry;
}
export function buildButterflies(scene,beds){
  const rng=random(172),butterflies=[];
  for(let i=0;i<32;i++){
    const kind=['monarch','blue','rose','lemon'][i%4],group=new THREE.Group(),left=new THREE.Group(),right=new THREE.Group();
    group.scale.setScalar([.28,.3,.26,.29][i%4]);
    const a=new THREE.Mesh(butterflyWing(kind),wingMaterial),b=new THREE.Mesh(butterflyWing(kind),wingMaterial);a.scale.x=-1;left.add(a);right.add(b);group.add(left,right);
    part(group,soft,0x6b5844,0,0,0,.025,.027,.18).castShadow=false;
    const bed=beds[i%beds.length],x=bed.x+(rng()-.5)*2,z=bed.z+(rng()-.5)*2;group.position.set(x,1.2,z);scene.add(group);
    butterflies.push({group,left,right,x,z,phase:rng()*6.28,kind});
  }
  return butterflies;
}
export function updateVegetation(time,reducedMotion,rain=0){wind.time.value=time;wind.strength.value=reducedMotion?0:1+rain*(.4+Math.sin(time*.65)*.2);}
