import { chooseGroundPoint } from './manual-input.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { GIFTS, START, BUBU, DESTINATION, freshState, SAVE_KEY } from '../src/game-state.js';

await mkdir('test-results',{recursive:true});
if(process.argv.includes('--moon-nest')){await import('./moon-nest.mjs');process.exit(0);}
if(process.argv.includes('--experience')){await import('./experience.mjs');process.exit(0);}
if(process.argv.includes('--day-night')){await import('./day-night.mjs');process.exit(0);}
if(process.argv.includes('--characters')){await import('./characters.mjs');process.exit(0);}
if(process.argv.includes('--refinements')){await import('./refinements.mjs');process.exit(0);}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const url=process.env.GAME_URL||'http://localhost:3000',errors=[];
const interactionOnly=process.argv.includes('--interaction');
const page=await browser.newPage({viewport:{width:1100,height:800},deviceScaleFactor:1});
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(key=>{const seed=sessionStorage.getItem('birthday-test-seed');if(seed){window.__DUDU_TEST_STATE__=JSON.parse(seed);sessionStorage.removeItem('birthday-test-seed');}},SAVE_KEY);
const snapshot=()=>page.evaluate(()=>window.__dudu.snapshot());
async function seed(state){
  await page.evaluate(state=>sessionStorage.setItem('birthday-test-seed',JSON.stringify(state)),state);
  await page.reload();await page.waitForFunction(()=>window.__dudu);
}
async function begin(){await page.locator('#start-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().playing);}
async function settled(){await page.waitForFunction(()=>window.__dudu.snapshot().story==='exploring',null,{timeout:60000});}
try{
  await page.goto(url);await page.waitForFunction(()=>window.__dudu);
  assert.equal((await snapshot()).bubuVisible,false,'Bubu starts inside her nest');
  assert.deepEqual((await snapshot()).position,START);
  await page.screenshot({path:'test-results/expanded-intro.png'});
  await begin();await settled();await page.keyboard.press('c');
  let current=await snapshot();assert.equal(current.state.departed,true);assert.equal(current.bubuVisible,false);
  assert.ok(Math.hypot(current.duduPosition.x-START.x,current.duduPosition.z-START.z)<.1,'Dudu walked out of his own nest');
  const bounds=await page.evaluate(()=>{const r=document.querySelector('#game-shell').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight};});
  assert.equal(bounds.x,0);assert.equal(bounds.y,0);assert.equal(bounds.width,bounds.viewportWidth);assert.equal(bounds.height,bounds.viewportHeight);
  assert.equal(await page.locator('.topbar').isVisible(),false);assert.equal(await page.locator('.bottom-bar').isVisible(),false);assert.equal(await page.locator('#map-button').isVisible(),false);
  await page.screenshot({path:'test-results/fullscreen-departure.png'});
  console.log('Departure, hidden Bubu, and full-viewport play passed.');

  const zoomBefore=current.zoom;
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert.ok((await snapshot()).zoom<zoomBefore);
  await page.getByRole('button',{name:'Zoom out',exact:true}).click();assert.ok(Math.abs((await snapshot()).zoom-zoomBefore)<.1);
  await page.mouse.move(550,550);await page.mouse.wheel(0,150);await page.waitForTimeout(200);assert.ok((await snapshot()).zoom>zoomBefore);
  await page.keyboard.press('+');await page.getByRole('button',{name:'See whole area'}).click();
  await page.waitForFunction(()=>window.__dudu.snapshot().view>85,null,{timeout:30000});
  assert.equal((await snapshot()).overview,true);await page.screenshot({path:'test-results/expanded-overview.png'});
  await page.getByRole('button',{name:'Follow Dudu'}).click();
  await page.waitForFunction(()=>window.__dudu.snapshot().view<35,null,{timeout:30000});
  assert.ok(current.weather.snow>0);assert.equal(current.weather.sun,true);assert.ok(current.weather.birds.length>=6);assert.ok(current.weather.windLeaves>0);assert.notDeepEqual((await snapshot()).weather.birds,current.weather.birds,'Birds fly through the forest');
  assert.ok(current.animals.length>=16);assert.ok(current.balloons>=14);assert.ok(current.worldRadius>35);
  const routes=await page.evaluate(async()=>{const {findPath,GIFTS,DESTINATION}=await import('/src/game-state.js'),s=window.__dudu.snapshot();return [...GIFTS,DESTINATION].map(g=>({id:g.id||'bubu',length:findPath(s.position,g,s.obstacles).length}));});
  assert.ok(routes.every(r=>r.length>0),'Every gift and clearing is reachable around real obstacles');
  console.log('Zoom, wheel, overview, animals, balloons, and destination routes passed.');

  await page.keyboard.press('m');await page.waitForSelector('#map-dialog[open]');
  const pausedAt=(await snapshot()).position;await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');assert.deepEqual((await snapshot()).position,pausedAt);
  await page.screenshot({path:'test-results/expanded-map.png'});await page.locator('#map-dialog [data-close]').click();
  await page.keyboard.press('b');await page.waitForSelector('#bag-dialog[open]');await page.getByRole('button',{name:'A little hint'}).click();assert.ok((await page.locator('#bag-hint').textContent()).length>25);await page.getByRole('button',{name:'Love letter: not found'}).click();assert.match(await page.locator('#bag-hint').textContent(),/wishing tree/);await page.locator('#bag-dialog .dialog-close').click();
  assert.equal((await snapshot()).route,0);assert.equal(await page.locator('#gift-pointer,#guide-button,#track-gift').count(),0);
  await page.screenshot({path:'test-results/manual-exploration-hud.png'});
  await page.keyboard.press('p');await page.waitForSelector('#pause-dialog[open]');
  await page.getByRole('button',{name:'Turn sound off',exact:true}).click();assert.equal((await snapshot()).sound,false);
  await page.getByRole('button',{name:'Turn sound on',exact:true}).click();assert.equal((await snapshot()).sound,true);
  await page.getByRole('button',{name:'Keep wandering'}).click();
  const target=await page.evaluate(({x,z})=>window.__dudu.project(x,z),{x:START.x+4,z:START.z});
  await page.mouse.click(target.x,target.y);
  await page.waitForFunction(start=>window.__dudu.snapshot().position.x>start.x+2,START,{timeout:30000});
  console.log('Map pause, bag hints, audio, and click-to-walk passed.');

  if(!interactionOnly){
    await seed({...freshState(),departed:true,bubuArrived:true,position:{...DESTINATION}});
    await begin();await settled();
    const earlyTime=(await snapshot()).time;await page.waitForFunction(t=>window.__dudu.snapshot().time>t+1,earlyTime);
    assert.equal((await snapshot()).bubuVisible,false,'Bubu stays inside when Dudu has missing gifts, including old saves');
    assert.equal((await snapshot()).state.bubuArrived,false);
    console.log('An early visit cannot reveal Bubu without all eight gifts.');

    // The player chooses where to walk; collecting the final gift must not route to Bubu.
    await seed({...freshState(),departed:true,position:{x:6,z:-5},collected:GIFTS.filter(g=>g.id!=='letter').map(g=>g.id)});
    await begin();await settled();await chooseGroundPoint(page,{x:13,z:-5});
    await page.waitForFunction(()=>window.__dudu.snapshot().nearby==='letter',null,{timeout:45000});
    await page.locator('#interact-button').click();
    assert.equal((await snapshot()).route,0);
    assert.equal((await snapshot()).state.collected.length,8);assert.equal((await snapshot()).bubuVisible,false);
    console.log('The letter can be found manually; collecting it does not lead to Bubu.');
    const collected=[];
    for(const gift of GIFTS){
      await seed({...freshState(),departed:true,bubuArrived:true,position:{x:gift.x+1.6,z:gift.z},collected:[...collected]});
      await begin();await settled();await page.keyboard.press('e');
      await page.waitForFunction(id=>window.__dudu.snapshot().state.collected.includes(id),gift.id);
      collected.push(gift.id);assert.deepEqual((await snapshot()).state.collected,collected);
      assert.equal(await page.locator('dialog[open]').count(),0,'Collection keeps the playground unobstructed');
      await page.keyboard.press('e');assert.equal((await snapshot()).state.collected.length,collected.length);
      console.log(`Collected ${gift.id}.`);
    }
    await page.keyboard.press('b');await page.screenshot({path:'test-results/eight-gift-bag.png'});await page.locator('#bag-dialog [data-close]').first().click();
    await seed({...freshState(),departed:true,position:{...DESTINATION},collected});
    await begin();await page.waitForFunction(()=>window.__dudu.snapshot().story==='arrival',null,{timeout:30000});
    await page.waitForFunction(()=>window.__dudu.snapshot().bubuVisible&&!window.__dudu.snapshot().state.bubuArrived,null,{timeout:30000});
    assert.ok((await snapshot()).bubuPosition.z<BUBU.z,'Bubu walks out of the doorway');
    await page.screenshot({path:'test-results/bubu-coming-home.png'});await settled();
    await page.getByRole('button',{name:'E Celebrate Bubu’s birthday',exact:true}).click();
    assert.equal((await snapshot()).story,'party');assert.equal((await snapshot()).state.completed,false,'Starting the party does not prematurely finish it');
    await page.waitForFunction(()=>window.__dudu.snapshot().partyTime>4,null,{timeout:30000});
    assert.equal((await snapshot()).candleLit,false,'Bubu makes her candle wish');
    await page.screenshot({path:'test-results/birthday-party.png'});
    await page.waitForSelector('#ending-dialog[open]',{timeout:60000});
    assert.equal((await snapshot()).state.completed,true);await page.screenshot({path:'test-results/expanded-birthday.png'});
    await page.getByRole('button',{name:'Walk together'}).click();await page.keyboard.press('c');
    assert.equal((await snapshot()).following,true);assert.equal((await snapshot()).route,0);
    const reunion=(await snapshot()).bubuPosition;
    const togetherTarget=await page.evaluate(()=>window.__dudu.project(0,-24));await page.mouse.click(togetherTarget.x,togetherTarget.y);
    await page.waitForFunction(()=>window.__dudu.snapshot().position.x<1.5,null,{timeout:45000});
    await page.waitForFunction(start=>Math.hypot(window.__dudu.snapshot().bubuPosition.x-start.x,window.__dudu.snapshot().bubuPosition.z-start.z)>2,reunion,{timeout:30000});
    assert.ok(await page.evaluate(async()=>{const {isWalkable}=await import('/src/game-state.js'),s=window.__dudu.snapshot();return isWalkable(s.bubuPosition.x,s.bubuPosition.z,s.obstacles);}));
    await page.screenshot({path:'test-results/walking-together.png'});
    await page.reload();await page.waitForFunction(()=>window.__dudu);assert.deepEqual((await snapshot()).state,freshState());assert.equal((await snapshot()).bubuVisible,false);assert.equal((await snapshot()).following,false);
    await begin();await page.keyboard.press('p');await page.getByRole('button',{name:'Start a fresh adventure'}).click();
    assert.equal((await snapshot()).bubuVisible,false);assert.deepEqual((await snapshot()).state.collected,[]);await settled();assert.deepEqual((await snapshot()).position,START);
    console.log('All eight gifts gate arrival, birthday party, walking together, reset on refresh, and restart passed.');
    await seed({...freshState(),departed:true,position:{x:8,z:26}});await begin();await settled();
    await page.getByRole('button',{name:'Zoom in',exact:true}).click({clickCount:3});
    await page.waitForFunction(()=>window.__dudu.snapshot().view<17,null,{timeout:30000});
    await page.screenshot({path:'test-results/lamb-faces.png'});
  }
  await page.close();
  const tablet=await browser.newPage({viewport:{width:768,height:1024},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  tablet.on('pageerror',error=>errors.push(error.message));await tablet.goto(url);await tablet.waitForFunction(()=>window.__dudu);
  await tablet.screenshot({path:'test-results/expanded-tablet-intro.png'});await tablet.locator('#start-button').tap();
  await tablet.waitForFunction(()=>window.__dudu.snapshot().state.departed,null,{timeout:60000});
  assert.equal(await tablet.locator('.topbar').isVisible(),false);assert.ok(await tablet.locator('#touch-controls').isVisible());
  const touch=await tablet.context().newCDPSession(tablet),zoomBeforePinch=await tablet.evaluate(()=>window.__dudu.snapshot().zoom);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:360},{x:260,y:360}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:80,y:360},{x:300,y:360}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(await tablet.evaluate(()=>window.__dudu.snapshot().zoom)<zoomBeforePinch,'Pinch zooms the camera');
  assert.equal(await tablet.evaluate(()=>window.__dudu.snapshot().route),0,'Pinching does not also walk');
  const initial=await tablet.evaluate(()=>window.__dudu.snapshot().position),joy=await tablet.locator('#joystick').boundingBox();
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:joy.x+90,y:joy.y+55}]});
  await tablet.waitForFunction(start=>Math.hypot(window.__dudu.snapshot().position.x-start.x,window.__dudu.snapshot().position.z-start.z)>.5,initial,{timeout:15000});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await tablet.screenshot({path:'test-results/fullscreen-tablet.png'});
  assert.equal(await tablet.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const guideBox=await tablet.locator('#journey-status').boundingBox(),toolsBox=await tablet.locator('#play-tools').boundingBox();assert.ok(guideBox.x+guideBox.width<toolsBox.x,'Tablet pointer card and controls do not overlap');
  assert.deepEqual(errors,[],'No browser runtime errors');console.log('Tablet full-screen, pinch zoom, joystick, and browser checks passed.');
}catch(error){if(!page.isClosed())console.log('Failure state:',await snapshot());throw error;}
finally{await browser.close();}
