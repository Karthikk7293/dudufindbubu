// Weather has its own clock so pause and reduced-motion settings stay consistent.
export class WeatherState {
  constructor() { this.mode='clear';this.blend=0;this.time=0; }
  set(mode, immediate=false) {
    this.mode=mode==='rain'?'rain':'clear';
    if(immediate)this.blend=this.mode==='rain'?1:0;
  }
  update(dt) {
    if(!Number.isFinite(dt)||dt<=0)return;
    const target=this.mode==='rain'?1:0;
    this.blend+=(target-this.blend)*(1-Math.exp(-dt*1.5));
    if(Math.abs(target-this.blend)<.001)this.blend=target;
    if(this.blend>0)this.time+=dt;
  }
}

export const wrap=(value,span)=>((value%span)+span)%span;

// Reusable output avoids allocating hundreds of objects on every rain frame.
export function rainPosition(drop,time,focus,out) {
  const fall=wrap(drop.phase+time*drop.speed,18);
  out.x=focus.x+wrap(drop.x+time*1.6-focus.x+17,34)-17;
  out.y=18.25-fall;
  out.z=focus.z+wrap(drop.z+time*.35-focus.z+17,34)-17;
  return out;
}

// Canopies shield the space below their curved fabric, not the rain above it.
export function underRainCover(point,covers){
  return covers.some(cover=>{
    const radial=((point.x-cover.x)**2+(point.z-cover.z)**2)/(cover.radius**2);
    return radial<1&&point.y<cover.y+cover.height*(1-radial);
  });
}
