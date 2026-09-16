import { MOON_NEST, findPath, moveWithCollisions } from './game-state.js';

export const CLIMB_SECONDS=10;
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export const ladderFoot=index=>({x:MOON_NEST.x+(index? .7:-.7),y:.23,z:MOON_NEST.z+6.5});
export const nestSeat=index=>({x:MOON_NEST.x+(index? .78:-.78),y:MOON_NEST.height+.08,z:MOON_NEST.z+2.8});

// A small, explicit story sequence keeps both bears on the ladder and allows
// pause, return, and replay without writing elevated positions into a save.
export class MoonJourney {
  constructor(dudu,bubu,obstacles,nightBlend=0){
    this.obstacles=obstacles;this.phase='approaching';this.time=0;this.progress=0;
    this.initialNight=nightBlend;this.nightBlend=nightBlend;this.events=[];
    this.bears=[dudu,bubu].map((position,i)=>({position:{x:position.x,y:.23,z:position.z},route:findPath(position,ladderFoot(i),obstacles),moving:false}));
    this.valid=this.bears.every((bear,i)=>bear.route.length||Math.hypot(bear.position.x-ladderFoot(i).x,bear.position.z-ladderFoot(i).z)<.2);
  }
  descend(){
    if(this.phase!=='stargazing')return false;
    this.phase='descending';this.time=0;this.events.push('moon-descending');return true;
  }
  update(dt){
    if(!Number.isFinite(dt)||dt<=0||!this.valid||this.phase==='finished')return;
    if(this.phase==='approaching'){
      for(const bear of this.bears){
        bear.moving=false;let travel=dt*3.4;
        while(travel>0&&bear.route.length){
          const next=bear.route[0],dx=next.x-bear.position.x,dz=next.z-bear.position.z,distance=Math.hypot(dx,dz);
          if(distance<.06){bear.route.shift();continue;}
          const step=Math.min(distance,travel);
          moveWithCollisions(bear.position,dx/distance*step,dz/distance*step,this.obstacles);
          bear.heading=Math.atan2(dx,dz);bear.moving=true;travel-=step;
        }
      }
      if(this.bears.every(b=>!b.route.length)){this.phase='climbing';this.time=0;this.events.push('moon-climbing');}
      return;
    }
    if(this.phase==='stargazing')return;
    this.time+=dt;
    const ascending=this.phase==='climbing',t=Math.min(1,this.time/CLIMB_SECONDS);
    this.progress=ascending?t:1-t;
    const height=smooth(this.progress/.82),step=smooth((this.progress-.82)/.18);
    this.onLadder=this.progress<.82;
    this.nightBlend=ascending?this.initialNight+(1-this.initialNight)*smooth(t):1;
    this.bears.forEach((bear,i)=>{
      const bottom=ladderFoot(i),top=nestSeat(i);
      // Reach the front lip before stepping onto the deck, so the bears never
      // pass through its underside. Descent reverses the same little step.
      const edge=MOON_NEST.z+5.5;
      bear.position={x:bottom.x+(top.x-bottom.x)*step,y:bottom.y+(top.y-bottom.y)*height,z:bottom.z+(edge-bottom.z)*height+(top.z-edge)*step};
      bear.heading=Math.PI;bear.moving=true;
    });
    if(t===1){this.phase=ascending?'stargazing':'finished';this.bears.forEach(b=>b.moving=false);this.events.push(ascending?'moon-arrived':'moon-finished');}
  }
}
