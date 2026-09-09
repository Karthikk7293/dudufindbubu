import * as THREE from 'three';

export class ForestSky {
  constructor(){
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,30);this.camera.position.z=10;
    this.time=0;this.nightTime=0;this.night=false;this.aspect=1;this.clouds=[];
    const gradient=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,uniforms:{night:{value:0}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv; uniform float night; void main(){vec3 day=mix(vec3(.86,.90,.82),vec3(.96,.95,.87),vUv.y);vec3 dark=mix(vec3(.12,.20,.31),vec3(.025,.05,.12),vUv.y);gl_FragColor=vec4(mix(day,dark,night),1.);}',toneMapped:false});
    this.background=new THREE.Mesh(new THREE.PlaneGeometry(2,2),gradient);this.background.position.z=-10;this.background.renderOrder=-100;this.scene.add(this.background);
    const glowCanvas=document.createElement('canvas');glowCanvas.width=128;glowCanvas.height=128;const ctx=glowCanvas.getContext('2d'),glow=ctx.createRadialGradient(64,64,0,64,64,64);
    glow.addColorStop(0,'#fff6db66');glow.addColorStop(.3,'#ffedc52b');glow.addColorStop(1,'#ffedc500');ctx.fillStyle=glow;ctx.fillRect(0,0,128,128);const texture=new THREE.CanvasTexture(glowCanvas);
    this.sun=new THREE.Group();this.moon=new THREE.Group();this.scene.add(this.sun,this.moon);
    const disc=(group,color,r)=>{const mesh=new THREE.Mesh(new THREE.CircleGeometry(r,48),new THREE.MeshBasicMaterial({color,transparent:true,toneMapped:false}));group.add(mesh);const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));halo.scale.set(.65,.65,1);halo.position.z=-.01;group.add(halo);};
    disc(this.sun,0xffdc91,.075);disc(this.moon,0xfff4d6,.095);
    [[-.026,.032,.018],[.034,.004,.014],[-.007,-.038,.023],[.035,.052,.009]].forEach(([x,y,r])=>{const crater=new THREE.Mesh(new THREE.CircleGeometry(r,20),new THREE.MeshBasicMaterial({color:0xa5adc0,transparent:true,opacity:.2,depthWrite:false,toneMapped:false}));crater.position.set(x,y,.003);this.moon.add(crater);});
    this.sun.position.set(-.30,.77,-6);this.moon.position.copy(this.sun.position);
    const positions=[],phases=[],sizes=[];let seed=811;
    const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<420;i++){positions.push(rng()*2-1,rng()*1.95-.96,-8);phases.push(rng()*6.28);sizes.push(1.1+rng()*2.4);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));geo.setAttribute('size',new THREE.Float32BufferAttribute(sizes,1));
    const starMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},opacity:{value:0},ratio:{value:Math.min(devicePixelRatio,1.5)}},vertexShader:'attribute float phase; attribute float size; uniform float time; uniform float ratio; varying float glow; void main(){glow=.65+.35*sin(time*.8+phase);gl_PointSize=size*ratio;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float opacity; varying float glow; void main(){float light=1.-smoothstep(.0,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.84,.90,1.,light*glow*opacity);}',toneMapped:false});
    this.stars=new THREE.Points(geo,starMaterial);this.stars.frustumCulled=false;this.scene.add(this.stars);
    this.cloudMaterial=new THREE.MeshLambertMaterial({color:0xfff9e9});this.scene.add(new THREE.HemisphereLight(0xffffff,0xc6d5d5,2));const light=new THREE.DirectionalLight(0xfff8df,1.2);light.position.set(-3,4,5);this.scene.add(light);
    const puff=new THREE.SphereGeometry(1,12,8);
    for(let i=0;i<8;i++){
      const group=new THREE.Group();group.position.set((i/8*2-1)*2.2,.43+rng()*.16,-4+(i%3)*.1);const scale=.55+rng()*.4;group.scale.setScalar(scale);
      [[-.17,0,.13,.055],[0,.035,.16,.082],[.16,0,.13,.058],[-.08,.085,.11,.08],[.1,.085,.09,.075]].forEach(([x,y,sx,sy])=>{const cloud=new THREE.Mesh(puff,this.cloudMaterial);cloud.position.set(x,y,0);cloud.scale.set(sx,sy,.09);group.add(cloud);});
      this.scene.add(group);this.clouds.push({group,x:group.position.x,speed:.008+rng()*.008});
    }
    const trailGeometry=new THREE.BufferGeometry();trailGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.22,.07,0,-.4,.13,0],3));trailGeometry.setAttribute('color',new THREE.Float32BufferAttribute([1,.95,.78,.58,.7,.95,.16,.25,.43],3));
    this.meteor=new THREE.Group();const trail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,toneMapped:false}));this.meteor.add(trail);const tip=new THREE.Mesh(new THREE.CircleGeometry(.005,8),new THREE.MeshBasicMaterial({color:0xfff7d8,transparent:true,toneMapped:false}));this.meteor.add(tip);this.meteor.visible=false;this.scene.add(this.meteor);
  }
  setNight(night){if(night!==this.night)this.nightTime=0;this.night=night;}
  resize(width,height){this.aspect=width/height;this.camera.left=-this.aspect;this.camera.right=this.aspect;this.camera.updateProjectionMatrix();this.background.scale.x=this.aspect;this.stars.scale.x=this.aspect;this.sun.position.x=this.moon.position.x=-this.aspect*.28;}
  update(dt,time,blend,reducedMotion,lookout=0){
    this.time=reducedMotion?0:time;if(this.night)this.nightTime+=dt;
    this.background.material.uniforms.night.value=blend;this.stars.material.uniforms.time.value=this.time;this.stars.material.uniforms.opacity.value=blend;
    this.sun.visible=blend<.95;this.moon.visible=blend>.05;
    this.moon.scale.setScalar(1+lookout*.75);this.moon.position.y=.77-lookout*.03;
    this.sun.children.forEach(n=>n.material.opacity=(n.isSprite?1:1)*(1-blend));this.moon.children.forEach((n,i)=>n.material.opacity=blend*(i>1?.2:1));
    this.cloudMaterial.color.setHex(0xfff9e9).lerp(new THREE.Color(0x17273e),blend);
    for(const cloud of this.clouds){const span=this.aspect+ .6;cloud.group.position.x=((cloud.x+this.time*cloud.speed+span)%(span*2)+span*2)%(span*2)-span;}
    const phase=this.nightTime%13,active=this.night&&blend>.8&&!reducedMotion&&phase>2.4&&phase<3.75;
    this.meteor.visible=active;
    if(active){const p=(phase-2.4)/1.35;this.meteor.position.set(-this.aspect*.6+p*this.aspect*1.3,.86-p*.36,-5);this.meteor.children.forEach(n=>n.material.opacity=Math.sin(p*Math.PI));}
  }
  render(renderer){renderer.render(this.scene,this.camera);}
}
