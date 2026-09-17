import * as THREE from 'three';

// Low-poly fabric gores share one mesh. Ribs and the curved handle are separate
// reusable shapes; no textures, network assets or dynamic shadows are needed.
const PANELS=8,RINGS=6,STEPS=5,RADIUS=1.85;
const positions=[],colors=[],indices=[];
for(let panel=0;panel<PANELS;panel++){
  const start=positions.length/3;
  for(let ring=0;ring<=RINGS;ring++)for(let step=0;step<=STEPS;step++){
    const r=ring/RINGS,angle=(panel+step/STEPS)/PANELS*Math.PI*2;
    const scallop=Math.sin(step/STEPS*Math.PI)*.085*r**4;
    positions.push(Math.sin(angle)*RADIUS*r,.48*(1-r*r)+scallop,Math.cos(angle)*RADIUS*r);
    const shade=panel%2?.91:1;colors.push(shade,shade,shade);
  }
  for(let ring=0;ring<RINGS;ring++)for(let step=0;step<STEPS;step++){
    const a=start+ring*(STEPS+1)+step,b=a+STEPS+1;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
}
const canopyGeometry=new THREE.BufferGeometry();
canopyGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
canopyGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
canopyGeometry.setIndex(indices);canopyGeometry.computeVertexNormals();
const ribPositions=[];
for(let panel=0;panel<PANELS;panel++)for(let ring=0;ring<RINGS;ring++){
  const angle=panel/PANELS*Math.PI*2;
  for(const r of [ring/RINGS,(ring+1)/RINGS])ribPositions.push(Math.sin(angle)*RADIUS*r,.48*(1-r*r)-.012,Math.cos(angle)*RADIUS*r);
}
const ribGeometry=new THREE.BufferGeometry();ribGeometry.setAttribute('position',new THREE.Float32BufferAttribute(ribPositions,3));
const trim=new THREE.LineBasicMaterial({color:0xf9e9cf});
const shaftMaterial=new THREE.MeshStandardMaterial({color:0x806449,roughness:.6});
// The curved grip reaches the paw; the upright shaft passes outside the cheek.
const shaftGeometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(0,0,0),new THREE.Vector3(.18,-.09,.14),new THREE.Vector3(.36,.1,.34),
  new THREE.Vector3(.36,1.15,.34),new THREE.Vector3(.36,2.54,.34),
]),24,.026,6,false);
const tipGeometry=new THREE.SphereGeometry(.055,8,6);
const fabrics=[0xd9b15e,0xd99aab].map(color=>new THREE.MeshStandardMaterial({color,vertexColors:true,roughness:.7,side:THREE.DoubleSide}));

export function umbrellaAllowed(story,bearName,storyTime,moonPhase){
  if(story==='moon'&&moonPhase!=='stargazing')return false;
  if((story==='departure'&&bearName==='Dudu')||(story==='arrival'&&bearName==='Bubu'))return storyTime>=1.9;
  return true;
}

export class BearUmbrella {
  constructor(bear,white=false){
    this.bear=bear;this.active=false;this.hand=white?0:1;this.grip=new THREE.Vector3();this.center=new THREE.Vector3();this.size=new THREE.Vector3();this.cover={x:0,y:0,z:0,radius:0,height:0};
    this.group=new THREE.Group();this.group.name=white?'Bubu’s rose umbrella':'Dudu’s honey umbrella';this.group.visible=false;this.group.scale.set(white?-1:1,white?1.13:1,1);
    const canopy=new THREE.Mesh(canopyGeometry,fabrics[white?1:0]);canopy.position.set(.36,2.03,.34);canopy.receiveShadow=true;this.canopy=canopy;
    const ribs=new THREE.LineSegments(ribGeometry,trim);ribs.position.copy(canopy.position);
    const shaft=new THREE.Mesh(shaftGeometry,shaftMaterial),tip=new THREE.Mesh(tipGeometry,shaftMaterial);tip.position.set(.36,2.57,.34);
    this.group.add(canopy,ribs,shaft,tip);bear.userData.body.add(this.group);
  }
  update(dt,rain,allowed=true){
    const active=this.bear.visible&&allowed&&rain>.12,changed=active!==this.active;
    this.active=active;this.group.visible=active;
    const {body,arms,forearms}=this.bear.userData,arm=arms[this.hand],paw=forearms[this.hand],side=this.hand?1:-1;
    if(!active){
      // A weather change made from the pause menu still releases the grip.
      if(changed&&dt===0){arm.rotation.set(0,0,0);paw.rotation.set(0,0,0);}
      return;
    }
    arm.rotation.set(-.95,0,side*.25);arm.position.x=side*.52;arm.position.z=0;
    paw.rotation.set(-.65,0,0);
    paw.updateWorldMatrix(true,false);this.grip.set(0,-.08,.035).applyMatrix4(paw.matrixWorld);
    body.worldToLocal(this.grip);this.group.position.copy(this.grip);
    this.canopy.getWorldPosition(this.center);this.canopy.getWorldScale(this.size);
    Object.assign(this.cover,{x:this.center.x,y:this.center.y,z:this.center.z,radius:RADIUS*Math.max(Math.abs(this.size.x),Math.abs(this.size.z)),height:.48*Math.abs(this.size.y)});
  }
}
