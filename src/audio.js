// Original, generated audio. No recordings or remote audio assets are needed.
export class ForestAudio {
  constructor() { this.enabled=false; this.ctx=null; this.timer=null; this.step=0; this.note=0; this.paused=false; }
  async start() {
    try {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        this.ctx=new AudioContext(); this.master=this.ctx.createGain(); this.master.gain.value=0;
        this.master.connect(this.ctx.destination);
        this.createBreeze();
      }
      await this.ctx.resume(); this.enabled=true;
      this.master.gain.setTargetAtTime(this.paused ? .15 : .45,this.ctx.currentTime,.25);
      if (!this.timer) this.timer=setInterval(()=>this.schedule(),220);
      return true;
    } catch { return false; }
  }
  mute() { this.enabled=false; if(this.ctx) this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.12); }
  setNight(value){this.night=value;}
  setPaused(value) { this.paused=value; if(this.ctx && this.enabled) this.master.gain.setTargetAtTime(value?.12:.45,this.ctx.currentTime,.3); }
  tone(frequency, time, duration=.4, gain=.1, type='sine', endFrequency) {
    if (!this.ctx) return;
    const osc=this.ctx.createOscillator(), env=this.ctx.createGain();
    osc.type=type; osc.frequency.setValueAtTime(frequency,time);
    if(endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency,time+duration);
    env.gain.setValueAtTime(0,time);env.gain.linearRampToValueAtTime(gain,time+.015);env.gain.exponentialRampToValueAtTime(.0001,time+duration);
    osc.connect(env);env.connect(this.master);osc.start(time);osc.stop(time+duration+.02);
  }
  createBreeze() {
    const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*3,this.ctx.sampleRate), data=buffer.getChannelData(0);
    let brown=0;
    for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.04-.02)/1.02;data[i]=brown;}
    this.breeze=this.ctx.createBufferSource();this.breeze.buffer=buffer;this.breeze.loop=true;
    const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;
    const gain=this.ctx.createGain();gain.gain.value=.22;
    this.breeze.connect(filter);filter.connect(gain);gain.connect(this.master);this.breeze.start();
  }
  schedule() {
    if (!this.enabled || this.ctx.state !== 'running') return;
    const now=this.ctx.currentTime+.02;
    if(this.party){
      if(this.paused)return;
      const melody=[72,76,79,0,79,81,79,76,74,77,81,0,81,79,77,74,76,79,84,0,83,81,79,76,74,77,79,83,84,0,79,0];
      const note=melody[this.partyNote++%melody.length];
      if(note){const f=440*2**((note-69)/12);this.tone(f,now,.8,.13);this.tone(f*2,now,.45,.018);}
      if(this.partyNote%4===1)[48,52,55].forEach((n,i)=>this.tone(440*2**((n-69)/12),now+i*.05,1.4,.03,'triangle'));
      return;
    }
    // A slow music-box melody over warm, changing triads.
    const melody=[76,0,79,0,83,81,79,0,74,0,78,0,81,0,78,0,72,0,76,0,79,76,74,0,71,0,74,0,78,0,74,0];
    const midi=melody[this.note%melody.length];
    if(midi && !this.paused){const f=440*2**((midi-69)/12);this.tone(f,now,1.1,.08);this.tone(f*2,now,.55,.018);}
    if(this.note%8===0){
      const chords=[[48,52,55],[50,54,57],[45,48,52],[43,47,50]], chord=chords[Math.floor(this.note/8)%4];
      chord.forEach((n,i)=>this.tone(440*2**((n-69)/12),now+i*.04,2.8,.022,'triangle'));
    }
    if(!this.paused){
      if(this.night&&this.note%12===2){for(let i=0;i<4;i++)this.tone(2300+i*60,now+i*.075,.045,.009,'sine',2100);}
      if(this.night&&this.note%89===20){this.tone(290,now,.4,.025,'sine',220);this.tone(250,now+.5,.55,.018,'sine',190);}
      if(!this.night&&this.note%29===8)this.bird();
    }
    this.note++;
  }
  footstep(running=false) {
    if (!this.enabled) return;
    const now=this.ctx.currentTime;
    this.tone(this.step++%2?150:180,now,.07,running?.045:.028,'triangle',65);
  }
  bird() {
    if (!this.enabled) return;
    const now=this.ctx.currentTime;
    for(let i=0;i<3;i++) this.tone(1700+i*230,now+i*.12,.095,.023,'sine',2600+i*150);
  }
  chirp(bubu=false) {
    if (!this.enabled) return;
    const t=this.ctx.currentTime, base=bubu?650:410;
    [0,.17,.37].forEach((delay,i)=>{
      this.tone(base*(i===1?1.35:1),t+delay,.16,.07,'sine',base*(i===2?.78:1.45));
      this.tone(base*2,t+delay,.12,.012,'triangle',base*1.6);
    });
  }
  collect() {
    if(!this.enabled)return;
    const now=this.ctx.currentTime;
    [659.25,783.99,987.77,1318.51].forEach((f,i)=>this.tone(f,now+i*.105,.65,.13));
    setTimeout(()=>this.chirp(),530);
  }
  celebrate() {
    this.party=true;this.partyNote=0;
    this.chirp(true);
  }
}
