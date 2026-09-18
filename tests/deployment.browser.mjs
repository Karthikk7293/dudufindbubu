import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.PREVIEW_URL||'http://localhost:4174';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:667,height:375},screen:{width:375,height:667},deviceScaleFactor:1,isMobile:true,hasTouch:true});page.setDefaultTimeout(120000);
  const requests=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(()=>localStorage.setItem('dudu-sound','off'));
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#loading',{state:'hidden'});
  assert.equal(await page.evaluate(()=>typeof window.__dudu),'undefined','Production excludes diagnostic fixture hooks');
  assert.equal(await page.locator('#start-button').isEnabled(),true);
  await page.locator('#start-button').tap();await page.waitForSelector('#app.playing');await page.waitForSelector('#guide-button:not(.hidden)');
  assert.ok(await page.locator('#touch-controls').isVisible());
  assert.ok(!requests.some(url=>/\/tracking\/|hand_landmarker|\/src\/engine\//.test(url)),'Forest never downloads the engine tracking assets');
  assert.equal(requests.filter(url=>url.endsWith('/models/characters/sheep.glb')).length,1,'The flock shares one sheep download');
  await page.screenshot({path:'test-results/forest-production-mobile.png'});await page.close();
  const study=await browser.newPage({viewport:{width:900,height:600},deviceScaleFactor:1});study.setDefaultTimeout(90000);
  study.on('pageerror',e=>errors.push(e.message));study.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await study.goto(base+'/character.html?animal=sheep');await study.waitForSelector('#loading',{state:'hidden'});
  assert.equal(await study.evaluate(()=>typeof window.__duduStudio),'undefined');
  await study.locator('[data-clip="Graze"]').click();assert.equal(await study.locator('[data-clip="Graze"]').getAttribute('aria-pressed'),'true');
  await study.screenshot({path:'test-results/sheep-production.png'});await study.close();
  assert.deepEqual(errors,[]);console.log('Built forest plays on a landscape phone with one sheep asset; sheep studio works; no failed resources or runtime errors.');
}finally{await browser.close();}
