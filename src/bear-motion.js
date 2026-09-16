export function turnBear(bear,heading,dt,rate=10){
  if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(heading))return;
  const difference=Math.atan2(Math.sin(heading-bear.rotation.y),Math.cos(heading-bear.rotation.y));
  bear.rotation.y+=difference*(1-Math.exp(-dt*rate));
}

// Distance-driven steps stay in sync when slowing down or following a route.
export function animateBearPose(bear,dt,time,moving,reducedMotion=false,emotions=true){
  const data=bear.userData,{body,head,legs,arms,forearms=[],ears=[],pack}=data;
  const previous=data.lastPosition||bear.position;
  const travel=Math.min(1.5,Math.hypot(bear.position.x-previous.x,bear.position.z-previous.z));
  data.lastPosition={x:bear.position.x,z:bear.position.z};
  if(dt<=0)return;
  data.gait=(data.gait||0)+(moving?travel*4.8:0);
  const velocity=moving?travel/dt:0,speed=Math.min(1,velocity/4.6);
  data.strideWeight=(data.strideWeight||0)+(speed-(data.strideWeight||0))*(1-Math.exp(-dt*10));
  data.runWeight=(data.runWeight||0)+(Math.min(1,Math.max(0,(velocity-4.8)/3.2))-(data.runWeight||0))*(1-Math.exp(-dt*8));
  const strideWeight=data.strideWeight;
  const run=data.runWeight,expression=emotions?data.expression:null,v=expression?.values||{};
  const resting=1-strideWeight,paws=(v.paws||0)*resting,cheer=(v.cheer||0)*resting;
  const lastHeading=data.lastHeading??bear.rotation.y;
  const turn=Math.atan2(Math.sin(bear.rotation.y-lastHeading),Math.cos(bear.rotation.y-lastHeading));
  data.lastHeading=bear.rotation.y;
  const lean=reducedMotion?0:Math.max(-.045,Math.min(.045,turn/dt*.008))*strideWeight;
  const phase=data.gait,ease=1-Math.exp(-dt*12),mix=(a,b)=>a+(b-a)*ease;
  const breathing=reducedMotion?0:Math.sin(time*1.9+data.blinkOffset)*.012;
  const joyHop=!reducedMotion&&expression?.reaction==='delighted'&&expression.age<.7?Math.sin(expression.age/.7*Math.PI)*.065*resting:0;
  body.position.x=mix(body.position.x,reducedMotion?0:Math.sin(phase)*.024*strideWeight);
  body.position.y=mix(body.position.y,!reducedMotion?(1-Math.cos(phase*2))*(.027+run*.018)*strideWeight+breathing*resting+joyHop:0);
  body.rotation.x=mix(body.rotation.x,reducedMotion?0:run*.075);
  body.rotation.z=mix(body.rotation.z,!reducedMotion?Math.sin(phase)*.022*strideWeight+lean:0);
  legs.forEach((leg,i)=>{
    const stride=Math.sin(phase+i*Math.PI);
    leg.rotation.x=mix(leg.rotation.x,stride*(.43+run*.16)*strideWeight);
    leg.rotation.z=mix(leg.rotation.z,reducedMotion?0:Math.sin(phase+i*Math.PI)*.035*strideWeight);
    leg.position.y=mix(leg.position.y,.24+Math.max(0,-stride)*(.065+run*.045)*strideWeight);
  });
  arms.forEach((arm,i)=>{
    const side=i?1:-1,swing=Math.sin(phase+i*Math.PI);
    arm.rotation.x=mix(arm.rotation.x,-swing*(.28+run*.2)*strideWeight-paws*.9-cheer*.25);
    arm.rotation.z=mix(arm.rotation.z,side*(cheer*1.15-paws*.7+run*.12));
    // Keep shoulders attached while the elbow brings the paw to the chest.
    arm.position.x=mix(arm.position.x,side*(.52-paws*.045));
    arm.position.z=mix(arm.position.z,paws*.10);
    if(forearms[i])forearms[i].rotation.x=mix(forearms[i].rotation.x,-paws*.85-cheer*.3-run*.45);
  });
  head.rotation.x=mix(head.rotation.x,reducedMotion?0:(v.chin||0)+Math.sin(phase*2)*.018*strideWeight-run*.035);
  head.rotation.y=mix(head.rotation.y,reducedMotion?0:(v.look||0)+Math.sin(time*.5+data.blinkOffset)*.045*resting-lean*1.5);
  head.rotation.z=mix(head.rotation.z,reducedMotion?0:(v.tilt||0)*resting+Math.sin(time*.8+data.blinkOffset)*.015);
  ears.forEach((ear,i)=>{const t=(time+data.blinkOffset+i*.7)%8;ear.rotation.z=mix(ear.rotation.z,!reducedMotion&&t<.3?Math.sin(t/.3*Math.PI)*.09:0);});
  if(pack)pack.rotation.x=mix(pack.rotation.x,!reducedMotion?Math.sin(phase*2)*.035*strideWeight:0);
}
