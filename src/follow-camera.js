import * as THREE from 'three';

export const FOLLOW_MIN=4.5, FOLLOW_MAX=16;
export const clampDistance=value=>Math.max(FOLLOW_MIN,Math.min(FOLLOW_MAX,value));
export const clampPitch=value=>Math.max(.08,Math.min(.62,value));

function sphereHit(origin,direction,obstacle,y,r){
  const x=origin.x-obstacle.x,dy=origin.y-y,z=origin.z-obstacle.z;
  const b=x*direction.x+dy*direction.y+z*direction.z,c=x*x+dy*dy+z*z-r*r;
  if(c<0)return Infinity;
  const disc=b*b-c;
  return disc<0?Infinity:-b-Math.sqrt(disc);
}
// Canopies use individual crown volumes; continuous capsules cover tall trunks.
// Padding also leaves room for the bear's silhouette beside the line of sight.
export function clearCameraDistance(origin,direction,distance,obstacles){
  let clear=distance;
  for(const obstacle of obstacles){
    const r=obstacle.radius+.32;
    let hit=Infinity;
    if(obstacle.minY!==undefined){
      const x=origin.x-obstacle.x,z=origin.z-obstacle.z;
      const a=direction.x**2+direction.z**2,b=x*direction.x+z*direction.z,c=x*x+z*z-r*r,disc=b*b-a*c;
      if(a>.0001&&disc>=0){const entry=(-b-Math.sqrt(disc))/a,y=origin.y+direction.y*entry;if(y>=obstacle.minY&&y<=obstacle.maxY)hit=entry;}
      for(const y of [obstacle.minY,obstacle.maxY]){const h=sphereHit(origin,direction,obstacle,y,r);if(h>0)hit=Math.min(hit,h);}
    }else hit=sphereHit(origin,direction,obstacle,obstacle.y,r);
    if(hit>0&&hit<clear)clear=Math.max(.6,hit-.15);
  }
  return clear;
}

export class FollowCamera {
  constructor(){
    this.camera=new THREE.PerspectiveCamera(56,1,.08,180);
    this.target=new THREE.Vector3();this.direction=new THREE.Vector3();
    this.distance=9;this.arm=9;this.yaw=.2;this.pitch=.22;this.initialized=false;
    this.avoidYaw=0;this.avoidPitch=0;this.clearTime=0;
  }
  resize(aspect){this.camera.aspect=aspect;this.camera.updateProjectionMatrix();}
  orbit(dx,dy){this.yaw-=dx*.006;this.pitch=clampPitch(this.pitch+dy*.004);}
  zoom(factor){this.distance=clampDistance(this.distance*factor);}
  recenter(heading){this.yaw=heading+Math.PI;this.pitch=.22;this.clearTime=0;}
  update(position,obstacles,dt,immediate=false){
    const target=new THREE.Vector3(position.x,(position.y||0)+1.2,position.z);
    const snap=immediate||!this.initialized;
    if(snap)this.target.copy(target);else this.target.lerp(target,1-Math.exp(-10*dt));
    this.initialized=true;
    const distance=this.distance;
    // Broad phase once, before trying alternative camera angles.
    obstacles=obstacles.filter(o=>(o.x-this.target.x)**2+(o.z-this.target.z)**2<(distance+o.radius+.5)**2);
    const directionAt=(yaw,pitch)=>this.direction.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    const clearance=(offset,lift)=>clearCameraDistance(this.target,directionAt(this.yaw+offset,clampPitch(this.pitch+lift)),distance,obstacles);
    const baseClear=clearance(0,0);
    let desiredYaw=this.avoidYaw,desiredPitch=this.avoidPitch;
    if(baseClear>=distance-.1){
      this.clearTime+=dt;
      if(this.clearTime>1.2){desiredYaw=0;desiredPitch=0;}
    }else{
      this.clearTime=0;
      // Prefer the nearest clear side and keep the chosen side while walking.
      // Only raise the view when a lateral move cannot clear the foliage.
      let best=-Infinity;
      for(const lift of [0,.14,.28])for(const offset of [this.avoidYaw,0,-.22,.22,-.45,.45,-.72,.72,-1.05,1.05,-1.4,1.4]){
        const score=clearance(offset,lift)/distance*6-Math.abs(offset)*.6-Math.abs(offset-this.avoidYaw)*.45-lift*1.2;
        if(score>best){best=score;desiredYaw=offset;desiredPitch=lift;}
      }
    }
    const ease=snap?1:1-Math.exp(-3.5*dt);
    this.avoidYaw=THREE.MathUtils.lerp(this.avoidYaw,desiredYaw,ease);this.avoidPitch=THREE.MathUtils.lerp(this.avoidPitch,desiredPitch,ease);
    directionAt(this.yaw+this.avoidYaw,clampPitch(this.pitch+this.avoidPitch));
    const clear=clearCameraDistance(this.target,this.direction,distance,obstacles);
    this.arm=snap||clear<this.arm?clear:THREE.MathUtils.lerp(this.arm,clear,1-Math.exp(-5*dt));
    // Keep the forest visible when an obstruction brings the camera closer.
    const baseFov=56;
    const fov=Math.min(102,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov/2))*distance/Math.max(.6,this.arm))));
    if(Math.abs(this.camera.fov-fov)>.01){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
    this.camera.position.copy(this.target).addScaledVector(this.direction,this.arm);
    this.camera.lookAt(this.target);this.camera.updateMatrixWorld();
    return this.camera;
  }
}
