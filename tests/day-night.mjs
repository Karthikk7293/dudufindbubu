import { chooseGroundPoint } from './manual-input.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { SAVE_KEY, freshState } from '../src/game-state.js';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],url=process.env.GAME_URL||'http://localhost:3000';
const page=await browser.newPage({viewport:{width:1000,height:740},deviceScaleFactor:1});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snap=()=>page.evaluate(()=>window.__dudu.snapshot());
const controlsOnly=process.argv.includes('--controls-only');
try{
  if(controlsOnly)await page.addInitScript(({key,state})=>{if(!sessionStorage.getItem('night-initialized')){window.__DUDU_TEST_STATE__=state;sessionStorage.setItem('night-initialized','yes');}},{key:SAVE_KEY,state:{...freshState(),position:{x:13,z:-1},departed:true}});
  await page.goto(url);await page.waitForFunction(()=>window.__dudu,null,{timeout:90000});
  let s=await snap();assert.equal(s.timeOfDay,'day');assert.equal(Object.keys(s.trees).length,6);assert.ok(s.flowerBeds.count>150);assert.equal(new Set(s.butterflies).size,4);assert.ok(s.weather.clouds>5);assert.ok(s.lamps.count>25);
  if(!controlsOnly){
  await page.screenshot({path:'test-results/new-forest-day-intro.png'});
  await page.locator('#intro-time').click();await page.waitForFunction(()=>window.__dudu.snapshot().nightBlend===1,null,{timeout:45000});assert.equal((await snap()).weather.moon,true);assert.equal((await snap()).weather.sun,false);assert.ok((await snap()).lamps.glowing>2);
  await page.screenshot({path:'test-results/new-forest-night-intro.png'});
  await page.locator('#start-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().story==='exploring',null,{timeout:60000});
  const routes=await page.evaluate(async()=>{const {GIFTS,DESTINATION,findPath}=await import('/src/game-state.js'),s=window.__dudu.snapshot();return [...GIFTS,DESTINATION].map(g=>({id:g.id||'bubu',count:findPath(s.position,g,s.obstacles).length}));});assert.ok(routes.every(r=>r.count>0),JSON.stringify(routes));
  s=await snap();assert.equal(s.weather.fireflies,140);assert.equal(s.weather.stars,420);assert.equal(s.lamps.lights.length,6);assert.equal(s.state.bubuArrived,false);
  await page.screenshot({path:'test-results/new-forest-night-play.png'});
  await page.locator('#zoom-overview').click();await page.waitForFunction(()=>window.__dudu.snapshot().view>90,null,{timeout:45000});
  await page.waitForFunction(()=>window.__dudu.snapshot().weather.shootingStar,null,{timeout:90000});await page.screenshot({path:'test-results/new-forest-night-overview.png'});
  const saved=(await snap()).state;await page.keyboard.press('t');await page.waitForFunction(()=>window.__dudu.snapshot().nightBlend===0,null,{timeout:45000});assert.equal((await snap()).lamps.glowing,0);assert.equal((await snap()).weather.fireflies,0);assert.deepEqual((await snap()).state,saved);
  await page.screenshot({path:'test-results/new-forest-day-overview.png'});
  }else{await page.locator('#start-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().playing);}
  await page.keyboard.press('p');await page.waitForSelector('#pause-dialog[open]');const paused=(await snap()).time;
  await page.locator('#pause-time').click();await page.waitForFunction(()=>window.__dudu.snapshot().nightBlend===1);assert.equal((await snap()).time,paused);assert.equal((await snap()).paused,true);
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__dudu,null,{timeout:90000});assert.equal((await snap()).timeOfDay,'night');assert.equal((await snap()).nightBlend,1);assert.equal((await snap()).state.departed,false);
  await page.locator('#intro-time').click();assert.equal((await snap()).nightBlend,0);await page.locator('#intro-time').click();assert.equal((await snap()).nightBlend,1);assert.equal((await snap()).weather.shootingStar,false);
  console.log('Mode persistence, pause and reduced-motion controls passed.');
  if(!controlsOnly)console.log('Tree and flower varieties, clouds, all gift routes, moonlit lamps, fireflies and shooting stars passed.');
  if(process.argv.includes('--preview')){assert.deepEqual(errors,[]);await page.close();}else{
    await page.addInitScript(state=>{window.__DUDU_TEST_STATE__=state;},{...freshState(),departed:true,position:{x:13,z:-1}});await page.reload();await page.waitForFunction(()=>window.__dudu);
    await page.locator('#start-button').click();
    await chooseGroundPoint(page,{x:13,z:-5});await page.waitForFunction(()=>window.__dudu.snapshot().nearby&&window.__dudu.snapshot().nearby!=='bubu',null,{timeout:90000});
    await page.locator('#interact-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().state.collected.length===1);assert.equal((await snap()).state.bubuArrived,false);console.log('Manual gift discovery and collection work at night.');await page.close();
  }
  const tablet=await browser.newPage({viewport:{width:768,height:1024},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});tablet.setDefaultTimeout(90000);tablet.on('pageerror',e=>errors.push(e.message));tablet.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await tablet.addInitScript(({key,state})=>window.__DUDU_TEST_STATE__=state,{key:SAVE_KEY,state:{...freshState(),departed:true}});
  await tablet.goto(url);await tablet.waitForFunction(()=>window.__dudu,null,{timeout:90000});await tablet.locator('#intro-time').tap();await tablet.locator('#start-button').tap();await tablet.waitForFunction(()=>window.__dudu.snapshot().state.departed,null,{timeout:60000});
  const guide=await tablet.locator('#journey-status').boundingBox(),controls=await tablet.locator('#play-tools').boundingBox();assert.ok(guide.x+guide.width<controls.x||guide.y>=controls.y+controls.height,'Guide and four controls do not overlap');assert.equal(await tablet.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await tablet.screenshot({path:'test-results/new-forest-night-tablet.png'});await tablet.locator('#play-time').tap();await tablet.waitForFunction(()=>window.__dudu.snapshot().nightBlend===0,null,{timeout:45000});assert.equal(await tablet.locator('#play-time').getAttribute('aria-pressed'),'false');
  const joy=await tablet.locator('#joystick').boundingBox(),touch=await tablet.context().newCDPSession(tablet),start=await tablet.evaluate(()=>window.__dudu.snapshot().position);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:joy.x+90,y:joy.y+55}]});await tablet.waitForFunction(start=>Math.hypot(window.__dudu.snapshot().position.x-start.x,window.__dudu.snapshot().position.z-start.z)>.5,start,{timeout:30000});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.deepEqual(errors,[]);console.log('Tablet mode toggle, full-screen layout and joystick passed with no browser or shader errors.');
}catch(e){if(!page.isClosed()){const s=await snap();console.log('Failure state:',{state:s.state,mode:s.timeOfDay,blend:s.nightBlend,playing:s.playing,paused:s.paused,story:s.story,route:s.route,nearby:s.nearby,errors});}throw e;}finally{await browser.close();}
