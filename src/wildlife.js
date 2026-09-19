import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Wildlife } from './wildlife-state.js';

const sphere=new THREE.SphereGeometry(1,12,9),materials=new Map();
function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.88}));return materials.get(color);}
function shape(parent,color,x,y,z,sx,sy=sx,sz=sx,geometry=sphere){const mesh=new THREE.Mesh(geometry,mat(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function joint(parent,x,y,z){const group=new THREE.Group();group.position.set(x,y,z);parent.add(group);return group;}
function twig(parent,points,radius,color){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return shape(parent,color,0,0,0,1,1,1,new THREE.TubeGeometry(curve,8,radius,5));}

// Batch rigid pieces within each joint, retaining the articulated skeleton.
function batchRig(group){
  group.children.filter(c=>c.isGroup).forEach(batchRig);
  const batches=new Map();
  group.children.filter(c=>c.isMesh&&!c.userData.animated).forEach(mesh=>{
    mesh.updateMatrix();const key=mesh.material;
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push(mesh);
  });
  for(const [material,meshes] of batches){
    if(meshes.length<2)continue;
    const parts=meshes.map(mesh=>{const g=mesh.geometry.clone().applyMatrix4(mesh.matrix);return g.index?g.toNonIndexed():g;});
    const mesh=new THREE.Mesh(mergeGeometries(parts),material);mesh.receiveShadow=true;group.add(mesh);
    meshes.forEach(m=>m.removeFromParent());parts.forEach(g=>g.dispose());
  }
}

export function createAnimal(kind,x=0,z=0,index=0){
  const group=new THREE.Group(),body=joint(group,0,0,0);group.name=kind;group.userData.dynamic=true;
  const rabbit=kind==='rabbit',fox=kind==='fox',deer=kind==='deer',sheep=kind==='sheep';
  const fur=rabbit?0xd9c7ac:fox?0xba6935:deer?0xb48a5e:0xefe8d8;
  const cream=0xf7eddb,dark=0x372e29,hoof=0x645345;
  const legs=[],ears=[],eyes=[];
  const shoulder=deer?1.07:sheep?.67:fox?.51:.32;
  shape(body,fur,0,shoulder+.22,0,deer?.37:sheep?.48:.31,deer?.43:sheep?.43:.29,deer?.73:sheep?.67:.48);
  shape(body,cream,0,shoulder+.10,.15,.24,.25,.4);
  if(sheep){
    for(let i=0;i<22;i++){const a=i*2.4;shape(body,i%3?0xeee6d3:0xf8f1e1,Math.sin(a)*.36,shoulder+.28+Math.cos(i*1.5)*.25,Math.cos(a)*.52,.23,.23,.24);}
  }
  let neck;
  if(deer){
    neck=joint(body,0,1.15,.47);
    const furNeck=shape(neck,fur,0,.25,.08,.23,.52,.23);furNeck.rotation.x=.28;
    // A young woodland deer: pale spots, slender legs, branching antlers.
    for(const side of [-1,1])for(let i=0;i<8;i++)shape(body,0xeadbbf,side*(.31+(i%2)*.018),1.29+(i%3)*.105,-.48+Math.floor(i/3)*.25,.025,.033,.045);
  }
  const head=joint(neck||body,0,deer?.77:sheep?1.04:fox?.94:.79,deer?.29:sheep?.61:fox?.48:.27);
  shape(head,sheep?0x9b8b75:fur,0,0,0,sheep?.27:rabbit?.25:.24,sheep?.29:.26,deer?.34:.28);
  shape(head,cream,0,-.13,deer?.27:fox?.27:.21,deer?.14:fox?.16:.17,.11,fox?.25:deer?.22:.13);
  const noseZ=deer?.48:fox?.50:.33;
  shape(head,rabbit?0xb78983:dark,0,-.10,noseZ,rabbit?.035:.055,.033,.04);
  for(const side of [-1,1]){
    shape(head,cream,side*.07,-.17,noseZ-.05,.076,.049,.035);
    const eye=shape(head,dark,side*(deer?.19:.125),.055,.22,.035,.044,.023);eye.userData.animated=true;eyes.push(eye);
    // Eye highlights inherit the blink scale.
    shape(eye,0xfff8ea,-.22,.3,.9,.21,.21,.21);
    const ear=joint(head,side*(sheep?.25:.17),sheep?.09:.19,-.045);ears.push(ear);
    if(fox){
      shape(ear,0x74462d,0,.12,0,.14,.32,.12,new THREE.ConeGeometry(1,1,4));
      shape(ear,0xd7b4a0,0,.12,.05,.08,.20,.06,new THREE.ConeGeometry(1,1,4));
    }else{
      const length=rabbit?.31:deer?.22:.12;
      shape(ear,fur,side*(sheep?.12:0),length*.62,0,sheep?.22:.085,length,.063);
      shape(ear,0xc29b91,side*(sheep?.12:0),length*.62,.052,sheep?.14:.044,length*.72,.012);
      ear.rotation.z=side*(rabbit?-.14:deer?-.65:-.2);
    }
    ear.userData.restZ=ear.rotation.z;
    if(deer){
      twig(head,[[side*.12,.16,-.08],[side*.18,.48,-.14],[side*.31,.68,-.09]],.028,0x826548);
      twig(head,[[side*.18,.45,-.14],[side*.09,.62,-.22]],.018,0x826548);
    }
  }
  if(sheep)for(let i=-1;i<=1;i++)shape(head,0xf4ecdc,i*.15,.23,.04,.15,.14,.16);
  for(const side of [-1,1])for(const end of [-1,1]){
    const leg=joint(body,side*(sheep?.28:deer?.24:.21),shoulder,end*(deer?.45:sheep?.39:fox?.31:.22));
    const length=shoulder-.07,thick=rabbit?.09:deer?.06:.08;
    shape(leg,rabbit?fur:sheep?0x9b8b75:fur,0,-length*.48,0,thick,length*.55,thick);
    const knee=joint(leg,0,-length*.53,0);
    shape(knee,fox?dark:deer?hoof:fur,0,-length*.22,.02,thick*.8,length*.26,thick*.88);
    shape(knee,rabbit?cream:hoof,0,-length*.44,.04,rabbit?.12:thick*1.1,.055,rabbit?.20:.10);
    leg.userData={knee,side,end};legs.push(leg);
  }
  const tail=joint(body,0,shoulder+.29,fox?-.43:deer?-.7:sheep?-.67:-.4);
  shape(tail,fox?fur:cream,0,fox?.01:0,fox?-.27:0,fox?.18:.11,fox?.20:.13,fox?.48:.13);
  if(fox){shape(tail,cream,0,.05,-.62,.135,.16,.22);tail.rotation.x=-.22;}
  group.scale.setScalar(rabbit?.64:fox?.78:sheep?.82:.93);
  group.position.set(x,.2,z);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(1,16),new THREE.MeshBasicMaterial({color:0x405034,transparent:true,opacity:.12,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.set(rabbit?.32:.48,deer?.82:.57,1);shadow.position.y=.01;group.add(shadow);
  batchRig(body);
  return {kind,group,body,head,neck,legs,ears,eyes,tail,shadow,x,z,groundY:.2,phase:index*1.7,brain:new Wildlife(kind,x,z,index+1)};
}

// Destinations build and tear down their own animals. Only per-animal geometry
// and materials are released; the shared sphere and palette stay alive.
export function disposeAnimal(animal){
  const shared=new Set(materials.values());
  animal.group.traverse(node=>{
    if(!node.isMesh)return;
    if(node.geometry!==sphere)node.geometry.dispose();
    for(const m of Array.isArray(node.material)?node.material:[node.material])if(!shared.has(m))m.dispose();
  });
  animal.group.removeFromParent();
}

export function updateAnimal(animal,dt,time,player,walkable,night,reducedMotion){
  const {brain,group,body,head,neck,legs,ears,eyes,tail,kind,phase}=animal;
  if(dt<=0)return;
  brain.update(dt,player,walkable,night);
  group.position.x=brain.position.x;group.position.z=brain.position.z;
  const ease=1-Math.exp(-dt*6),moving=brain.speed>.01;
  const angle=Math.atan2(Math.sin(brain.heading-group.rotation.y),Math.cos(brain.heading-group.rotation.y));group.rotation.y+=angle*ease;
  const cycle=brain.distance*(kind==='rabbit'?12:8),graze=brain.mode==='graze',sleep=brain.mode==='sleep',friendly=brain.mode==='friendly';
  const mix=(a,b)=>a+(b-a)*ease;
  if(neck)neck.rotation.x=mix(neck.rotation.x,graze?1.82:sleep?.4:0);
  head.rotation.x=mix(head.rotation.x,sleep?.7:graze?(neck?-.1:.75)+Math.sin(time*2+phase)*.045:moving?-.05:0);
  head.rotation.y=mix(head.rotation.y,moving||brain.mode==='alert'?0:reducedMotion?0:Math.sin(time*.6+phase)*.12);
  head.rotation.z=mix(head.rotation.z,friendly?.12:0);
  body.position.y=mix(body.position.y,reducedMotion?0:kind==='rabbit'&&moving?Math.max(0,Math.sin(cycle))*.18:Math.sin(time*2+phase)*.009);
  legs.forEach((leg,i)=>{
    const wave=Math.sin(cycle+(kind==='rabbit'?(i%2)*Math.PI:(i===0||i===3?0:Math.PI)));
    leg.rotation.x=mix(leg.rotation.x,moving?wave*(kind==='rabbit'?.42:.34):0);
    leg.userData.knee.rotation.x=mix(leg.userData.knee.rotation.x,moving?Math.max(0,-wave)*.35:0);
  });
  ears.forEach((ear,i)=>{const flick=!reducedMotion&&((time+phase+i*.9)%7)<.3?Math.sin((time+phase+i*.9)%7/ .3*Math.PI)*.15:0;ear.rotation.z=mix(ear.rotation.z,ear.userData.restZ+flick);});
  tail.rotation.y=reducedMotion?0:Math.sin(time*(friendly?5:moving?3:1.3)+phase)*(friendly?.23:kind==='fox'?.18:.07);
  const blink=(time+phase)%6.3;eyes.forEach(eye=>eye.scale.y=.044*(sleep?.12:!reducedMotion&&blink<.16?Math.max(.1,Math.abs(blink-.08)/.08):1));
  animal.blenderSheep?.update(dt,time,brain,reducedMotion);
}
