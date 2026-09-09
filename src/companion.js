import { findPath, isWalkable, moveWithCollisions } from './game-state.js';

// Replan around the same water and tree collisions as Dudu. Bubu never teleports
// to catch up, and slows down when she is close enough to walk with him.
export class Companion {
  constructor(position, obstacles) {
    this.position={...position};this.obstacles=obstacles;this.route=[];this.replan=0;
  }
  update(dt, target) {
    const before={...this.position},distance=Math.hypot(target.x-before.x,target.z-before.z);
    this.replan-=dt;
    if(distance<1.65){this.route=[];return {moving:false,dx:0,dz:0};}
    if(this.replan<=0){this.route=findPath(this.position,target,this.obstacles);this.replan=.65;}
    let remaining=Math.min(dt*Math.min(8.4,4.6+Math.max(0,distance-3)*.55),distance-1.5);
    while(this.route.length&&remaining>0){
      const next=this.route[0],dx=next.x-this.position.x,dz=next.z-this.position.z,length=Math.hypot(dx,dz);
      if(length<.12){this.route.shift();continue;}
      const step=Math.min(remaining,length);
      moveWithCollisions(this.position,dx/length*step,dz/length*step,this.obstacles);remaining-=step;
      if(step===length)this.route.shift();
    }
    const dx=this.position.x-before.x,dz=this.position.z-before.z;
    return {moving:Math.hypot(dx,dz)>.001,dx,dz};
  }
}

export function companionStart(state, obstacles) {
  const saved=state.companionPosition;
  if(saved&&isWalkable(saved.x,saved.z,obstacles))return {...saved};
  for(let radius=1.7;radius<=4;radius+=.6)for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,point={x:state.position.x+Math.cos(angle)*radius,z:state.position.z+Math.sin(angle)*radius};
    if(isWalkable(point.x,point.z,obstacles)&&findPath(state.position,point,obstacles).length)return point;
  }
  return {...state.position};
}
