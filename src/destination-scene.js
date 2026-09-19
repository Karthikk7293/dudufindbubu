import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { destinationHeight, destinationLayout } from './destinations.js';
import { createAnimal, disposeAnimal, updateAnimal } from './wildlife.js';
import { isWalkable } from './game-state.js';
import { RoadNetwork, TrafficLights, Vehicle } from './city-traffic.js';
import { Route, RouteRider } from './scenery-route.js';

// Scenery is built only for the destination being visited. Static details share
// material batches; moving props and memory markers remain separate.
export class DestinationScene {
  constructor(place,mobile=false){
    this.place=place;this.mobile=mobile;this.group=new THREE.Group();this.static=new THREE.Group();this.group.add(this.static);
    this.obstacles=[];this.cameraObstacles=[];this.markers=[];this.lamps=[];this.dynamic=[];this.materials=new Map();this.geometry=new Map();this.paths=[];
    this.gifts=[];this.animals=[];this.signals=[];this.signalSkins=new Map();this.traffic=null;this.routes=[];this.riders=[];
    this.layout=destinationLayout(place.id);this.time=0;
    this.ground=this.makeGround();
    if(place.id!=='city')this.path(place.id==='beach'?[[0,33],[0,24],[0,14],[0,5],[0,-5]]:[[0,33],[0,23],[0,12],[0,3],[0,-8],[0,-19],[0,-30]],2.6);
    if(place.id==='village')this.village();
    if(place.id==='city')this.city();
    if(place.id==='beach')this.beach();
    if(place.id==='mountains')this.mountains();
    if(place.id==='snowlands')this.snowlands();
    this.outskirts();this.vehicles();this.placeGifts();
    this.details();this.memoryMarkers();this.batch();this.spawnAnimals();
    this.lights=Array.from({length:Math.min(this.lamps.length,mobile?1:2)},()=>{const light=new THREE.PointLight(0xffd397,0,9,2);this.group.add(light);return light;});
  }
  height(x,z){return destinationHeight(this.place.id,x,z);}
  geo(kind){
    if(!this.geometry.has(kind))this.geometry.set(kind,kind==='box'?new THREE.BoxGeometry(1,1,1):kind==='cone'?new THREE.ConeGeometry(1,1,8):kind==='cylinder'?new THREE.CylinderGeometry(1,1,1,12):new THREE.SphereGeometry(1,12,8));
    return this.geometry.get(kind);
  }
  material(color,glow=false){
    const key=`${color}/${glow}`;
    if(!this.materials.has(key))this.materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.85,emissive:glow?color:0,emissiveIntensity:glow?.15:0}));
    return this.materials.get(key);
  }
  shape(kind,color,x,y,z,sx=1,sy=sx,sz=sx,parent=this.static,glow=false){
    // Static batches cast the baked shadows; animated props must not leave
    // a fixed shadow behind when the windmill, tram or birds move.
    const mesh=new THREE.Mesh(this.geo(kind),this.material(color,glow));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  object(x,z,radius,height){this.obstacles.push({x,z,radius});this.cameraObstacles.push({x,z,radius,minY:this.height(x,z),maxY:this.height(x,z)+height});}
  makeGround(){
    const rings=52,segments=104,positions=[],colors=[],indices=[],base=new THREE.Color(this.place.ground);
    for(let ring=0;ring<=rings;ring++)for(let segment=0;segment<=segments;segment++){
      const angle=segment/segments*Math.PI*2,radius=41*ring/rings,x=Math.sin(angle)*radius,z=Math.cos(angle)*radius;
      const y=this.height(x,z)-(this.place.id==='beach'?Math.max(0,-z-9)*.18:0);
      positions.push(x,y,z);const c=base.clone().multiplyScalar(.97+.04*Math.sin(x*.83)*Math.cos(z*.71));colors.push(c.r,c.g,c.b);
      if(ring<rings&&segment<segments){const a=ring*(segments+1)+segment,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
    const ground=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1}));ground.receiveShadow=true;this.group.add(ground);
    // Join the terrain perimeter directly to its underside. A capped cylinder
    // beneath the island would overlap the flat terrain and cause z-fighting.
    const sides=[],sideIndices=[];
    for(let segment=0;segment<=segments;segment++){
      const offset=(rings*(segments+1)+segment)*3,[x,y,z]=positions.slice(offset,offset+3);
      sides.push(x,y,z,x,-4,z);
      if(segment<segments){const a=segment*2;sideIndices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const skirt=new THREE.BufferGeometry();skirt.setAttribute('position',new THREE.Float32BufferAttribute(sides,3));skirt.setIndex(sideIndices);skirt.computeVertexNormals();
    this.static.add(new THREE.Mesh(skirt,this.material(this.place.id==='snowlands'?0xb9ccd3:0x938669)));
    return ground;
  }
  path(points,width=2,color,lift=.025){
    this.paths.push({points,width});const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z))),p=[],index=[];
    for(let i=0;i<=90;i++){
      const at=curve.getPoint(i/90),side=curve.getTangent(i/90).cross(new THREE.Vector3(0,1,0)).normalize().multiplyScalar(width/2);
      for(const sign of [1,-1]){const x=at.x+side.x*sign,z=at.z+side.z*sign;p.push(x,this.height(x,z)+lift,z);}
      if(i<90){const a=i*2;index.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(index);geo.computeVertexNormals();
    const path=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:color??(this.place.id==='snowlands'?0xd1dce2:this.place.id==='city'?0xd0d0c5:0xd7c59b),roughness:.95,side:THREE.DoubleSide}));path.receiveShadow=true;this.group.add(path);
  }
  tree(x,z,size=1,type='round'){
    const y=this.height(x,z),green=this.place.id==='snowlands'?0x608982:0x648a58;
    this.shape('cylinder',0x8a6d50,x,y+size*1.5,z,.16*size,3*size,.16*size);
    if(type==='pine'){
      for(let i=0;i<3;i++){
        this.shape('cone',green,x,y+(2.1+i*.9)*size,z,(1.45-i*.28)*size,2*size,(1.45-i*.28)*size);
        if(this.place.id==='snowlands')this.shape('cone',0xe5eff0,x,y+(2.6+i*.9)*size,z,(1.13-i*.26)*size,1.12*size,(1.13-i*.26)*size);
      }
    }else{
      [[0,3.2,0,1.4],[-.85,2.8,.25,1.05],[.7,3.1,.3,1.1],[.05,3.7,-.2,.95]].forEach(([a,b,c,r],i)=>this.shape('sphere',[0x73935c,0x85a467,0x658950][i%3],x+a*size,y+b*size,z+c*size,r*size,.9*r*size,r*size));
    }
    this.object(x,z,.24*size,4.4*size);this.cameraObstacles.push({x,z,y:y+3.2*size,radius:1.4*size});
  }
  house(x,z,color=0xe0bc91,scale=1,snow=false){
    const y=this.height(x,z),group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(scale);this.static.add(group);
    this.shape('box',color,0,1.45,0,4,2.9,3.4,group);
    const roof=this.shape('cone',snow?0xeaf1ef:0xa66f57,0,3.15,0,3.3,2.05,2.9,group);roof.geometry=new THREE.ConeGeometry(1,1,4);roof.rotation.y=Math.PI/4;
    this.shape('box',0x715d4d,0,.8,1.73,.9,1.6,.12,group);
    for(const side of [-1,1]){
      this.shape('box',0xffd7a0,side*1.24,1.65,1.73,.76,.87,.1,group,true);
      this.shape('box',0xefe0bf,side*1.24,1.65,1.8,.06,.9,.07,group);
      this.shape('box',0xefe0bf,side*1.24,1.65,1.8,.8,.06,.07,group);
      this.shape('box',0x9d7655,side*1.24,1.04,1.93,1.05,.25,.5,group);
      for(let j=0;j<3;j++)this.shape('sphere',0xcf8fa4,side*1.24+(j-1)*.25,1.22,1.93,.17,.15,.18,group);
    }
    this.shape('box',0x95745a,1.1,3.8,-.55,.55,1.5,.55,group);this.object(x,z,2.5*scale,4.8*scale);
  }
  lamp(x,z){
    const y=this.height(x,z);this.shape('cylinder',0x56665d,x,y+1.55,z,.065,3.1,.065);this.shape('box',0x56665d,x,y+3.12,z,.48,.07,.48);
    this.shape('box',0xffd59a,x,y+2.83,z,.3,.5,.3,this.static,true);this.shape('cone',0x56665d,x,y+3.3,z,.38,.35,.38);
    this.object(x,z,.13,3.5);this.lamps.push({x,z});
  }
  bench(x,z,rotation=0){
    const g=new THREE.Group();g.position.set(x,this.height(x,z),z);g.rotation.y=rotation;this.static.add(g);
    this.shape('box',0xae835b,0,.6,0,1.9,.15,.65,g);this.shape('box',0xb99268,0,1,-.29,1.9,.6,.1,g);
    for(const s of [-1,1])this.shape('box',0x586457,s*.7,.3,0,.12,.6,.5,g);this.object(x,z,.95,1.3);
  }
  flowers(x,z,count=22){
    for(let i=0;i<count;i++){
      const a=i*2.4,r=.25+Math.sqrt(i/count)*1.6,px=x+Math.sin(a)*r,pz=z+Math.cos(a)*r,y=this.height(px,pz);
      this.shape('cylinder',0x759561,px,y+.18,pz,.022,.35,.022);
      this.shape('sphere',[0xe3acb3,0xebe0ad,0xa6b1d1][i%3],px,y+.38,pz,.12,.07,.12);
    }
  }
  village(){
    this.path([[-22,4],[0,4],[21,4]],2.6);this.path([[-13,-6],[-9,0],[0,4],[9,-1],[13,-9]],1.8);
    [[-10,14,0xe7c59b],[10,14,0xcfac8c],[-17,-18,0xdfc599],[4,-19,0xd7ad94],[19,-17,0xe8d7a9]].forEach(([x,z,c])=>this.house(x,z,c));
    for(const x of [-6,6]){
      this.shape('box',0x977454,x,.85,1,3,1.2,1.6);this.shape('box',x<0?0xd49b92:0xa2bbaa,x,2.6,1,3.6,.25,2.5);
      for(const s of [-1,1])this.shape('cylinder',0x8d7052,x+s*1.5,1.5,1,.06,2.7,.06);
      for(let i=0;i<7;i++)this.shape('sphere',x<0?0xe4ba68:0xdb8ba0,x-1+i*.32,1.55,1,.18,.17,.18);
      this.object(x,1,1.85,2.9);
    }
    this.shape('cylinder',0xc5c1a2,0,.53,-1,1.65,.65,1.65);this.shape('sphere',0x96bec0,0,.87,-1,1.35,.12,1.35);this.object(0,-1,1.7,1.2);
    const x=-17,z=-9,y=this.height(x,z);this.shape('cylinder',0xe4d7b5,x,y+2.5,z,1.4,5,1.4);this.shape('cone',0xa98264,x,y+5.5,z,1.85,1.8,1.85);
    const sails=new THREE.Group();sails.position.set(x,y+3.8,z+1.5);this.group.add(sails);
    for(let i=0;i<4;i++){const arm=new THREE.Group();arm.rotation.z=i*Math.PI/2;this.shape('box',0xf2e8cc,0,1.45,0,.58,2.8,.1,arm);sails.add(arm);}this.dynamic.push(t=>sails.rotation.z=t*.18);this.object(x,z,1.9,6.5);
    for(const [x,z]of [[12,-16],[17,-12],[19,-19],[9,-20]]){this.tree(x,z,1.15);for(let i=0;i<5;i++)this.shape('sphere',0xbc7660,x+Math.sin(i*2)*1.1,3.55,z+Math.cos(i*2)*1.1,.16);}
    this.flowers(-13,-10);this.flowers(10,6);this.bench(-3,12.5,.2);[-22,-9,9,22].forEach(x=>this.lamp(x,7));
  }
  crossing(x,z,along){
    // Zebra stripes run the way people walk, repeating along the road.
    for(let i=-3;i<=3;i++){
      if(along==='x')this.shape('box',0xeeeade,x+i*.82,.252,z,.44,.014,5.4);
      else this.shape('box',0xeeeade,x,.252,z+i*.82,5.4,.014,.44);
    }
  }
  signalPost(x,z,axis,facing){
    const head=new THREE.Group();head.position.set(x,this.height(x,z),z);head.rotation.y=facing;this.group.add(head);
    this.shape('cylinder',0x4f555a,0,1.7,0,.07,3.4,.07,head);
    this.shape('box',0x3f4449,0,3.05,.12,.34,.92,.3,head);
    const lamps=['red','amber','green'].map((tone,i)=>{
      const lamp=this.shape('sphere',0x2f3337,0,3.35-i*.27,.28,.1,.1,.06,head);
      lamp.userData.tone=tone;return lamp;
    });
    this.object(x,z,.16,3.6);this.signals.push({axis,lamps});
  }
  city(){
    const xs=[-24,0,24],zs=[24,8,-11,-26];
    this.roads=new RoadNetwork(xs,zs);this.signals=[];
    for(const z of zs)this.path([[-24,z],[0,z],[24,z]],6.2,0x9aa0a2);
    for(const x of xs)this.path([[x,24],[x,0],[x,-26]],6.2,0x9aa0a2);
    // Pavement slabs fill each block between the roads.
    for(const [bx,bz,depth] of [[-12,16,9.8],[12,16,9.8],[-12,-1.5,12.8],[12,-1.5,12.8],[-12,-18.5,8.8],[12,-18.5,8.8]])
      this.shape('box',0xcdc9ba,bx,.235,bz,17.8,.03,depth);
    // Dashed centre lines, kept clear of every junction.
    const clear=(value,list)=>list.every(at=>Math.abs(value-at)>5.6);
    for(const z of zs)for(let x=-23;x<=23;x+=3.6)if(clear(x,xs))this.shape('box',0xe9dbb5,x,.245,z,1.6,.016,.14);
    for(const x of xs)for(let z=-25;z<=23;z+=3.6)if(clear(z,zs))this.shape('box',0xe9dbb5,x,.245,z,.14,.016,1.6);
    // Signalled crossroads: crossings on all four approaches, lights on the corners.
    for(const z of [8,-11]){
      for(const x of [-5.7,5.7])this.crossing(x,z,'x');
      for(const dz of [5.7,-5.7])this.crossing(0,z+dz,'z');
      this.signalPost(-4.4,z+4.4,'ew',Math.PI/2);this.signalPost(4.4,z-4.4,'ew',-Math.PI/2);
      this.signalPost(4.4,z+4.4,'ns',Math.PI);this.signalPost(-4.4,z-4.4,'ns',0);
    }
    // Townhouses sit well inside each block, clear of every driving lane.
    for(const [x,z,h,c] of [[-15,16,11,0xb7b0a0],[-8,16,8,0xd5afa1],[8,16,10,0x91b0b3],[15,16,7,0xc7a69b],
      [8,-1.5,12,0xa3acbb],[15,-1.5,9,0xc7ba9d],[-15,-18.5,10,0x94a9ab],[-8,-18.5,13,0xb5bdba]]){
      this.shape('box',c,x,.26+h/2,z,5.4,h,4.7);this.shape('box',0xede3cf,x,h+.34,z,5.65,.2,5);
      for(let row=1;row<h-1;row+=2)for(const side of [-1,1])this.shape('box',0xffdca6,x+side*1.3,row+.56,z+2.37,1,1.05,.06,this.static,true);
      this.shape('box',0x77979b,x,1.16,z+2.4,1.2,1.8,.06);this.object(x,z,3.6,h+.5);
    }
    // Clocktower square fills the block west of the main junction.
    this.shape('cylinder',0xc9c4b2,-8,.55,-1.5,2.1,.7,2.1);this.shape('cylinder',0x85b9c2,-8,.93,-1.5,1.85,.04,1.85);
    this.shape('sphere',0xbee4db,-8,1.55,-1.5,.55,.8,.55);this.object(-8,-1.5,2.1,2.4);
    this.shape('box',0xc3ad89,-15,3.86,-1.5,2.9,7.2,2.9);this.shape('cone',0x678184,-15,8.06,-1.5,2.2,2,2.2);this.object(-15,-1.5,2,9.4);
    const clock=this.shape('cylinder',0xf4e9ce,-15,6.36,-.01,.82,.09,.82);clock.rotation.x=Math.PI/2;
    this.shape('box',0x647572,-15,6.64,.07,.08,.55,.08);const hand=this.shape('box',0x647572,-14.8,6.36,.08,.5,.08,.08);hand.rotation.z=.35;
    this.bench(-12,2,Math.PI);this.bench(-12,-5,0);this.tree(-19,-5.5,.8);this.tree(-19,2.5,.75);
    // The pocket garden keeps the south-east block green.
    for(const [x,z,s] of [[8,-16,.9],[16,-21,.95],[9,-21.5,.8],[16.5,-15.5,.85]])this.tree(x,z,s);
    this.flowers(12,-18.5);this.bench(12,-15.2,Math.PI);this.bench(12,-21.8,0);
    // The tram keeps its own line east of the ring road.
    for(const x of [31.4,32.6])this.shape('box',0x737e7f,x,.24,0,.065,.07,42);
    const tram=new THREE.Group();this.group.add(tram);this.shape('box',0x709c94,0,1.4,0,2,2,4.4,tram);
    this.shape('box',0xe9d7ad,0,2.5,0,2.15,.25,4.6,tram);
    for(const z of [-1.4,0,1.4])this.shape('box',0xc5dfe2,-1.02,1.8,z,.04,.72,.9,tram);
    for(const x of [-.85,.85])for(const z of [-1.4,1.4]){const wheel=this.shape('cylinder',0x53646a,x,.4,z,.35,.12,.35,tram);wheel.rotation.z=Math.PI/2;}
    this.dynamic.push(t=>{tram.position.set(32,0,Math.sin(t*.09)*18);});
    this.shape('box',0x77969d,28.5,2.1,8,3.4,.2,1.6);this.shape('cylinder',0x637e7d,27.1,1.2,8,.055,2.2,.055);this.object(28.5,8,.8,2.4);
    // Street lighting along the pavements, never in a driving lane.
    for(const z of [18,2,-6,-21])for(const x of [-4.4,4.4])this.lamp(x,z);
    for(const x of [-14,14])for(const z of [11.6,4.4,-7.6,-14.6])this.lamp(x,z);
  }
  palm(x,z,size=1){
    const y=this.height(x,z);this.shape('cylinder',0xb4936b,x,y+2*size,z,.15*size,4*size,.17*size);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7,leaf=this.shape('sphere',i%2?0x75a478:0x598e71,x+Math.sin(a)*.9*size,y+4*size,z+Math.cos(a)*.9*size,.28*size,.13*size,1.6*size);leaf.rotation.y=a;leaf.rotation.x=.18;}
    this.object(x,z,.26*size,4.8*size);this.cameraObstacles.push({x,z,y:y+4*size,radius:1.8*size});
  }
  beach(){
    this.path([[-16,0],[-8,4],[0,7],[13,7],[21,12]],1.65,0xeedeb4);
    const ocean=new THREE.Mesh(new THREE.PlaneGeometry(220,130),new THREE.MeshStandardMaterial({color:0x5cabb5,roughness:.32,metalness:.08}));ocean.rotation.x=-Math.PI/2;ocean.position.set(0,.07,-74);this.group.add(ocean);
    for(let i=0;i<5;i++){
      const wave=new THREE.Mesh(new THREE.PlaneGeometry(74-i*5,.2+i*.14),new THREE.MeshBasicMaterial({color:0xdff2e6,transparent:true,opacity:.3,depthWrite:false}));wave.rotation.x=-Math.PI/2;this.group.add(wave);
      this.dynamic.push(t=>{wave.position.set(Math.sin(t*.35+i)*2.2,.085+i*.002,-10.6-i*2.1+Math.sin(t*.5+i)*.7);wave.material.opacity=.1+Math.max(0,Math.sin(t*.5+i))*.16;});
    }
    [[-18,11,1.2],[-10,15,.95],[8,14,1.3],[20,0,1.15],[19,14,.9]].forEach(p=>this.palm(...p));
    for(const [x,z,color]of [[8,2,0xe5b087],[17,8,0x87bcc0],[-8,7,0xd9a3a6]]){
      this.shape('cylinder',0xb39671,x,1.3,z,.04,2.2,.04);this.shape('cone',color,x,2.55,z,1.7,.75,1.7);this.shape('box',0xeee0bd,x, .26,z,2.8,.035,2);this.object(x,z,.22,3);
    }
    this.shape('cylinder',0xece5d2,-20,4.6,-1,1.3,8.8,1.3);for(const y of [2,4.5,7])this.shape('cylinder',0xc38676,-20,y,-1,1.32,.55,1.32);
    this.shape('cylinder',0xffdea1,-20,9.25,-1,1.05,.7,1.05,this.static,true);this.shape('cone',0x647f87,-20,10,-1,1.7,.85,1.7);this.object(-20,-1,1.7,10.5);
    for(let i=0;i<24;i++){const x=Math.sin(i*9.7)*22,z=-7+Math.cos(i*2)*1.2;this.shape('sphere',i%2?0xf5e7cf:0xe2bda8,x,.28,z,.13,.05,.1);}
    this.shape('box',0xb69c72,13,.29,7,3,.07,2.6);this.shape('sphere',0xbd9670,13.4,.6,7,.4,.35,.3);this.bench(-13,3,.5);
  }
  mountains(){
    this.path([[0,20],[8,15],[13,10],[14,1],[8,-7]],2);this.path([[0,10],[-8,6],[-12,1],[-15,-8]],1.8);
    for(let i=0;i<10;i++){
      const a=Math.PI*.5+i/9*Math.PI,x=Math.sin(a)*49,z=Math.cos(a)*49-5,h=19+(i%4)*5,r=9+(i%3);
      this.shape('cone',[0x8b9697,0xa2acab,0x7d8d92][i%3],x,h/2-1,z,r,h,r);
      this.shape('cone',0xe0e5df,x,h*.82-1,z,r*.38,h*.36,r*.38);
    }
    for(const [x,z,s]of [[-20,8,1.2],[-17,-15,1.3],[-4,-19,1.5],[20,0,1.2],[20,16,1],[-9,17,1]])this.tree(x,z,s,'pine');
    const y=this.height(-16,0);this.shape('cone',0xc1a16e,-16,y+1.3,0,2.2,2.6,2.2).rotation.y=.8;this.shape('cone',0x665e50,-16,y+1,1.5,.75,1.7,.08);this.object(-16,0,2.1,3);
    this.shape('cylinder',0x9b8f76,-12,this.height(-12,-3)+.17,-3,.85,.3,.85);
    const flame=this.shape('sphere',0xf4bf6d,-12,this.height(-12,-3)+.65,-3,.27,.62,.27,this.group,true);this.dynamic.push(t=>flame.scale.y=.57+Math.sin(t*7)*.05);this.object(-12,-3,.8,1.4);
    this.flowers(17,11);this.flowers(11,-11);this.bench(7,-11);this.lamp(-4,12);this.lamp(11,4);
  }
  snowlands(){
    this.path([[-13,-7],[-7,-1],[0,4],[8,1],[12,-6]],2,0xc7d8df);
    this.house(-17,-10,0xb99779,1.1,true);this.house(13,15,0xc29f7d,.9,true);
    const lake=this.shape('sphere',0xaccfda,13,.22,-11,6,.06,4);lake.material=this.material(0xaccfda);lake.material.roughness=.25;
    for(const [x,z,s]of [[-20,4,1.4],[-14,16,1.2],[-5,-17,1.6],[5,-22,1.2],[21,-5,1.3],[23,6,1],[-23,-15,.9]])this.tree(x,z,s,'pine');
    const x=0,z=0;this.shape('sphere',0xf6f4e8,x,.94,z,.9,.8,.8);this.shape('sphere',0xf6f4e8,x,1.98,z,.65,.61,.59);
    for(const s of [-1,1]){this.shape('sphere',0xf6f4e8,x+s*.48,2.43,z,.22);this.shape('sphere',0x596365,x+s*.21,2.1,z+.55,.06);this.shape('sphere',0xf6f4e8,x+s*.94,1.1,z,.23,.35,.23);}
    this.shape('sphere',0xcb9978,0,1.91,.6,.11,.08,.13);this.shape('cylinder',0xb08b9e,0,1.51,0,.68,.2,.62);this.object(0,0,1.1,2.9);
    for(const x of [-5,5])for(const z of [11,-4])this.lamp(x,z);this.lamp(-12,-10);this.bench(9,-3,.4);
    const positions=[];for(let i=0;i<(this.mobile?130:280);i++)positions.push(Math.sin(i*8.2)*37,(i*.79)%15,Math.cos(i*3.17)*37);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.snow=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffffff,size:.075,transparent:true,opacity:.82,depthWrite:false}));this.snow.frustumCulled=false;this.group.add(this.snow);
    const g=new THREE.PlaneGeometry(88,14,44,6);const material=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:{time:{value:0},night:{value:0}},vertexShader:'varying vec2 vUv; uniform float time; void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*.13+time*.2)*3.;p.y+=sin(p.x*.19+time*.15)*1.4;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'varying vec2 vUv;uniform float time;uniform float night;void main(){float glow=sin(vUv.x*28.+sin(vUv.y*9.+time*.12))*0.18+0.55;float fade=sin(vUv.y*3.14159)*sin(vUv.x*3.14159);gl_FragColor=vec4(mix(vec3(.32,.76,.66),vec3(.57,.48,.81),vUv.y),fade*glow*night*.52);}',toneMapped:false});
    this.aurora=new THREE.Mesh(g,material);this.aurora.position.set(0,16,-43);this.group.add(this.aurora);
  }
  resolveSite(x,z){
    if(isWalkable(x,z,this.obstacles,this.layout))return {x,z};
    for(let radius=.8;radius<=7;radius+=.8)for(let i=0;i<14;i++){
      const angle=i/14*Math.PI*2,px=x+Math.sin(angle)*radius,pz=z+Math.cos(angle)*radius;
      if(isWalkable(px,pz,this.obstacles,this.layout))return {x:px,z:pz};
    }
    return {x,z};
  }
  // Ribboned boxes, matching the forest's presents, on a clear patch of ground.
  placeGifts(){
    for(const item of this.place.gifts){
      const {x,z}=this.resolveSite(item.x,item.z),group=new THREE.Group();
      group.position.set(x,this.height(x,z),z);this.group.add(group);
      const box=new THREE.Group();box.position.y=.42;group.add(box);
      this.shape('box',item.color,0,0,0,.66,.58,.58,box);
      this.shape('box',item.color,0,.33,0,.74,.14,.66,box);
      this.shape('box',0xfaecc8,0,.02,.3,.12,.58,.03,box);
      this.shape('box',0xfaecc8,.34,.02,0,.03,.58,.1,box);
      this.shape('box',0xfaecc8,0,.4,0,.13,.03,.66,box);
      this.shape('box',0xfaecc8,0,.4,0,.74,.03,.1,box);
      for(const side of [-1,1]){const loop=this.shape('sphere',0xfaecc8,side*.13,.5,0,.15,.09,.08,box);loop.rotation.z=side*.5;}
      const ring=new THREE.Mesh(new THREE.RingGeometry(.86,.98,30),new THREE.MeshBasicMaterial({color:0xf4dcab,side:THREE.DoubleSide,transparent:true,opacity:.55,depthWrite:false}));
      ring.rotation.x=-Math.PI/2;ring.position.y=.05;group.add(ring);
      const sparkle=this.shape('sphere',0xfff0c4,0,1.35,0,.1,.13,.1,group,true);
      this.gifts.push({item,x,z,group,box,ring,sparkle});
    }
  }
  // Each place keeps its own little residents, on open ground near their homes.
  spawnAnimals(){
    this.place.friends.forEach((friend,index)=>{
      const {x,z}=this.resolveSite(friend.x,friend.z),animal=createAnimal(friend.kind,x,z,index);
      animal.group.position.y=this.height(x,z);this.group.add(animal.group);this.animals.push(animal);
    });
  }
  nearestGift(position,taken=[]){
    return this.gifts.filter(gift=>!taken.includes(`${this.place.id}/${gift.item.id}`))
      .find(gift=>Math.hypot(gift.x-position.x,gift.z-position.z)<2.6);
  }
  // Scenery that travels follows a smoothed route, so it can be checked against
  // the scenery it has to keep clear of.
  ride(kind,points,group,options={}){
    const route=new Route(points,options),rider=new RouteRider(route,options);
    if(options.lane)this.path(route.loop?[...points,points[0],points[1]]:points,options.lane.width??2.4,options.lane.color,.034);
    this.routes.push({kind,route,clearance:options.clearance??.8});
    this.riders.push({...options,rider,group,phase:this.riders.length*1.7});
    return rider;
  }
  car(color,x=0,z=0,parked=false){
    const g=new THREE.Group();g.position.set(x,this.height(x,z),z);(parked?this.static:this.group).add(g);
    const wheels=[];
    // A softly rounded shell over the chassis, with glass, lamps and mirrors.
    this.shape('box',color,0,.5,0,1.48,.44,2.94,g);
    this.shape('sphere',color,0,.52,.15,.8,.4,1.66,g);
    this.shape('sphere',color,0,.86,-.24,.64,.35,1.02,g);
    this.shape('box',0x9fc4cf,0,.9,.62,1.16,.32,.06,g);
    this.shape('box',0x9fc4cf,0,.9,-1.08,1.12,.3,.06,g);
    this.shape('box',0xe3ded0,0,.33,-1.53,.52,.14,.05,g);
    for(const side of [-1,1]){
      this.shape('box',0x9fc4cf,side*.74,.9,-.24,.05,.28,.88,g);
      this.shape('sphere',0x4a4f54,side*.82,.64,.36,.06,.06,.15,g);
      this.shape('box',0xf6e7c0,side*.46,.5,1.5,.34,.16,.1,g,true);
      this.shape('box',0xc9776a,side*.46,.5,-1.49,.34,.14,.1,g,true);
    }
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const hub=new THREE.Group();hub.position.set(sx*.74,.3,sz*1.02);hub.rotation.order='YXZ';g.add(hub);
      const tyre=this.shape('cylinder',0x35393d,0,0,0,.3,.2,.3,hub);tyre.rotation.z=Math.PI/2;
      const rim=this.shape('cylinder',0xd3cfc2,sx*.055,0,0,.17,.12,.17,hub);rim.rotation.z=Math.PI/2;
      wheels.push({hub,front:sz>0});
    }
    if(parked)this.object(x,z,1.7,1.4);
    return {group:g,wheels};
  }
  boat(x,z,size=1,hull=0xd6ae86,sail=0xf5ecd8){
    const g=new THREE.Group();g.position.set(x,.08,z);this.group.add(g);
    this.shape('sphere',hull,0,.2*size,0,.85*size,.42*size,2.3*size,g);
    this.shape('box',0xf1e5c8,0,.42*size,0,1.5*size,.1*size,3*size,g);
    this.shape('box',hull,0,.68*size,-1.05*size,1*size,.55*size,.8*size,g);
    this.shape('cylinder',0x9b7a55,0,1.75*size,.2*size,.075*size,2.9*size,.075*size,g);
    const front=this.shape('cone',sail,0,1.85*size,.95*size,.95*size,2.2*size,.1*size,g);front.rotation.z=-.05;
    const back=this.shape('cone',sail,0,1.6*size,-.6*size,.7*size,1.7*size,.09*size,g);back.rotation.z=.06;
    return g;
  }
  // Traffic, boats and working vehicles give each place somewhere to look.
  vehicles(){
    const id=this.place.id;
    if(id==='city'){
      // Traffic is driven from the same grid the roads are drawn from, so a lane
      // can never run through a building.
      this.signalCycle=new TrafficLights();this.traffic=[];this.vehicles=[];
      const fleet=[
        {edge:[0,0,1,0],color:0xd7a49c,speed:7,start:6},
        {edge:[2,1,1,1],color:0x8fb1b9,speed:6.2,start:4},
        {edge:[1,0,1,1],color:0xcfc4a4,speed:6.8,start:3},
        {edge:[1,2,1,1],color:0xa5b6c4,speed:5.8,start:9},
        {edge:[0,3,1,3],color:0xbfa9c0,speed:6.4,start:12},
        {edge:[2,2,2,3],color:0xc9b08a,speed:6,start:5},
        {edge:[0,2,0,1],color:0x9fb8ae,speed:6.6,start:8},
      ];
      fleet.forEach((spec,index)=>{
        const edge=this.roads.edgeAt(...spec.edge);
        if(!edge)return;
        const {group,wheels}=this.car(spec.color);
        const vehicle=new Vehicle(this.roads,edge,{speed:spec.speed,seed:index*37+11,start:spec.start});
        this.vehicles.push(vehicle);this.traffic.push({vehicle,group,wheels});
      });
      // Two cars parked on the pavement, clear of every lane and doorway.
      for(const [x,z,color,turn] of [[5.2,-19,0xbfa9c0,Math.PI],[-4.6,-4,0x9fb8ae,0]])
        this.car(color,x,z,true).group.rotation.y=turn;
    }
    if(id==='beach'){
      // Both craft keep to open water, well beyond the tide line.
      const sailing=this.boat(0,-19,1);
      this.ride('water',[[-22,-18],[-6,-15],[10,-17],[22,-22],[10,-27],[-8,-26]],sailing,
        {speed:2.2,turn:1.1,altitude:()=>0,lift:.08,bob:.05,roll:.035,clearance:2.4});
      const ship=this.boat(-24,-33,1.9,0xc79a74,0xeee2c9);
      this.ride('water',[[-34,-34],[-6,-31],[24,-35],[30,-44],[-6,-47],[-32,-42]],ship,
        {speed:1.5,turn:.7,altitude:()=>0,lift:.08,bob:.06,roll:.022,clearance:4});
      // A rowing boat pulled up onto the sand, with one oar left behind.
      const rowing=new THREE.Group();rowing.position.set(-9,this.height(-9,-7.4),-7.4);rowing.rotation.y=.5;this.static.add(rowing);
      this.shape('sphere',0xcf9d7a,0,.28,0,.72,.3,1.7,rowing);
      this.shape('box',0xefe0c0,0,.4,0,1.2,.08,2.3,rowing);
      for(const z of [-.6,.5])this.shape('box',0xb8926c,0,.5,z,1.15,.1,.28,rowing);
      const oar=this.shape('box',0xa78257,.55,.6,.2,.08,.08,2.4,rowing);oar.rotation.z=.25;
      this.object(-9,-7.4,1.4,1);
    }
    if(id==='village'){
      // A produce cart trundles round the market lane all day.
      const cart=new THREE.Group();this.group.add(cart);
      this.shape('box',0xb08a5f,0,.72,0,1.5,.5,2.4,cart);
      for(const side of [-1,1])this.shape('box',0xc39a6b,side*.78,1,0,.1,.62,2.4,cart);
      this.shape('box',0xc39a6b,0,1,-1.15,1.56,.62,.1,cart);
      for(let i=0;i<6;i++)this.shape('sphere',[0xd9c07a,0xc8705f,0xa9b47a][i%3],(i%3-1)*.4,1.12,(Math.floor(i/3)-.5)*.8,.32,.24,.32,cart);
      for(const side of [-1,1])for(const z of [-.9,.9]){const wheel=this.shape('cylinder',0x8d6f4e,side*.86,.42,z,.42,.13,.42,cart);wheel.rotation.z=Math.PI/2;}
      this.shape('cylinder',0x9b7a55,0,.62,1.55,.06,1.2,.06,cart).rotation.x=Math.PI/2;
      this.ride('land',[[-19,4.6],[0,4.4],[18,5],[19,8.5],[10,9.2],[0,8.8],[-12,9.4],[-19,8.6]],cart,{speed:2.4,turn:2.2,clearance:1.2,lane:{width:2.5,color:0xcdb68d}});
      const wagon=new THREE.Group();wagon.position.set(-4,this.height(-4,-8),-8);wagon.rotation.y=.4;this.static.add(wagon);
      this.shape('box',0xb08a5f,0,.85,0,1.7,.55,3,wagon);
      for(const side of [-1,1])this.shape('box',0xc39a6b,side*.88,1.15,0,.1,.7,3,wagon);
      for(let i=0;i<9;i++)this.shape('sphere',0xd9c07a,(i%3-1)*.42,1.4+Math.sin(i)*.1,(Math.floor(i/3)-1)*.85,.42,.3,.42,wagon);
      for(const side of [-1,1])for(const z of [-1,1]){const w=this.shape('cylinder',0x8d6f4e,side*.95,.5,z*1.05,.5,.14,.5,wagon);w.rotation.z=Math.PI/2;}
      this.object(-4,-8,1.7,1.9);
    }
    if(id==='mountains'){
      // A cable car crosses the valley between two pylons.
      const a=new THREE.Vector3(-27,this.height(-27,10)+8.5,10),b=new THREE.Vector3(15,this.height(15,-13)+10.5,-13);
      for(const p of [a,b]){
        const base=this.height(p.x,p.z);
        this.shape('cylinder',0x77726a,p.x,(base+p.y)/2,p.z,.18,p.y-base,.18);
        this.shape('box',0x8a857c,p.x,p.y,p.z,1.5,.18,.5);this.object(p.x,p.z,.6,p.y-base);
      }
      const cable=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:0x5d6168}));this.group.add(cable);
      const gondola=new THREE.Group();this.group.add(gondola);
      this.shape('box',0xcf8f6f,0,-1.55,0,1.3,1.3,1.6,gondola);
      this.shape('box',0xc3dbe0,0,-1.55,.84,1,.8,.05,gondola);
      this.shape('box',0xe8dcc0,0,-.82,0,1.45,.16,1.75,gondola);
      this.shape('cylinder',0x6b6e74,0,-.4,0,.05,.8,.05,gondola);
      this.shape('box',0x5d6168,0,0,0,.5,.14,.22,gondola);
      // The car hangs from the cable and eases into each station.
      this.ride('air',[[a.x,a.z],[b.x,b.z]],gondola,{loop:false,steps:2,pingPong:true,speed:3.2,turn:.9,roll:.02,
        altitude:rider=>a.y+(b.y-a.y)*(rider.route.length?rider.distance/rider.route.length:0)});
    }
    if(id==='snowlands'){
      // One sleigh gliding the snow track, and one waiting by the cabin.
      const glider=new THREE.Group();this.group.add(glider);
      this.shape('box',0xb4705f,0,.75,0,1.5,.6,2.4,glider);
      this.shape('box',0xc98675,0,1.2,-.9,1.5,.5,.5,glider);
      for(let i=0;i<4;i++)this.shape('sphere',[0xe8dcc0,0xa9c6d6][i%2],(i%2-.5)*.6,1.18,(Math.floor(i/2)-.5)*.7,.3,.22,.3,glider);
      for(const side of [-1,1]){
        this.shape('box',0x8d6b52,side*.8,.3,0,.12,.14,2.8,glider);
        this.shape('cylinder',0x8d6b52,side*.8,.56,1.32,.1,.52,.1,glider);
      }
      this.ride('land',[[-8,12],[4,14],[14,9],[20,3],[16,-3],[6,1],[-3,4],[-10,9]],glider,{speed:2.6,turn:2,clearance:1.2,lane:{width:2.3,color:0xd3dfe6}});
      const sleigh=new THREE.Group();sleigh.position.set(-6,this.height(-6,-9),-9);sleigh.rotation.y=-.35;this.static.add(sleigh);
      this.shape('box',0xb4705f,0,.75,0,1.5,.6,2.4,sleigh);
      this.shape('box',0xc98675,0,1.2,-.9,1.5,.5,.5,sleigh);
      for(const side of [-1,1]){
        this.shape('box',0x8d6b52,side*.8,.3,0,.12,.14,2.8,sleigh);
        this.shape('cylinder',0x8d6b52,side*.8,.56,1.32,.1,.52,.1,sleigh);
      }
      this.object(-6,-9,1.4,1.6);
    }
  }
  // The wider ring keeps its own homes, trees and quiet corners to find.
  outskirts(){
    const id=this.place.id;
    if(id==='village'){
      [[-28,-6,0xdcc09a],[26,2,0xe2c9a2],[-22,22,0xd3b48f],[8,28,0xe0bfa0]].forEach(([x,z,c])=>this.house(x,z,c,.95));
      this.path([[-28,-4],[-17,-2],[-6,2],[6,6],[20,12],[28,20]],2.1);
      [-26,-14,14,26].forEach(x=>this.lamp(x,24));
      this.flowers(-24,-14);this.flowers(24,-18);this.bench(22,22,-.6);
    }
    if(id==='city'){
      // Outer blocks sit beyond the ring road, never over a driving lane.
      [[-32,8,13,0xb7b0a0],[32,-4,9,0xc3a99e],[-32,-17,11,0xa5b3c0],[32,16,10,0xcbbda0],[-14,33,12,0xb0bfbd],[13,34,9,0xd0b2a4]].forEach(([x,z,h,c])=>{
        this.shape('box',c,x,.26+h/2,z,5.4,h,4.7);this.shape('box',0xede3cf,x,h+.34,z,5.65,.2,5);
        for(let row=1;row<h-1;row+=2)for(const side of [-1,1])this.shape('box',0xffdca6,x+side*1.3,row+.56,z+2.37,1,1.05,.06,this.static,true);
        this.object(x,z,3.6,h+.5);
      });
      this.bench(-30,0,.5);this.bench(30,8,-.5);this.flowers(-30,-9);this.flowers(29,25);
      for(const [x,z] of [[-30,20],[30,-14],[-21,31],[21,31]])this.lamp(x,z);
    }
    if(id==='beach'){
      [[-27,18,1.1],[26,20,1.25],[-25,-2,1],[29,8,1.05],[15,24,1.15]].forEach(p=>this.palm(...p));
      for(const [x,z,color] of [[-20,16,0xd9a3a6],[22,10,0xe5b087]]){
        this.shape('cylinder',0xb39671,x,1.3,z,.04,2.2,.04);this.shape('cone',color,x,2.55,z,1.7,.75,1.7);
        this.shape('box',0xeee0bd,x,.26,z,2.8,.035,2);this.object(x,z,.22,3);
      }
      this.house(24,-2,0xe3cba2,.8);
      this.bench(-24,8,.8);this.path([[-26,6],[-16,4],[-6,4],[6,10],[18,18]],1.5,0xeedeb4);
    }
    if(id==='mountains'){
      for(const [x,z,s] of [[-28,14,1.3],[-25,26,1.1],[24,24,1.2],[29,-6,1.15],[-30,-4,1.25],[6,28,1.05]])this.tree(x,z,s,'pine');
      for(const [x,z,r] of [[-22,-26,2.2],[18,-24,2.6],[28,16,2]]){
        const y=this.height(x,z);this.shape('sphere',0x8f8d84,x,y+r*.45,z,r,r*.6,r*.85);this.object(x,z,r*.9,r);
      }
      this.path([[0,30],[-4,24],[-6,16],[-2,10],[0,10]],1.8);
      this.flowers(-24,6);this.bench(-26,18,.4);this.lamp(2,24);
    }
    if(id==='snowlands'){
      for(const [x,z,s] of [[-28,-4,1.3],[26,18,1.2],[-24,24,1.1],[12,28,1.25],[30,-2,1],[-8,30,1.15]])this.tree(x,z,s,'pine');
      this.house(25,-20,0xb08d6f,1,true);
      this.path([[0,30],[-4,22],[-9,14],[-13,4],[-13,-6]],1.8,0xc7d8df);
      for(const [x,z] of [[-22,10],[20,24],[6,28]])this.lamp(x,z);
      this.bench(-20,-2,.9);
    }
  }
  details(){
    // Small ground details stay off footpaths and the memory clearings.
    const nearPath=(x,z)=>this.paths.some(path=>path.points.slice(1).some(([bx,bz],i)=>{
      const [ax,az]=path.points[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
      return Math.hypot(x-ax-t*dx,z-az-t*dz)<path.width/2+.75;
    }));
    const count=this.mobile?150:270;
    for(let i=0;i<count;i++){
      const a=i*2.39996,r=5+Math.sqrt(i/count)*32,x=Math.sin(a)*r,z=Math.cos(a)*r;
      if(Math.hypot(x,z)>37||nearPath(x,z)||this.layout.blocked?.(x,z)||this.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+.7)||this.place.landmarks.some(p=>Math.hypot(x-p.x,z-p.z)<2.4)||this.gifts.some(g=>Math.hypot(x-g.x,z-g.z)<2.2))continue;
      const y=this.height(x,z);
      if(this.place.id==='snowlands')this.shape('sphere',i%3?0xeef2ed:0xbdced3,x,y+.08,z,.2,.13,.28);
      else if(this.place.id==='city'){if(i%6===0)this.shape('cylinder',0x9d927e,x,y+.28,z,.23,.5,.23);}
      else if(this.place.id==='beach'){if(z>5&&i%3===0)for(let j=0;j<3;j++)this.shape('cone',0xa7ac7c,x+j*.08,y+.18,z,.045,.35,.06);}
      else for(let j=0;j<3;j++){const blade=this.shape('sphere',i%2?0x94ab75:0x819969,x+j*.09,y+.15,z,.035,.19,.06);blade.rotation.z=(j-1)*.35;}
    }
    if(this.place.id==='village'||this.place.id==='mountains')for(let i=0;i<24;i++){
      const x=Math.sin(i*2.4)*(20+(i%5)*3.2),z=Math.cos(i*2.4)*(19+(i%4)*3.6);
      if(Math.abs(x)<6||this.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+2))continue;
      this.tree(x,z,.65+(i%4)*.18,this.place.id==='mountains'?'pine':'round');
    }
    if(this.place.id!=='snowlands'){
      this.birds=[];
      for(let i=0;i<4;i++){
        const g=new THREE.Group(),color=this.place.id==='beach'?0xf0eee3:0x65776e;
        this.shape('sphere',color,0,0,0,.085,.08,.24,g);const wings=[];
        for(const s of [-1,1])wings.push(this.shape('sphere',color,s*.22,.02,0,.28,.025,.1,g));
        this.group.add(g);this.birds.push({group:g,wings});
        this.dynamic.push(t=>{const a=t*.1+i*1.7;g.position.set(Math.sin(a)*26,8+i*.65,Math.cos(a)*21);g.rotation.y=a+Math.PI/2;wings.forEach((w,j)=>w.rotation.z=Math.sin(t*6+i)*.45*(j?1:-1));});
      }
    }
  }
  memoryMarkers(){
    for(const item of this.place.landmarks){
      const group=new THREE.Group();group.position.set(item.x,this.height(item.x,item.z),item.z);this.group.add(group);
      const ring=new THREE.Mesh(new THREE.RingGeometry(.58,.65,32),new THREE.MeshBasicMaterial({color:0xf1d29a,side:THREE.DoubleSide,transparent:true,opacity:.75}));ring.rotation.x=-Math.PI/2;ring.position.y=.07;group.add(ring);
      const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.22),new THREE.MeshStandardMaterial({color:0xf4d099,emissive:0xc39658,emissiveIntensity:.3,roughness:.5}));crystal.position.y=1.8;group.add(crystal);this.markers.push({item,group,ring,crystal});
    }
  }
  batch(){
    this.static.updateMatrixWorld(true);const groups=new Map();
    this.static.traverse(mesh=>{if(!mesh.isMesh)return;const copy=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);const g=copy.index?copy.toNonIndexed():copy;if(g!==copy)copy.dispose();const key=mesh.material.uuid;if(!groups.has(key))groups.set(key,{material:mesh.material,geometries:[]});groups.get(key).geometries.push(g);});
    this.static.traverse(mesh=>{if(mesh.isMesh&&!Array.from(this.geometry.values()).includes(mesh.geometry))mesh.geometry.dispose();});
    this.static.clear();
    for(const {material,geometries}of groups.values()){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(!merged)continue;const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;this.static.add(mesh);}
  }
  update(dt,night,rain,reduced,memories,position={x:0,z:0},extras={}){
    if(!reduced)this.time+=dt;const t=this.time;
    const {gifts=[],walkable,paused=false}=extras,step=paused?0:dt;
    this.dynamic.forEach(update=>update(t));
    const nearest=[...this.lamps].sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z));
    this.lights.forEach((light,i)=>{const site=nearest[i];light.position.set(site.x,this.height(site.x,site.z)+2.8,site.z);light.intensity=night*8;});
    this.birds?.forEach(b=>b.group.visible=night<.65&&rain<.6);
    for(const [key,mat]of this.materials)if(key.endsWith('/true'))mat.emissiveIntensity=.15+night*1.65;
    this.ground.material.roughness=1-rain*.24;
    this.markers.forEach(({item,crystal,ring},i)=>{const found=memories.includes(`${this.place.id}/${item.id}`);crystal.visible=!found;ring.material.opacity=found?.25:.65;crystal.position.y=1.8+(reduced?0:Math.sin(t*1.8+i)*.15);crystal.rotation.y=t*.5;});
    if(this.snow){this.snow.visible=!reduced;const pos=this.snow.geometry.attributes.position;for(let i=0;i<pos.count;i++){pos.setY(i,((i*.79-t*(.5+rain*.45))%15+15)%15);pos.setX(i,Math.sin(i*8.2)*37+Math.sin(t*.2+i)*.7);}pos.needsUpdate=true;}
    if(this.aurora){this.aurora.visible=night>.05;this.aurora.material.uniforms.night.value=night;this.aurora.material.uniforms.time.value=t;}
    for(const entry of this.riders){
      entry.rider.update(step);
      const {rider,group,lift=0,bob=0,roll=0,phase}=entry;
      const base=entry.altitude?entry.altitude(rider):this.height(rider.x,rider.z);
      group.position.set(rider.x,base+lift+(reduced?0:Math.sin(t*1.25+phase)*bob),rider.z);
      group.rotation.y=rider.heading;
      if(roll)group.rotation.z=reduced?0:Math.sin(t*.85+phase)*roll;
    }
    if(this.traffic){
      // Cars obey the signals, keep their distance, and wait for a bear crossing.
      this.signalCycle.update(step);
      for(const car of this.traffic)car.vehicle.update(step,this.signalCycle,this.vehicles,position);
      for(const {vehicle,group,wheels} of this.traffic){
        group.position.set(vehicle.x,this.height(vehicle.x,vehicle.z),vehicle.z);group.rotation.y=vehicle.heading;
        if(reduced)continue;
        for(const wheel of wheels){
          wheel.hub.rotation.x-=vehicle.speed*step/.3;
          if(wheel.front)wheel.hub.rotation.y=vehicle.steer;
        }
      }
      for(const signal of this.signals){
        const state=this.signalCycle.isGreen(signal.axis)?'green':this.signalCycle.isAmber(signal.axis)?'amber':'red';
        for(const lamp of signal.lamps)lamp.material=this.signalTone(lamp.userData.tone,lamp.userData.tone===state);
      }
    }
    this.gifts.forEach((gift,i)=>{
      const taken=gifts.includes(`${this.place.id}/${gift.item.id}`);
      gift.group.visible=!taken;
      if(taken)return;
      gift.box.position.y=.42+(reduced?0:Math.sin(t*1.9+i)*.09);
      gift.box.rotation.y=reduced?0:Math.sin(t*.6+i)*.25;
      gift.sparkle.position.y=1.35+(reduced?0:Math.sin(t*2.4+i)*.14);
      gift.sparkle.rotation.y=t;
      gift.ring.material.opacity=.45+(reduced?0:Math.sin(t*2+i)*.1);
    });
    // Local animals wander on the same collision map the bears walk on.
    if(walkable)for(const animal of this.animals){
      updateAnimal(animal,step,t,position,walkable,night,reduced);
      animal.group.position.y=this.height(animal.group.position.x,animal.group.position.z);
    }
  }
  nearbyFriend(position,night=0){
    return this.animals.filter(animal=>animal.brain.canGreet(position,night))
      .sort((a,b)=>Math.hypot(a.group.position.x-position.x,a.group.position.z-position.z)-Math.hypot(b.group.position.x-position.x,b.group.position.z-position.z))[0];
  }
  signalTone(tone,on){
    const key=`${tone}/${on}`;
    if(!this.signalSkins.has(key)){
      const base={red:0xd8584a,amber:0xe2a84f,green:0x6fb583}[tone];
      this.signalSkins.set(key,on
        ?new THREE.MeshStandardMaterial({color:base,emissive:base,emissiveIntensity:1.4,roughness:.35})
        :new THREE.MeshStandardMaterial({color:new THREE.Color(base).multiplyScalar(.22),roughness:.7}));
    }
    return this.signalSkins.get(key);
  }
  dispose(){
    // Animals share a palette with the forest, so they release only their own parts.
    for(const animal of this.animals)disposeAnimal(animal);
    this.animals=[];this.signalSkins.forEach(material=>material.dispose());this.signalSkins.clear();
    const geometries=new Set(this.geometry.values()),materials=new Set(this.materials.values());
    this.group.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.material)for(const m of Array.isArray(node.material)?node.material:[node.material])materials.add(m);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.group.removeFromParent();
  }
}
