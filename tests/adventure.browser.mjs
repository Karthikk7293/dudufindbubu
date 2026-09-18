import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { freshState } from '../src/game-state.js';

const phone=process.argv.includes('--mobile');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
  await mkdir('test-results',{recursive:true});
  const page=await browser.newPage({...phone?{viewport:{width:667,height:375},screen:{width:375,height:667},isMobile:true,hasTouch:true}:{viewport:{width:1000,height:640}},deviceScaleFactor:.75,acceptDownloads:true});
  page.setDefaultTimeout(120000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
  if(process.env.SOFTWARE_RENDERING_SYNC==='1')await page.addInitScript(()=>{
    // Test-only GPU backpressure for software-rendered headless browsers.
    const frame=requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>frame(time=>{callback(time);if(callback.name==='animate')document.querySelector('#world canvas')?.getContext('webgl2')?.finish();});
  });
  await page.addInitScript(state=>{
    window.__DUDU_TEST_STATE__=state;localStorage.setItem('dudu-sound','off');localStorage.setItem('dudu-weather','clear');localStorage.setItem('dudu-time-of-day','day');
    Object.defineProperty(document,'fullscreenEnabled',{get:()=>false});
  },{...freshState(),departed:true,position:{x:-22,z:21}});
  await page.goto(process.env.GAME_URL||'http://localhost:3000',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__dudu?.snapshot().ready);await page.waitForSelector('#loading',{state:'hidden'});
  console.log(phone?'Phone ready':'Desktop ready');
  const snap=()=>page.evaluate(()=>window.__dudu.snapshot());
  await page.locator('#start-button').click();
  await page.waitForFunction(()=>window.__dudu.snapshot().adventure.places.includes('clover'));
  assert.equal((await snap()).state.collected.length,0);assert.equal((await snap()).bubuVisible,false);
  assert.ok(await page.evaluate(async()=>{
    const {PLACES,placeDestination}=await import('/src/adventure.js'),{findPath,START}=await import('/src/game-state.js');
    return PLACES.every(place=>findPath(START,placeDestination(place),window.__dudu.snapshot().obstacles).length>0);
  }),'All optional trail destinations must be reachable');
  await page.locator('#interact-button').click();
  await page.waitForFunction(()=>window.__dudu.snapshot().state.collected.includes('chocolates'));
  await page.waitForFunction(()=>window.__dudu.snapshot().nearby==='friend');
  await page.locator(phone?'#touch-interact':'#interact-button').click();
  await page.waitForFunction(()=>window.__dudu.snapshot().adventure.friends.includes('rabbit'));
  console.log('Discovery, gift priority, animal greeting and trail reachability passed');
  await page.screenshot({path:`test-results/adventure-${phone?'mobile':'desktop'}-playing.png`,scale:'css'});
  await page.locator('#journey-status').click();
  await page.locator('#tab-places').click();
  assert.match(await page.locator('[data-place="moonwatch"] .entry-status').textContent(),/AFTER THE BIRTHDAY/);
  assert.equal(await page.locator('.journal-place.visited').count(),1);
  await page.waitForTimeout(250);
  await page.screenshot({path:`test-results/adventure-${phone?'mobile':'desktop'}-journal.png`,scale:'css'});
  await page.locator('[data-place="bridge"]').click();
  assert.equal((await snap()).route,0);assert.equal(await page.locator('#journal-places button').count(),0);
  await page.locator('#bag-dialog .dialog-close').click();
  console.log('Journal clues never start a walk');
  if(!phone)await page.keyboard.press('c');
  const original=(await snap()).camera;
  await page.locator('#play-pause').click();await page.locator('#pause-photo').click();
  let frozen=await snap();assert.equal(frozen.paused,true);assert.equal(frozen.photo.active,true);
  assert.equal(await page.locator('#play-tools').isVisible(),false);
  await page.waitForTimeout(150);assert.equal((await snap()).time,frozen.time);
  await page.locator('#photo-portrait').click();assert.equal((await snap()).photo.perspective,true);
  await page.locator('#photo-message').fill('A forest full of friends. x');assert.equal((await snap()).photo.active,true);
  await page.screenshot({path:`test-results/adventure-${phone?'mobile':'desktop'}-camera.png`,scale:'css'});
  const before=(await snap()).photo.position;
  if(phone){
    const session=await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:320,y:140,id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:380,y:155,id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const first=(await snap()).photo,range=p=>Math.hypot(p.position.x-p.target.x,p.position.y-p.target.y,p.position.z-p.target.z);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:130,id:1},{x:370,y:130,id:2}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:285,y:130,id:1},{x:385,y:130,id:2}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(range((await snap()).photo)<range(first),'Pinching apart zooms the photo camera in');
  }else{await page.mouse.move(480,300);await page.mouse.down();await page.mouse.move(555,325,{steps:4});await page.mouse.up();}
  assert.notDeepEqual((await snap()).photo.position,before);assert.equal((await snap()).time,frozen.time);
  const download=page.waitForEvent('download');await page.locator('#photo-save').click();
  const image=await download;await image.saveAs(`test-results/adventure-${phone?'mobile':'desktop'}-postcard.png`);
  const png=await readFile(await image.path());assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');assert.ok(png.length>20000,'Postcard contains the rendered scene');
  assert.equal((await snap()).adventure.postcards,1);
  await page.locator('#photo-reset').click();assert.equal((await snap()).photo.perspective,original.perspective);
  await page.locator('#photo-exit').click();assert.equal((await snap()).photo.active,false);
  assert.equal((await snap()).camera.mode,original.mode);
  await page.waitForFunction(t=>window.__dudu.snapshot().time>t,frozen.time);
  console.log('Photo pause, orbit, PNG export, camera restoration and resume passed');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.locator('#play-pause').click();await page.locator('#restart-button').click();
  const reset=await snap();assert.deepEqual(reset.adventure,{places:[],friends:[],postcards:0});assert.equal(reset.state.collected.length,0);assert.equal(reset.bubuVisible,false);
  assert.deepEqual(errors,[]);console.log('Fresh restart and no browser errors verified');
}finally{await browser.close();}
