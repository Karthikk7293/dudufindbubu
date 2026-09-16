import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { freshState } from '../src/game-state.js';

const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
const reducedOnly=process.argv.includes('--reduced'),sync=process.env.SOFTWARE_RENDERING_SYNC==='1';
const profiles=process.argv.includes('--desktop')?[false]:process.argv.includes('--mobile')||reducedOnly?[true]:[false,true];
try{
  const counts=[];
  for(const phone of profiles){
    const page=await browser.newPage({...phone?{viewport:{width:667,height:375},screen:{width:375,height:667},isMobile:true,hasTouch:true}:{viewport:{width:900,height:560}},deviceScaleFactor:sync?.75:1});
    page.setDefaultTimeout(120000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
    if(sync)await page.addInitScript(()=>{
      // Optional headless-only backpressure for SwiftShader. This measures
      // behaviour and pixels, not hardware frame rate or real-device speed.
      const frame=window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame=callback=>frame(time=>{callback(time);if(callback.name==='animate')document.querySelector('#world canvas')?.getContext('webgl2')?.finish();});
    });
    if(reducedOnly)await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript(state=>{
      window.__DUDU_TEST_STATE__=state;localStorage.setItem('dudu-sound','off');localStorage.setItem('dudu-weather','clear');localStorage.setItem('dudu-time-of-day','day');
      Object.defineProperty(document,'fullscreenEnabled',{get:()=>false});
    },{...freshState(),departed:true,position:{x:-10,z:10.5}});
    await page.goto(process.env.GAME_URL||'http://localhost:3000',{waitUntil:'domcontentloaded'});
    console.log(phone?'Phone opening':'Desktop opening');
    await page.waitForFunction(()=>window.__dudu?.snapshot().ready);await page.waitForSelector('#loading',{state:'hidden'});
    console.log('Forest ready');
    await page.locator('#start-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().playing);
    console.log('Adventure started');
    const snap=()=>page.evaluate(()=>window.__dudu.snapshot());
    if(reducedOnly){const reduced=(await snap()).environment;assert.equal(reduced.breeze,0);assert.equal(reduced.grassTime,0);await page.close();continue;}
    await page.waitForFunction(()=>window.__dudu.snapshot().environment.grassTime>0);
    let s=await snap();counts.push(s.environment.tufts);assert.ok(s.environment.ferns>50);assert.equal(s.environment.sunbeams,true);
    await page.screenshot({path:`test-results/woodland-${phone?'mobile':'desktop'}-day.png`,scale:'css'});
    console.log('Day captured');
    await page.locator('#play-pause').click();const frozen=(await snap()).environment.grassTime;await page.waitForTimeout(150);assert.equal((await snap()).environment.grassTime,frozen);
    await page.locator('#pause-time').click();
    await page.locator('#pause-dialog [data-close]').last().click();
    await page.waitForFunction(()=>window.__dudu.snapshot().nightBlend===1);
    assert.equal((await snap()).environment.sunbeams,false);
    await page.screenshot({path:`test-results/woodland-${phone?'mobile':'desktop'}-night.png`,scale:'css'});
    if(phone){
      await page.locator('#play-pause').click();await page.locator('#pause-weather').click();await page.locator('#pause-dialog [data-close]').last().click();
      await page.waitForFunction(()=>window.__dudu.snapshot().weather.blend===1);
      assert.equal((await snap()).environment.sunbeams,false);assert.ok((await snap()).weather.rain>0);
      await page.screenshot({path:'test-results/woodland-mobile-rain.png',scale:'css'});
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    console.log(phone?'Phone':'Desktop',s.environment,s.render);await page.close();
  }
  if(counts.length===2)assert.ok(counts[1]<counts[0]*.6);assert.deepEqual(errors,[]);
  console.log(reducedOnly?'Reduced-motion meadow verified.':'Day/night shaders, grass budgets, pause, landscape layout and browser errors verified.');
}finally{await browser.close();}
