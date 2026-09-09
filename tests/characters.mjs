import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { GIFTS, freshState, SAVE_KEY, BUBU } from '../src/game-state.js';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],url=process.env.GAME_URL||'http://localhost:3000';
async function check(){
try{
  const page=await browser.newPage({viewport:{width:1100,height:720},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/references/characters/README.md');
  await page.setContent('<html><body style="margin:0;background:#f4f0e7"><div style="position:absolute;top:32px;width:100%;text-align:center;font:16px Georgia;color:#6c5744;letter-spacing:2px">DUDU & BUBU · CHARACTER STUDY</div></body></html>');
  await page.evaluate(async()=>{
    const source=await (await fetch('/src/world.js')).text(),path=source.match(/import \* as THREE from ["']([^"']+)/)[1];
    const THREE=await import(path),{createBear}=await import('/src/world.js');
    const scene=new THREE.Scene();scene.background=new THREE.Color(0xf4f0e7);
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,720);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xfff8eb,0xb3a491,2));const key=new THREE.DirectionalLight(0xffebce,2.6);key.position.set(-3,6,5);scene.add(key);const fill=new THREE.DirectionalLight(0xfffaff,.8);fill.position.set(4,3,2);scene.add(fill);
    const bears=[createBear(false),createBear(true)];bears.forEach((bear,i)=>{bear.position.x=i?1.55:-1.55;scene.add(bear);});
    const camera=new THREE.OrthographicCamera(-4.4,4.4,2.88,-2.88,.1,50);camera.position.set(0,2.4,10);camera.lookAt(0,1.35,0);
    window.study={render(angle){bears.forEach(b=>b.rotation.y=angle);renderer.render(scene,camera);},dispose(){renderer.dispose();}};window.study.render(0);
  });
  await page.screenshot({path:'test-results/character-front.png'});
  await page.evaluate(()=>window.study.render(.7));await page.screenshot({path:'test-results/character-quarter.png'});
  await page.evaluate(()=>window.study.dispose());console.log('Front and three-quarter character previews rendered.');
  if(process.argv.includes('--preview')){assert.deepEqual(errors,[]);return;}
  await page.addInitScript(({key,state})=>window.__DUDU_TEST_STATE__=state,{key:SAVE_KEY,state:{...freshState(),departed:true,bubuArrived:true,collected:GIFTS.map(g=>g.id),position:{x:BUBU.x-1.7,z:BUBU.z+.5}}});
  await page.goto(url);await page.waitForFunction(()=>window.__dudu);await page.locator('#start-button').click();
  await page.keyboard.press('+');await page.keyboard.press('+');await page.waitForFunction(()=>window.__dudu.snapshot().view<19,null,{timeout:30000});
  await page.screenshot({path:'test-results/refined-bears-forest.png'});
  await page.locator('#interact-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().story==='party'&&window.__dudu.snapshot().partyTime>4,null,{timeout:60000});
  await page.screenshot({path:'test-results/refined-bears-birthday.png'});await page.waitForSelector('#ending-dialog[open]',{timeout:60000});
  await page.getByRole('button',{name:'Walk together'}).click();await page.keyboard.press('c');assert.equal(await page.evaluate(()=>window.__dudu.snapshot().following),true);
  const start=await page.evaluate(()=>window.__dudu.snapshot().bubuPosition),target=await page.evaluate(()=>window.__dudu.project(0,-24));await page.mouse.click(target.x,target.y);
  await page.waitForFunction(start=>Math.hypot(window.__dudu.snapshot().bubuPosition.x-start.x,window.__dudu.snapshot().bubuPosition.z-start.z)>2,start,{timeout:45000});
  await page.screenshot({path:'test-results/refined-bears-walking.png'});assert.deepEqual(errors,[]);console.log('Refined bears render in the forest, celebrate, and walk together without runtime errors.');
}finally{await browser.close();}
}
await check();
