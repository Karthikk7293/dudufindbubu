import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { freshState, GIFTS, DESTINATION } from '../src/game-state.js';
import { chooseGroundPoint } from './manual-input.mjs';

const phone=process.argv.includes('--mobile');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
  await mkdir('test-results',{recursive:true});
  const page=await browser.newPage({viewport:phone?{width:667,height:375}:{width:1000,height:640},screen:{width:375,height:667},isMobile:phone,hasTouch:phone,deviceScaleFactor:.6});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(fixture=>{
    window.__DUDU_TEST_STATE__=fixture;localStorage.setItem('dudu-sound','off');localStorage.setItem('dudu-weather','clear');localStorage.setItem('dudu-time-of-day','day');
    Object.defineProperty(document,'fullscreenEnabled',{get:()=>false});
    const frame=requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>frame(time=>{callback(time);if(callback.name==='animate')document.querySelector('#world canvas')?.getContext('webgl2')?.finish();});
    window.__mapLabels=[];const fillText=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(...args){if(this.canvas.id==='large-map')window.__mapLabels.push(args[0]);return fillText.apply(this,args);};
  },{...freshState(),departed:true,position:{x:13,z:0},collected:GIFTS.filter(g=>g.id!=='letter').map(g=>g.id)});
  await page.goto(process.env.GAME_URL||'http://localhost:3000',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__dudu?.snapshot().ready);await page.waitForSelector('#loading',{state:'hidden'});
  const snap=()=>page.evaluate(()=>window.__dudu.snapshot());
  await page.locator('#start-button').click();await page.waitForSelector('#journey-status:not(.hidden)');
  const assertIdle=async()=>{const before=await snap();await page.waitForFunction(t=>window.__dudu.snapshot().time>t+.6,before.time);const after=await snap();assert.deepEqual(after.position,before.position);assert.equal(after.route,0);};
  assert.equal(await page.locator('#guide-button,#gift-pointer,#track-gift').count(),0);await assertIdle();
  await page.locator('#play-bag').click();await page.locator('[data-gift="letter"]').click();assert.match(await page.locator('#bag-hint').textContent(),/wishing tree/);
  await page.locator('#tab-places').click();assert.equal(await page.locator('#journal-places button').count(),0);await page.locator('#bag-dialog .dialog-close').click();await assertIdle();
  await page.locator('#play-map').click();let labels=await page.evaluate(()=>window.__mapLabels);
  assert.ok(!labels.includes('Love letter'));assert.ok(!labels.includes('Bubu’s nest'));assert.ok(!labels.includes('Moonwatch nest'));assert.ok(labels.includes('Wildflowers'),'Collected gifts remain in the map');
  await page.locator('#map-dialog .dialog-close').click();
  // Exercise actual movement, then let go: idle must never resume an objective.
  const before=await snap();
  if(phone){
    const box=await page.locator('#joystick').boundingBox(),cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2+25}]});
    await page.waitForFunction(p=>Math.hypot(window.__dudu.snapshot().position.x-p.x,window.__dudu.snapshot().position.z-p.z)>.3,before.position);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{await page.keyboard.down('s');await page.waitForFunction(p=>Math.hypot(window.__dudu.snapshot().position.x-p.x,window.__dudu.snapshot().position.z-p.z)>.3,before.position);await page.keyboard.up('s');}
  await assertIdle();
  await chooseGroundPoint(page,GIFTS.find(g=>g.id==='letter'),{touch:phone});
  await page.locator(phone?'#touch-interact':'#interact-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().state.collected.length===8);await assertIdle();assert.equal((await snap()).bubuVisible,false);
  console.log('Exploration, optional clues, hidden undiscovered map markers, manual controls and gift pickup passed.');
  await page.locator('#play-map').click();assert.ok((await page.evaluate(()=>window.__mapLabels)).includes('Love letter'));await page.locator('#map-dialog .dialog-close').click();
  await chooseGroundPoint(page,DESTINATION,{wait:false,touch:phone});
  await page.waitForFunction(()=>window.__dudu.snapshot().state.bubuArrived);assert.equal((await snap()).state.completed,false);await assertIdle();
  await page.screenshot({path:`test-results/manual-exploration-${phone?'mobile':'desktop'}.png`,scale:'css'});
  // The new destinations also rely on exploration rather than auto-targets.
  await page.locator('#travel-button').click();await page.locator('[data-destination="village"]').click();await page.waitForFunction(()=>window.__dudu.snapshot().destination.id==='village'&&!window.__dudu.snapshot().travelling);
  const away=await snap();await page.waitForFunction(t=>window.__dudu.snapshot().destination.animationTime>t+.6,away.destination.animationTime);assert.deepEqual((await snap()).position,away.position);assert.equal((await snap()).route,0);
  await page.locator('#play-map').click();assert.ok(!(await page.evaluate(()=>window.__mapLabels)).includes('Windmill garden'));await page.locator('#map-dialog .dialog-close').click();
  await chooseGroundPoint(page,{x:0,z:3},{touch:phone});await page.locator(phone?'#touch-interact':'#interact-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().destination.memories.includes('village/market'));
  assert.equal((await snap()).route,0);assert.deepEqual(errors,[]);
  console.log('Bubu waits for a manual arrival; destination memories are found through exploration; no browser errors.');
}finally{await browser.close();}
