import { chooseGroundPoint } from './manual-input.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { freshState, START, SAVE_KEY } from '../src/game-state.js';

const url=process.env.GAME_URL||'http://localhost:3000';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const phase=process.argv.find(a=>['--loading','--camera','--reset','--tablet'].includes(a))||'--camera',errors=[];
const tablet=phase==='--tablet';
const page=await browser.newPage({viewport:tablet?{width:768,height:1024}:phase==='--reset'?{width:800,height:600}:{width:1000,height:740},deviceScaleFactor:1,isMobile:tablet,hasTouch:tablet,reducedMotion:phase==='--reset'?'reduce':'no-preference'});
page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snapshot=()=>page.evaluate(()=>window.__dudu.snapshot());
const ready=async()=>{await page.waitForFunction(()=>window.__dudu?.snapshot().ready||document.querySelector('#loading.has-error'));assert.equal(await page.locator('#loading.has-error').count(),0,errors.join('\n'));await page.waitForSelector('#loading',{state:'hidden'});};
try{
  if(phase==='--loading'){
    let release,requested;const gate=new Promise(resolve=>release=resolve),requestSeen=new Promise(resolve=>requested=resolve);
    await page.route('**/src/main.js*',async route=>{requested();await gate;if(!page.isClosed())await route.continue();});
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await requestSeen;
    await page.waitForSelector('#loading[data-stage="5"]');assert.equal(await page.locator('#app').getAttribute('aria-busy'),'true');assert.equal(await page.locator('#start-button').isDisabled(),true);assert.equal(await page.locator('#loading-retry').isVisible(),false);
    await page.screenshot({path:'test-results/loading-skeleton.png'});
    if(process.argv.includes('--preview')){await page.close();release();console.log('Skeleton and disabled controls verified with the game download held.');}else{
    release();await ready();
    assert.equal(await page.locator('#app').getAttribute('aria-busy'),'false');assert.equal(await page.locator('#start-button').isEnabled(),true);assert.equal((await snapshot()).playing,false);
    console.log('Skeleton paints before the game downloads; Play unlocks after the first forest frame.');
    await page.locator('#start-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().state.departed);assert.equal((await snapshot()).camera.perspective,true);assert.equal((await snapshot()).bubuVisible,false);await page.screenshot({path:'test-results/third-person-departure.png'});
    console.log('A fresh adventure leaves Dudu’s nest in third person, with Bubu still inside.');
    assert.deepEqual(errors,[]);await page.close();
    }
    const failure=await browser.newPage({viewport:{width:800,height:650}});
    await failure.route('**/src/main.js*',route=>route.abort());await failure.goto(url,{waitUntil:'domcontentloaded'});await failure.waitForSelector('#loading.has-error');assert.equal(await failure.locator('#loading-retry').isVisible(),true);assert.equal(await failure.locator('#start-button').isDisabled(),true);await failure.screenshot({path:'test-results/loading-error.png'});
    const navigation=failure.waitForRequest(request=>request.isNavigationRequest());await failure.locator('#loading-retry').click();await navigation;
    console.log('A failed download gives a readable error and a retry button.');
  }else{
    const fixture={...freshState(),departed:true,position:{x:-19,z:23}};
    await page.addInitScript(({fixture,night})=>{if(!sessionStorage.getItem('experience-seeded')){window.__DUDU_TEST_STATE__=fixture;sessionStorage.setItem('experience-seeded','yes');}if(night)localStorage.setItem('dudu-time-of-day','night');localStorage.setItem('dudu-sound','off');},{fixture,night:tablet});
    await page.goto(url,{waitUntil:'domcontentloaded'});await ready();await page.locator('#start-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().camera.perspective);
    let s=await snapshot();assert.equal(s.camera.mode,'third-person');assert.ok(s.camera.position.y-s.camera.target.y<5);assert.ok(s.camera.arm>3);
    if(phase==='--camera'){
      await page.screenshot({path:'test-results/third-person-day.png'});const start=s.position,yaw=s.camera.yaw;
      await page.mouse.move(760,380);await page.mouse.down();await page.mouse.move(250,410,{steps:5});await page.mouse.up();
      s=await snapshot();assert.ok(Math.abs(s.camera.yaw-yaw)>1);assert.deepEqual(s.position,start);assert.equal(s.route,0);
      assert.equal(await page.locator('#gift-pointer').count(),0,'Looking around does not reveal a hidden gift pointer');
      const before=s.position,a=s.camera.yaw;await page.keyboard.down('w');await page.waitForFunction(p=>Math.hypot(window.__dudu.snapshot().position.x-p.x,window.__dudu.snapshot().position.z-p.z)>.6,before);await page.keyboard.up('w');
      s=await snapshot();assert.ok((s.position.x-before.x)*-Math.sin(a)+(s.position.z-before.z)*-Math.cos(a)>.3,'W moves forward relative to the rotated camera');
      await page.keyboard.press('c');assert.equal((await snapshot()).camera.perspective,false);await page.keyboard.press('c');assert.equal((await snapshot()).camera.perspective,true);
      await page.locator('#zoom-overview').click();await page.waitForFunction(()=>window.__dudu.snapshot().view>90);assert.equal((await snapshot()).camera.perspective,false);await page.locator('#zoom-overview').click();await page.waitForFunction(()=>window.__dudu.snapshot().camera.perspective);
      const distance=(await snapshot()).camera.distance;await page.locator('#zoom-in').click();assert.ok((await snapshot()).camera.distance<distance);
      await page.locator('#play-time').click();await page.waitForFunction(()=>window.__dudu.snapshot().nightBlend===1);await page.screenshot({path:'test-results/third-person-night.png'});
      console.log('Third-person perspective, orbit without walking, camera-relative movement, manual exploration, zoom, overview and night lighting passed.');
    }else if(phase==='--reset'){
      await chooseGroundPoint(page,{x:-22,z:19});await page.waitForFunction(()=>!!window.__dudu.snapshot().nearby);await page.locator('#interact-button').click();await page.waitForFunction(()=>window.__dudu.snapshot().state.collected.length===1);
      await page.evaluate(({key,state})=>{localStorage.setItem(key,JSON.stringify(state));localStorage.setItem('dudu-time-of-day','night');},{key:SAVE_KEY,state:(await snapshot()).state});
      await page.reload({waitUntil:'domcontentloaded'});await ready();s=await snapshot();assert.deepEqual(s.state,freshState());assert.deepEqual(s.position,START);assert.equal(s.bubuVisible,false);assert.equal(s.following,false);assert.equal(s.playing,false);assert.equal(s.timeOfDay,'night');assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY),null);assert.match(await page.locator('#start-button').textContent(),/Let’s find Bubu/);
      console.log('A real collected gift and old stored progress reset on refresh; Bubu stays inside and the day/night preference remains.');
    }else{
      const framing=await page.evaluate(()=>{const p=window.__dudu.snapshot().position;return Math.abs(window.__dudu.project(p.x,p.z,2.8).y-window.__dudu.project(p.x,p.z,.2).y)/innerHeight;});
      assert.ok(framing<.55,'Dudu leaves room to see the forest on a tablet');
      await page.screenshot({path:'test-results/third-person-tablet.png'});
      if(process.argv.includes('--preview')){assert.deepEqual(errors,[]);console.log('Portrait camera framing and rendering passed.');await browser.close();process.exit(0);}
      const cdp=await page.context().newCDPSession(page),yaw=s.camera.yaw,start=s.position;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:380}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:170,y:410}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      s=await snapshot();assert.ok(Math.abs(s.camera.yaw-yaw)>.2);assert.deepEqual(s.position,start);assert.equal(s.route,0);
      const distance=s.camera.distance;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:340},{x:240,y:340}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:90,y:340},{x:270,y:340}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await snapshot()).camera.distance<distance);assert.equal((await snapshot()).route,0);
      const joy=await page.locator('#joystick').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:joy.x+88,y:joy.y+55}]});await page.waitForFunction(p=>Math.hypot(window.__dudu.snapshot().position.x-p.x,window.__dudu.snapshot().position.z-p.z)>.5,start);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.locator('#camera-mode').tap();assert.equal((await snapshot()).camera.perspective,false);await page.locator('#camera-mode').tap();assert.equal((await snapshot()).camera.perspective,true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const camera=await page.locator('#zoom-tools').boundingBox();assert.ok(camera.x>=0&&camera.x+camera.width<=768&&camera.y+camera.height<joy.y,'Camera controls stay clear of the touch joystick');
      console.log('Tablet third person, swipe orbit, pinch zoom, joystick and view switch passed.');
    }
    assert.deepEqual(errors,[]);
  }
}catch(error){if(!page.isClosed())console.log('Failure:',await page.evaluate(()=>({loading:document.querySelector('#loading-status')?.textContent,snapshot:window.__dudu?.snapshot().camera,state:window.__dudu?.snapshot().state})));throw error;}finally{await browser.close();}
