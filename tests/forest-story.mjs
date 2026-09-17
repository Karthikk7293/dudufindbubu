import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { GIFTS, freshState, DESTINATION } from '../src/game-state.js';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1000,height:600},deviceScaleFactor:process.env.SOFTWARE_RENDERING_SYNC==='1'?.75:1});page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
  if(process.env.SOFTWARE_RENDERING_SYNC==='1')await page.addInitScript(()=>{
    const frame=requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>frame(time=>{callback(time);if(callback.name==='animate')document.querySelector('#world canvas')?.getContext('webgl2')?.finish();});
  });
  await page.addInitScript(fixture=>{window.__DUDU_TEST_STATE__=fixture;localStorage.setItem('dudu-sound','off');localStorage.setItem('dudu-time-of-day','day');}, {...freshState(),departed:true,collected:GIFTS.map(g=>g.id),position:DESTINATION});
  await page.goto(process.env.GAME_URL||'http://localhost:3000',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__dudu?.snapshot().ready);await page.waitForSelector('#loading',{state:'hidden'});
  const snap=()=>page.evaluate(()=>window.__dudu.snapshot());
  assert.equal((await snap()).bubuVisible,false);
  await page.locator('#start-button').click();
  await page.waitForFunction(()=>window.__dudu.snapshot().state.bubuArrived);
  const s=await snap();assert.equal(s.story,'exploring');assert.equal(s.state.completed,false);
  assert.equal(await page.locator('#journal-chapter').textContent(),'CHAPTER 3 / 4');
  // Updated canopies and posts must leave every gift and the ladder accessible.
  assert.ok(await page.evaluate(async()=>{const {findPath,GIFTS,START,MOON_NEST}=await import('/src/game-state.js');return [...GIFTS,MOON_NEST.entry].every(target=>findPath(START,target,window.__dudu.snapshot().obstacles).length>0);}));
  await page.locator('#interact-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().story==='party');
  await page.waitForFunction(()=>window.__dudu.snapshot().partyTime>3.6);
  assert.equal((await snap()).candleLit,false);
  await page.locator('#play-pause').click();assert.equal(await page.locator('#pause-photo').isDisabled(),true);const paused=(await snap()).partyTime;await page.waitForTimeout(200);assert.equal((await snap()).partyTime,paused);
  await page.locator('#pause-dialog [data-close]').last().click();
  await page.waitForSelector('#ending-dialog[open]');await page.getByRole('button',{name:'Walk together'}).click();
  assert.equal((await snap()).following,true);assert.equal((await snap()).state.completed,true);
  assert.equal(await page.locator('#journal-chapter').textContent(),'CHAPTER 4 / 4');
  const start=(await snap()).bubuPosition;await page.locator('#guide-button').click();
  await page.waitForFunction(p=>Math.hypot(window.__dudu.snapshot().bubuPosition.x-p.x,window.__dudu.snapshot().bubuPosition.z-p.z)>.7,start);
  await page.locator('#play-pause').click();await page.screenshot({path:'test-results/forest-story-together.png'});
  assert.deepEqual(errors,[]);console.log('Bubu arrival, all gift routes, birthday wish, party pause, and both bears walking together passed.');
}finally{await browser.close();}
