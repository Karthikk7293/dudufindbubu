import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.PREVIEW_URL||'http://localhost:4174';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:667,height:375},screen:{width:375,height:667},deviceScaleFactor:.6,isMobile:true,hasTouch:true});page.setDefaultTimeout(120000);
  const requests=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(()=>{
    localStorage.setItem('dudu-sound','off');localStorage.setItem('dudu-weather','clear');localStorage.setItem('dudu-time-of-day','day');
    Object.defineProperty(document,'fullscreenEnabled',{get:()=>false});
    const frame=requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>frame(time=>{callback(time);document.querySelector('#world canvas')?.getContext('webgl2')?.finish();});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#loading',{state:'hidden'});
  assert.equal(await page.evaluate(()=>typeof window.__dudu),'undefined','Production excludes diagnostic fixture hooks');
  assert.equal(await page.locator('#start-button').isEnabled(),true);
  await page.locator('#start-button').tap();await page.waitForSelector('#app.playing');await page.waitForSelector('#guide-button:not(.hidden)');
  assert.ok(await page.locator('#touch-controls').isVisible());
  assert.ok(!requests.some(url=>/\/tracking\/|hand_landmarker|\/src\/engine\//.test(url)),'Forest never downloads the engine tracking assets');
  assert.equal(requests.filter(url=>url.endsWith('/models/characters/sheep.glb')).length,1,'The flock shares one sheep download');
  await page.screenshot({path:'test-results/forest-production-mobile.png',scale:'css'});
  assert.ok(!requests.some(url=>/\/destination-scene-.*\.js/.test(url)),'New scenery stays lazy until travel');
  await page.waitForSelector('#travel-button:not([disabled])');await page.locator('#travel-button').tap();
  await page.locator('[data-destination="city"]').tap();await page.waitForSelector('#travel-loading',{state:'hidden'});
  assert.match(await page.locator('#travel-button').textContent(),/Lumen City/);
  assert.ok(requests.some(url=>/\/destination-scene-.*\.js/.test(url)),'Production loads the destination chunk on demand');
  await page.locator('#play-map').tap();assert.equal(await page.locator('#map-title').textContent(),'Lumen City');await page.locator('#map-dialog [data-close]').tap();
  await page.locator('#zoom-overview').tap();await page.locator('#play-pause').tap();await page.locator('#pause-photo').tap();
  await page.screenshot({path:'test-results/city-production-mobile.png',scale:'css'});await page.locator('#photo-exit').tap();
  await page.locator('#travel-button').tap();await page.locator('[data-destination="forest"]').tap();await page.waitForSelector('#travel-loading',{state:'hidden'});
  assert.match(await page.locator('#travel-button').textContent(),/Sunnywood Forest/);await page.close();
  const study=await browser.newPage({viewport:{width:900,height:600},deviceScaleFactor:1});study.setDefaultTimeout(90000);
  study.on('pageerror',e=>errors.push(e.message));study.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await study.goto(base+'/character.html?animal=sheep');await study.waitForSelector('#loading',{state:'hidden'});
  assert.equal(await study.evaluate(()=>typeof window.__duduStudio),'undefined');
  await study.locator('[data-clip="Graze"]').click();assert.equal(await study.locator('[data-clip="Graze"]').getAttribute('aria-pressed'),'true');
  await study.screenshot({path:'test-results/sheep-production.png'});await study.close();
  assert.deepEqual(errors,[]);console.log('Built forest plays on a landscape phone; city scenery loads on demand and returns home; sheep studio works; no failed resources or runtime errors.');
}finally{await browser.close();}
