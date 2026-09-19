import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1000,height:620},deviceScaleFactor:1});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__expressions-study',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#f4f0e7"><div id="label" style="position:absolute;top:26px;width:100%;text-align:center;font:18px Georgia;color:#6c5744"></div></body></html>'}));
  await page.goto((process.env.GAME_URL||'http://localhost:3000')+'/__expressions-study');
  await page.evaluate(async()=>{
    const source=await (await fetch('/src/world.js')).text(),path=source.match(/import \* as THREE from ["']([^"']+)/)[1];
    const THREE=await import(path),{createBear,animateBearFace}=await import('/src/world.js'),{animateBearPose}=await import('/src/bear-motion.js');
    const scene=new THREE.Scene();scene.background=new THREE.Color(0xf4f0e7);
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,620);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xfff8eb,0xb3a491,2));const light=new THREE.DirectionalLight(0xffebce,2.6);light.position.set(-3,6,5);scene.add(light);
    const bears=[createBear(),createBear(true)];bears.forEach((b,i)=>{b.position.x=i?1.12:-1.12;b.rotation.y=i?-.18:.18;scene.add(b);});
    const camera=new THREE.PerspectiveCamera(32,1000/620,.1,30);camera.position.set(0,1.6,6.7);camera.lookAt(0,.94,0);
    window.study={render(moods){
      document.querySelector('#label').textContent=`Dudu · ${moods[0]}                     Bubu · ${moods[1]}`;
      bears.forEach((b,i)=>{b.userData.expression.reset();b.userData.expression.update(.1,{mood:moods[i]},true);for(let frame=0;frame<60;frame++)animateBearPose(b,1/60,2,false);animateBearFace(b,2);});
      renderer.render(scene,camera);
      return bears.map(b=>({mood:b.userData.expression.mood,open:b.userData.openMouth.visible,happy:b.userData.happyEyes[0].visible,elbow:b.userData.forearms[0].rotation.x,wave:Math.abs(b.userData.arms[b.userData.waveHand].rotation.z),ear:b.userData.ears[0].position.y}));
    }};
  });
  for(const moods of [['calm','bright'],['curious','surprised'],['delighted','shy'],['content','wish'],['greet','sleepy'],['wonder','bright']]){
    const result=await page.evaluate(moods=>window.study.render(moods),moods);
    assert.deepEqual(result.map(r=>r.mood),moods);
    if(moods[0]==='delighted'){assert.equal(result[0].happy,true);assert.equal(result[0].open,true);assert.ok(result[1].elbow<-.7);}
    // Bubu's everyday face keeps her eyes round and her little smile open.
    if(moods[1]==='bright'){assert.equal(result[1].happy,false);assert.equal(result[1].open,true);}
    if(moods[0]==='greet')assert.ok(result[0].wave>.6,'the greeting lifts a paw');
    await page.screenshot({path:`test-results/expressions-${moods.join('-')}.png`});
  }
  assert.deepEqual(errors,[]);console.log('Eleven facial expressions, ear moods and articulated paw poses rendered without browser errors.');
}finally{await browser.close();}
