import { chooseGroundPoint } from './manual-input.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { freshState } from '../src/game-state.js';

const url=process.env.GAME_URL||'http://localhost:3000';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];let page;
await mkdir('test-results',{recursive:true});
try{
  page=await browser.newPage({viewport:{width:390,height:844},screen:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(fixture=>{
    localStorage.setItem('dudu-sound','off');localStorage.setItem('dudu-time-of-day','day');
    if(!sessionStorage.getItem('seeded')){window.__DUDU_TEST_STATE__=fixture;sessionStorage.setItem('seeded','yes');}
    // Exercise browsers that offer neither fullscreen nor orientation locking.
    Object.defineProperty(document,'fullscreenEnabled',{get:()=>false});
    screen.orientation.lock=()=>Promise.reject(new DOMException('Unavailable','NotSupportedError'));
  },{...freshState(),departed:true,position:{x:-19,z:23}});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__dudu||document.querySelector('#loading.has-error'));
  assert.equal(await page.locator('#loading.has-error').count(),0,errors.join('\n'));
  await page.waitForSelector('#loading',{state:'hidden'});
  assert.ok(await page.locator('#start-button').isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'test-results/mobile-welcome.png'});
  await page.locator('#start-button').tap();await page.waitForSelector('#rotate-notice:not([hidden])');
  const snapshot=()=>page.evaluate(()=>window.__dudu.snapshot());
  let state=await snapshot();assert.equal(state.paused,true);assert.equal(state.quality.pixelRatio,1.1);
  await page.screenshot({path:'test-results/mobile-rotate.png'});
  const frozen=state.time;await page.waitForTimeout(300);assert.equal((await snapshot()).time,frozen);
  await page.setViewportSize({width:844,height:390});await page.waitForSelector('#rotate-notice',{state:'hidden'});
  await page.waitForFunction(()=>window.__dudu.snapshot().camera.perspective&&!window.__dudu.snapshot().paused);
  const controls=['#journey-status','#play-tools','#zoom-tools','#joystick','#touch-interact'];
  for(const selector of controls){const b=await page.locator(selector).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=844&&b.y+b.height<=390,`${selector} fits`);}
  const boxes=await Promise.all(controls.map(s=>page.locator(s).boundingBox()));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`${controls[i]} and ${controls[j]} do not overlap`);}
  for(const selector of ['#play-bag','#zoom-in','#camera-mode','#touch-interact']){const b=await page.locator(selector).boundingBox();assert.ok(b.width>=44&&b.height>=44,`${selector} has a touch target`);}
  await page.screenshot({path:'test-results/mobile-landscape-day.png'});
  console.log('Portrait welcome, landscape fallback, phone quality budget and landscape HUD passed.');
  const cdp=await page.context().newCDPSession(page);
  const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:6,radiusY:6,force:1}))});
  const stick=await page.locator('#joystick').boundingBox(),cx=stick.x+stick.width/2,cy=stick.y+stick.height/2;
  state=await snapshot();console.log('Render stats:',state.render);
  await touch('touchStart',[[1,cx,cy-28]]);
  await page.waitForFunction(p=>Math.hypot(window.__dudu.snapshot().position.x-p.x,window.__dudu.snapshot().position.z-p.z)>.35,state.position);
  const yaw=(await snapshot()).camera.yaw;
  await touch('touchStart',[[1,cx,cy-28],[2,610,190]]);
  await touch('touchMove',[[1,cx,cy-28],[2,540,205]]);await touch('touchEnd',[]);
  assert.ok(Math.abs((await snapshot()).camera.yaw-yaw)>.1,'Look and move work with two thumbs');
  console.log('Two-thumb movement and look passed.');
  // A cancelled touch must not leave a stuck movement vector.
  await touch('touchStart',[[1,cx,cy-25]]);await touch('touchCancel',[]);
  await page.waitForTimeout(150);const stopped=(await snapshot()).position;await page.waitForTimeout(300);assert.deepEqual((await snapshot()).position,stopped);
  const zoom=(await snapshot()).zoom;
  await touch('touchStart',[[1,350,200],[2,490,200]]);await touch('touchMove',[[1,300,200],[2,540,200]]);await touch('touchEnd',[]);
  assert.ok((await snapshot()).zoom<zoom,'Pinch zooms in');
  console.log('Touch cancellation and pinch passed.');
  // A dialog survives a rotation, and can still be closed in landscape.
  await page.locator('#play-bag').tap();await page.setViewportSize({width:390,height:844});
  await page.waitForSelector('#rotate-notice:not([hidden])');assert.equal(await page.locator('#bag-dialog').getAttribute('open'),null);
  await page.setViewportSize({width:844,height:390});await page.waitForSelector('#bag-dialog[open]');
  await page.locator('#bag-dialog .dialog-close').tap();assert.equal((await snapshot()).paused,false);
  await page.locator('#play-map').tap();
  const map=await page.locator('#map-dialog').boundingBox();assert.ok(map.y>=0&&map.y+map.height<=390);
  await page.locator('#map-dialog .dialog-close').tap();
  console.log('Dialog rotation and map passed.');
  // Read a clue, choose a ground point and collect the chocolate gift with touch.
  await page.locator('#play-bag').tap();await page.locator('[data-gift="chocolates"]').tap();assert.equal((await snapshot()).route,0);await page.locator('#bag-dialog .dialog-close').tap();
  await chooseGroundPoint(page,{x:-22,z:19},{touch:true});await page.waitForFunction(()=>window.__dudu.snapshot().nearby==='chocolates');
  await page.locator('#touch-interact').tap();await page.waitForFunction(()=>window.__dudu.snapshot().state.collected.includes('chocolates'));
  assert.equal((await snapshot()).bubuVisible,false);
  console.log('Touch gift collection passed.');
  await page.locator('#play-time').tap();await page.waitForFunction(()=>window.__dudu.snapshot().nightBlend>.95);
  await page.screenshot({path:'test-results/mobile-landscape-night.png'});
  for(const viewport of [{width:667,height:375},{width:568,height:320}]){
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);
    for(const selector of controls){const b=await page.locator(selector).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width&&b.y+b.height<=viewport.height,`${selector} fits ${viewport.width}`);}
    await page.screenshot({path:`test-results/mobile-landscape-${viewport.width}.png`});
  }
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__dudu?.snapshot().ready);await page.waitForSelector('#loading',{state:'hidden'});
  state=await snapshot();assert.equal(state.state.collected.length,0);assert.equal(state.state.departed,false);assert.equal(state.bubuVisible,false);
  assert.deepEqual(errors,[]);console.log('Two-thumb movement/look, cancellation, pinch, rotation with an open dialog, gift collection, night, smaller phones and fresh reload passed.');
} catch(error){if(page&&!page.isClosed()){console.log('Errors:',errors);console.log(await page.evaluate(()=>({loading:document.querySelector('#loading-status')?.textContent,state:window.__dudu?.snapshot()})));await page.screenshot({path:'test-results/mobile-failure.png'});}throw error;}
finally{await browser.close();}
