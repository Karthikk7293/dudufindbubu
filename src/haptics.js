export const HAPTIC_PATTERNS=Object.freeze({tap:8,gift:[20,35,35],friend:15,discovery:[12,35,18],celebrate:[25,55,35,65,50]});
const KEY='dudu-haptics';

export class ForestHaptics {
  constructor(env=globalThis){
    this.env=env;this.until=0;this.preference=null;
    try{this.preference=env.localStorage?.getItem(KEY);}catch{/* Preferences are optional. */}
  }
  get touch(){return !!this.env.matchMedia?.('(any-pointer: coarse)').matches;}
  get supported(){return this.touch&&typeof this.env.navigator?.vibrate==='function';}
  get enabled(){return this.preference==='on'||(this.preference!=='off'&&!this.env.matchMedia?.('(prefers-reduced-motion: reduce)').matches);}
  setEnabled(enabled){
    this.preference=enabled?'on':'off';
    try{this.env.localStorage?.setItem(KEY,this.preference);}catch{}
    if(!enabled)this.stop();
  }
  pulse(kind='tap'){
    if(!this.supported||!this.enabled||this.env.document?.hidden||this.env.navigator.userActivation?.hasBeenActive===false)return false;
    const pattern=HAPTIC_PATTERNS[kind];if(pattern===undefined)return false;
    const now=this.env.performance.now();
    // A button's generic tap must not replace its gift/celebration pattern.
    if(now<this.until&&(kind==='tap'||this.last!=='tap'))return false;
    try{
      if(this.env.navigator.vibrate(Array.isArray(pattern)?[...pattern]:pattern)===false)return false;
      this.last=kind;this.until=now+(Array.isArray(pattern)?pattern.reduce((a,b)=>a+b,0):pattern)+60;return true;
    }catch{return false;}
  }
  stop(){
    this.until=0;
    try{if(this.supported)this.env.navigator.vibrate(0);}catch{}
  }
}
