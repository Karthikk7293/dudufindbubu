import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1200,height:700},deviceScaleFactor:1});page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
  const url=process.env.GAME_URL||'http://localhost:3000';
  await page.route('**/__study',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#f4f0e7"><div id="label" style="position:absolute;top:32px;width:100%;text-align:center;font:16px Georgia;color:#6c5744;letter-spacing:2px"></div></body></html>'}));
  await page.goto(url+'/__study');
  await page.evaluate(async()=>{
    const source=await (await fetch('/src/world.js')).text(),path=source.match(/import \* as THREE from ["']([^"']+)/)[1];
    const THREE=await import(path),{createBear}=await import('/src/world.js'),{createAnimal,updateAnimal}=await import('/src/wildlife.js'),{createForestTree}=await import('/src/vegetation.js');
    const scene=new THREE.Scene();scene.background=new THREE.Color(0xf4f0e7);
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,700);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xfff8eb,0xb3a491,2));const key=new THREE.DirectionalLight(0xffebce,2.6);key.position.set(-3,6,5);scene.add(key);
    const camera=new THREE.PerspectiveCamera(35,1200/700,.1,100),items=new THREE.Group();scene.add(items);
    window.study={render(kind){items.clear();document.querySelector('#label').textContent=kind.toUpperCase()+' · SUNNYWOOD FOREST';
      if(kind==='bears'){[false,true].forEach((white,i)=>{const bear=createBear(white);bear.position.x=i?1.2:-1.2;bear.rotation.y=i?-.2:.3;items.add(bear);});camera.position.set(0,2.3,8);camera.lookAt(0,.95,0);}
      if(kind==='wildlife'){['rabbit','fox','sheep','deer'].forEach((name,i)=>{const animal=createAnimal(name,i*2.2-3.3,0,i);animal.group.rotation.y=-.3;items.add(animal.group);});camera.position.set(0,3.2,12);camera.lookAt(0,1,0);}
      if(kind==='trees'){['oak','blossom','willow','pine'].forEach((name,i)=>{const tree=createForestTree(name,[0x72995b,0x88a962,0x819d61,0x5d8553][i],42+i);tree.position.x=i*4.5-6.75;items.add(tree);});camera.position.set(0,6,24);camera.lookAt(0,1.9,0);}
      renderer.render(scene,camera);
    }};
  });
  for(const kind of ['bears','wildlife','trees']){await page.evaluate(kind=>window.study.render(kind),kind);await page.screenshot({path:`test-results/refined-${kind}.png`});}
  assert.deepEqual(errors,[]);console.log('Bear, wildlife and tree model studies rendered without errors.');
}finally{await browser.close();}
