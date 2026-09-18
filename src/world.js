import * as THREE from 'three';
import { currentScreen, forestQuality } from './screen-support.js';
import { createAnimal, updateAnimal } from './wildlife.js';
import { animateBearPose, turnBear } from './bear-motion.js';
import { BearExpression, applyBearFace, lookAtBearTarget } from './bear-expression.js';
import { ForestAtmosphere } from './atmosphere.js';
import { Companion, companionStart } from './companion.js';
import { createForestTree, treeDimensions, buildFlowerBeds, buildButterflies, buildUnderstory, updateVegetation, batchFoliageMaterial } from './vegetation.js';
import { ForestSky } from './sky.js';
import { WeatherState } from './weather-state.js';
import { ForestRain } from './rain.js';
import { ForestSurfaces } from './forest-surfaces.js';
import { ForestMeadow, meadowGround, meadowSpace } from './forest-floor.js';
import { ForestSunlight } from './forest-sunlight.js';
import { ForestReactions } from './forest-reactions.js';
import { BearUmbrella, umbrellaAllowed } from './bear-umbrella.js';
import { RoadLighting } from './road-lighting.js';
import { FollowCamera } from './follow-camera.js';
import { DestinationTravel } from './destination-travel.js';
import { buildMoonNest } from './moon-nest.js';
import { MoonJourney } from './moon-journey.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GIFTS, BUBU, START, DUDU_NEST, BUBU_NEST, MOON_NEST, WORLD_RADIUS, TRAILS, PONDS, clampZoom, isWalkable, findPath, moveWithCollisions, shouldRevealBubu, canCelebrate } from './game-state.js';

const COLORS={grass:0x81984e,edge:0x657f46,path:0xcbb78e,trunk:0x806443,leaf:0x62894b,darkLeaf:0x426b49,lightLeaf:0x89a751,pink:0xdab1b0,cream:0xfff5dc,water:0x71a7a0};
const materials=new Map();
function mat(color, options={}) {
  const key=JSON.stringify([color,options]);
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:1,...options}));
  return materials.get(key);
}
const sphereGeo=new THREE.SphereGeometry(1,20,14);
const petalGeo=new THREE.IcosahedronGeometry(1,0);
const leafGeo=new THREE.IcosahedronGeometry(1,1);
const boxGeo=new THREE.BoxGeometry(1,1,1);
function mesh(geo,color,parent,x=0,y=0,z=0,scale=[1,1,1],options={}) {
  const m=new THREE.Mesh(geo,mat(color,options));m.position.set(x,y,z);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function ball(parent,color,x,y,z,sx,sy=sx,sz=sx){return mesh(sphereGeo,color,parent,x,y,z,[sx,sy,sz]);}
function box(parent,color,x,y,z,sx,sy,sz){return mesh(boxGeo,color,parent,x,y,z,[sx,sy,sz]);}
function cylinder(parent,color,x,y,z,rt,rb,h,segments=9){return mesh(new THREE.CylinderGeometry(rt,rb,h,segments),color,parent,x,y,z);}
function line(parent,points,color,radius=.035){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const obj=mesh(new THREE.TubeGeometry(curve,Math.max(8,points.length*6),radius,5,false),color,parent);return obj;}
function seeded(seed) { return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}; }
const rand=seeded(1287);
export const PATH_POINTS=TRAILS[0].points;

// Soft, rounded plush forms based on the user's Dar3t6FNPJT reel.
const plushGeometry=new THREE.SphereGeometry(1,36,24);
const plushPositions=plushGeometry.attributes.position;
for(let i=0;i<plushPositions.count;i++){
  const soften=n=>Math.sign(n)*Math.abs(n)**.88;
  plushPositions.setXYZ(i,soften(plushPositions.getX(i)),soften(plushPositions.getY(i)),soften(plushPositions.getZ(i)));
}
plushGeometry.computeVertexNormals();
const furMaterials=new Map();
let furTexture;
function plushMaterial(color){
  if(furMaterials.has(color))return furMaterials.get(color);
  if(!furTexture){
    const pixels=new Uint8Array(128*128*4);let seed=713;
    for(let i=0;i<pixels.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=130+(seed>>>25);pixels[i]=pixels[i+1]=pixels[i+2]=value;pixels[i+3]=255;}
    furTexture=new THREE.DataTexture(pixels,128,128,THREE.RGBAFormat);furTexture.wrapS=furTexture.wrapT=THREE.RepeatWrapping;furTexture.repeat.set(5,5);furTexture.generateMipmaps=true;furTexture.minFilter=THREE.LinearMipmapLinearFilter;furTexture.magFilter=THREE.LinearFilter;furTexture.needsUpdate=true;
  }
  const material=new THREE.MeshPhysicalMaterial({color,roughness:.96,sheen:.65,sheenColor:new THREE.Color(color).lerp(new THREE.Color(0xfff7e9),.55),sheenRoughness:.9,bumpMap:furTexture,bumpScale:.018});
  furMaterials.set(color,material);return material;
}
export function createBear(white=false) {
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  root.name=white?'Bubu':'Dudu';
  root.scale.setScalar(white?.66:.68);
  const fur=white?0xfffcf5:0xc18a59,dark=0x493028,blush=white?0xe6acaa:0xeab65f;
  const plush=(parent,color,x,y,z,sx,sy=sx,sz=sx)=>{
    const part=new THREE.Mesh(plushGeometry,plushMaterial(color));part.position.set(x,y,z);part.scale.set(sx,sy,sz);part.receiveShadow=true;parent.add(part);return part;
  };
  plush(body,fur,0,.66,0,.57,.59,.46);
  const head=new THREE.Group();head.name='plush-head';head.position.y=1.62;body.add(head);
  plush(head,fur,0,0,0,.96,.79,.69);
  // Project the low-set face onto the head so its details sit on the plush,
  // including when the bears turn sideways in the forest.
  const faceZ=(x,y)=>.69*Math.max(.01,1-Math.abs(x/.96)**(2/.88)-Math.abs(y/.79)**(2/.88))**(.88/2);
  const eyes=[],happyEyes=[],ears=[],cheeks=[],brows=[];let pack;
  [-1,1].forEach(side=>{
    const ear=new THREE.Group();ear.position.set(side*.68,.61,-.06);head.add(ear);ears.push(ear);
    plush(ear,white?dark:fur,0,0,0,.225,.23,.17);
    plush(ear,white?0x6c4c3d:0x805236,0,0,.172,.137,.146,.025);
    const eye=ball(head,0x2f211f,side*.23,-.285,faceZ(side*.23,-.285)+.012,.060,.072,.029);eye.name='button-eye';eye.userData.side=side;eyes.push(eye);
    ball(eye,0xfff9ec,-.22,.27,.87,.20,.17,.14);
    const happy=new THREE.Group();happy.position.set(side*.23,-.292,faceZ(side*.23,-.27)+.035);head.add(happy);
    line(happy,[[-.07,0,0],[0,.032,.006],[.07,0,0]],0x382720,.018);happy.visible=false;happyEyes.push(happy);
    const brow=new THREE.Group();brow.position.set(side*.23,-.14,faceZ(side*.23,-.09)+.027);head.add(brow);
    line(brow,[[-.055,0,0],[0,.015,.003],[.055,0,0]],0x493028,.011);brow.visible=false;brows.push(brow);
    const cheek=plush(head,blush,side*.52,-.405,faceZ(side*.52,-.405)+.018,.158,.155,.03);cheek.rotation.y=side*.25;cheek.rotation.x=.18;cheeks.push(cheek);
  });
  plush(head,white?0xfff6e8:0xd9a46e,0,-.375,.661,.105,.058,.035);
  ball(head,dark,0,-.362,.705,.028,.020,.012);
  const smilePoints=[[-.076,-.385],[-.061,-.43],[-.025,-.432],[0,-.405],[.025,-.432],[.061,-.43],[.076,-.385]];
  const mouth=line(head,smilePoints.map(([x,y])=>[x,y-.025,faceZ(x,y-.025)+.115]),0x382720,.017);
  const openMouth=mesh(new THREE.CircleGeometry(1,24),0x4d292b,head,0,-.468,.729,[.06,.06,1]);openMouth.visible=false;
  const tongue=mesh(new THREE.CircleGeometry(1,16),0xe4a19b,openMouth,0,-.4,.006,[.58,.24,1]);
  // Small plush tufts with the blue/red bands visible in the reference.
  const tuft=new THREE.Group();tuft.position.set(0,.775,-.02);head.add(tuft);
  cylinder(tuft,white?0x9d5b57:0x4b798b,0,.04,0,.087,.087,.055,16);
  [-1,0,1].forEach(i=>{const lobe=plush(tuft,fur,i*.052,.13+(i===0?.035:0),0,.054,.105,.055);lobe.rotation.z=-i*.23;});
  const arms=[],legs=[],forearms=[];
  [-1,1].forEach(side=>{
    const arm=new THREE.Group();arm.position.set(side*.52,.86,0);body.add(arm);
    plush(arm,fur,side*.02,-.085,.015,.175,.18,.19);
    const elbow=new THREE.Group();elbow.position.set(side*.025,-.17,.025);arm.add(elbow);forearms.push(elbow);
    plush(elbow,fur,0,-.055,.01,.185,white?.15:.18,.2);
    if(white)plush(elbow,dark,0,-.155,.035,.15,.075,.16);
    arms.push(arm);
    const leg=new THREE.Group();leg.position.set(side*.28,.24,0);body.add(leg);
    plush(leg,fur,0,white?-.025:-.055,.025,.22,white?.175:.22,.25);
    if(white)plush(leg,dark,0,-.17,.065,.205,.078,.235);
    legs.push(leg);
  });
  plush(body,fur,0,.47,-.47,.15,.16,.15);
  if(white){
    const bow=new THREE.Group();bow.name='bubu-bow-tie';bow.position.set(0,.93,.49);body.add(bow);
    const ribbon=mesh(new THREE.TorusGeometry(.41,.034,6,36),dark,body,0,.97,0);ribbon.rotation.x=Math.PI/2;ribbon.scale.set(1.14,1,1);
    [-1,1].forEach(side=>{const loop=plush(bow,dark,side*.115,0,0,.135,.093,.052);loop.rotation.z=side*.28;});
    plush(bow,0x382821,0,0,.04,.065,.065,.045);
  }else{
    // Keep Dudu's working gift bag and add the reel's little white-bear charm.
    pack=plush(body,0x859165,0,.76,-.49,.46,.43,.26);
    box(body,0xa1a276,0,1.08,-.72,.65,.10,.12);
    plush(body,0x9da173,0,.64,-.73,.31,.20,.045);
    box(body,0xc3b085,0,.85,-.786,.10,.17,.028);
    [-1,1].forEach(side=>line(body,[[side*.35,1.1,-.3],[side*.45,1.04,.22],[side*.38,.62,.39]],0x78845d,.035));
    const charm=new THREE.Group();charm.name='bubu-keepsake';charm.position.set(-.40,.54,.43);charm.rotation.z=-.18;body.add(charm);
    line(body,[[-.40,.92,.4],[-.44,.8,.46],[-.40,.74,.43]],0xaa875b,.014);
    plush(charm,0xfff7e9,0,.04,0,.092,.13,.067);plush(charm,0xfff7e9,0,.205,.016,.13,.115,.072);
    [-1,1].forEach(side=>{plush(charm,0xfff7e9,side*.10,.29,.012,.045);plush(charm,0xfff7e9,side*.108,.085,0,.044,.075,.04);plush(charm,0xfff7e9,side*.052,-.088,.02,.046,.064,.045);ball(charm,dark,side*.043,.21,.087,.012);});
    ball(charm,dark,0,.17,.09,.017,.012,.008);
  }
  root.userData={body,head,arms,forearms,legs,eyes,happyEyes,ears,cheeks,brows,mouth,openMouth,tongue,pack,expression:new BearExpression(),blinkOffset:white?2.2:0};return root;
}

