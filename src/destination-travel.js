import * as THREE from 'three';
import { DESTINATIONS, destinationById, freshTravel, rememberLandmark } from './destinations.js';
import { Companion } from './companion.js';
import { animateBearPose, turnBear } from './bear-motion.js';

export class DestinationTravel {
  constructor(world){
    this.world=world;this.current=DESTINATIONS[0];this.log=freshTravel();this.time=0;this.active=null;
    this.forestRoot=new THREE.Group();this.forestRoot.name='Sunnywood scenery';
    this.shared=new Set([world.ambient,world.sunLight,world.fillLight,world.dudu,world.bubu,world.clickMarker,world.reactions.mesh,world.rain.streaks,world.rain.puddles,world.rain.ripples,this.forestRoot]);
    this.wrapForest();world.scene.add(this.forestRoot);
  }
  get away(){return this.current.id!=='forest';}
  wrapForest(){for(const child of [...this.world.scene.children])if(!this.shared.has(child)&&child!==this.active?.group)this.forestRoot.add(child);}
  async visit(id){
    const place=destinationById(id),world=this.world;
    if(!place||place===this.current||world.cinematic||!world.state.departed)return false;
    if(id==='forest'){this.returnHome();return true;}
    // Compile the destination before changing the current scene, so a failed
    // import or GPU warm-up leaves the current adventure intact.
    const {DestinationScene}=await import('./destination-scene.js');
    const next=new DestinationScene(place,world.mobile);
    try{await world.renderer.compileAsync(next.group,world.camera,world.scene);}catch(error){next.dispose();throw error;}
    if(!this.away){
      this.home={position:{...world.state.position},companionPosition:world.state.companionPosition?{...world.state.companionPosition}:null,companion:world.companion,bubuVisible:world.bubu.visible,bubuPosition:world.bubu.position.clone(),duduRotation:world.dudu.rotation.y,bubuRotation:world.bubu.rotation.y,obstacles:world.obstacles,cameraObstacles:world.cameraObstacles,story:world.story,yaw:world.follow.yaw};
      this.wrapForest();this.forestRoot.visible=false;
    }else this.leaveDestination();
    this.current=place;this.active=next;this.time=0;world.scene.add(next.group);
    world.obstacles=next.obstacles;world.cameraObstacles=next.cameraObstacles;world.navigation=next.layout;
    world.state.position={...(this.log.positions[id]||place.spawn)};
    world.story='exploring';world.bubu.visible=world.state.completed;
    world.companion=world.state.completed?new Companion({x:world.state.position.x+1.7,z:world.state.position.z},next.obstacles,next.layout):null;
    if(world.companion&&!world.walkable(world.companion.position.x,world.companion.position.z))world.companion.position={...world.state.position};
    if(!this.log.visited.includes(id))this.log.visited.push(id);
    this.resetView();
    return true;
  }
  leaveDestination(){
    this.log.positions[this.current.id]={...this.world.state.position};this.active?.dispose();this.active=null;
  }
  returnHome(){
    if(!this.away)return;
    this.leaveDestination();const world=this.world,home=this.home;
    world.state.position={...home.position};world.state.companionPosition=home.companionPosition;
    world.companion=home.companion;world.story=home.story;world.obstacles=home.obstacles;world.cameraObstacles=home.cameraObstacles;world.navigation=undefined;
    world.bubu.visible=home.bubuVisible;world.bubu.position.copy(home.bubuPosition);world.dudu.rotation.y=home.duduRotation;world.bubu.rotation.y=home.bubuRotation;
    this.current=DESTINATIONS[0];this.forestRoot.visible=true;this.resetView();world.follow.yaw=home.yaw;this.home=null;
  }
  resetView(){
    const world=this.world;world.follow.initialized=false;world.follow.yaw=.12;world.overview=false;world.clickMarker.visible=false;world.friendMoment=null;world.reactions.reset();
    world.renderer.shadowMap.needsUpdate=true;world.needsRender=true;
    world.sky.setPalette(this.current.id==='forest'?null:this.current.sky);
    world.dudu.position.set(world.state.position.x,this.active?.height(world.state.position.x,world.state.position.z)??.2,world.state.position.z);
    if(world.companion&&this.away)world.bubu.position.set(world.companion.position.x,this.active.height(world.companion.position.x,world.companion.position.z),world.companion.position.z);
    for(const bear of [world.dudu,world.bubu]){bear.userData.lastPosition=null;bear.userData.umbrella.update(0,0);}
    world.setCamera(true);
  }
  reset(){this.returnHome();this.log=freshTravel();}
  nearby(){return this.current.landmarks.find(item=>Math.hypot(item.x-this.world.state.position.x,item.z-this.world.state.position.z)<3);}
  remember(item){return rememberLandmark(this.log,this.current.id,item.id,this.world.state.position);}
  update(dt,moving,paused,animateFace){
    const world=this.world,place=this.current,region=this.active;this.time+=dt;
    const pos=world.state.position;world.dudu.position.set(pos.x,region.height(pos.x,pos.z),pos.z);
    for(const bear of [world.dudu,world.bubu])bear.userData.expression.update(dt,{mood:world.state.completed?'content':'curious',scripted:false},world.reducedMotion);
    animateBearPose(world.dudu,dt,this.time,moving,world.reducedMotion);
    if(world.companion){
      const step=paused?{moving:false}:world.companion.update(dt,pos),p=world.companion.position;
      world.bubu.position.set(p.x,region.height(p.x,p.z),p.z);if(step.moving)turnBear(world.bubu,Math.atan2(step.dx,step.dz),dt);
      animateBearPose(world.bubu,dt,this.time,step.moving,world.reducedMotion);
    }
    world.updateLighting(dt);
    const snowy=place.id==='snowlands',n=world.nightBlend,rain=world.weather.blend;
    world.scene.fog.color.setHex(place.sky).lerp(new THREE.Color(0x25394f),n);world.ambient.groundColor.setHex(place.ground).multiplyScalar(.65);
    region.update(dt,n,rain,world.reducedMotion,this.log.memories,pos);
    for(const bear of [world.dudu,world.bubu]){bear.userData.umbrella.update(dt,snowy?0:rain);animateFace(bear,this.time,false,world.reducedMotion);}
    world.rain.update(world.weather,pos,n,world.reducedMotion,[world.dudu,world.bubu].filter(b=>b.userData.umbrella.active).map(b=>b.userData.umbrella.cover));
    world.rain.puddles.visible=world.rain.ripples.visible=false;if(snowy)world.rain.streaks.visible=false;
    world.sky.update(dt,this.time,n,world.reducedMotion,0,snowy?rain*.3:rain);
    if(world.clickMarker.visible&&this.time-world.markerTime>1.3)world.clickMarker.visible=false;
    world.setCamera(false,dt);world.reactions.update(dt,world.camera);
    world.renderer.clear();world.sky.render(world.renderer);world.renderer.clearDepth();world.renderer.render(world.scene,world.camera);
  }
  drawMap(ctx,w,h){
    const scale=Math.min(w,h)/64,cx=w/2,cy=h/2,point=(x,z)=>[cx+x*scale,cy+z*scale];
    ctx.fillStyle=`#${this.current.ground.toString(16).padStart(6,'0')}`;ctx.beginPath();ctx.arc(cx,cy,29*scale,0,Math.PI*2);ctx.fill();
    if(this.current.id==='beach'){ctx.fillStyle='#77b8c3';ctx.fillRect(cx-28*scale,cy-28*scale,56*scale,18.5*scale);}
    ctx.strokeStyle='#f3ead5';ctx.lineCap='round';ctx.lineJoin='round';
    for(const path of this.active.paths){ctx.lineWidth=path.width*scale;ctx.beginPath();path.points.forEach(([x,z],i)=>i?ctx.lineTo(...point(x,z)):ctx.moveTo(...point(x,z)));ctx.stroke();}
    ctx.fillStyle='#71817488';for(const o of this.active.obstacles){ctx.beginPath();ctx.arc(...point(o.x,o.z),o.radius*scale,0,Math.PI*2);ctx.fill();}
    ctx.textAlign='center';ctx.font=`500 ${Math.round(scale*1.25)}px "DM Sans",sans-serif`;
    for(const place of this.current.landmarks){if(!this.log.memories.includes(`${this.current.id}/${place.id}`))continue;const [x,y]=point(place.x,place.z);ctx.fillStyle='#6d8d74';ctx.beginPath();ctx.arc(x,y,scale,0,Math.PI*2);ctx.fill();ctx.fillStyle='#43594d';ctx.fillText(place.name,x,y+2.7*scale);}
    if(this.world.bubu.visible){ctx.fillStyle='#f4eee3';ctx.beginPath();ctx.arc(...point(this.world.bubu.position.x,this.world.bubu.position.z),1.2*scale,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#8f6644';ctx.beginPath();ctx.arc(...point(this.world.state.position.x,this.world.state.position.z),1.25*scale,0,Math.PI*2);ctx.fill();
  }
  snapshot(){return {id:this.current.id,name:this.current.name,visited:[...this.log.visited],memories:[...this.log.memories],landmarks:this.current.landmarks,sceneCount:this.active?1:0,forestVisible:this.forestRoot.visible,homePosition:this.home?.position,animationTime:this.active?.time};}
}
