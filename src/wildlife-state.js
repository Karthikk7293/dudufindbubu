// Small, deterministic behavior controller, independent of rendering.
export class Wildlife {
  constructor(kind,x,z,seed=1){
    this.kind=kind;this.home={x,z};this.position={x,z};this.target=null;
    this.seed=seed+41;this.mode=kind==='rabbit'?'idle':'graze';this.timer=1+this.random()*4;
    this.heading=this.random()*Math.PI*2;this.distance=0;this.speed=0;
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  chooseTarget(walkable,away){
    for(let i=0;i<12;i++){
      const angle=away?Math.atan2(this.position.x-away.x,this.position.z-away.z)+(this.random()-.5)*1.4:this.random()*Math.PI*2;
      const length=away?1.6+this.random()*1.2:.7+this.random()*1.8;
      const target={x:this.position.x+Math.sin(angle)*length,z:this.position.z+Math.cos(angle)*length};
      if(Math.hypot(target.x-this.home.x,target.z-this.home.z)>4.2)continue;
      // Check the whole short segment, not only its destination.
      if([.2,.4,.6,.8,1].every(t=>walkable(this.position.x+(target.x-this.position.x)*t,this.position.z+(target.z-this.position.z)*t))){
        this.target=target;this.mode=this.kind==='rabbit'?'hop':'walk';return;
      }
    }
    this.target=null;this.mode='idle';this.timer=1.5;
  }
  update(dt,player,walkable,night=0){
    if(dt<=0)return;this.speed=0;
    this.timer-=dt;
    const near=Math.hypot(player.x-this.position.x,player.z-this.position.z)<(this.kind==='deer'?3.5:2.5);
    if(near&&!this.target&&this.mode!=='alert') {this.mode='alert';this.timer=.8;}
    if(this.mode==='alert'){
      this.heading=Math.atan2(player.x-this.position.x,player.z-this.position.z);
      if(this.timer<=0)this.chooseTarget(walkable,player);
      return;
    }
    if(!near&&night>.7&&!this.target){this.mode='sleep';return;}
    if(this.mode==='sleep'){this.mode='idle';this.timer=.8;}
    if(this.target){
      const dx=this.target.x-this.position.x,dz=this.target.z-this.position.z,distance=Math.hypot(dx,dz);
      const pace={rabbit:1.35,deer:.65,fox:.85,sheep:.42}[this.kind];
      const step=Math.min(distance,dt*pace),x=this.position.x+dx/Math.max(distance,.001)*step,z=this.position.z+dz/Math.max(distance,.001)*step;
      if(distance>.035&&walkable(x,z)){
        this.position={x,z};this.heading=Math.atan2(dx,dz);this.distance+=step;this.speed=step/dt;
      }else {this.target=null;this.mode=this.kind==='fox'?'idle':'graze';this.timer=2+this.random()*5;}
    }else if(this.timer<=0)this.chooseTarget(walkable);
  }
}
