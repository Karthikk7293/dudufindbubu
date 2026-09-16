import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { freshState } from '../src/game-state.js';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
  const context=await browser.newContext({viewport:{width:844,height:390},screen:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();page.setDefaultTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(fixture=>{
    if(!sessionStorage.getItem('weather-test-started')){
      window.__DUDU_TEST_STATE__=fixture;sessionStorage.setItem('weather-test-started','yes');
      localStorage.setItem('dudu-time-of-day','day');
    }
    localStorage.setItem('dudu-sound','off');
    Object.defineProperty(document,'fullscreenEnabled',{get:()=>false});
  },{...freshState(),departed:true,position:{x:-6,z:24}});
  await page.goto(process.env.GAME_URL||'http://localhost:3000',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__dudu?.snapshot().ready);await page.waitForSelector('#loading',{state:'hidden'});
  const snap=()=>page.evaluate(()=>window.__dudu.snapshot());
  assert.equal((await snap()).weather.mode,'clear');console.log('Forest ready; switching from clear skies to rain.');
  await page.locator('#intro-weather').tap();
  await page.waitForFunction(()=>window.__dudu.snapshot().weather.blend>.98);
  assert.equal((await snap()).weather.audioRain,true);
  await page.locator('#start-button').tap();await page.waitForFunction(()=>window.__dudu.snapshot().playing);
  await page.screenshot({path:'test-results/forest-rain-mobile.png'});
  let s=await snap();assert.equal(s.weather.rain,380);assert.ok(s.weather.puddles>20);assert.equal(s.weather.snowVisible,false);
  console.log('Rain particles, puddles, weather control, and phone quality verified.',s.render);
  await page.locator('#play-pause').tap();console.log('Checking paused weather controls.');const paused=(await snap()).weather.time;
  await page.waitForTimeout(200);assert.equal((await snap()).weather.time,paused);
  await page.locator('#pause-weather').tap();s=await snap();assert.equal(s.paused,true);assert.equal(s.weather.blend,0);assert.equal(s.weather.audioRain,false);
  await page.locator('#pause-weather').tap();await page.locator('#pause-time').tap();
  await page.locator('#pause-dialog [data-close]').last().tap();
  await page.waitForFunction(()=>window.__dudu.snapshot().weather.blend===1&&window.__dudu.snapshot().nightBlend===1);
  s=await snap();assert.equal(s.weather.sun,false);assert.equal(s.weather.moon,true);assert.ok(s.lamps.glowing>0);
  await page.screenshot({path:'test-results/forest-rain-night.png'});
  // The fifth HUD action must fit even the smallest supported landscape layout.
  await page.setViewportSize({width:568,height:320});
  const boxes=await page.locator('#play-tools button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right};}));
  const guide=await page.locator('#guide-button').boundingBox();
  assert.equal(boxes.length,5);assert.ok(boxes.every(b=>b.width>=44&&b.height>=44&&b.right<=568));
  assert.ok(guide.x+guide.width<boxes[0].x);
  await page.screenshot({path:'test-results/forest-rain-small-phone.png'});
  console.log('Pause, rainy night, and five landscape HUD controls verified.');
  await page.emulateMedia({reducedMotion:'reduce'});
  // Clear the fixture on reload: preference survives, adventure progress does not.
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__dudu?.snapshot().ready);await page.waitForSelector('#loading',{state:'hidden'});
  s=await snap();assert.equal(s.weather.mode,'rain');assert.equal(s.weather.blend,1);assert.equal(s.weather.rain,0);assert.equal(s.weather.ripples,0);assert.ok(s.weather.puddles>0);
  assert.equal(s.state.departed,false);assert.equal(s.state.collected.length,0);assert.equal(s.bubuVisible,false);
  assert.deepEqual(errors,[]);console.log('Saved weather, fresh adventure, reduced motion, and no browser errors verified.');
}finally{await browser.close();}
