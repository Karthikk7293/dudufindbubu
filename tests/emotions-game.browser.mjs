import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { freshState, GIFTS, DESTINATION } from '../src/game-state.js';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],base=process.env.GAME_URL||'http://localhost:3000';
async function scene(fixture,phone=false){
  const context=await browser.newContext(phone?{viewport:{width:667,height:375},screen:{width:375,height:667},isMobile:true,hasTouch:true,deviceScaleFactor:1}:{viewport:{width:900,height:540},deviceScaleFactor:1});
  const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(state=>{window.__DUDU_TEST_STATE__=state;localStorage.setItem('dudu-sound','off');localStorage.setItem('dudu-time-of-day','day');localStorage.setItem('dudu-weather','clear');Object.defineProperty(document,'fullscreenEnabled',{get:()=>false});},fixture);
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__dudu?.snapshot().ready);await page.waitForSelector('#loading',{state:'hidden'});
  await page.locator('#start-button').click();return {context,page,snap:()=>page.evaluate(()=>window.__dudu.snapshot())};
}
try{
  {
    const {context,page,snap}=await scene({...freshState(),departed:true,position:{x:-21.2,z:19}},true);
    await page.waitForFunction(()=>window.__dudu.snapshot().expressions[0].mood==='curious');
    await page.locator('#touch-interact').tap();await page.waitForFunction(()=>window.__dudu.snapshot().state.collected.includes('chocolates'));
    await page.waitForFunction(()=>window.__dudu.snapshot().expressions[0].mood==='delighted');
    await page.locator('#play-pause').tap();const frozen=(await snap()).expressions;
    await page.waitForTimeout(200);assert.deepEqual((await snap()).expressions,frozen);
    await page.locator('#pause-dialog [data-close]').last().tap();
    await page.waitForFunction(()=>window.__dudu.snapshot().expressions[0].reaction===null);
    const joystick=await page.locator('#joystick').boundingBox(),client=await context.newCDPSession(page),touch={id:1,x:joystick.x+joystick.width/2+25,y:joystick.y+joystick.height/2,radiusX:7,radiusY:7};
    const before=(await snap()).position;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
    await page.waitForFunction(p=>Math.hypot(window.__dudu.snapshot().position.x-p.x,window.__dudu.snapshot().position.z-p.z)>.25,before);
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>window.__dudu.snapshot().expressions[0].stride<.05);
    assert.equal((await snap()).bubuVisible,false);
    console.log('Mobile gift curiosity, delight, paused emotions, and touch walking passed.');await context.close();
  }
  {
    const {context,page,snap}=await scene({...freshState(),departed:true,collected:GIFTS.map(g=>g.id),position:DESTINATION});
    await page.waitForFunction(()=>window.__dudu.snapshot().state.bubuArrived);
    await page.locator('#interact-button').click();
    await page.waitForFunction(()=>window.__dudu.snapshot().expressions[1].mood==='wish');
    await page.locator('#play-pause').click();const frozen=(await snap()).expressions;
    await page.waitForTimeout(150);assert.deepEqual((await snap()).expressions,frozen);
    await page.locator('#pause-dialog [data-close]').last().click();
    await page.waitForFunction(()=>window.__dudu.snapshot().partyTime>3.6);const party=await snap();assert.equal(party.candleLit,false);assert.equal(party.expressions[1].mood,'delighted');
    await page.waitForSelector('#ending-dialog[open]');await page.getByRole('button',{name:'Walk together'}).click();
    assert.equal((await snap()).following,true);
    await page.locator('#interact-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().expressions[1].mood==='shy');
    assert.equal((await snap()).route,0);
    await page.locator('#guide-button').click();const before=(await snap()).bubuPosition;
    await page.waitForFunction(p=>Math.hypot(window.__dudu.snapshot().bubuPosition.x-p.x,window.__dudu.snapshot().bubuPosition.z-p.z)>.5,before);
    await page.locator('#play-pause').click();await page.locator('#restart-button').click();
    const fresh=await snap();assert.equal(fresh.state.collected.length,0);assert.equal(fresh.bubuVisible,false);assert.ok(fresh.expressions.every(e=>e.reaction===null));
    console.log('Arrival, candle wish, birthday delight, shy conversation, companion walking, and fresh restart passed.');await context.close();
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