export function animateBearFace(bear,time,happy=false,reducedMotion=false){
  if(bear.userData.blenderDudu)bear.userData.blenderDudu.update(time,reducedMotion);
  else applyBearFace(bear,time,happy,reducedMotion);
}

function createGift(color) {
  const group=new THREE.Group();
  box(group,color,0,.48,0,.92,.8,.8);
  box(group,color,0,.9,0,1.02,.18,.9);
  box(group,0xffecc8,0,.51,.412,.14,.78,.025);
  box(group,0xffecc8,.468,.5,0,.026,.8,.13);
  box(group,0xffecc8,0,1,0,.15,.025,.9);
  box(group,0xffecc8,0,1,0,1.02,.027,.13);
  const loopGeo=new THREE.TorusGeometry(.16,.038,6,12);
  const left=mesh(loopGeo,0xffecc8,group,-.15,1.12,0);left.scale.set(1.2,.7,1);left.rotation.z=-.4;
  const right=mesh(loopGeo,0xffecc8,group,.15,1.12,0);right.scale.set(1.2,.7,1);right.rotation.z=.4;
  return group;
}

export class ForestWorld {
  constructor(container, state) {
    this.quality=forestQuality(currentScreen().phone,devicePixelRatio);
    this.container=container;this.state=state;this.obstacles=[];this.gifts=new Map();this.butterflies=[];this.floaties=[];this.flowers=[];this.animals=[];this.balloons=[];this.ducks=[];this.events=[];
    this.story=state.departed?'exploring':'ready';this.storyTime=0;this.zoomView=27;this.overview=false;
    this.playing=false;this.time=0;this.walkTime=0;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.timeOfDay='day';this.nightBlend=0;this.needsRender=false;this.treeKinds={};this.treeSizes=[];this.blossomSites=[];
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xc6d3b7,30,112);
    this.sky=new ForestSky();this.weather=new WeatherState();this.surfaces=new ForestSurfaces();
    this.overheadCamera=new THREE.OrthographicCamera(-30,30,25,-25,.1,280);
    this.follow=new FollowCamera();this.camera=this.overheadCamera;this.cameraMode='third-person';this.cameraObstacles=[];
    this.moonCamera=new THREE.PerspectiveCamera(54,1,.08,180);this.moonLook=new THREE.Vector3();this.moonJourney=null;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;
    this.renderer.autoClear=false;
    container.appendChild(this.renderer.domElement);
    this.ambient=new THREE.HemisphereLight(0xeaf1df,0x496649,1.35);this.scene.add(this.ambient);
    const sun=new THREE.DirectionalLight(0xffdf9f,3.1);this.sunLight=sun;sun.castShadow=true;
    sun.position.set(-38,56,28);sun.shadow.mapSize.set(this.quality.shadowSize,this.quality.shadowSize);sun.shadow.camera.left=-49;sun.shadow.camera.right=49;sun.shadow.camera.top=49;sun.shadow.camera.bottom=-49;sun.shadow.camera.far=150;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.shadow.radius=3;this.scene.add(sun);
    const fill=new THREE.DirectionalLight(0xb9d6cc,.45);this.fillLight=fill;fill.position.set(20,12,-20);this.scene.add(fill);
    this.land=new THREE.Group();this.scene.add(this.land);
  }
  async initialize(progress){
    const state=this.state;
    await progress(18,'Laying the winding forest paths…');
    this.buildGround();this.buildPaths();PONDS.forEach(pond=>this.buildPond(pond));
    await progress(32,'Making two little homes…');
    this.buildPicnic();this.buildCottage();this.buildNests();
    this.cameraObstacles.push({x:-16,y:1.8,z:-5,radius:1.9},...[DUDU_NEST,BUBU_NEST].map(n=>({...n,y:2.05,radius:2.9})));
    await progress(46,'Growing trees and hanging blossoms…');
    this.buildTrees();
    this.moonNest=buildMoonNest(this.land,this.obstacles,this.cameraObstacles);
    await progress(60,'Planting flowers and waking the butterflies…');
    this.buildDetails();this.buildGifts();this.buildFields();
    this.reactions=new ForestReactions(this.scene,this.heartGeo);
    await progress(66,'Fluffing the sheep’s wool…');
    try{
      const {loadSheepTemplate,attachSheepModel}=await import('./blender-sheep.js');
      const sheep=await loadSheepTemplate();
      this.animals.filter(animal=>animal.kind==='sheep').forEach(animal=>attachSheepModel(animal,sheep));
    }catch(error){this.wildlifeLoadError='The sheep’s new wool could not load. Their usual look is ready to play.';console.warn(this.wildlifeLoadError,error);}
    this.flowerBeds=buildFlowerBeds(this.land,this.obstacles);this.butterflies=buildButterflies(this.scene,this.flowerBeds.beds);
    await progress(72,'Wrapping presents and lighting the lanterns…');
    this.roadLighting=new RoadLighting(this.scene,this.land,this.obstacles);
    this.roadLighting.sites.forEach(site=>this.cameraObstacles.push({...site,minY:.2,maxY:3.4,radius:.22}));
    // New roadside posts may occupy an old save's exact position. Move only to
    // the closest free patch, preserving the player's gifts and story progress.
    if(!isWalkable(state.position.x,state.position.z,this.obstacles)){
      const origin={...state.position};let free=null;
      for(let r=.25;r<=3&&!free;r+=.25)for(let i=0;i<16;i++){const a=i/16*Math.PI*2,x=origin.x+Math.cos(a)*r,z=origin.z+Math.sin(a)*r;if(isWalkable(x,z,this.obstacles)){free={x,z};break;}}
      state.position=free||{...START};
    }
    this.dudu=createBear();
    // The first Blender character is available for review without changing the
    // established default cast. Only this preview downloads the extra asset.
    if(new URLSearchParams(window.location.search).get('dudu')==='blender'){
      await progress(76,'Getting Dudu’s new look ready…');
      try{
        const {loadDuduModel,attachDuduModel}=await import('./blender-dudu.js');
        attachDuduModel(this.dudu,await loadDuduModel());
      }catch(error){this.characterLoadError='Dudu’s new look could not load. His usual look is ready to play.';console.warn(this.characterLoadError,error);}
    }
    this.dudu.position.set(state.position.x,0,state.position.z);this.dudu.rotation.y=.6;this.scene.add(this.dudu);
    this.bubu=createBear(true);this.bubu.position.set(BUBU.x,.25,BUBU.z);this.bubu.rotation.y=.35;this.scene.add(this.bubu);
    this.bubu.visible=state.bubuArrived;this.dudu.visible=state.departed;
    this.companion=null;
    if(state.completed)this.beginTogether();
    [this.dudu,this.bubu].forEach(bear=>{
      bear.traverse(node=>{if(node.isMesh)node.castShadow=false;});
      const shadow=new THREE.Mesh(new THREE.CircleGeometry(.68,28),new THREE.MeshBasicMaterial({color:0x56683e,transparent:true,opacity:.18,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;shadow.scale.y=.8;bear.add(shadow);
      bear.userData.groundShadow=shadow;
      bear.userData.umbrella=new BearUmbrella(bear,bear===this.bubu);
    });
    await progress(80,'Getting Dudu ready for his adventure…');
    this.batchStaticGeometry();
    this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    this.clickMarker=new THREE.Mesh(new THREE.RingGeometry(.25,.34,28),new THREE.MeshBasicMaterial({color:0xfff3d7,transparent:true,opacity:.8,side:THREE.DoubleSide}));
    this.clickMarker.rotation.x=-Math.PI/2;this.clickMarker.visible=false;this.scene.add(this.clickMarker);
    this.guidance=new THREE.InstancedMesh(new THREE.CircleGeometry(.13,10),new THREE.MeshBasicMaterial({color:0xc49653,transparent:true,opacity:.85,depthWrite:false}),160);
    this.guidance.count=0;this.guidance.frustumCulled=false;this.scene.add(this.guidance);
    this.atmosphere=new ForestAtmosphere(this.scene,this.blossomSites);
    this.sunlight=new ForestSunlight(this.scene);
    this.rain=new ForestRain(this.scene,currentScreen().phone);
    this.cameraTarget=new THREE.Vector3();this.viewSize=48;this.resize();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.container);
    this.setCamera(true);
    this.travel=new DestinationTravel(this);
  }
  get away(){return !!this.travel?.away;}
  walkable(x,z){return isWalkable(x,z,this.obstacles,this.navigation);}
  findPath(start,goal){return findPath(start,goal,this.obstacles,this.navigation);}
  move(position,dx,dz){return moveWithCollisions(position,dx,dz,this.obstacles,this.navigation);}
  async warmUp(progress){
    await progress(88,'Adding the last little rays of sunshine…');
    this.updateLighting(0);
    await this.renderer.compileAsync(this.scene,this.follow.camera);
    await this.renderer.compileAsync(this.sky.scene,this.sky.camera);
    await progress(96,'Taking our first peek into the forest…');
    this.update(0);
  }
  buildGround() {
    const soil=cylinder(this.land,0xb1b384,0,-1.13,0,40,38.4,2.6,96);soil.receiveShadow=true;
    cylinder(this.land,COLORS.edge,0,-.15,0,40.18,40,.62,96);
    const ground=mesh(meadowGround(),0xffffff,this.land,0,.18,0);ground.castShadow=false;this.surfaces.apply(ground);
    // A soft outer ground catches the island's shadow and blends into the page.
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.ShadowMaterial({color:0x344837,opacity:.13}));floor.position.y=-2.6;floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;this.scene.add(floor);
  }
  path(points,width=1.9) {
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,.215,z)));
    const positions=[],indices=[],up=new THREE.Vector3(0,1,0);
    for(let i=0;i<=160;i++){
      const p=curve.getPoint(i/160),side=curve.getTangent(i/160).cross(up).normalize().multiplyScalar(width/2);
      positions.push(p.x+side.x,p.y,p.z+side.z,p.x-side.x,p.y,p.z-side.z);
      if(i<160){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const path=mesh(geometry,COLORS.path,this.land,0,0,0,[1,1,1],{side:THREE.DoubleSide});path.castShadow=false;this.surfaces.apply(path,'path');
  }
  buildPaths(){TRAILS.forEach(trail=>this.path(trail.points,trail.width));}
  buildPond(config) {
    const pond=new THREE.Group();pond.position.set(config.x,.22,config.z);this.land.add(pond);
    const bank=mesh(new THREE.CircleGeometry(1,48),0xd9d6ac,pond,0,0,0,[5.4,4.05,1]);bank.rotation.x=-Math.PI/2;bank.castShadow=false;this.surfaces.apply(bank,'path');
    const water=mesh(new THREE.CircleGeometry(1,48),COLORS.water,pond,0,.012,0,[4.95,3.6,1],{roughness:.38,metalness:.03});water.rotation.x=-Math.PI/2;water.castShadow=false;
    this.water=water;
    for(let i=0;i<13;i++){
      const x=(rand()-.5)*7,z=(rand()-.5)*4.7;
      if(Math.abs(z)<.9)continue;
      const ripple=mesh(new THREE.TorusGeometry(.25+rand()*.4,.017,4,28),0xc1d7c0,pond,x,.032,z);ripple.rotation.x=-Math.PI/2;ripple.scale.y=.65;ripple.castShadow=false;ripple.userData.dynamic=true;this.floaties.push(ripple);
    }
    for(let i=0;i<6;i++){
      const a=rand()*Math.PI*2,x=Math.cos(a)*3.6,z=Math.sin(a)*2.4;if(Math.abs(z)<1)continue;
      const pad=mesh(new THREE.CircleGeometry(.32,18,0,Math.PI*1.85),0x83a881,pond,x,.06,z);pad.rotation.x=-Math.PI/2;pad.rotation.z=rand()*6;pad.castShadow=false;
      if(i%2===0)ball(pond,0xf3d6c4,x,.11,z,.1,.07,.1);
    }
    // The bridge is walkable in the navigation model as well as in the scene.
    for(let i=0;i<23;i++)box(pond,i%3?0xc1a274:0xb9996d,-5.1+i*.465,.28,0,.44,.18,1.9);
    [-.98,.98].forEach(z=>{
      [-4.6,-1.6,1.6,4.6].forEach(x=>cylinder(pond,0x96764e,x,.72,z,.07,.08,1.1));
      line(pond,[[-4.6,1.13,z],[-1.6,1.01,z],[1.6,1.01,z],[4.6,1.13,z]],0xa08155,.055);
    });
    const duck=new THREE.Group();duck.position.set(-1.2,.1,2);pond.add(duck);
    ball(duck,0xffefd0,0,.13,0,.29,.2,.2);ball(duck,0xffefd0,.21,.36,0,.16);box(duck,0xce9c51,.37,.34,0,.15,.06,.09);ball(duck,0x5f5948,.27,.4,.12,.023);
    this.ducks.push(duck);duck.userData.dynamic=true;
  }
  tree(x,z,size=1,type='round',color) {
    const kind=color===COLORS.pink?'blossom':type==='round'?'oak':type;
    const palette={blossom:0x718f4e,umbrella:0x829b49,willow:0x718f58,birch:0x8aa65e,oak:color||COLORS.leaf,pine:color||COLORS.darkLeaf};
    const seed=Math.round(x*173+z*367+42000),group=createForestTree(kind,palette[kind],seed,this.quality.foliageDetail),dimensions=treeDimensions(kind,size,seed);
    group.position.set(x,.18,z);group.rotation.y=rand()*6.28;group.scale.set(dimensions.width,dimensions.height,dimensions.width);this.land.add(group);
    group.updateWorldMatrix(true,true);
    const bounds=new THREE.Box3().setFromObject(group);
    this.treeSizes.push({kind,x,z,height:bounds.max.y-bounds.min.y,width:bounds.max.x-bounds.min.x});
    this.treeKinds[kind]=(this.treeKinds[kind]||0)+1;
    if(kind==='blossom')this.blossomSites.push({x,z,size:dimensions.width});
    group.traverse(node=>{if(!node.userData.cameraCrown)return;const box=new THREE.Box3().setFromObject(node),center=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3());this.cameraObstacles.push({x:center.x,y:center.y,z:center.z,radius:Math.max(extent.x,extent.y,extent.z)*.53});});
    this.cameraObstacles.push({x,z,minY:.18,maxY:2.8*dimensions.height,radius:.3*dimensions.width});
    this.obstacles.push({x,z,radius:.29*dimensions.width});return group;
  }
  buildTrees() {
    const trees=[[-19,-3,1.5],[-18,-9,1.7],[-15,-13,1.45],[-11,-16,1.3],[-7,-18,1.55],[-4,-20,1.1],[5,-20,1.2],[9,-17,1.5],[13,-14,1.4],[18,-10,1.55],[20,-5,1.25],[20,1,1.4],[18,7,1.4],[16,12,1.2],[12,16,1.1],[7,19,1],[-1,20,1.1],[-6,19,1.1],[-11,17,1.1],[-15,13,1.2],[-19,8,1.3],[-20,2,1.1],[-18,3,1.05],[-16,-10,1.1],[-10,-12,1.2],[-6,-15,1.15],[-1,-8,1.2],[4,-10,1.1],[8,-7,1.3],[16,-1,1.25],[11,2,1.1],[6,4,1.15],[5,16,.9],[-5,14,1],[-4,7,1.15],[-16,5,1],[-15,9,.9],[-7,-6,1.1],[3,-4,1],[-2,-4,1.05],[6,-17,.9],[-10,15,.8]];
    trees.forEach(([x,z,s],i)=>this.tree(x,z,s,['pine','oak','blossom','umbrella','willow','birch'][i%6],[COLORS.leaf,COLORS.darkLeaf,COLORS.lightLeaf,0x88a86b][i%4]));
    for(let i=0;i<74;i++){
      const angle=i/74*Math.PI*2,radius=34+rand()*4,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      if(Math.hypot(x-DUDU_NEST.x,z-DUDU_NEST.z)<10||Math.hypot(x-BUBU_NEST.x,z-BUBU_NEST.z)<9||GIFTS.some(g=>Math.hypot(x-g.x,z-g.z)<3))continue;
      this.tree(x,z,.85+rand()*.65,['pine','oak','blossom','birch','umbrella'][i%5],[COLORS.leaf,COLORS.darkLeaf,COLORS.lightLeaf][i%3]);
    }
    [[-25,9],[-25,14],[-17,28],[11,26],[16,28],[23,23],[25,-4],[20,-12],[14,-20],[-12,-23],[-21,-24],[-30,-13],[-21,3],[8,21],[-13,21],[10,-32]].forEach(([x,z],i)=>this.tree(x,z,1+rand()*.5,['willow','umbrella','blossom','birch','oak','pine'][i%6],i%4===0?COLORS.pink:COLORS.leaf));
    // An old wishing tree with tiny ribbons hanging from the branches.
    this.tree(16,-7,1.5,'umbrella',0x8fa777);
    for(let i=0;i<5;i++){const ribbon=box(this.land,[0xe0b59c,0xb8c9af,0xe8d29d][i%3],15+rand()*2,2+rand(),-6.7,.09,.55,.035);ribbon.rotation.z=(rand()-.5)*.6;}
  }
  buildCottage() {
    const house=new THREE.Group();house.position.set(-16,.2,-5);house.rotation.y=.6;this.land.add(house);
    box(house,0xe3d9b6,0,1.1,0,2.45,2.2,2.15);
    const roofGeo=new THREE.ConeGeometry(2.05,1.55,4);const roof=mesh(roofGeo,0xa48161,house,0,2.9,0);roof.rotation.y=Math.PI/4;roof.scale.z=.95;
    box(house,0x8b7959,0,.8,1.1,.68,1.6,.08);ball(house,0xe5cc8a,.22,.8,1.17,.045);
    box(house,0xa79e74,-.75,1.3,1.09,.54,.65,.08);box(house,0xe6dfb7,-.75,1.3,1.15,.39,.48,.03);
    box(house,0x938864,-.75,1.3,1.19,.045,.49,.02);box(house,0x938864,-.75,1.3,1.19,.4,.035,.02);
    box(house,0x907454,.65,3.03,-.4,.38,1.15,.42);
    cylinder(house,0xcaa765,1.65,.65,.5,.46,.62,.9,12);cylinder(house,0xd5b472,1.65,1.02,.5,.28,.46,.6,12);ball(house,0x685744,1.65,.57,.99,.1,.085,.035);
    this.obstacles.push({x:-16,z:-5,radius:1.45});
  }
  buildPicnic() {
    this.tree(BUBU.x+4,BUBU.z-3,1.7,'round',COLORS.pink);
    const picnic=new THREE.Group();picnic.position.set(BUBU.x,.22,BUBU.z);this.land.add(picnic);
    box(picnic,0xf3ddc2,0,0,0,4.6,.045,3.2);
    for(let x=0;x<8;x++)for(let z=0;z<6;z++)if((x+z)%2===0)box(picnic,0xdcb0a1,-2.01+x*.575,.027,-1.34+z*.535,.575,.009,.535);
    cylinder(picnic,0xc5ac7c,-1.3,.27,-.7,.43,.34,.5,12);
    const handle=mesh(new THREE.TorusGeometry(.34,.04,5,16,Math.PI),0xa88d64,picnic,-1.3,.51,-.7);handle.rotation.y=Math.PI/2;
    cylinder(picnic,0xfff4d9,1.1,.08,.4,.45,.45,.09,24);
    const cake=new THREE.Group();cake.position.set(1.1,.14,.4);picnic.add(cake);
    cylinder(cake,0xe0af9c,0,.21,0,.33,.33,.4,24);cylinder(cake,0xffeed4,0,.43,0,.34,.34,.07,24);cylinder(cake,0xa1b4a0,0,.63,0,.025,.025,.35,6);this.candleFlame=ball(cake,0xe6b559,0,.84,0,.045,.08,.04);this.candleFlame.visible=!this.state.completed;
    this.picnicCake=cake;cake.visible=this.state.completed;cake.userData.dynamic=true;
    // Festive little bunting across the picnic clearing.
    [-2.7,2.7].forEach(x=>cylinder(picnic,0xaa8b66,x,1.8,-1,.045,.065,3.6));
    line(picnic,[[-2.7,3.5,-1],[0,3.05,-1],[2.7,3.5,-1]],0xb6a780,.019);
    for(let i=0;i<9;i++){
      const x=-2.25+i*.56,y=3.05+(x/2.7)**2*.45;
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-.2,0,0,.2,0,0,0,-.45,0],3));geo.computeVertexNormals();
      mesh(geo,[0xdba79a,0xe4ce8f,0x9eaf94][i%3],picnic,x,y,-1,[1,1,1],{side:THREE.DoubleSide});
    }
  }
  buildDetails() {
    this.meadow=new ForestMeadow(this.scene,currentScreen().phone);
    this.understory=buildUnderstory(this.land,this.treeSizes,this.quality.foliageDetail);
    const flowerGeometry=[], yellowGeometry=[], pinkGeometry=[];
    const addMerged=(geo,x,y,z,scale,arr)=>{const g=geo.clone();g.scale(...scale);g.translate(x,y,z);arr.push(g);};
    for(let i=0;i<this.quality.groundDetails;i++){
      const a=rand()*Math.PI*2,r=Math.sqrt(rand())*39,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(!meadowSpace(x,z,.2))continue;
      if(i%3!==0){
        const target=i%4===0?pinkGeometry:i%3===1?yellowGeometry:flowerGeometry;
        addMerged(petalGeo,x,.28,z,[.065,.045,.065],target);
        for(let j=0;j<4;j++)addMerged(petalGeo,x+Math.cos(j*Math.PI/2)*.07,.28,z+Math.sin(j*Math.PI/2)*.07,[.055,.035,.055],target);
      }
    }
    [[flowerGeometry,0xfff3db],[yellowGeometry,0xeac76c],[pinkGeometry,0xe9aabc]].forEach(([geos,color])=>{
      if(!geos.length)return;const m=mesh(mergeGeometries(geos),color,this.land);m.castShadow=false;geos.forEach(g=>g.dispose());
    });
    for(let i=0;i<38;i++){
      const a=rand()*6.28,r=34+rand()*5,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const rock=mesh(new THREE.DodecahedronGeometry(1,0),[0xa5ac8b,0xb6b99a,0xb9bea0][i%3],this.land,x,.2,z,[.3+rand()*.6,.3+rand()*.4,.4+rand()*.4]);rock.rotation.y=rand()*6;
    }
    const shrooms=[[-11,9],[-11.5,9.3],[-10.8,9.7],[-4,-11],[-3.5,-11.5],[9,7],[9.5,7.2],[17,3],[-17,-2]];
    shrooms.forEach(([x,z],i)=>{const h=.25+(i%3)*.1;cylinder(this.land,0xf3e7c9,x,.2+h/2,z,.065,.095,h);const cap=ball(this.land,0xc99177,x,.2+h,z,.25,.16,.25);for(let j=0;j<3;j++)ball(this.land,0xf6eacb,x+Math.cos(j*2.1)*.12,.3+h,z+Math.sin(j*2.1)*.12,.036,.016,.036);});
    // Hand-painted wooden signs.
    this.sign(0,24,'TO SUNNYWOOD',.3);this.sign(-12,5,'HONEY HOLLOW',.6);this.sign(3,-21,'BUBU’S NEST',.25);this.sign(-21,21,'CLOVER FIELDS',.3);this.sign(28,9,'HEARTWIND',.3);this.sign(-25,-16,'MOONFLOWERS',.3);
    const dustGeometry=new THREE.BufferGeometry(),dustPositions=[];
    for(let i=0;i<120;i++)dustPositions.push((rand()-.5)*78,rand()*6+.7,(rand()-.5)*78);
    dustGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dustPositions,3));this.dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:0xfff9dc,size:.065,transparent:true,opacity:.7}));this.scene.add(this.dust);
    // Decorative heart on the opening path.
    const heartShape=new THREE.Shape();heartShape.moveTo(0,.15);heartShape.bezierCurveTo(-.5,.7,-.8,0,0,-.4);heartShape.bezierCurveTo(.8,0,.5,.7,0,.15);
    this.heartGeo=new THREE.ShapeGeometry(heartShape);
    this.confetti=[];
  }
  sign(x,z,text,rotation=0) {
    for(const offset of [-.7,0,.7])this.cameraObstacles.push({x:x+Math.cos(rotation)*offset,y:1.55,z:z-Math.sin(rotation)*offset,radius:.4});
    const group=new THREE.Group();group.position.set(x,.2,z);group.rotation.y=rotation;this.land.add(group);
    cylinder(group,0x9e815a,0,.7,0,.06,.08,1.4);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#c5aa7d';ctx.fillRect(0,0,512,128);ctx.fillStyle='#f8f0d6';ctx.font='500 38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,65);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const board=new THREE.Mesh(new THREE.BoxGeometry(2.1,.52,.12),[mat(0xb69b72),mat(0xb69b72),mat(0xb69b72),mat(0xb69b72),new THREE.MeshStandardMaterial({map:texture,roughness:1}),mat(0xb69b72)]);
    board.position.y=1.35;board.castShadow=true;group.add(board);
  }
  buildGifts() {
    GIFTS.forEach(gift=>{
      const group=createGift(gift.color);group.position.set(gift.x,.36,gift.z);group.rotation.y=.5;group.userData.dynamic=true;this.land.add(group);
      group.visible=!this.state.collected.includes(gift.id);
      const ring=mesh(new THREE.RingGeometry(.72,.77,40),0xfff4c9,this.land,gift.x,.25,gift.z,[1,1,1],{transparent:true,opacity:.65,side:THREE.DoubleSide});ring.rotation.x=-Math.PI/2;ring.castShadow=false;ring.visible=group.visible;ring.userData.dynamic=true;
      const sparkle=mesh(new THREE.OctahedronGeometry(.11),0xfff4cf,this.land,gift.x,2.1,gift.z);sparkle.visible=group.visible;sparkle.castShadow=false;sparkle.userData.dynamic=true;
      this.gifts.set(gift.id,{group,ring,sparkle});
    });
  }
  buildNests(){
    const makeNest=(position,name,pink)=>{
      const nest=new THREE.Group();nest.position.set(position.x,.2,position.z);this.land.add(nest);
      cylinder(nest,pink?0xcba789:0xb7926b,0,1.55,0,2.25,2.6,3.1,16);
      for(let i=0;i<14;i++){
        const a=i/14*Math.PI*2;
        line(nest,[[Math.sin(a)*2.53,.2,Math.cos(a)*2.53],[Math.sin(a)*2.37,1.5,Math.cos(a)*2.37],[Math.sin(a)*2.25,3,Math.cos(a)*2.25]],pink?0xbb9778:0xa7835e,.045);
      }
      // A leafy roof and twig rim make these little hollow-tree nests.
      for(let i=0;i<10;i++){
        const a=i/10*Math.PI*2;
        mesh(leafGeo,pink?0xdab4b0:0x90a871,nest,Math.cos(a)*1.65,3.35,Math.sin(a)*1.65,[1.15,.55,1.15]);
      }
      ball(nest,pink?0xe3c1b6:0xa2b882,0,3.75,0,2.2,.85,2.1);
      for(let i=0;i<3;i++){const rim=mesh(new THREE.TorusGeometry(2.38+i*.09,.08,5,32),0x97764f,nest,0,3.08+i*.11,0);rim.rotation.x=Math.PI/2;}
      // The dark doorway stays inside the stump; the door opens on its hinge.
      ball(nest,0x4c4938,0,1.1,2.32,.79,1.18,.15);
      const pivot=new THREE.Group();pivot.position.set(-.75,0,2.48);pivot.userData.dynamic=true;nest.add(pivot);
      const door=ball(pivot,pink?0xa88b82:0x82936a,.75,1.12,0,.75,1.1,.1);door.castShadow=false;
      [-.34,0,.34].forEach(x=>line(pivot,[[.75+x,.25,.11],[.75+x,1.65,.11]],pink?0x947c73:0x6c805b,.018));
      ball(pivot,0xe8ce8f,1.21,1.04,.14,.065);
      [-1,1].forEach(side=>{
        ball(nest,0x886f51,side*1.55,1.65,1.93,.48,.51,.12);
        ball(nest,0xf1db9c,side*1.55,1.65,2.04,.37,.39,.045);
        box(nest,0x987e5c,side*1.55,1.65,2.1,.055,.74,.04);
        box(nest,0x987e5c,side*1.55,1.65,2.1,.7,.055,.04);
        cylinder(nest,0xc19a78,side*1.85,.29,2.65,.32,.23,.5);
        for(let i=0;i<4;i++)ball(nest,pink?0xd993a0:0xf0d780,side*1.85+(rand()-.5)*.45,.74+rand()*.2,2.65+(rand()-.5)*.3,.17);
      });
      for(let i=0;i<4;i++){const stone=mesh(petalGeo,0xd6cfad,nest,(i%2-.5)*.13,.045,2.65+i*.48,[.67,.13,.28]);stone.castShadow=false;}
      this.sign(position.x-3,position.z+3.2,name,.35);
      this.obstacles.push({x:position.x,z:position.z,radius:2.52});
      return {group:nest,door:pivot,entry:{x:position.x,z:position.z+2.4}};
    };
    this.duduNest=makeNest(DUDU_NEST,'DUDU’S NEST',false);
    this.bubuNest=makeNest(BUBU_NEST,'BUBU’S NEST',true);
  }
  buildFields(){
    [['rabbit',-18,21],['rabbit',-20,17],['rabbit',-24,21],['rabbit',-12,26],['deer',18,-18],['deer',22,-20],['deer',25,-16],['fox',-26,-9],['fox',-23,-11],['sheep',7,24],['sheep',10,24],['sheep',12,21],['sheep',3,26],['rabbit',29,2],['rabbit',25,4],['fox',-17,-24]].forEach(([kind,x,z],i)=>{
      let spawn={x,z};
      if(!isWalkable(x,z,this.obstacles)){
        search:for(let r=.4;r<=2;r+=.4)for(let j=0;j<12;j++){
          const nx=x+Math.sin(j*Math.PI/6)*r,nz=z+Math.cos(j*Math.PI/6)*r;
          if(isWalkable(nx,nz,this.obstacles)){spawn={x:nx,z:nz};break search;}
        }
      }
      const animal=createAnimal(kind,spawn.x,spawn.z,i);this.animals.push(animal);this.scene.add(animal.group);
    });
    const heart=new THREE.Shape();heart.moveTo(0,.45);heart.bezierCurveTo(-.75,1.3,-1.5,.2,0,-.8);heart.bezierCurveTo(1.5,.2,.75,1.3,0,.45);
    const heartGeometry=new THREE.ExtrudeGeometry(heart,{depth:.12,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.12,bevelThickness:.13,curveSegments:10});
    const locations=[[-10,32],[-2,34],[-21,23],[-25,18],[27,10],[30,5],[27,1],[25,7],[3,-26],[10,-26],[3,-30],[10,-31],[-24,-20],[19,26]];
    locations.forEach(([x,z],i)=>{
      const group=new THREE.Group();group.position.set(x,.2,z);group.userData.dynamic=true;this.scene.add(group);
      const color=[0xd8909a,0xe6b6aa,0xe7c886][i%3];
      const balloon=mesh(heartGeometry,color,group,0,3.3+i%3*.25,0,[.62,.7,.8]);balloon.rotation.y=.45;balloon.castShadow=false;
      line(group,[[0,.15,0],[.12,1.3,0],[-.08,2.1,0],[0,2.75+i%3*.25,0]],0xb7a17b,.014);
      cylinder(this.land,0xaa8b65,x,.35,z,.025,.035,.6,5);
      this.balloons.push({group,phase:i});
    });
    const balloonGift=this.gifts.get('balloon').group;
    mesh(heartGeometry,0xd8909a,balloonGift,0,2.3,0,[.44,.5,.5]).castShadow=false;
    line(balloonGift,[[0,1,0],[.09,1.4,0],[0,1.92,0]],0xc2aa84,.013);
    // Low field fences frame the meadows while leaving every trail open.
    [[2,22,9],[-27,17,7],[15,-23,8]].forEach(([x,z,count])=>{
      for(let i=0;i<count;i++){cylinder(this.land,0xb39b71,x+i*.8,.55,z,.055,.07,.7,6);if(i<count-1){box(this.land,0xc9b68b,x+i*.8+.4,.48,z,.8,.08,.065);box(this.land,0xc9b68b,x+i*.8+.4,.77,z,.8,.08,.065);}}
    });
  }
  get cinematic(){return ['departure','arrival','party','moon'].includes(this.story);}
  startMoonVisit(){
    if(this.cinematic||!this.state.completed||Math.hypot(this.state.position.x-MOON_NEST.entry.x,this.state.position.z-MOON_NEST.entry.z)>2.6)return false;
    const journey=new MoonJourney(this.state.position,this.bubu.position,this.obstacles,this.nightBlend);
    if(!journey.valid)return false;
    this.moonJourney=journey;this.story='moon';this.storyTime=0;this.overview=false;this.clickMarker.visible=false;this.events.push('moon-approaching');return true;
  }
  updateMoonJourney(dt){
    const journey=this.moonJourney;journey.update(dt);
    [this.dudu,this.bubu].forEach((bear,i)=>{
      const actor=journey.bears[i],{position}=actor;bear.position.set(position.x,position.y,position.z);
      const climbing=['climbing','descending'].includes(journey.phase)&&journey.onLadder,watching=journey.phase==='stargazing';
      const heading=watching?Math.PI:actor.heading??Math.PI;
      turnBear(bear,heading,dt,8);
      animateBearPose(bear,dt,this.time,actor.moving&&!climbing,this.reducedMotion,false);
      const cycle=journey.time*5+i*Math.PI,body=bear.userData;
      body.body.position.y=0;body.body.position.x=0;body.body.rotation.set(0,0,0);body.head.rotation.z=0;body.head.rotation.x=watching?-.16:0;
      body.forearms.forEach(arm=>arm.rotation.x=climbing?-.25:0);
      body.arms.forEach((arm,j)=>{arm.rotation.z=0;arm.rotation.x=climbing?-2.1+Math.sin(cycle+j*Math.PI)*.45:actor.moving?Math.sin(this.time*9+j*Math.PI)*.3:0;});
      body.legs.forEach((leg,j)=>{leg.rotation.x=climbing?Math.sin(cycle+j*Math.PI)*.5:actor.moving?Math.sin(this.time*9+j*Math.PI)*.4:0;});
      bear.userData.groundShadow.visible=!climbing&&!watching;
    });
    this.state.position={x:this.dudu.position.x,z:this.dudu.position.z};
    this.state.companionPosition={x:this.bubu.position.x,z:this.bubu.position.z};
    for(const event of journey.events.splice(0)){
      if(event==='moon-climbing'){journey.initialNight=journey.nightBlend=this.nightBlend;this.setTimeOfDay('night');}
      if(event==='moon-arrived'){this.sky.nightTime=0;this.nightBlend=1;}
      this.events.push(event);
    }
    if(journey.phase==='finished'){
      this.story='exploring';this.moonJourney=null;this.follow.initialized=false;
      [this.dudu,this.bubu].forEach(b=>{b.userData.head.rotation.x=0;b.userData.arms.forEach(arm=>arm.rotation.set(0,0,0));b.userData.legs.forEach(leg=>leg.rotation.set(0,0,0));b.userData.groundShadow.visible=true;});
      this.beginTogether();
    }
  }
  beginDeparture(){if(this.state.departed){this.story='exploring';this.dudu.visible=true;return;}this.story='departure';this.storyTime=0;this.dudu.visible=false;this.setCamera(true);}
  revealBubu(){if(!shouldRevealBubu(this.state)||this.cinematic)return;this.story='arrival';this.storyTime=0;this.bubu.visible=false;this.events.push('arrival-start');}
  resetStory(){this.friendMoment=null;this.reactions.reset();this.animals.forEach(a=>{a.brain.greetCooldown=0;if(a.brain.mode==='friendly'){a.brain.mode='idle';a.brain.timer=1;}});this.moonJourney=null;[this.dudu,this.bubu].forEach(b=>{b.userData.expression.reset();b.userData.lastPosition=null;b.userData.gait=b.userData.strideWeight=b.userData.runWeight=0;b.userData.body.position.set(0,0,0);b.userData.body.rotation.set(0,0,0);});[this.dudu,this.bubu].forEach(b=>{b.userData.head.rotation.x=0;b.userData.groundShadow.visible=true;});this.story='ready';this.storyTime=0;this.companion=null;this.partyGifts?.removeFromParent();this.partyGifts=null;this.bubu.visible=false;this.bubu.position.set(BUBU.x,.25,BUBU.z);this.bubu.userData.arms.forEach(arm=>arm.rotation.set(0,0,0));this.dudu.visible=false;this.duduNest.door.rotation.y=0;this.bubuNest.door.rotation.y=0;this.events=[];this.overview=false;this.zoomView=this.mobile?25:27;this.beginDeparture();}
  updateStory(dt){
    if(!this.cinematic)return;
    this.storyTime+=dt;
    if(this.story==='moon'){this.updateMoonJourney(dt);return;}
    if(this.story==='party'){this.updateParty(dt);return;}
    const departure=this.story==='departure',nest=departure?this.duduNest:this.bubuNest,bear=departure?this.dudu:this.bubu,target=departure?START:BUBU;
    const progress=THREE.MathUtils.clamp((this.storyTime-.45)/2.5,0,1),ease=progress*progress*(3-2*progress);
    nest.door.rotation.y=-1.55*Math.min(1,this.storyTime/.5)*(this.storyTime>3.1?Math.max(0,1-(this.storyTime-3.1)/.6):1);
    bear.visible=this.storyTime>.4;bear.position.set(THREE.MathUtils.lerp(nest.entry.x,target.x,ease),.23,THREE.MathUtils.lerp(nest.entry.z,target.z,ease));bear.rotation.y=0;
    animateBearPose(bear,dt,this.time,progress>0&&progress<1,this.reducedMotion,false);
    if(this.storyTime>=3.7){
      nest.door.rotation.y=0;this.story='exploring';bear.userData.legs.forEach(leg=>leg.rotation.x=0);
      if(departure){this.state.departed=true;this.events.push('departed');}
      else{this.state.bubuArrived=true;this.bubu.userData.expression.react('shy',2.8);this.dudu.userData.expression.react('delighted',2);this.events.push('arrived');}
    }
  }
  get thirdPerson(){return this.playing&&this.cameraMode==='third-person'&&!this.overview;}
  get movementYaw(){const direction=new THREE.Vector3();this.camera.getWorldDirection(direction);return Math.atan2(-direction.x,-direction.z);}
  zoomBy(factor){this.overview=false;if(this.cameraMode==='third-person')this.follow.zoom(factor);else this.zoomView=clampZoom(this.zoomView*factor);}
  toggleOverview(){this.overview=!this.overview;}
  toggleCamera(){this.overview=false;this.cameraMode=this.cameraMode==='third-person'?'overhead':'third-person';this.follow.initialized=false;this.setCamera(true);}
  orbitCamera(dx,dy){if(this.thirdPerson&&!this.cinematic)this.follow.orbit(dx,dy);}
  recenterCamera(){this.overview=false;this.cameraMode='third-person';this.follow.recenter(this.dudu.rotation.y);}
  setTimeOfDay(mode,immediate=false){
    this.timeOfDay=mode==='night'?'night':'day';this.sky.setNight(this.timeOfDay==='night');
    if(immediate||this.reducedMotion)this.nightBlend=this.timeOfDay==='night'?1:0;
    this.needsRender=true;
  }
  setWeather(mode,immediate=false){
    this.weather.set(mode,immediate||this.reducedMotion);this.needsRender=true;
  }
  updateLighting(dt){
    const target=this.timeOfDay==='night'?1:0;
    if(this.moonJourney?.phase==='climbing')this.nightBlend=this.moonJourney.nightBlend;
    else{this.nightBlend=THREE.MathUtils.lerp(this.nightBlend,target,1-Math.exp(-3*dt));if(Math.abs(this.nightBlend-target)<.002)this.nightBlend=target;}
    this.weather.update(dt);
    const n=this.nightBlend,rain=this.weather.blend;
    this.ambient.color.setHex(0xeaf1df).lerp(new THREE.Color(0x819ac7),n);this.ambient.groundColor.setHex(0x496649).lerp(new THREE.Color(0x34466b),n);this.ambient.intensity=1.35-n*.5;
    this.sunLight.color.setHex(0xffdf9f).lerp(new THREE.Color(0x9fbbe9),n);this.sunLight.intensity=3.1-n*2.64;
    this.fillLight.color.setHex(0xb9d6cc).lerp(new THREE.Color(0x8b92c8),n);this.fillLight.intensity=.45-n*.12;
    this.scene.fog.color.setHex(0xc6d3b7).lerp(new THREE.Color(0x1c2d49),n);
    // Overcast light stays soft and readable, including on white Bubu.
    this.ambient.color.lerp(new THREE.Color(0xd2dfe4).lerp(new THREE.Color(0x8294b7),n),rain*.8);
    this.ambient.intensity*=1-rain*.08;
    this.sunLight.color.lerp(new THREE.Color(0xc7d8e5),rain*.6);this.sunLight.intensity*=1-rain*.66;
    this.fillLight.intensity+=rain*.15;
    this.scene.fog.color.lerp(new THREE.Color(0xb5c8cf).lerp(new THREE.Color(0x263a50),n),rain*.72);
    this.surfaces.update(rain);
    this.roadLighting.update(Math.max(n,rain*.4),this.state.position);
    const windows=mat(0xf1db9c);windows.emissive.setHex(0xffb969);windows.emissiveIntensity=n*.85;
    this.candleFlame.material.emissive.setHex(0xffb34e);this.candleFlame.material.emissiveIntensity=.3+n;
    this.guidance.material.color.setHex(0xc49653).lerp(new THREE.Color(0xffda92),n);
    this.butterflies.forEach(b=>b.group.visible=n<.7&&rain<.55);
  }
  batchStaticGeometry(){
    // Render the stationary forest in material batches instead of hundreds of draws.
    this.land.updateWorldMatrix(true,true);const batches=new Map();this.canopyBatches=[];
    this.land.traverse(node=>{
      if(!node.isMesh||Array.isArray(node.material))return;
      let ancestor=node;while(ancestor){if(ancestor.userData.dynamic)return;ancestor=ancestor.parent;}
      // Small spatial batches let the camera cull trees outside its view.
      const e=node.matrixWorld.elements,cell=`${Math.floor(e[12]/16)},${Math.floor(e[14]/16)}`;
      const foliage=node.material.userData.forestLeaf;
      const material=foliage?batchFoliageMaterial(node.material.userData.forestCanopy):node.material;
      const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);
      if(foliage){
        const color=node.material.color,colors=new Float32Array(geometry.attributes.position.count*3);
        for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
        geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
      }
      const detail=!!node.userData.canopyDetail;
      const key=`${cell}-${material.uuid}-${node.castShadow}-${detail}-${Object.keys(geometry.attributes).sort().join(',')}`;
      if(!batches.has(key))batches.set(key,{material,cast:node.castShadow,detail,geometries:[],nodes:[]});
      const batch=batches.get(key);
      // Geometry sources use mixed index types; normalize before merging.
      if(geometry.index){batch.geometries.push(geometry.toNonIndexed());geometry.dispose();}
      else batch.geometries.push(geometry);
      batch.nodes.push(node);
    });
    for(const batch of batches.values()){
      const geometry=mergeGeometries(batch.geometries);if(!geometry)continue;
      geometry.computeBoundingSphere();
      const combined=new THREE.Mesh(geometry,batch.material);combined.castShadow=batch.cast;combined.receiveShadow=true;this.scene.add(combined);
      if(batch.detail)this.canopyBatches.push(combined);
      batch.nodes.forEach(node=>node.removeFromParent());batch.geometries.forEach(geo=>geo.dispose());
    }
  }
  collect(id){this.reactions.emit(this.dudu.position,this.reducedMotion);this.dudu.userData.expression.react('delighted',2.2);const gift=this.gifts.get(id);if(gift){gift.group.visible=false;gift.ring.visible=false;gift.sparkle.visible=false;}this.addBackpackGifts();}
  addBackpackGifts(){
    if(this.backpackGifts)this.dudu.userData.body.remove(this.backpackGifts);
    this.backpackGifts=new THREE.Group();this.dudu.userData.body.add(this.backpackGifts);
    this.state.collected.forEach((id,i)=>{const gift=createGift(GIFTS.find(g=>g.id===id).color);gift.scale.setScalar(.2);gift.position.set((i%3-1)*.22,1.1+Math.floor(i/3)*.13,-.8);gift.rotation.z=(i-2)*.1;this.backpackGifts.add(gift);});
  }
  celebrate(){
    if(this.cinematic||!canCelebrate(this.state))return false;
    this.story='party';this.storyTime=0;this.partyWish=false;this.picnicCake.visible=true;this.candleFlame.visible=true;
    this.partyStart={...this.state.position};
    this.partyGifts=new THREE.Group();this.scene.add(this.partyGifts);
    GIFTS.forEach((gift,i)=>{const present=createGift(gift.color);present.scale.setScalar(.35);present.position.set(BUBU.x-1.75+(i%4)*.53,.3,BUBU.z-1.1+Math.floor(i/4)*.55);this.partyGifts.add(present);});
    this.events.push('party-start');return true;
  }
  releaseConfetti(){
    this.confettiAge=0;
    for(let i=0;i<65;i++){
      const heart=new THREE.Mesh(this.heartGeo,new THREE.MeshBasicMaterial({color:[0xd4a19c,0xe7c778,0xf5e4c3,0x94a780][i%4],side:THREE.DoubleSide,transparent:true}));
      const angle=rand()*Math.PI*2;heart.position.set(BUBU.x+(rand()-.5)*4,1+rand()*5,BUBU.z+(rand()-.5)*4);heart.scale.setScalar(.15+rand()*.2);heart.userData={speed:.5+rand(),phase:angle};this.scene.add(heart);this.confetti.push(heart);
    }
  }
  updateParty(dt){
    const t=this.storyTime,ease=Math.min(1,t/1.8),smooth=ease*ease*(3-2*ease);
    this.state.position.x=THREE.MathUtils.lerp(this.partyStart.x,BUBU.x-1.8,smooth);this.state.position.z=THREE.MathUtils.lerp(this.partyStart.z,BUBU.z+.5,smooth);
    this.dudu.position.set(this.state.position.x,.23,this.state.position.z);this.dudu.rotation.y=.9;this.bubu.rotation.y=.2;
    [this.dudu,this.bubu].forEach((bear,i)=>{
      animateBearPose(bear,dt,this.time,i===0&&t<1.8,this.reducedMotion);
      if(t>3.4){
        bear.userData.body.position.y=this.reducedMotion?0:Math.max(0,Math.sin((t-3.4)*4+i*.4))*.095;
        bear.userData.head.rotation.z=this.reducedMotion?0:Math.sin(t*2+i)*.05;
      }
    });
    const wish=t>1.8&&t<3.4;
    this.bubu.userData.body.rotation.x=wish&&!this.reducedMotion?Math.sin((t-1.8)/1.6*Math.PI)*.1:0;
    if(t>=3.4&&!this.partyWish){this.partyWish=true;this.candleFlame.visible=false;this.releaseConfetti();this.events.push('party-wish');}
    if(t>=8){
      this.state.completed=true;this.state.companionPosition={x:this.bubu.position.x,z:this.bubu.position.z};this.story='exploring';
      // Hold the final pose while the ending dialog is open; walking blends it out.
      this.beginTogether();this.events.push('party-finished');
    }
  }
  beginTogether(){
    this.companion=new Companion(companionStart(this.state,this.obstacles),this.obstacles);
    this.bubu.position.set(this.companion.position.x,.23,this.companion.position.z);this.bubu.visible=true;
    this.state.companionPosition={...this.companion.position};
  }
  updateCompanion(dt){
    if(!this.companion||!this.playing||this.cinematic)return;
    const {moving,dx,dz}=this.companion.update(dt,this.state.position),pos=this.companion.position;
    this.bubu.position.set(pos.x,PONDS.some(p=>Math.abs(pos.z-p.z)<1&&Math.abs(pos.x-p.x)<5.6)?.48:.23,pos.z);
    if(moving)turnBear(this.bubu,Math.atan2(dx,dz),dt);
    animateBearPose(this.bubu,dt,this.time,moving,this.reducedMotion);
    this.state.companionPosition={...pos};
  }
  shareMoment(){
    if(!this.state.completed||this.cinematic)return;
    this.dudu.userData.expression.react('content',3.2);this.bubu.userData.expression.react('shy',3.2);
  }
  nearbyFriend(){
    return this.animals.filter(a=>a.brain.canGreet(this.state.position,this.nightBlend))
      .sort((a,b)=>a.group.position.distanceToSquared(this.dudu.position)-b.group.position.distanceToSquared(this.dudu.position))[0];
  }
  greetAnimal(animal){
    if(this.cinematic||!animal.brain.greet(this.state.position,this.nightBlend))return false;
    this.friendMoment={animal,remaining:4};this.dudu.userData.expression.react('content',3);
    this.dudu.rotation.y=Math.atan2(animal.group.position.x-this.dudu.position.x,animal.group.position.z-this.dudu.position.z);
    this.reactions.emit(animal.group.position,this.reducedMotion);return true;
  }
  updateBearExpressions(dt,moving){
    const scripted=this.cinematic,time=this.storyTime+dt;
    let duduMood='calm',bubuMood='calm',duduTarget=null,bubuTarget=null;
    if(this.story==='party'){
      duduMood=time<3.4?'content':'delighted';bubuMood=time<1.8?'surprised':time<3.4?'wish':'delighted';
      duduTarget=this.bubu.position;bubuTarget=this.dudu.position;
    }else if(this.story==='arrival'){
      duduMood='content';bubuMood=time<2?'surprised':'shy';duduTarget=this.bubu.position;bubuTarget=this.dudu.position;
    }else if(this.story==='moon'){
      duduMood=bubuMood=this.moonJourney?.phase==='stargazing'?'wonder':'curious';
    }else if(this.state.completed&&this.bubu.visible){
      duduMood=moving?'calm':'content';bubuMood='content';
      if(Math.hypot(this.dudu.position.x-this.bubu.position.x,this.dudu.position.z-this.bubu.position.z)<3.5){duduTarget=this.bubu.position;bubuTarget=this.dudu.position;}
    }else{
      let distance=4;
      for(const gift of GIFTS){const d=Math.hypot(this.state.position.x-gift.x,this.state.position.z-gift.z);if(!this.state.collected.includes(gift.id)&&d<distance){distance=d;duduTarget=gift;duduMood='curious';}}
    }
    if(this.friendMoment){
      this.friendMoment.remaining-=dt;
      if(moving||scripted||this.friendMoment.remaining<=0)this.friendMoment=null;
      else{duduTarget=this.friendMoment.animal.group.position;duduMood='content';}
    }
    this.dudu.userData.expression.update(dt,{mood:duduMood,look:lookAtBearTarget(this.dudu,duduTarget),scripted},this.reducedMotion);
    this.bubu.userData.expression.update(dt,{mood:bubuMood,look:lookAtBearTarget(this.bubu,bubuTarget),scripted},this.reducedMotion);
  }
  showGuidance(path){
    const dummy=new THREE.Object3D();dummy.rotation.x=-Math.PI/2;
    this.guidance.count=Math.min(path.length,160);
    path.slice(0,160).forEach((point,i)=>{const onBridge=PONDS.some(p=>Math.abs(point.z-p.z)<1&&Math.abs(point.x-p.x)<5.6);dummy.position.set(point.x,this.away?this.travel.active.height(point.x,point.z)+.075:onBridge?.6:.27,point.z);dummy.updateMatrix();this.guidance.setMatrixAt(i,dummy.matrix);});this.guidance.instanceMatrix.needsUpdate=true;
  }
  projectLocation(x,y,z){
    const point=new THREE.Vector3(x,y,z),local=point.clone().applyMatrix4(this.camera.matrixWorldInverse),front=local.z<0;
    point.project(this.camera);
    if(!front&&this.camera.isPerspectiveCamera)return{x:this.width*(.5+local.x/Math.max(1,Math.abs(local.z))),y:this.height*1.3,front:false};
    return{x:(point.x*.5+.5)*this.width,y:(-.5*point.y+.5)*this.height,front};
  }
  screenPosition(object, offset=0) {return this.projectLocation(object.position.x,object.position.y+offset,object.position.z);}
  groundPoint(clientX,clientY){
    const rect=this.container.getBoundingClientRect();this.pointer.set((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height)*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);if(this.raycaster.ray.direction.y>=-.015)return null;
    if(this.away){const hit=this.raycaster.intersectObject(this.travel.active.ground)[0];return hit?{x:hit.point.x,z:hit.point.z}:null;}
    const hit=new THREE.Vector3();return this.raycaster.ray.intersectPlane(this.groundPlane,hit)?{x:hit.x,z:hit.z}:null;
  }
  mark(point){this.clickMarker.position.set(point.x,this.away?this.travel.active.height(point.x,point.z)+.1:.3,point.z);this.clickMarker.visible=true;this.markerTime=this.away?this.travel.time:this.time;}
  resize(){this.width=Math.max(1,this.container.clientWidth);this.height=Math.max(1,this.container.clientHeight);this.mobile=currentScreen().phone||this.width<760;this.renderer.setSize(this.width,this.height);this.sky.resize(this.width,this.height);this.follow.resize(this.width/this.height);this.setCamera(true);}
  setCamera(immediate=false,dt=1/60){
    const aspect=this.width/this.height;
    if(this.story==='moon'){
      const height=(this.dudu.position.y+this.bubu.position.y)/2,progress=this.moonJourney.progress;
      // Stay in the open corridor directly in front of the ladder. The side
      // birches are taller than the nest and must stay outside this final shot.
      const z=(this.dudu.position.z+this.bubu.position.z)/2;
      const position=new THREE.Vector3(MOON_NEST.x,height+3.5,z+6.2);
      const target=new THREE.Vector3(MOON_NEST.x,height+1.8+progress*.6,z-1.1);
      const ease=immediate||this.camera!==this.moonCamera||this.reducedMotion?1:1-Math.exp(-3*dt);
      this.moonCamera.position.lerp(position,ease);this.moonLook.lerp(target,ease);this.moonCamera.aspect=aspect;this.moonCamera.updateProjectionMatrix();this.moonCamera.lookAt(this.moonLook);this.moonCamera.updateMatrixWorld();this.camera=this.moonCamera;
      this.viewSize=this.moonCamera.position.distanceTo(this.moonLook)*2*Math.tan(THREE.MathUtils.degToRad(this.moonCamera.fov/2));
      this.scene.fog.near=32-this.weather.blend*9;this.scene.fog.far=110-this.weather.blend*28;return;
    }
    if(this.thirdPerson){
      const position=this.away?this.dudu.position:this.story==='arrival'?{x:BUBU.x-.5,z:BUBU.z-1}:this.story==='party'?{x:BUBU.x-.8,z:BUBU.z}:this.state.position;
      const changed=this.camera!==this.follow.camera,oldYaw=this.follow.yaw;
      if(this.story==='party'||this.story==='arrival')this.follow.yaw=.35;
      this.camera=this.follow.update(position,this.cameraObstacles,dt,immediate||changed,this.mobile);
      this.follow.yaw=oldYaw;this.viewSize=this.follow.arm*2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
      this.scene.fog.near=32-this.weather.blend*9;this.scene.fog.far=110-this.weather.blend*28;return;
    }
    if(this.camera!==this.overheadCamera)immediate=true;
    this.camera=this.overheadCamera;this.scene.fog.near=120;this.scene.fog.far=250;
    let desiredTarget, desiredSize;
    if(this.playing){
      desiredTarget=new THREE.Vector3(this.state.position.x,0,this.state.position.z);desiredSize=this.zoomView;
      if(this.story==='arrival'){desiredTarget.lerp(new THREE.Vector3(BUBU_NEST.x,0,BUBU_NEST.z+3),.55);desiredSize=Math.min(this.zoomView,24);}
      else if(this.story==='departure'){desiredTarget.set(DUDU_NEST.x,0,DUDU_NEST.z+2);desiredSize=this.mobile?22:25;}
      else if(this.story==='party'){desiredTarget.set(BUBU.x,0,BUBU.z);desiredSize=this.mobile?15:17;}
      if(!this.cinematic){desiredTarget.lerp(new THREE.Vector3(),THREE.MathUtils.clamp((this.zoomView-50)/58,0,1));if(this.overview){desiredTarget.set(0,0,0);desiredSize=this.away?Math.max(65,62/aspect):Math.max(94,86/aspect);}}
    }
    else if(this.mobile){desiredTarget=new THREE.Vector3(-13,0,-22);desiredSize=103;}
    else{desiredTarget=new THREE.Vector3(-19,0,14);desiredSize=83;}
    if(immediate){this.cameraTarget.copy(desiredTarget);this.viewSize=desiredSize;}else{this.cameraTarget.lerp(desiredTarget,1-Math.exp(-4*dt));this.viewSize=THREE.MathUtils.lerp(this.viewSize,desiredSize,1-Math.exp(-3*dt));}
    this.camera.left=-this.viewSize*aspect/2;this.camera.right=this.viewSize*aspect/2;this.camera.top=this.viewSize/2;this.camera.bottom=-this.viewSize/2;this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3(68,84,96));this.camera.lookAt(this.cameraTarget);this.camera.updateMatrixWorld();
  }
  update(dt, moving=false, running=false, paused=false){
    if(this.away){this.travel.update(dt,moving,paused,animateBearFace);return;}
    this.time+=dt;const t=this.time;
    updateVegetation(t,this.reducedMotion,this.weather.blend);
    this.dudu.position.x=this.state.position.x;this.dudu.position.z=this.state.position.z;
    // Keep Dudu's feet on the bridge when crossing the pond.
    this.dudu.position.y=PONDS.some(p=>Math.abs(this.state.position.z-p.z)<1&&Math.abs(this.state.position.x-p.x)<5.6)?.48:.2;
    this.updateBearExpressions(dt,moving);
    if(!this.cinematic||this.story==='arrival')animateBearPose(this.dudu,dt,t,moving&&!this.cinematic,this.reducedMotion);
    if(!this.companion&&!this.cinematic)animateBearPose(this.bubu,dt,t,false,this.reducedMotion);
    this.animals.forEach(animal=>updateAnimal(animal,dt,t,this.playing?this.state.position:{x:99,z:99},(x,z)=>isWalkable(x,z,this.obstacles),this.nightBlend,this.reducedMotion));
    if(!this.reducedMotion){
      this.gifts.forEach(({group,ring,sparkle},id)=>{const phase=GIFTS.findIndex(g=>g.id===id);group.position.y=.4+Math.sin(t*2+phase)*.1;sparkle.position.y=1.92+Math.sin(t*2.5+phase)*.18;sparkle.rotation.y=t;ring.material.opacity=.5+Math.sin(t*2)*.12;});
      this.butterflies.forEach(({group,left,right,x,z,phase})=>{group.position.set(x+Math.sin(t*.5+phase)*.95,1.2+Math.sin(t*1.3+phase)*.2,z+Math.cos(t*.4+phase)*.8);group.rotation.y=Math.atan2(.475*Math.cos(t*.5+phase),-.32*Math.sin(t*.4+phase));group.rotation.z=Math.sin(t*.7+phase)*.12;left.rotation.z=Math.sin(t*17+phase)*.85;right.rotation.z=-left.rotation.z;});
      this.ducks.forEach((duck,i)=>{duck.position.x=-1.2+Math.sin(t*.22+i)*.6;duck.rotation.y=Math.sin(t*.2+i)*.4;});
      this.floaties.forEach((r,i)=>{r.scale.x=1+Math.sin(t+i)*.07;});this.dust.rotation.y=t*.008;
      this.balloons.forEach(({group,phase})=>{group.rotation.z=Math.sin(t*.8+phase)*.045;group.rotation.x=Math.cos(t*.6+phase)*.025;});

    }
    this.confettiAge=(this.confettiAge||0)+dt;
    this.confetti.forEach(heart=>{if(!this.reducedMotion){heart.position.y+=dt*heart.userData.speed*.35;heart.position.x+=Math.sin(t+heart.userData.phase)*dt*.15;}heart.quaternion.copy(this.camera.quaternion);heart.material.opacity=Math.max(0,1-(heart.position.y-4)/5)*Math.max(0,1-(this.confettiAge-6)/6);});
    if(this.confettiAge>12&&this.confetti.length){this.confetti.forEach(heart=>{heart.removeFromParent();heart.material.dispose();});this.confetti=[];}
    if(this.clickMarker.visible){this.clickMarker.scale.setScalar(1+(t-this.markerTime)*.25);if(t-this.markerTime>1.3)this.clickMarker.visible=false;}
    if(!paused){this.updateStory(dt);this.updateCompanion(dt);}
    // Pausing must also preserve the bears' elevated positions in the nest.
    else if(this.story==='moon')this.updateMoonJourney(0);
    this.updateLighting(paused?0:dt);
    for(const bear of [this.dudu,this.bubu])bear.userData.umbrella.update(paused?0:dt,this.weather.blend,umbrellaAllowed(this.story,bear.name,this.storyTime,this.moonJourney?.phase));
    const detail=this.thirdPerson||(this.playing&&!this.overview&&this.zoomView<40);
    this.meadow.update(t,this.reducedMotion,this.weather.blend,this.state.position,detail);
    for(const canopy of this.canopyBatches){
      const bounds=canopy.geometry.boundingSphere;
      canopy.visible=detail&&Math.hypot(bounds.center.x-this.state.position.x,bounds.center.z-this.state.position.z)<34+bounds.radius;
    }
    this.sunlight.update(t,this.nightBlend,this.weather.blend,this.reducedMotion);
    [this.dudu,this.bubu].forEach(bear=>animateBearFace(bear,t,false,this.reducedMotion));
    this.atmosphere.update(paused?0:dt,this.time,this.playing?this.state.position:{x:0,z:0},this.reducedMotion,this.nightBlend,this.weather.blend);
    this.rain.update(this.weather,this.playing?this.state.position:{x:0,z:0},this.nightBlend,this.reducedMotion,[this.dudu,this.bubu].filter(b=>b.userData.umbrella.active).map(b=>b.userData.umbrella.cover));
    this.sky.update(paused?0:dt,t,this.nightBlend,this.reducedMotion,this.story==='moon'?this.moonJourney.progress:0,this.weather.blend);
    if(this.guidance.count&&!this.reducedMotion)this.guidance.material.opacity=.65+Math.sin(t*2)*.2;
    this.setCamera(false,dt);this.reactions.update(paused?0:dt,this.camera);this.renderer.clear();this.sky.render(this.renderer);this.renderer.clearDepth();this.renderer.render(this.scene,this.camera);
  }
}
