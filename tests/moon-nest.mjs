import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { GIFTS, MOON_NEST, freshState } from '../src/game-state.js';

const url=process.env.GAME_URL||'http://localhost:3000';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
const ready=async page=>{await page.waitForFunction(()=>window.__dudu?.snapshot().ready||document.querySelector('#loading.has-error'));assert.equal(await page.locator('#loading.has-error').count(),0,errors.join('\n'));await page.waitForSelector('#loading',{state:'hidden'});};
let page;
try{
  page=await browser.newPage({viewport:{width:1100,height:780},deviceScaleFactor:1});page.setDefaultTimeout(150000);page.on('pageerror',error=>errors.push(error.message));
  const fixture={...freshState(),collected:GIFTS.map(g=>g.id),completed:true,departed:true,bubuArrived:true,position:{...MOON_NEST.entry},companionPosition:{x:-15,z:-24}};
  await page.addInitScript(fixture=>{if(!sessionStorage.getItem('moon-seeded')){window.__DUDU_TEST_STATE__=fixture;sessionStorage.setItem('moon-seeded','true');}localStorage.setItem('dudu-sound','off');localStorage.setItem('dudu-time-of-day','day');},fixture);
  const snapshot=()=>page.evaluate(()=>window.__dudu.snapshot());
  await page.goto(url,{waitUntil:'domcontentloaded'});await ready(page);
  await page.locator('#start-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().playing);
  await page.evaluate(async()=>{
    const {findPath,GIFTS,START,BUBU,MOON_NEST}=await import('/src/game-state.js');
    for(const target of [...GIFTS,BUBU,MOON_NEST.entry])if(!findPath(START,target,window.__dudu.snapshot().obstacles).length)throw new Error(`No route to ${target.id||JSON.stringify(target)}`);
  });
  const sizes=(await snapshot()).treeSizes.map(t=>t.height);assert.ok(Math.max(...sizes)>Math.min(...sizes)*2.5);assert.ok((await snapshot()).bearScale<.75);
  assert.equal((await snapshot()).guidance.id,'moon-nest');
  await page.screenshot({path:'test-results/moonwatch-tree-day.png'});
  await page.locator('#interact-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().moonJourney?.phase==='climbing');
  await page.waitForFunction(()=>{const s=window.__dudu.snapshot();return s.nightBlend>.3&&s.nightBlend<.8;});
  await page.locator('#play-pause').click();const paused=await snapshot();
  assert.ok(paused.duduPosition.y>2&&paused.bubuPosition.y>2);assert.ok(paused.nightBlend>.2&&paused.nightBlend<1);
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,350)));const still=await snapshot();
  assert.deepEqual(still.duduPosition,paused.duduPosition);assert.deepEqual(still.bubuPosition,paused.bubuPosition);assert.equal(still.nightBlend,paused.nightBlend);
  await page.locator('#pause-dialog [data-close]').last().click();await page.screenshot({path:'test-results/moonwatch-climb-dusk.png'});
  await page.waitForFunction(()=>window.__dudu.snapshot().moonJourney?.phase==='stargazing');
  let s=await snapshot();assert.equal(s.nightBlend,1);assert.ok(s.duduPosition.y>10&&s.bubuPosition.y>10);assert.equal(s.weather.moon,true);assert.ok(s.weather.stars>100&&s.weather.clouds>0);
  assert.equal(await page.locator('#play-time').isDisabled(),true);await page.keyboard.press('t');assert.equal((await snapshot()).timeOfDay,'night');
  await page.waitForFunction(()=>window.__dudu.snapshot().weather.shootingStar);await page.screenshot({path:'test-results/moonwatch-stargazing.png'});
  console.log('Real forest routes, smaller bears, varied tree heights, dusk climb, pause and moon/star/meteor view passed.');
  if(process.argv.includes('--preview')){
    await page.setViewportSize({width:768,height:1024});await page.screenshot({path:'test-results/tablet-moonwatch-nest.png'});
    assert.deepEqual(errors,[]);await browser.close();process.exit(0);
  }
  await page.locator('#interact-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().story==='exploring');
  s=await snapshot();assert.ok(s.duduPosition.y<.5&&s.bubuPosition.y<.5);assert.equal(s.following,true);assert.equal(s.state.completed,true);assert.equal(s.timeOfDay,'night');
  await page.keyboard.down('w');await page.waitForFunction(p=>Math.hypot(window.__dudu.snapshot().position.x-p.x,window.__dudu.snapshot().position.z-p.z)>.35,s.position);await page.keyboard.up('w');
  console.log('Both bears climbed down safely and resumed walking together.');
  await page.locator('#guide-button').click();
  await page.waitForFunction(()=>{const s=window.__dudu.snapshot();return s.story==='moon'||s.nearby==='moon-nest'&&!s.route;});
  if((await snapshot()).story!=='moon')await page.locator('#interact-button').click();
  await page.waitForFunction(()=>window.__dudu.snapshot().moonJourney?.phase==='climbing');
  await page.locator('#play-pause').click();await page.locator('#restart-button').click();
  await page.waitForFunction(()=>window.__dudu.snapshot().state.departed);s=await snapshot();assert.equal(s.moonJourney,null);assert.equal(s.bubuVisible,false);assert.equal(s.state.completed,false);assert.equal(s.state.collected.length,0);assert.ok(s.duduPosition.y<.5);
  await page.setViewportSize({width:700,height:780});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1100,height:780});
  console.log('Descent, companion walking, restart during a climb and desktop resize passed.');
  await page.close();
  const tablet=await browser.newPage({viewport:{width:768,height:1024},deviceScaleFactor:1,isMobile:true,hasTouch:true});tablet.setDefaultTimeout(150000);tablet.on('pageerror',error=>errors.push(error.message));
  await tablet.addInitScript(()=>localStorage.setItem('dudu-sound','off'));await tablet.goto(url,{waitUntil:'domcontentloaded'});await ready(tablet);await tablet.locator('#start-button').tap();await tablet.waitForFunction(()=>window.__dudu.snapshot().state.departed);
assert.equal(await tablet.locator('#touch-controls').isVisible(),true);
  const guide=await tablet.locator('#guide-button').boundingBox(),controls=await tablet.locator('#play-tools').boundingBox();assert.ok(guide.x+guide.width<controls.x);
  assert.equal(await tablet.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await tablet.screenshot({path:'test-results/tablet-forest-proportions.png'});
  await tablet.close();assert.deepEqual(errors,[]);console.log('Tablet portrait play and controls render without overflow or browser errors.');
}catch(error){if(page&&!page.isClosed())console.log('Browser state:',await page.evaluate(()=>({loading:document.querySelector('#loading-status')?.textContent,state:window.__dudu?.snapshot()})));throw error;}finally{await browser.close();}
