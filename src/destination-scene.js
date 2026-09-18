import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { destinationHeight, destinationLayout } from './destinations.js';

// Scenery is built only for the destination being visited. Static details share
// material batches; moving props and memory markers remain separate.
export class DestinationScene {
  constructor(place,mobile=false){
    this.place=place;this.mobile=mobile;this.group=new THREE.Group();this.static=new THREE.Group();this.group.add(this.static);
    this.obstacles=[];this.cameraObstacles=[];this.markers=[];this.lamps=[];this.dynamic=[];this.materials=new Map();this.geometry=new Map();this.paths=[];
    this.layout=destinationLayout(place.id);this.time=0;
    this.ground=this.makeGround();
    if(place.id!=='city')this.path([[0,23],[0,12],[0,3],[0,-8],[0,-19]],2.6);
    if(place.id==='village')this.village();
    if(place.id==='city')this.city();
    if(place.id==='beach')this.beach();
    if(place.id==='mountains')this.mountains();
    if(place.id==='snowlands')this.snowlands();
    this.details();this.memoryMarkers();this.batch();
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
    const rings=40,segments=96,positions=[],colors=[],indices=[],base=new THREE.Color(this.place.ground);
    for(let ring=0;ring<=rings;ring++)for(let segment=0;segment<=segments;segment++){
      const angle=segment/segments*Math.PI*2,radius=29.6*ring/rings,x=Math.sin(angle)*radius,z=Math.cos(angle)*radius;
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
  path(points,width=2,color){
    this.paths.push({points,width});const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z))),p=[],index=[];
    for(let i=0;i<=90;i++){
      const at=curve.getPoint(i/90),side=curve.getTangent(i/90).cross(new THREE.Vector3(0,1,0)).normalize().multiplyScalar(width/2);
      for(const sign of [1,-1]){const x=at.x+side.x*sign,z=at.z+side.z*sign;p.push(x,this.height(x,z)+.025,z);}
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
    this.flowers(-13,-10);this.flowers(10,6);this.bench(-3,9,.2);[-20,-9,9,20].forEach(x=>this.lamp(x,5.8));
  }
  city(){
    this.path([[-25,8],[0,8],[24,8]],5.4,0x969da0);this.path([[0,24],[0,-24]],5.8,0x969da0);this.path([[-13,-11],[-8,-8],[0,-8]],2.6);
    for(let z=-21;z<=21;z+=4)this.shape('box',0xe9dbb5,0,.245,z,.14,.016,1.6);
    for(let x=-2;x<=2;x+=.7)this.shape('box',0xe6e6d8,x,.255,8,.35,.015,4);
    [[-10,16,6,0xd5afa1],[10,16,8,0x91b0b3],[-20,0,10,0xc7ba9d],[10,-15,11,0xa3acbb],[-20,-19,12,0x94a9ab],[20,-17,8,0xc7a69b],[0,-23,14,0xb5bdba]].forEach(([x,z,h,c])=>{
      this.shape('box',c,x,.2+h/2,z,5.4,h,4.7);this.shape('box',0xede3cf,x,h+.28,z,5.65,.2,5);
      for(let row=1;row<h-1;row+=2)for(const side of [-1,1])this.shape('box',0xffdca6,x+side*1.3,row+.5,z+2.37,1,1.05,.06,this.static,true);
      this.shape('box',0x77979b,x,1.1,z+2.4,1.2,1.8,.06);this.object(x,z,3.6,h+.5);
    });
    this.shape('cylinder',0xc9c4b2,0,.55,-2,2.1,.7,2.1);this.shape('cylinder',0x85b9c2,0,.93,-2,1.85,.04,1.85);this.shape('sphere',0xbee4db,0,1.55,-2,.55,.8,.55);this.object(0,-2,2.1,2.4);
    this.shape('box',0xc3ad89,0,3.8,-8,2.9,7.2,2.9);this.shape('cone',0x678184,0,8,-8,2.2,2,2.2);this.object(0,-8,2,9.4);
    const clock=this.shape('cylinder',0xf4e9ce,0,6.3,-6.51,.82,.09,.82);clock.rotation.x=Math.PI/2;
    this.shape('box',0x647572,0,6.58,-6.43,.08,.55,.08);const hand=this.shape('box',0x647572,.2,6.3,-6.42,.5,.08,.08);hand.rotation.z=.35;
    for(const x of [22.3,23.5])this.shape('box',0x737e7f,x,.24,0,.065,.07,43);
    const tram=new THREE.Group();this.group.add(tram);this.shape('box',0x709c94,0,1.4,0,2,2,4,tram);this.shape('box',0xe9d7ad,0,2.5,0,2.15,.25,4.2,tram);
    for(const z of [-1.25,0,1.25])this.shape('box',0xc5dfe2,-1.02,1.8,z,.04,.72,.8,tram);
    for(const x of [-.85,.85])for(const z of [-1.25,1.25]){const wheel=this.shape('cylinder',0x53646a,x,.4,z,.35,.12,.35,tram);wheel.rotation.z=Math.PI/2;}
    this.dynamic.push(t=>{tram.position.set(22.9,0,Math.sin(t*.08)*17);});
    this.shape('box',0x77969d,15,2.1,6,3,.2,1.4);this.shape('cylinder',0x637e7d,13.6,1.2,6,.055,2.2,.055);this.object(15,6,.7,2.4);
    for(const [x,z]of [[-16,-14],[-9,-16],[-16,-6]])this.tree(x,z,.85);this.flowers(-10,-10);this.bench(-15,-9);this.bench(7,3);
    for(const x of [-4,4])for(const z of [-17,1,18])this.lamp(x,z);
  }
  palm(x,z,size=1){
    const y=this.height(x,z);this.shape('cylinder',0xb4936b,x,y+2*size,z,.15*size,4*size,.17*size);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7,leaf=this.shape('sphere',i%2?0x75a478:0x598e71,x+Math.sin(a)*.9*size,y+4*size,z+Math.cos(a)*.9*size,.28*size,.13*size,1.6*size);leaf.rotation.y=a;leaf.rotation.x=.18;}
    this.object(x,z,.26*size,4.8*size);this.cameraObstacles.push({x,z,y:y+4*size,radius:1.8*size});
  }
  beach(){
    this.path([[-16,0],[-8,4],[0,7],[13,7],[21,12]],1.65,0xeedeb4);
    const ocean=new THREE.Mesh(new THREE.PlaneGeometry(160,90),new THREE.MeshStandardMaterial({color:0x5cabb5,roughness:.32,metalness:.08}));ocean.rotation.x=-Math.PI/2;ocean.position.set(0,.07,-55);this.group.add(ocean);
    for(let i=0;i<7;i++){
      const wave=new THREE.Mesh(new THREE.PlaneGeometry(90,.16+i*.12),new THREE.MeshBasicMaterial({color:0xd5efe1,transparent:true,opacity:.45,depthWrite:false}));wave.rotation.x=-Math.PI/2;this.group.add(wave);
      this.dynamic.push(t=>{wave.position.set(Math.sin(t*.35+i)*2,.085+i*.002,-10.7-i*3+Math.sin(t*.5+i)*.65);wave.material.opacity=.24+Math.sin(t*.5+i)*.14;});
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
      const a=Math.PI*.5+i/9*Math.PI,x=Math.sin(a)*37,z=Math.cos(a)*37-5,h=15+(i%4)*4,r=7+(i%3);
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
    const positions=[];for(let i=0;i<(this.mobile?100:210);i++)positions.push(Math.sin(i*8.2)*27,(i*.79)%15,Math.cos(i*3.17)*27);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.snow=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffffff,size:.075,transparent:true,opacity:.82,depthWrite:false}));this.snow.frustumCulled=false;this.group.add(this.snow);
    const g=new THREE.PlaneGeometry(65,12,40,6);const material=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:{time:{value:0},night:{value:0}},vertexShader:'varying vec2 vUv; uniform float time; void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*.13+time*.2)*3.;p.y+=sin(p.x*.19+time*.15)*1.4;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'varying vec2 vUv;uniform float time;uniform float night;void main(){float glow=sin(vUv.x*28.+sin(vUv.y*9.+time*.12))*0.18+0.55;float fade=sin(vUv.y*3.14159)*sin(vUv.x*3.14159);gl_FragColor=vec4(mix(vec3(.32,.76,.66),vec3(.57,.48,.81),vUv.y),fade*glow*night*.52);}',toneMapped:false});
    this.aurora=new THREE.Mesh(g,material);this.aurora.position.set(0,15,-31);this.group.add(this.aurora);
  }
  details(){
    // Small ground details stay off footpaths and the memory clearings.
    const nearPath=(x,z)=>this.paths.some(path=>path.points.slice(1).some(([bx,bz],i)=>{
      const [ax,az]=path.points[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
      return Math.hypot(x-ax-t*dx,z-az-t*dz)<path.width/2+.75;
    }));
    for(let i=0;i<(this.mobile?95:160);i++){
      const a=i*2.39996,r=5+Math.sqrt(i/160)*23,x=Math.sin(a)*r,z=Math.cos(a)*r;
      if(Math.hypot(x,z)>28||nearPath(x,z)||this.layout.blocked?.(x,z)||this.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+.7)||this.place.landmarks.some(p=>Math.hypot(x-p.x,z-p.z)<2.4))continue;
      const y=this.height(x,z);
      if(this.place.id==='snowlands')this.shape('sphere',i%3?0xeef2ed:0xbdced3,x,y+.08,z,.2,.13,.28);
      else if(this.place.id==='city'){if(i%6===0)this.shape('cylinder',0x9d927e,x,y+.28,z,.23,.5,.23);}
      else if(this.place.id==='beach'){if(z>5&&i%3===0)for(let j=0;j<3;j++)this.shape('cone',0xa7ac7c,x+j*.08,y+.18,z,.045,.35,.06);}
      else for(let j=0;j<3;j++){const blade=this.shape('sphere',i%2?0x94ab75:0x819969,x+j*.09,y+.15,z,.035,.19,.06);blade.rotation.z=(j-1)*.35;}
    }
    if(this.place.id==='village'||this.place.id==='mountains')for(let i=0;i<14;i++){
      const x=Math.sin(i*2.4)*25,z=Math.cos(i*2.4)*24;
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
        this.dynamic.push(t=>{const a=t*.1+i*1.7;g.position.set(Math.sin(a)*19,8+i*.65,Math.cos(a)*15);g.rotation.y=a+Math.PI/2;wings.forEach((w,j)=>w.rotation.z=Math.sin(t*6+i)*.45*(j?1:-1));});
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
  update(dt,night,rain,reduced,memories,position={x:0,z:0}){
    if(!reduced)this.time+=dt;const t=this.time;
    this.dynamic.forEach(update=>update(t));
    const nearest=[...this.lamps].sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z));
    this.lights.forEach((light,i)=>{const site=nearest[i];light.position.set(site.x,this.height(site.x,site.z)+2.8,site.z);light.intensity=night*8;});
    this.birds?.forEach(b=>b.group.visible=night<.65&&rain<.6);
    for(const [key,mat]of this.materials)if(key.endsWith('/true'))mat.emissiveIntensity=.15+night*1.65;
    this.ground.material.roughness=1-rain*.24;
    this.markers.forEach(({item,crystal,ring},i)=>{const found=memories.includes(`${this.place.id}/${item.id}`);crystal.visible=!found;ring.material.opacity=found?.25:.65;crystal.position.y=1.8+(reduced?0:Math.sin(t*1.8+i)*.15);crystal.rotation.y=t*.5;});
    if(this.snow){this.snow.visible=!reduced;const pos=this.snow.geometry.attributes.position;for(let i=0;i<pos.count;i++){pos.setY(i,((i*.79-t*(.5+rain*.45))%15+15)%15);pos.setX(i,Math.sin(i*8.2)*27+Math.sin(t*.2+i)*.7);}pos.needsUpdate=true;}
    if(this.aurora){this.aurora.visible=night>.05;this.aurora.material.uniforms.night.value=night;this.aurora.material.uniforms.time.value=t;}
  }
  dispose(){
    const geometries=new Set(this.geometry.values()),materials=new Set(this.materials.values());
    this.group.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.material)for(const m of Array.isArray(node.material)?node.material:[node.material])materials.add(m);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.group.removeFromParent();
  }
}
