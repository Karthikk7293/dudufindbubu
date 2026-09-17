import * as THREE from 'three';
import { clearCameraDistance } from './follow-camera.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function portraitComposition(position,heading,obstacles=[]){
  const target=new THREE.Vector3(position.x,position.y+.9,position.z),distance=4.65;
  let best=-Infinity,result;
  for(const pitch of [.24,.42,.65])for(const offset of [0,-.3,.3,-.6,.6,-.95,.95,-1.4,1.4,-2.1,2.1,Math.PI]){
    const yaw=heading+.25+offset,direction=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    const clear=clearCameraDistance(target,direction,distance,obstacles);
    const score=clear/distance*7-Math.abs(offset)*.7-(pitch-.24);
    if(score>best){best=score;result={target,position:target.clone().addScaledVector(direction,clear)};}
  }
  return result;
}

export class PostcardCamera {
  constructor(world){this.world=world;this.active=false;this.needsRender=false;}
  get available(){return !this.world.cinematic||this.world.moonJourney?.phase==='stargazing';}
  useCamera(camera,target){
    this.controls?.dispose();this.camera=camera;
    this.controls=new OrbitControls(camera,this.world.renderer.domElement);
    this.controls.target.copy(target);this.controls.enablePan=false;this.controls.enableDamping=false;
    this.controls.minDistance=Math.min(2.8,camera.position.distanceTo(target));this.controls.maxDistance=150;this.controls.minZoom=.5;this.controls.maxZoom=4;
    this.controls.maxPolarAngle=Math.PI*.49;this.controls.addEventListener('change',()=>this.needsRender=true);
    this.controls.update();this.needsRender=true;
  }
  open(){
    if(this.active||!this.available)return false;
    this.original={camera:this.world.camera.clone(),target:(this.world.story==='moon'?this.world.moonLook:this.world.thirdPerson?this.world.follow.target:this.world.cameraTarget).clone()};
    this.active=true;this.useCamera(this.original.camera.clone(),this.original.target);return true;
  }
  close(){this.controls?.dispose();this.controls=null;this.active=false;this.needsRender=false;}
  reset(){if(!this.active)return;this.useCamera(this.original.camera.clone(),this.original.target);this.resize();}
  portrait(){
    if(!this.active)return;
    const bear=this.world.dudu,heading=bear.rotation.y;
    const camera=new THREE.PerspectiveCamera(48,this.world.width/this.world.height,.08,180);
    const {target,position}=portraitComposition(bear.position,heading,this.world.cameraObstacles);
    camera.position.copy(position);
    this.useCamera(camera,target);
  }
  orbit(dx,dy){
    if(!this.active)return;
    const offset=this.camera.position.clone().sub(this.controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
    spherical.theta+=dx;spherical.phi=THREE.MathUtils.clamp(spherical.phi+dy,.08,this.controls.maxPolarAngle);
    this.camera.position.copy(this.controls.target).add(offset.setFromSpherical(spherical));this.controls.update();
  }
  zoom(factor){
    if(!this.active)return;
    if(this.camera.isOrthographicCamera){this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom/factor,.5,4);this.camera.updateProjectionMatrix();}
    else{const offset=this.camera.position.clone().sub(this.controls.target);offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,this.controls.minDistance,150));this.camera.position.copy(this.controls.target).add(offset);}
    this.controls.update();this.needsRender=true;
  }
  resize(){
    if(!this.active)return;
    this.width=this.world.width;this.height=this.world.height;
    if(this.camera.isPerspectiveCamera)this.camera.aspect=this.world.width/this.world.height;
    else{const half=(this.camera.top-this.camera.bottom)/2;this.camera.left=-half*this.world.width/this.world.height;this.camera.right=-this.camera.left;}
    this.camera.updateProjectionMatrix();this.needsRender=true;
  }
  render(force=false){
    if(!this.active)return;
    if(this.width!==this.world.width||this.height!==this.world.height)this.resize();
    if(!force&&!this.needsRender)return;
    const world=this.world;world.reactions.update(0,this.camera);world.renderer.clear();world.sky.render(world.renderer);world.renderer.clearDepth();world.renderer.render(world.scene,this.camera);this.needsRender=false;
  }
  async capture(message){
    if(!this.active)throw new Error('Open the postcard camera first.');
    this.render(true);
    const source=this.world.renderer.domElement,width=Math.min(1600,source.width),height=Math.round(width*source.height/source.width),border=Math.round(width*.035),footer=Math.round(width*.13);
    const canvas=document.createElement('canvas');canvas.width=width+border*2;canvas.height=height+border*2+footer;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser could not make a postcard.');
    ctx.fillStyle='#f6f1e5';ctx.fillRect(0,0,canvas.width,canvas.height);
    // Copy immediately while the WebGL drawing buffer still contains this frame.
    ctx.drawImage(source,border,border,width,height);
    ctx.fillStyle='#526549';ctx.font=`600 ${Math.round(width*.023)}px Georgia`;ctx.fillText('A LITTLE MOMENT IN SUNNYWOOD',border,height+border*2+footer*.3);
    ctx.fillStyle='#7c816e';ctx.font=`italic ${Math.round(width*.023)}px Georgia`;
    ctx.fillText((message.trim()||'A little journey. A lot of love.').slice(0,80),border,height+border*2+footer*.65,width);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('The postcard could not be created. Please try again.');return blob;
  }
}
