// Distance-driven steps stay in sync when slowing down or following a route.
export function animateBearPose(bear,dt,time,moving,reducedMotion=false){
  const data=bear.userData,{body,head,legs,arms,ears=[],pack}=data;
  const previous=data.lastPosition||bear.position;
  const travel=Math.min(1.5,Math.hypot(bear.position.x-previous.x,bear.position.z-previous.z));
  data.lastPosition={x:bear.position.x,z:bear.position.z};
  if(dt<=0)return;
  data.gait=(data.gait||0)+(moving?travel*5.8:0);
  const speed=moving?Math.min(1,travel/dt/4.6):0;
  data.strideWeight=(data.strideWeight||0)+(speed-(data.strideWeight||0))*(1-Math.exp(-dt*10));
  const strideWeight=data.strideWeight;
  const lastHeading=data.lastHeading??bear.rotation.y;
  const turn=Math.atan2(Math.sin(bear.rotation.y-lastHeading),Math.cos(bear.rotation.y-lastHeading));
  data.lastHeading=bear.rotation.y;
  const lean=reducedMotion?0:Math.max(-.045,Math.min(.045,turn/dt*.008))*strideWeight;
  const phase=data.gait,ease=1-Math.exp(-dt*12),mix=(a,b)=>a+(b-a)*ease;
  const breathing=reducedMotion?0:Math.sin(time*1.9+data.blinkOffset)*.012;
  body.position.y=mix(body.position.y,!reducedMotion?(1-Math.cos(phase*2))*.027*strideWeight+breathing*(1-strideWeight):0);
  body.rotation.z=mix(body.rotation.z,!reducedMotion?Math.sin(phase)*.022*strideWeight+lean:0);
  legs.forEach((leg,i)=>{
    const stride=Math.sin(phase+i*Math.PI);
    leg.rotation.x=mix(leg.rotation.x,stride*.43*strideWeight);
    leg.position.y=mix(leg.position.y,.24+Math.max(0,-stride)*.065*strideWeight);
  });
  arms.forEach((arm,i)=>{arm.rotation.x=mix(arm.rotation.x,-Math.sin(phase+i*Math.PI)*.28*strideWeight);arm.rotation.z=mix(arm.rotation.z,0);});
  head.rotation.x=mix(head.rotation.x,!reducedMotion?Math.sin(phase*2)*.018*strideWeight:0);
  head.rotation.y=mix(head.rotation.y,reducedMotion?0:Math.sin(time*.5+data.blinkOffset)*.09*(1-strideWeight)-lean*1.5);
  head.rotation.z=mix(head.rotation.z,reducedMotion?0:Math.sin(time*.8+data.blinkOffset)*.015);
  ears.forEach((ear,i)=>{const t=(time+data.blinkOffset+i*.7)%8;ear.rotation.z=mix(ear.rotation.z,!reducedMotion&&t<.3?Math.sin(t/.3*Math.PI)*.09:0);});
  if(pack)pack.rotation.x=mix(pack.rotation.x,!reducedMotion?Math.sin(phase*2)*.035*strideWeight:0);
}
