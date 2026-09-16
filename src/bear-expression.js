const calm={eyes:1,smile:0,open:0,blush:0,brow:0,tilt:0,chin:0,paws:0,cheer:0};
const moodKeys=Object.keys(calm),blinkWindows=[[.4,.18],[4.65,.16],[4.93,.13]];
export const BEAR_MOODS={
  calm,
  curious:{...calm,eyes:1.12,brow:.65,tilt:.1,chin:.035},
  surprised:{...calm,eyes:1.3,open:.85,blush:.2,brow:1,tilt:-.03,chin:-.025,cheer:.6},
  delighted:{...calm,eyes:.8,smile:1,open:.8,blush:.65,brow:.15,tilt:.03,chin:-.06,cheer:1},
  shy:{...calm,eyes:.82,smile:.35,blush:1,brow:.2,tilt:-.11,chin:.1,paws:1},
  content:{...calm,eyes:.9,smile:.6,blush:.45,tilt:.05,chin:.015,paws:.2},
  wish:{...calm,eyes:.3,smile:.95,open:.35,blush:.3,chin:.1,paws:.6},
  wonder:{...calm,eyes:1.25,smile:.05,open:.5,blush:.3,brow:.65,tilt:-.025,chin:-.14,paws:.12},
};
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

export class BearExpression {
  constructor(){this.reset();}
  reset(){this.mood='calm';this.reaction=null;this.remaining=0;this.age=0;this.values={...calm,look:0};}
  react(mood,duration=2){
    if(!Object.hasOwn(BEAR_MOODS,mood)||!Number.isFinite(duration)||duration<=0)return false;
    this.reaction=mood;this.remaining=Math.min(6,duration);this.age=0;return true;
  }
  update(dt,{mood='calm',look=0,scripted=false}={},reducedMotion=false){
    if(!Number.isFinite(dt)||dt<=0)return this.values;
    this.age+=dt;this.remaining=Math.max(0,this.remaining-dt);
    if(!this.remaining)this.reaction=null;
    this.mood=!scripted&&this.reaction?this.reaction:Object.hasOwn(BEAR_MOODS,mood)?mood:'calm';
    if(!scripted&&this.reaction==='delighted'&&this.age<.32)this.mood='surprised';
    const target=BEAR_MOODS[this.mood],ease=reducedMotion?1:1-Math.exp(-dt*9);
    for(const key of moodKeys)this.values[key]+=(target[key]-this.values[key])*ease;
    this.values.look+=(clamp(Number.isFinite(look)?look:0,-.42,.42)-this.values.look)*ease;
    return this.values;
  }
}

// The two bears blink at different moments. A short double blink adds life
// without changing expression timers or introducing per-frame randomness.
export function bearBlink(time,offset=0,reducedMotion=false){
  if(reducedMotion)return 1;
  const t=((time+offset)%7.6+7.6)%7.6;
  for(const [start,duration] of blinkWindows){
    if(t>=start&&t<start+duration)return .06+.94*Math.abs((t-start)/duration*2-1);
  }
  return 1;
}

export function lookAtBearTarget(bear,target){
  if(!target)return 0;
  const dx=target.x-bear.position.x,dz=target.z-bear.position.z;
  if(Math.hypot(dx,dz)<.1)return 0;
  const angle=Math.atan2(dx,dz)-bear.rotation.y,relative=Math.atan2(Math.sin(angle),Math.cos(angle));
  // Never twist the head towards something behind the shoulders.
  return Math.abs(relative)<1.4?clamp(relative*.65,-.42,.42):0;
}

export function applyBearFace(bear,time,happy=false,reducedMotion=false){
  const {eyes,happyEyes,cheeks=[],brows=[],mouth,openMouth,tongue,blinkOffset=0,expression}=bear.userData;
  const v=expression?.values||calm,smile=happy?1:v.smile;
  const blink=bearBlink(time,blinkOffset,reducedMotion),closed=smooth(.3,.78,smile);
  eyes.forEach(eye=>{
    eye.visible=closed<=.5;eye.scale.x=.060*(1+(v.eyes-1)*.35);
    eye.scale.y=.072*v.eyes*blink*(1-closed*.94);
    const side=eye.userData.side??Math.sign(eye.position.x);
    eye.position.x=side*.23+(v.look||0)*.025;
  });
  happyEyes.forEach(eye=>{eye.visible=closed>.5;eye.scale.y=Math.max(.35,closed);});
  cheeks.forEach(cheek=>cheek.scale.set(.158*(1+v.blush*.1),.155*(1+v.blush*.08),.03));
  brows.forEach((brow,i)=>{
    brow.visible=v.brow>.05;brow.scale.setScalar(.55+v.brow*.45);
    brow.position.y=-.14+v.brow*.045;brow.rotation.z=(i?1:-1)*(v.brow*.12-v.blush*.09);
  });
  if(mouth){mouth.visible=v.open<.18;mouth.scale.x=1+smile*.15;}
  if(openMouth){openMouth.visible=v.open>.04;openMouth.scale.set(.047+v.open*.025,.012+v.open*.075,1);}
  if(tongue)tongue.visible=v.open>.5;
}
