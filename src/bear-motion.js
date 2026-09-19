export function turnBear(bear,heading,dt,rate=10){
  if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(heading))return;
  const difference=Math.atan2(Math.sin(heading-bear.rotation.y),Math.cos(heading-bear.rotation.y));
  bear.rotation.y+=difference*(1-Math.exp(-dt*rate));
}

const clamp=(x,limit)=>Math.max(-limit,Math.min(limit,x));

// Distance-driven steps stay in sync when slowing down or following a route.
export function animateBearPose(bear,dt,time,moving,reducedMotion=false,emotions=true){
  const data=bear.userData,{body,head,legs,arms,forearms=[],feet=[],ears=[],pack}=data;
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
  const resting=1-strideWeight,paws=(v.paws||0)*resting,cheer=(v.cheer||0)*resting,hello=(v.wave||0)*resting,perk=v.ears||0;
  // Changing pace tips the weight forward on a start and settles it back on a stop.
  const lastVelocity=data.velocity||0;
  data.velocity=lastVelocity+(velocity-lastVelocity)*(1-Math.exp(-dt*6));
  const surge=reducedMotion?0:clamp((data.velocity-lastVelocity)/dt*.014,.07);
  const lastHeading=data.lastHeading??bear.rotation.y;
  const turn=Math.atan2(Math.sin(bear.rotation.y-lastHeading),Math.cos(bear.rotation.y-lastHeading));
  data.lastHeading=bear.rotation.y;
  const lean=reducedMotion?0:clamp(turn/dt*.008,.045)*strideWeight;
  // Turning on the spot lets the shoulders trail the feet instead of snapping round.
  const pivot=reducedMotion?0:clamp(turn/dt*.022,.11)*resting;
  const phase=data.gait,ease=1-Math.exp(-dt*12),mix=(a,b)=>a+(b-a)*ease;
  const breathing=reducedMotion?0:Math.sin(time*1.9+data.blinkOffset)*.012;
  // A slow weight shift keeps a standing bear alive between the bigger gestures.
  const settle=reducedMotion?0:Math.sin(time*.42+data.blinkOffset)*resting;
  const twist=reducedMotion?0:Math.sin(phase)*.05*strideWeight;
  const joyHop=!reducedMotion&&expression?.reaction==='delighted'&&expression.age<.7?Math.sin(expression.age/.7*Math.PI)*.065*resting:0;
  body.position.x=mix(body.position.x,reducedMotion?0:Math.sin(phase)*.024*strideWeight+settle*.016);
  body.position.y=mix(body.position.y,!reducedMotion?(1-Math.cos(phase*2))*(.027+run*.018)*strideWeight+breathing*resting+joyHop:0);
  body.rotation.x=mix(body.rotation.x,reducedMotion?0:run*.075+surge);
  body.rotation.y=mix(body.rotation.y,twist-pivot);
  body.rotation.z=mix(body.rotation.z,!reducedMotion?Math.sin(phase)*.022*strideWeight+lean+settle*.018+pivot*.35:0);
  legs.forEach((leg,i)=>{
    const stride=Math.sin(phase+i*Math.PI);
    leg.rotation.x=mix(leg.rotation.x,stride*(.43+run*.16)*strideWeight);
    leg.rotation.z=mix(leg.rotation.z,reducedMotion?0:Math.sin(phase+i*Math.PI)*.035*strideWeight);
    leg.position.y=mix(leg.position.y,.24+Math.max(0,-stride)*(.065+run*.045)*strideWeight);
    // The sole stays level under the bear, pushes off the toes, then clears the ground.
    if(feet[i])feet[i].rotation.x=mix(feet[i].rotation.x,((stride>0?stride*(.4+run*.14):stride*.2)-stride*(.43+run*.16))*strideWeight);
  });
  arms.forEach((arm,i)=>{
    const side=i?1:-1,swing=Math.sin(phase+i*Math.PI),wave=i===(data.waveHand??0)?hello:0;
    const flutter=reducedMotion?0:Math.sin(time*7.2+data.blinkOffset)*.34*wave;
    arm.rotation.x=mix(arm.rotation.x,-swing*(.28+run*.2)*strideWeight-paws*.9-cheer*.25-wave*.75);
    arm.rotation.z=mix(arm.rotation.z,side*(cheer*1.15-paws*.7+run*.12+wave*.95+flutter));
    // Keep shoulders attached while the elbow brings the paw to the chest.
    arm.position.x=mix(arm.position.x,side*((data.armX??.52)-paws*.045));
    arm.position.z=mix(arm.position.z,paws*.10);
    if(forearms[i])forearms[i].rotation.x=mix(forearms[i].rotation.x,-paws*.85-cheer*.3-run*.45-wave*.55);
  });
  // A wandering gaze only plays while nothing has caught the bear's eye.
  const wander=reducedMotion?0:(Math.sin(time*.5+data.blinkOffset)*.045+Math.sin(time*.21+data.blinkOffset*1.7)*.07)*resting*(1-Math.min(1,Math.abs(v.look||0)/.42));
  head.rotation.x=mix(head.rotation.x,(v.chin||0)+(v.gaze||0)*(1-run*.5)+(reducedMotion?0:Math.sin(phase*2)*.018*strideWeight)-run*.035);
  head.rotation.y=mix(head.rotation.y,(v.look||0)+wander-lean*1.5-twist*.55+pivot*.6);
  head.rotation.z=mix(head.rotation.z,(v.tilt||0)*resting+(reducedMotion?0:Math.sin(time*.8+data.blinkOffset)*.015));
  ears.forEach((ear,i)=>{
    const rest=ear.userData.rest||(ear.userData.rest={x:ear.position.x,y:ear.position.y});
    const side=Math.sign(rest.x)||(i?1:-1),t=(time+data.blinkOffset+i*.7)%8;
    const flick=!reducedMotion&&t<.3?Math.sin(t/.3*Math.PI)*.09:0;
    // Ears lift and open when something is interesting, and fold when shy or sleepy.
    ear.rotation.z=mix(ear.rotation.z,flick-side*perk*.26);
    ear.position.x=mix(ear.position.x,rest.x+side*perk*.02);
    ear.position.y=mix(ear.position.y,rest.y+perk*.05);
  });
  if(pack)pack.rotation.x=mix(pack.rotation.x,!reducedMotion?Math.sin(phase*2)*.035*strideWeight:0);
}
