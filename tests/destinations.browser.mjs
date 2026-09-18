import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { freshState, GIFTS } from '../src/game-state.js';
import { DESTINATIONS } from '../src/destinations.js';

const together=process.argv.includes('--together'),desktop=process.argv.includes('--desktop');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
const selection=process.argv.find(arg=>arg.startsWith('--places='))?.split('=')[1].split(',');
const places=DESTINATIONS.slice(1).filter(place=>!selection||selection.includes(place.id));
try{
  const page=await browser.newPage({viewport:desktop?{width:1100,height:760}:{width:667,height:375},screen:{width:375,height:667},hasTouch:!desktop,isMobile:!desktop,deviceScaleFactor:.6,acceptDownloads:true});page.setDefaultTimeout(120000);
  page.on('crash',()=>console.log('Browser renderer crashed'));page.on('pageerror',e=>{errors.push(e.message);console.log('Page error:',e.message);});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(fixture=>{
    window.__DUDU_TEST_STATE__=fixture;localStorage.setItem('dudu-sound','off');localStorage.setItem('dudu-weather','clear');localStorage.setItem('dudu-time-of-day','day');
    Object.defineProperty(document,'fullscreenEnabled',{get:()=>false});
    const frame=requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>frame(time=>{callback(time);if(callback.name==='animate')document.querySelector('#world canvas')?.getContext('webgl2')?.finish();});
  },{...freshState(),departed:true,position:{x:-8,z:8},...together?{collected:GIFTS.map(g=>g.id),completed:true,bubuArrived:true,companionPosition:{x:-6.3,z:8}}:{}});
  await page.goto(process.env.GAME_URL||'http://localhost:3000',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__dudu?.snapshot().ready);await page.waitForSelector('#loading',{state:'hidden'});
  const snap=()=>page.evaluate(()=>window.__dudu.snapshot());
  await page.locator('#start-button').click();console.log('Forest loaded; starting destination tour');
  if(!together){await page.keyboard.press('e');await page.waitForFunction(()=>window.__dudu.snapshot().state.collected.includes('flowers'));}
  const before=await snap();
  await page.locator('#travel-button').click();assert.equal(await page.locator('[data-destination]').count(),6);
  await page.screenshot({path:`test-results/destinations-menu-${desktop?'desktop':'mobile'}.png`,scale:'css'});
  for(const place of places){
    if(!await page.locator('#travel-dialog').isVisible())await page.locator('#travel-button').click();
    await page.locator(`[data-destination="${place.id}"]`).click();
    await page.waitForFunction(id=>{const s=window.__dudu.snapshot();return s.destination.id===id&&!s.travelling;},place.id);
    let state=await snap();assert.equal(state.destination.forestVisible,false);assert.equal(state.destination.sceneCount,1);assert.equal(state.bubuVisible,together);assert.deepEqual(state.state.collected,before.state.collected);
    await page.locator('#guide-button').click();
    await page.waitForFunction(()=>{const s=window.__dudu.snapshot();return s.destination.landmarks.some(l=>Math.hypot(s.position.x-l.x,s.position.z-l.z)<2.3);});
    await page.keyboard.press('e');await page.waitForFunction(id=>window.__dudu.snapshot().destination.memories.some(m=>m.startsWith(id+'/')),place.id);
    const memoryCount=(await snap()).destination.memories.length;await page.keyboard.press('e');assert.equal((await snap()).destination.memories.length,memoryCount);
    if(together){assert.equal((await snap()).following,true);assert.ok(Math.hypot((await snap()).bubuPosition.x-state.bubuPosition.x,(await snap()).bubuPosition.z-state.bubuPosition.z)>.4);}
    await page.locator('#play-map').click();assert.equal(await page.locator('#map-title').textContent(),place.name);await page.locator('#map-dialog [data-close]').click();
    await page.keyboard.press('x');await page.waitForFunction(()=>window.__dudu.snapshot().photo.active);await page.screenshot({path:`test-results/destination-${place.id}-walk-${together?'together':desktop?'desktop':'mobile'}.png`,scale:'css'});await page.locator('#photo-exit').click();
    await page.locator('#zoom-overview').click();await page.keyboard.press('x');await page.waitForFunction(()=>window.__dudu.snapshot().photo.active);
    await page.screenshot({path:`test-results/destination-${place.id}-${together?'together':desktop?'desktop':'mobile'}.png`,scale:'css'});
    const frozen=await snap();await page.waitForTimeout(100);assert.equal((await snap()).destination.animationTime,frozen.destination.animationTime);
    if(place.id==='beach'){
      const download=page.waitForEvent('download');await page.locator('#photo-save').click();const image=await download;assert.match(image.suggestedFilename(),/^beach-postcard/);assert.equal(await image.failure(),null);
    }
    await page.locator('#photo-exit').click();
    if(place.id==='snowlands'){
      await page.locator('#play-pause').click();await page.locator('#pause-time').click();await page.locator('#pause-weather').click();
      assert.equal(await page.locator('#pause-weather').getAttribute('aria-label'),'Lighter snowfall');assert.equal((await snap()).umbrellas[0].visible,false);
      await page.locator('#pause-photo').click();await page.screenshot({path:`test-results/destination-snowlands-night-${together?'together':'solo'}.png`,scale:'css'});await page.locator('#photo-exit').click();
    }
    console.log(`${place.name}: travel, memory, local map and paused postcard passed`);
  }
  await page.locator('#travel-button').click();await page.locator('[data-destination="forest"]').click();await page.waitForFunction(()=>{const s=window.__dudu.snapshot();return s.destination.id==='forest'&&!s.travelling;});
  const returned=await snap();assert.deepEqual(returned.state.position,before.state.position);assert.deepEqual(returned.state.collected,before.state.collected);assert.equal(returned.state.completed,before.state.completed);assert.equal(returned.bubuVisible,before.bubuVisible);assert.equal(returned.destination.forestVisible,true);assert.equal(returned.destination.sceneCount,0);assert.ok(returned.resources.geometries<=before.resources.geometries+20,'Destination geometry is released on return');
  await page.locator('#travel-button').click();await page.locator('[data-destination="city"]').click();await page.waitForFunction(()=>window.__dudu.snapshot().destination.id==='city'&&!window.__dudu.snapshot().travelling);
  await page.locator('#play-pause').click();await page.locator('#restart-button').click();assert.equal((await snap()).destination.id,'forest');assert.equal((await snap()).destination.memories.length,0);assert.equal((await snap()).state.collected.length,0);assert.equal((await snap()).bubuVisible,false);
  await page.reload();await page.waitForFunction(()=>window.__dudu?.snapshot().ready);assert.equal((await snap()).destination.id,'forest');assert.deepEqual((await snap()).destination.visited,['forest']);assert.deepEqual(errors,[]);
  console.log('Forest progress restored; restart and refresh reset destinations; no browser errors.');
}finally{await browser.close();}
