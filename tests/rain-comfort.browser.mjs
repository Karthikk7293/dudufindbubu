import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { freshState, GIFTS } from '../src/game-state.js';

const together=process.argv.includes('--together'),blender=process.argv.includes('--blender');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:667,height:375},screen:{width:375,height:667},isMobile:true,hasTouch:true,deviceScaleFactor:.75});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(({fixture,together})=>{
    window.__DUDU_TEST_STATE__=fixture;localStorage.setItem('dudu-sound','off');localStorage.setItem('dudu-time-of-day','day');localStorage.setItem('dudu-weather',together?'rain':'clear');localStorage.setItem('dudu-haptics','on');
    Object.defineProperty(document,'fullscreenEnabled',{get:()=>false});
    // Hardware cannot vibrate in emulation. Record the browser API requests.
    window.__vibrations=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{window.__vibrations.push(pattern);return true;}});
  },{together,fixture:{...freshState(),departed:true,position:{x:-8,z:8},...together?{collected:GIFTS.map(g=>g.id),completed:true,bubuArrived:true,companionPosition:{x:-6.8,z:9.2}}:{}}});
  if(process.env.SOFTWARE_RENDERING_SYNC==='1')await page.addInitScript(()=>{
    const frame=requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>frame(time=>{callback(time);if(callback.name==='animate')document.querySelector('#world canvas')?.getContext('webgl2')?.finish();});
  });
  await page.goto((process.env.GAME_URL||'http://localhost:3000')+(blender?'/?dudu=blender':''),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__dudu?.snapshot().ready);await page.waitForSelector('#loading',{state:'hidden'});
  const snap=()=>page.evaluate(()=>window.__dudu.snapshot());
  await page.locator('#start-button').tap();console.log(together?'Rainy companion walk ready':'Mobile feedback test ready');
  if(together){
    await page.waitForFunction(()=>window.__dudu.snapshot().umbrellas.every(u=>u.visible));
    if(blender)assert.equal((await snap()).characterModel.source,'blender');
    const start=(await snap()).position;
    await page.keyboard.down('s');await page.waitForFunction(p=>Math.hypot(window.__dudu.snapshot().position.x-p.x,window.__dudu.snapshot().position.z-p.z)>.4,start);await page.keyboard.up('s');
    assert.ok((await snap()).umbrellas.every(u=>u.visible));
  }else{
    assert.ok((await snap()).umbrellas.every(u=>!u.visible));
    await page.locator('#touch-interact').tap();await page.waitForFunction(()=>window.__dudu.snapshot().state.collected.includes('flowers'));
    assert.ok(await page.evaluate(()=>window.__vibrations.some(p=>JSON.stringify(p)==='[20,35,35]')),'Collecting a gift requests its specific haptic');
  }
  await page.locator('#play-pause').tap();assert.equal(await page.locator('#pause-haptics').isEnabled(),true);
  await page.locator('#pause-haptics').tap();assert.equal((await snap()).haptics.enabled,false);
  const calls=await page.evaluate(()=>window.__vibrations.filter(pattern=>pattern!==0).length);
  if(!together)await page.locator('#pause-weather').tap();
  await page.waitForFunction(()=>window.__dudu.snapshot().umbrellas[0].visible);
  assert.equal((await snap()).umbrellas[1].visible,together);
  const frozen=await snap();await page.waitForTimeout(150);assert.deepEqual((await snap()).umbrellas,frozen.umbrellas);
  await page.locator('#pause-photo').tap();await page.locator('#photo-portrait').tap();
  await page.screenshot({path:`test-results/umbrella-${together?'together':'dudu'}${blender?'-blender':''}.png`,scale:'css'});
  assert.equal(await page.evaluate(()=>window.__vibrations.filter(pattern=>pattern!==0).length),calls,'Haptics off silences all subsequent actions');
  await page.locator('#photo-exit').tap();await page.locator('#play-pause').tap();
  await page.locator('#pause-weather').tap();await page.waitForFunction(()=>window.__dudu.snapshot().umbrellas.every(u=>!u.visible));
  await page.locator('#pause-haptics').tap();assert.equal((await snap()).haptics.enabled,true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('dudu-haptics')),'on');
  await page.evaluate(()=>{Object.defineProperty(navigator,'vibrate',{configurable:true,value:undefined});window.dispatchEvent(new Event('resize'));});
  assert.equal(await page.locator('#pause-haptics').isDisabled(),true);
  assert.equal(await page.locator('#pause-haptics').textContent(),'Haptics unavailable');
  await page.locator('#pause-weather').tap();await page.waitForFunction(()=>window.__dudu.snapshot().umbrellas[0].visible);
  await page.locator('#restart-button').tap();assert.equal((await snap()).bubuVisible,false);
  assert.deepEqual(errors,[]);console.log('Mobile haptic requests, off/on preference, unsupported fallback, rain umbrellas, pause, clear weather and restart passed.');
}finally{await browser.close();}
