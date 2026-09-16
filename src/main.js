import * as THREE from 'three';
import { ForestWorld } from './world.js';
import { ForestAudio } from './audio.js';
import { turnBear } from './bear-motion.js';
import { currentScreen } from './screen-support.js';
import { icons, giftArt } from './icons.js';
import { FOLLOW_MIN, FOLLOW_MAX } from './follow-camera.js';
import { GIFTS, BUBU, START, DUDU_NEST, BUBU_NEST, DESTINATION, MOON_NEST, WORLD_RADIUS, TRAILS, PONDS, SAVE_KEY, freshState, restoreState, collectGift, canCelebrate, shouldRevealBubu, guidanceTarget, moveWithCollisions, findPath, isWalkable } from './game-state.js';

const $=id=>document.getElementById(id);
const show=id=>$(id).classList.remove('hidden'), hide=id=>$(id).classList.add('hidden');
const audio=new ForestAudio();
let state=freshState();
// Adventure progress belongs to this page visit. Refresh always starts at home.
try{localStorage.removeItem(SAVE_KEY);}catch{/* Storage is optional. */}
// Explicit browser-test fixtures are only accepted in a development build.
if(import.meta.env.DEV&&window.__DUDU_TEST_STATE__){state=restoreState(JSON.stringify(window.__DUDU_TEST_STATE__));delete window.__DUDU_TEST_STATE__;}
let weatherMode='clear';try{if(localStorage.getItem('dudu-weather')==='rain')weatherMode='rain';}catch{}
let timeOfDay='day';try{if(localStorage.getItem('dudu-time-of-day')==='night')timeOfDay='night';}catch{}
let world, ready=false, playing=false, nearby=null, route=[], toastTimer, speechTimer, speechBear='dudu', lastTime=0, stepTime=0, mapTime=0, wasPaused=false, fullscreenTransition=false;
let guidedId=null,inspectedGift=null,guideTarget=null,guidePath=[],guideTime=0,guideOrigin=null;
let joystick={x:0,y:0}, joystickPointer=null;
const keys=new Set();
const dialogs=[...document.querySelectorAll('dialog')];
const isPaused=()=>dialogs.some(d=>d.open)||document.hidden||document.documentElement.dataset.rotateRequired==='true';

$('sound-button').innerHTML=icons.muted;$('help-button').innerHTML=icons.help;$('headphone-icon').innerHTML=icons.headphones;
$('leaf-icon').innerHTML=icons.leaf;$('heart-icon').innerHTML=icons.heart;$('map-icon').innerHTML=icons.map;
$('play-bag-icon').innerHTML=icons.bag;$('play-map').innerHTML=icons.map;$('play-pause').innerHTML=icons.pause;
$('zoom-in').innerHTML=icons.zoomIn;$('zoom-out').innerHTML=icons.zoomOut;$('zoom-overview').innerHTML=icons.overview;
$('camera-recenter').innerHTML=icons.recenter;
$('bag-slots').innerHTML=GIFTS.map(g=>`<button class="bag-slot" data-gift="${g.id}" aria-label="${g.short}: not found" title="${g.short}">${giftArt[g.id]}<span>${g.short}</span></button>`).join('');
$('ending-gifts').innerHTML=GIFTS.map(g=>giftArt[g.id]).join('');
$('start-button').disabled=true;
function updateSoundButton(){
  $('sound-button').innerHTML=audio.enabled?icons.sound:icons.muted;
  $('sound-button').setAttribute('aria-label',audio.enabled?'Turn sound off':'Turn sound on');
  $('sound-button').setAttribute('aria-pressed',String(audio.enabled));
  $('sound-button').title=audio.enabled?'Sound on — click to mute':'Sound off — click to listen';
  $('pause-sound').innerHTML=`${audio.enabled?icons.sound:icons.muted}<span>Sound ${audio.enabled?'on':'off'}</span>`;
  $('pause-sound').setAttribute('aria-label',audio.enabled?'Turn sound off':'Turn sound on');
}
async function toggleSound(){if(audio.enabled)audio.mute();else if(!await audio.start())toast('Sound isn’t available in this browser. You can still enjoy the forest.');updateSoundButton();try{localStorage.setItem('dudu-sound',audio.enabled?'on':'off');}catch{}}
$('sound-button').addEventListener('click',toggleSound);
function updateTimeControls(){
  const night=timeOfDay==='night',label=night?'Switch to day mode':'Switch to night mode';
  $('app').classList.toggle('night',night);
  ['intro-time','play-time','pause-time'].forEach(id=>{const button=$(id);button.innerHTML=(night?icons.sun:icons.moon)+(id==='pause-time'?`<span>${night?'Day':'Night'} mode</span>`:'');button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(night));button.title=`${label} (T)`;});
}
function toggleTime(){
  if(!world||world.story==='moon')return;timeOfDay=timeOfDay==='day'?'night':'day';world.setTimeOfDay(timeOfDay,isPaused());audio.setNight(timeOfDay==='night');updateTimeControls();
  try{localStorage.setItem('dudu-time-of-day',timeOfDay);}catch{}
  if(playing&&!isPaused())toast(timeOfDay==='night'?'Moonlit paths, little lanterns, and wishes among the stars.':weatherMode==='rain'?'A rainy morning in the woods. ♡':'Hello, sunshine. The butterflies are back. ♡',3800);
}
['intro-time','play-time','pause-time'].forEach(id=>$(id).addEventListener('click',toggleTime));updateTimeControls();
function updateWeatherControls(){
  const rainy=weatherMode==='rain',label=rainy?'Clear the sky':'Start gentle rain';
  $('app').classList.toggle('rainy',rainy);
  ['intro-weather','play-weather','pause-weather'].forEach(id=>{
    const button=$(id),caption=id==='intro-weather'?(rainy?'Gentle rain':'Clear skies'):label;
    button.innerHTML=(rainy?icons.rain:icons.cloudSun)+(id==='play-weather'?'':`<span>${caption}</span>`);
    button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(rainy));button.title=`${label} (V)`;
  });
}
function toggleWeather(){
  if(!world||!ready)return;
  weatherMode=weatherMode==='clear'?'rain':'clear';world.setWeather(weatherMode,isPaused());
  audio.setRain(weatherMode==='rain');updateWeatherControls();
  try{localStorage.setItem('dudu-weather',weatherMode);}catch{}
  if(playing&&!isPaused())toast(weatherMode==='rain'?'A little rain, a softer forest. ♡':'The clouds are clearing. ♡');
}
['intro-weather','play-weather','pause-weather'].forEach(id=>$(id).addEventListener('click',toggleWeather));updateWeatherControls();


function openDialog(id){
  clearInputs();
  dialogs.filter(dialog=>dialog.open&&dialog.id!==id).forEach(dialog=>dialog.close());
  if(!$(id).open)$(id).showModal();audio.setPaused(true);
}
function closeDialog(dialog){dialog.close();audio.setPaused(isPaused());if(playing)$('world').focus({preventScroll:true});}
dialogs.forEach(dialog=>{
  dialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>closeDialog(dialog)));
  dialog.addEventListener('cancel',()=>{setTimeout(()=>{audio.setPaused(isPaused());if(playing)$('world').focus({preventScroll:true});},0);});
  dialog.addEventListener('click',event=>{if(event.target===dialog && dialog.id!=='ending-dialog'){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog(dialog);}});
});
$('help-button').addEventListener('click',()=>openDialog('help-dialog'));
function openMap(){drawMap($('large-map'),true);openDialog('map-dialog');}
$('map-button').addEventListener('click',openMap);$('play-map').addEventListener('click',openMap);
$('play-bag').addEventListener('click',()=>openDialog('bag-dialog'));$('play-pause').addEventListener('click',()=>openDialog('pause-dialog'));
$('pause-sound').addEventListener('click',toggleSound);$('pause-help').addEventListener('click',()=>openDialog('help-dialog'));
async function enterFullscreen(){
  fullscreenTransition=true;
  try{
    if(!document.fullscreenElement&&document.fullscreenEnabled)await $('app').requestFullscreen();
  }catch{/* Some phone browsers use the full browser viewport instead. */}
  try{if(currentScreen().phone&&screen.orientation?.lock)await screen.orientation.lock('landscape');}
  catch{/* The rotate prompt is the fallback for unsupported or denied locks. */}
  finally{fullscreenTransition=false;updateScreen();}
}
$('fullscreen-button').addEventListener('click',enterFullscreen);
$('rotate-fullscreen').addEventListener('click',enterFullscreen);
function updateScreen(){
  const layout=currentScreen(),rotate=playing&&layout.rotate;
  const changed=document.documentElement.dataset.rotateRequired!==String(rotate);
  document.documentElement.dataset.rotateRequired=String(rotate);
  document.documentElement.dataset.phone=String(layout.phone);
  $('rotate-notice').hidden=!rotate;
  $('game-shell').inert=rotate;
  if(changed&&playing){
    clearInputs();
    // A modal occupies the browser's top layer; remember it while rotating.
    if(rotate){suspendedDialog=dialogs.find(d=>d.open)?.id;dialogs.filter(d=>d.open).forEach(d=>d.close());$('rotate-notice').focus({preventScroll:true});}
    else if(suspendedDialog){openDialog(suspendedDialog);suspendedDialog=null;}
    else $('world').focus({preventScroll:true});
    audio.setPaused(isPaused());
  }
  if(world&&ready){world.resize();world.needsRender=true;}
}
let suspendedDialog=null;
window.addEventListener('resize',updateScreen);
screen.orientation?.addEventListener('change',updateScreen);
document.addEventListener('fullscreenchange',updateScreen);
function updateZoomUI(){
  if(!world)return;const follow=world.cameraMode==='third-person';
  $('zoom-in').disabled=!world.overview&&(follow?world.follow.distance<=FOLLOW_MIN:world.zoomView<=14);
  $('zoom-out').disabled=!world.overview&&(follow?world.follow.distance>=FOLLOW_MAX:world.zoomView>=108);
  $('zoom-overview').setAttribute('aria-pressed',String(world.overview));$('zoom-overview').setAttribute('aria-label',world.overview?'Follow Dudu':'See whole forest');
  $('camera-mode').setAttribute('aria-pressed',String(follow&&!world.overview));$('camera-mode').setAttribute('aria-label',follow?'Switch to overhead view':'Switch to third-person view');
  const label=world.overview?'Whole forest':follow?'Third person':'Overhead view';
  if($('camera-mode').dataset.view!==label){$('camera-mode').innerHTML=`${icons.camera}<span>${label}</span>`;$('camera-mode').dataset.view=label;}
  $('camera-recenter').disabled=world.cinematic;
}
function zoom(factor){if(!world||world.cinematic)return;world.zoomBy(factor);updateZoomUI();}
function overview(){if(!world||world.cinematic)return;world.toggleOverview();updateZoomUI();}
$('zoom-in').addEventListener('click',()=>zoom(1/1.25));$('zoom-out').addEventListener('click',()=>zoom(1.25));$('zoom-overview').addEventListener('click',overview);
function changeCamera(){if(!world||world.cinematic)return;world.toggleCamera();updateZoomUI();}
function recenter(){if(!world||world.cinematic)return;world.recenterCamera();updateZoomUI();}
$('camera-mode').addEventListener('click',changeCamera);$('camera-recenter').addEventListener('click',recenter);
function inspectGift(gift){
  inspectedGift=gift.id;const found=state.collected.includes(gift.id);$('bag-hint').textContent=found?gift.note:gift.hint;
  $('track-gift').classList.toggle('hidden',found);$('track-gift').textContent=`Follow ${gift.short.toLowerCase()}’s trail ↗`;
}
document.querySelectorAll('.bag-slot').forEach(slot=>slot.addEventListener('click',()=>inspectGift(GIFTS.find(g=>g.id===slot.dataset.gift))));
$('track-gift').addEventListener('click',()=>{guidedId=inspectedGift;guideOrigin=null;closeDialog($('bag-dialog'));updateGuidance(0);toast(`Follow the glowing trail to ${guideTarget.short.toLowerCase()}. Tap its pointer to walk there.`,5000);});
$('hint-button').addEventListener('click',()=>{
  if(state.completed){$('bag-hint').textContent='One more little adventure: follow the moon pointer to the tall Moonwatch tree, then climb to the nest together. ♡';return;}
  const next=GIFTS.filter(g=>!state.collected.includes(g.id)).sort((a,b)=>Math.hypot(state.position.x-a.x,state.position.z-a.z)-Math.hypot(state.position.x-b.x,state.position.z-b.z))[0];
  if(next)inspectGift(next);else{$('bag-hint').textContent='All eight gifts are ready! Follow the northern road to Bubu’s nest.';hide('track-gift');}
});

function updateGuidance(dt){
  const visible=playing&&!world.cinematic&&!isPaused();
  ['guide-button','gift-pointer'].forEach(id=>$(id).classList.toggle('hidden',!visible));world.guidance.visible=visible;
  if(!visible)return;
  const next=guidanceTarget(state,guidedId);guideTime-=dt;
  const changed=next.id!==guideTarget?.id||next.x!==guideTarget?.x||next.z!==guideTarget?.z;guideTarget=next;guidedId=next.id;
  if(changed||!guideOrigin||(guideTime<=0&&Math.hypot(state.position.x-guideOrigin.x,state.position.z-guideOrigin.z)>1.5)){
    guidePath=findPath(state.position,guideTarget,world.obstacles);world.showGuidance(guidePath);guideTime=.6;guideOrigin={...state.position};
    $('guide-name').textContent=guideTarget.short;$('guide-art').innerHTML=giftArt[guideTarget.id]||(guideTarget.id==='moon-nest'?icons.moon:icons.heart);
    document.querySelectorAll('.bag-slot').forEach(slot=>slot.classList.toggle('tracked',slot.dataset.gift===guidedId));
  }
  const distance=Math.hypot(state.position.x-next.x,state.position.z-next.z),near=distance<(next.id==='bubu'?3.2:next.id==='moon-nest'?2.6:2.5);
  const action=next.id==='moon-nest'?'Climb together':next.id==='bubu'?'Celebrate':'Collect';
  $('guide-detail').textContent=near?`${action} ♡`:`${Math.ceil(distance)} m · Tap to follow`;
  $('guide-button').setAttribute('aria-label',`${near?action:'Follow the trail to'} ${next.short}`);
  $('gift-pointer').setAttribute('aria-label',`${near?action:'Walk to'} ${next.short}`);
  const p=world.projectLocation(next.x,2.7,next.z),{x,y}=p;
  const compact=currentScreen().compact;
  const px=Math.max(95,Math.min(world.width-95,x)),py=Math.max(compact?125:150,Math.min(world.height-(compact?120:world.mobile?220:130),y));
  const offscreen=!p.front||Math.abs(px-x)>1||Math.abs(py-y)>1,arrow=$('gift-pointer').querySelector('.pointer-arrow');
  $('gift-pointer').classList.toggle('offscreen',offscreen);$('gift-pointer').style.left=`${px}px`;$('gift-pointer').style.top=`${py}px`;
  $('pointer-name').textContent=offscreen?`${next.short} · ${Math.ceil(distance)} m`:next.short;
  arrow.style.transform=offscreen?`rotate(${Math.atan2(y-py,x-px)*180/Math.PI-90}deg)`:'';
  const d=world.screenPosition(world.dudu,2.7);$('guide-arrow').style.transform=`rotate(${Math.atan2(y-d.y,x-d.x)*180/Math.PI+90}deg)`;
}
function followGuidance(){
  if(!guideTarget||world.cinematic||isPaused())return;
  const distance=Math.hypot(state.position.x-guideTarget.x,state.position.z-guideTarget.z);
  if(distance<(guideTarget.id==='bubu'?3.2:guideTarget.id==='moon-nest'?2.6:2.5)){interact();return;}
  route=findPath(state.position,guideTarget,world.obstacles);world.mark(guideTarget);$('world').focus({preventScroll:true});
}
$('guide-button').addEventListener('click',followGuidance);$('gift-pointer').addEventListener('click',followGuidance);

function toast(message,duration=4500){clearTimeout(toastTimer);$('toast').textContent=message;show('toast');toastTimer=setTimeout(()=>hide('toast'),duration);}
function speak(message,bear='dudu'){clearTimeout(speechTimer);speechBear=bear;$('speech').textContent=message;show('speech');speechTimer=setTimeout(()=>hide('speech'),3800);}

function updateUI(){
  const count=state.collected.length;
  $('progress-fill').style.width=`${count/GIFTS.length*100}%`;$('progress-text').textContent=`${count} of ${GIFTS.length} gifts collected`;$('collected-count').textContent=count;
  $('play-bag').setAttribute('aria-label',`Open gift bag, ${count} of ${GIFTS.length} gifts`);
  document.querySelectorAll('.bag-slot').forEach(slot=>{const found=state.collected.includes(slot.dataset.gift);slot.classList.toggle('found',found);slot.setAttribute('aria-label',`${GIFTS.find(g=>g.id===slot.dataset.gift).short}: ${found?'collected':'not found'}`);});
  if(inspectedGift)inspectGift(GIFTS.find(g=>g.id===inspectedGift));
  if(state.completed){$('quest-description').textContent='Happy birthday, Bubu. You are so loved.';$('progress-text').textContent='A birthday to remember ♡';}
  else if(count===GIFTS.length){$('quest-description').textContent='All the gifts are ready. Follow the road to Bubu’s nest!';}
  else{$('quest-description').textContent='Eight little surprises, from Dudu’s nest to Bubu’s door.';}
  drawMap($('mini-map'));
}

async function start(){
  if(!world||!ready||playing||isPaused())return;
  playing=true;world.playing=true;$('app').classList.add('playing');
  ['intro','intro-weather','world-caption','dudu-label','intro-footer'].forEach(hide);
  ['play-tools','zoom-tools','touch-controls'].forEach(show);
  if(!matchMedia('(pointer: coarse)').matches)$('touch-controls').classList.add('hidden');
  $('world').focus({preventScroll:true});
  enterFullscreen();updateScreen();world.beginDeparture();updateZoomUI();
  let soundPreference=null;try{soundPreference=localStorage.getItem('dudu-sound');}catch{}
  if(soundPreference!=='off'){await audio.start();audio.setPaused(isPaused());updateSoundButton();audio.chirp();}
  if(state.departed)toast(state.completed?'Welcome back. There’s always time for another little wander. ♡':'Your little adventure continues. B opens the bag; M opens the map.',5000);
  else speak('“A birthday adventure starts at home.” ♡');
  if(world.characterLoadError)toast(world.characterLoadError,7000);
  else if(world.wildlifeLoadError)toast(world.wildlifeLoadError,7000);
}
$('start-button').addEventListener('click',start);

function checkNearby(){
  if(!playing||isPaused())return;
  if(world.story==='moon'){
    const watching=world.moonJourney.phase==='stargazing';
    $('interact-button').classList.toggle('hidden',!watching);$('interact-label').textContent='Climb down together';return;
  }
  if(world.cinematic)return;
  nearby=GIFTS.find(g=>!state.collected.includes(g.id)&&Math.hypot(state.position.x-g.x,state.position.z-g.z)<2.5);
  if(state.completed&&Math.hypot(state.position.x-MOON_NEST.entry.x,state.position.z-MOON_NEST.entry.z)<2.6)nearby={id:'moon-nest'};
  if(!nearby&&state.bubuArrived&&Math.hypot(state.position.x-world.bubu.position.x,state.position.z-world.bubu.position.z)<3.2)nearby={id:'bubu'};
  if(nearby){$('interact-label').textContent=nearby.id==='moon-nest'?'Climb to the moon nest together':nearby.id==='bubu'?(state.completed?'Share a little moment':'Celebrate Bubu’s birthday'):`Pick up ${nearby.short.toLowerCase()}`;show('interact-button');}
  else hide('interact-button');
}
function interact(){
  if(!playing||isPaused())return;
  if(world.story==='moon'){if(world.moonJourney.descend()){hide('interact-button');keys.clear();}return;}
  if(world.cinematic)return;
  checkNearby();if(!nearby){toast('Wander close to a wrapped gift or Bubu, then say hello.',3000);return;}
  if(nearby.id==='moon-nest'){
    if(world.startMoonVisit()){route=[];keys.clear();resetJoystick();hide('speech');hide('toast');hide('interact-button');}
    else toast('Let’s take a step closer to the ladder together.');
    return;
  }
  if(nearby.id==='bubu'){
    if(state.completed){route=[];keys.clear();resetJoystick();world.shareMoment();audio.chirp(true);speak(['“Can we stay here a little longer?” ♡','“You’re my favorite adventure, Dudu.”','“Best. Birthday. Ever.”'][Math.floor(Math.random()*3)],'bubu');return;}
    if(canCelebrate(state)){
      route=[];keys.clear();joystick={x:0,y:0};$('joystick-knob').style.transform='';world.celebrate();
      hide('interact-button');hide('speech');
    }else{audio.chirp(true);speak('“I’ll set the picnic. You find the surprises!” ♡','bubu');toast(`${GIFTS.length-state.collected.length} little surprises left. Check your bag for a clue.`,5000);}
    return;
  }
  const gift=nearby;
  if(!collectGift(state,gift.id))return;
  world.collect(gift.id);audio.collect();updateUI();hide('interact-button');
  toast(`${gift.short} tucked into the bag · ${state.collected.length} / ${GIFTS.length} ♡`,4000);
  if(state.collected.length===GIFTS.length)speak('“Everything’s ready. Bubu, here I come!”');
}
$('interact-button').addEventListener('click',interact);$('touch-interact').addEventListener('click',interact);
$('stay-button').addEventListener('click',()=>{closeDialog($('ending-dialog'));toast('Follow the moon pointer to the big Moonwatch tree. There’s a nest under the stars for two. ♡',6500);});
function restart(){
  hide('moon-caption');$('app').classList.remove('moon-visit');['intro-time','play-time','pause-time'].forEach(id=>$(id).disabled=false);
  dialogs.filter(d=>d.open).forEach(closeDialog);audio.party=false;state=freshState();world.state=state;world.dudu.rotation.y=0;world.bubu.rotation.y=.35;
  world.gifts.forEach(g=>{g.group.visible=true;g.ring.visible=true;g.sparkle.visible=true;});
  world.picnicCake.visible=false;world.confetti.forEach(h=>{world.scene.remove(h);h.material.dispose();});world.confetti=[];
  world.addBackpackGifts();route=[];nearby=null;guidedId=null;guideTarget=null;guideOrigin=null;inspectedGift=null;hide('track-gift');hide('party-caption');hide('speech');hide('interact-button');hide('toast');updateUI();world.resetStory();updateZoomUI();world.setCamera(true);
}
$('restart-button').addEventListener('click',restart);$('play-again-button').addEventListener('click',restart);
$('reload-button').addEventListener('click',()=>location.reload());

window.addEventListener('keydown',event=>{
  const k=event.key.toLowerCase();
  if(isPaused())return;
  if(!playing)return;
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','w','a','s','d','j','l','i','k'].includes(k)){event.preventDefault();keys.add(k);route=[];}
  if(k==='shift')keys.add(k);
  if(event.repeat)return;
  if(k==='e'||k===' '){event.preventDefault();interact();}
  if(k==='m'){event.preventDefault();openMap();}
  if(k==='b'){event.preventDefault();openDialog('bag-dialog');}
  if(k==='+'||k==='='){event.preventDefault();zoom(1/1.25);}
  if(k==='-'||k==='_'){event.preventDefault();zoom(1.25);}
  if(k==='0'){event.preventDefault();overview();}
  if(k==='v'){event.preventDefault();toggleWeather();}
  if(k==='t'){event.preventDefault();toggleTime();}
  if(k==='c'){event.preventDefault();changeCamera();}
  if(k==='r'){event.preventDefault();recenter();}
  if(k==='escape'||k==='p'){event.preventDefault();openDialog('pause-dialog');}
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>{clearInputs();if(playing&&!isPaused()&&!fullscreenTransition)openDialog('pause-dialog');});
document.addEventListener('visibilitychange',()=>{audio.setPaused(isPaused());if(document.hidden)clearInputs();});


function walkTo(clientX,clientY){
  if(!playing||isPaused()||world.cinematic)return;
  const point=world.groundPoint(clientX,clientY);if(!point)return;
  const path=findPath(state.position,point,world.obstacles);
  if(path.length){route=path;world.mark(point);$('world').focus({preventScroll:true});}
}
const forestTouches=new Map();let pinchDistance=0,pinched=false,mouseLook=null;
$('world').addEventListener('contextmenu',event=>event.preventDefault());
$('world').addEventListener('pointerdown',event=>{
  if(!playing||isPaused()||world.cinematic)return;
  if(event.pointerType!=='touch'){
    if(event.button!==0&&event.button!==2)return;
    mouseLook={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,button:event.button,dragged:false};$('world').setPointerCapture(event.pointerId);return;
  }
  $('world').setPointerCapture(event.pointerId);forestTouches.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY});
  if(forestTouches.size===2){const[a,b]=[...forestTouches.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);pinched=true;route=[];}
});
$('world').addEventListener('pointermove',event=>{
  if(mouseLook?.id===event.pointerId){
    const dx=event.clientX-mouseLook.x,dy=event.clientY-mouseLook.y;
    if(Math.hypot(event.clientX-mouseLook.startX,event.clientY-mouseLook.startY)>6)mouseLook.dragged=true;
    if(mouseLook.dragged&&!isPaused()){world.orbitCamera(dx,dy);route=[];}
    mouseLook.x=event.clientX;mouseLook.y=event.clientY;return;
  }
  const point=forestTouches.get(event.pointerId);if(!point||isPaused())return;const dx=event.clientX-point.x,dy=event.clientY-point.y;point.x=event.clientX;point.y=event.clientY;
  if(forestTouches.size===2){const[a,b]=[...forestTouches.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0&&distance>0)zoom(pinchDistance/distance);pinchDistance=distance;}
  else if(!pinched&&Math.hypot(point.x-point.startX,point.y-point.startY)>8&&!isPaused()){point.dragged=true;world.orbitCamera(dx,dy);route=[];}
});
function endForestTouch(event){
  if(mouseLook?.id===event.pointerId){if(event.type==='pointerup'&&!mouseLook.dragged&&mouseLook.button===0)walkTo(event.clientX,event.clientY);mouseLook=null;return;}
  const point=forestTouches.get(event.pointerId);if(point&&!point.dragged&&!pinched&&event.type==='pointerup'&&Math.hypot(point.x-point.startX,point.y-point.startY)<10)walkTo(event.clientX,event.clientY);forestTouches.delete(event.pointerId);if(!forestTouches.size){pinched=false;pinchDistance=0;}
}
['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('world').addEventListener(type,endForestTouch));
$('world').addEventListener('wheel',event=>{if(playing&&!isPaused()){event.preventDefault();zoom(Math.exp(Math.max(-150,Math.min(150,event.deltaY))*.0025));}},{passive:false});
function moveJoystick(event){
  const rect=$('joystick').getBoundingClientRect();let x=event.clientX-(rect.left+rect.width/2),y=event.clientY-(rect.top+rect.height/2);
  const distance=Math.hypot(x,y),max=rect.width*.32;if(distance>max){x=x/distance*max;y=y/distance*max;}
  joystick={x:x/max,y:y/max};$('joystick-knob').style.transform=`translate(${x}px,${y}px)`;route=[];
}
$('joystick').addEventListener('pointerdown',event=>{if(isPaused()||joystickPointer!==null||world.cinematic)return;joystickPointer=event.pointerId;$('joystick').setPointerCapture(event.pointerId);moveJoystick(event);});
$('joystick').addEventListener('pointermove',event=>{if(event.pointerId===joystickPointer)moveJoystick(event);});
function resetJoystick(){joystickPointer=null;joystick={x:0,y:0};$('joystick-knob').style.transform='';}
['pointerup','pointercancel','lostpointercapture'].forEach(name=>$('joystick').addEventListener(name,event=>{if(event.pointerId===joystickPointer)resetJoystick();}));
function clearInputs(){
  keys.clear();route=[];resetJoystick();forestTouches.clear();pinched=false;pinchDistance=0;mouseLook=null;
}
updateScreen();

function drawMap(canvas,large=false){
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  const scale=Math.min(w,h)/88,cx=w/2,cy=h/2;
  const point=(x,z)=>[cx+x*scale,cy+z*scale];
  ctx.fillStyle='#e7ead3';ctx.beginPath();ctx.ellipse(cx,cy,40*scale,40*scale,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#cbd8b3';
  [[-17,-10,5],[12,-13,6],[17,7,4],[-13,13,5],[-25,19,7],[23,-19,9],[-24,-17,8],[7,25,7]].forEach(([x,z,r])=>{ctx.beginPath();ctx.arc(...point(x,z),r*scale,0,Math.PI*2);ctx.fill();});
  ctx.strokeStyle='#f7f0d9';ctx.lineCap='round';ctx.lineJoin='round';
  for(const trail of TRAILS){ctx.lineWidth=trail.width*scale;ctx.beginPath();trail.points.forEach(([x,z],i)=>i?ctx.lineTo(...point(x,z)):ctx.moveTo(...point(x,z)));ctx.stroke();}
  for(const pond of PONDS){
    ctx.fillStyle='#a5c8b6';ctx.beginPath();ctx.ellipse(...point(pond.x,pond.z),pond.rx*scale,pond.rz*scale,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#c9ad83';ctx.lineWidth=1.3*scale;ctx.beginPath();ctx.moveTo(...point(pond.x-5.5,pond.z));ctx.lineTo(...point(pond.x+5.5,pond.z));ctx.stroke();
  }
  [[DUDU_NEST,'Dudu’s nest','#b79870'],[BUBU_NEST,'Bubu’s nest','#d2a1a1']].forEach(([nest,label,color])=>{
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(...point(nest.x,nest.z),2.2*scale,0,Math.PI*2);ctx.fill();
    if(large){ctx.fillStyle='#66785b';ctx.textAlign='center';ctx.font=`500 ${Math.round(scale*1.5)}px "DM Sans",sans-serif`;const[x,y]=point(nest.x,nest.z);ctx.fillText(label,x,y+4.8*scale);}
  });
  {const [x,y]=point(MOON_NEST.entry.x,MOON_NEST.entry.z);ctx.fillStyle='#667591';ctx.beginPath();ctx.arc(x,y,1.35*scale,0,Math.PI*2);ctx.fill();if(large){ctx.fillStyle='#fff3d0';ctx.textAlign='center';ctx.font=`${Math.round(scale*2)}px Georgia`;ctx.fillText('☾',x,y+.65*scale);ctx.fillStyle='#60718b';ctx.font=`500 ${Math.round(scale*1.3)}px "DM Sans",sans-serif`;ctx.fillText('Moonwatch nest',x,y-2.5*scale);}}
  [[-17,3],[-7,-17],[17,-5],[14,13],[-5,17],[-15,-12],[27,-11],[-29,11],[-11,31],[14,-31]].forEach(([x,z])=>{ctx.fillStyle='#94ad7a';ctx.beginPath();ctx.moveTo(...point(x,z-1.6));ctx.lineTo(...point(x-1.1,z+1));ctx.lineTo(...point(x+1.1,z+1));ctx.closePath();ctx.fill();});
  GIFTS.forEach(g=>{
    const[x,y]=point(g.x,g.z),found=state.collected.includes(g.id);ctx.fillStyle=found?'#9cab80':'#ca8d68';
    ctx.beginPath();ctx.arc(x,y,(large?1:1.3)*scale,0,Math.PI*2);ctx.fill();
    if(large&&g.id===guidedId&&!found){ctx.strokeStyle='#956d46';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,1.65*scale,0,Math.PI*2);ctx.stroke();}
    if(large){ctx.fillStyle='#faf6e8';ctx.font=`${Math.round(scale*1.4)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(found?'✓':'♡',x,y);ctx.fillStyle=found?'#8b947e':'#738368';ctx.font=`500 ${Math.round(scale*1.25)}px "DM Sans",sans-serif`;ctx.fillText(g.short,x,y+2.6*scale);}
  });
  if(large){ctx.fillStyle='#6d7d63';ctx.font=`500 ${Math.round(scale*2)}px Georgia,serif`;ctx.textAlign='center';ctx.fillText('N',w-28,28);ctx.strokeStyle='#849474';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w-28,38);ctx.lineTo(w-28,61);ctx.moveTo(w-32,45);ctx.lineTo(w-28,38);ctx.lineTo(w-24,45);ctx.stroke();}
  const[px,py]=point(state.position.x,state.position.z);ctx.fillStyle='#fff8e5';ctx.beginPath();ctx.arc(px,py,(large?1.5:2)*scale,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8b6344';ctx.beginPath();ctx.arc(px,py,(large?1:1.3)*scale,0,Math.PI*2);ctx.fill();
}

function animate(time){
  const dt=Math.min((time-lastTime)/1000,.25);lastTime=time;let moving=false,running=false;
  const paused=isPaused();
  if(playing&&!paused&&!world.cinematic){
    world.orbitCamera((Number(keys.has('l'))-Number(keys.has('j')))*dt*170,(Number(keys.has('k'))-Number(keys.has('i')))*dt*100);
    let sx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+joystick.x;
    let sy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))+joystick.y;
    let dx=0,dz=0;
    if(Math.hypot(sx,sy)>.12){
      const length=Math.max(1,Math.hypot(sx,sy));sx/=length;sy/=length;
      // Movement always follows the current camera, including after orbiting.
      const a=world.movementYaw;dx=sx*Math.cos(a)+sy*Math.sin(a);dz=-sx*Math.sin(a)+sy*Math.cos(a);route=[];
    }else if(route.length){
      const next=route[0],distance=Math.hypot(next.x-state.position.x,next.z-state.position.z);
      if(distance<.2){route.shift();}else{dx=(next.x-state.position.x)/distance;dz=(next.z-state.position.z)/distance;}
    }
    running=keys.has('shift');const speed=running?8:4.6;
    if(dx||dz){
      const oldX=state.position.x,oldZ=state.position.z;
      const travel=route.length?Math.min(speed*dt,Math.hypot(route[0].x-state.position.x,route[0].z-state.position.z)):speed*dt;
      moveWithCollisions(state.position,dx*travel,dz*travel,world.obstacles);
      moving=Math.hypot(state.position.x-oldX,state.position.z-oldZ)>.001;
      if(!moving&&route.length)route=[];
      turnBear(world.dudu,Math.atan2(dx,dz),dt);
      stepTime+=dt;if(moving&&stepTime>(running?.23:.34)){audio.footstep(running);stepTime=0;}
    }
    checkNearby();
    if(shouldRevealBubu(state)){route=[];keys.clear();hide('interact-button');world.revealBubu();}
  }
  if(!paused||!wasPaused||world.needsRender){world.update(paused?0:dt,moving,running,paused);world.needsRender=false;}
  wasPaused=paused;
  for(const event of world.events.splice(0)){
    if(event==='departed'){audio.chirp();toast('Follow the gift pointer. Tap it to walk there · B to choose a different gift',6500);}
    if(event==='arrival-start'){hide('interact-button');speak('“Bubu…? It’s me!”');audio.chirp();}
    if(event==='arrived'){audio.chirp(true);speak('“All these surprises… for me?” ♡','bubu');}
    if(event==='party-start'){hide('toast');show('party-caption');$('party-line').textContent='Happy birthday, Bubu ♡';audio.celebrate();}
    if(event==='party-wish'){$('party-line').textContent='A wish, a smile, and a little magic.';audio.collect();}
    if(event==='party-finished'){audio.party=false;hide('party-caption');keys.clear();joystick={x:0,y:0};route=[];updateUI();openDialog('ending-dialog');}
    if(event==='moon-approaching'){
      $('app').classList.add('moon-visit');show('moon-caption');$('moon-line').textContent='One more little adventure, together.';$('moon-detail').textContent='Dudu and Bubu are heading to the ladder.';
      ['intro-time','play-time','pause-time'].forEach(id=>$(id).disabled=true);
    }
    if(event==='moon-climbing'){
      timeOfDay='night';audio.setNight(true);updateTimeControls();
      $('moon-line').textContent='Up we go, as the daylight fades.';$('moon-detail').textContent='The forest is lighting its little lanterns.';
    }
    if(event==='moon-arrived'){
      $('moon-line').textContent='A little closer to the stars. ♡';$('moon-detail').textContent='Stay a while. Watch the clouds drift and make a wish on a shooting star.';audio.chirp(true);
    }
    if(event==='moon-descending'){$('moon-line').textContent='Back to our moonlit little forest.';$('moon-detail').textContent='Climbing down together…';}
    if(event==='moon-finished'){
      hide('moon-caption');$('app').classList.remove('moon-visit');['intro-time','play-time','pause-time'].forEach(id=>$(id).disabled=false);keys.clear();resetJoystick();route=[];guideOrigin=null;toast('There’s still a whole moonlit forest to wander, together. ♡');
    }
  }
  if(world.story==='moon')checkNearby();
  if(!playing){const p=world.screenPosition(world.duduNest.group,4.5);$('dudu-label').style.left=`${p.x-155}px`;$('dudu-label').style.top=`${p.y-25}px`;}
  if(!$('speech').classList.contains('hidden')){const p=world.screenPosition(world[speechBear],2.3);$('speech').style.left=`${Math.max(110,Math.min(world.width-110,p.x))}px`;$('speech').style.top=`${Math.max(95,p.y)}px`;}
  updateZoomUI();
  updateGuidance(dt);
  mapTime+=dt;if(mapTime>.3){if(!playing)drawMap($('mini-map'));if($('map-dialog').open)drawMap($('large-map'),true);mapTime=0;}
  requestAnimationFrame(animate);
}

export async function initialize(progress){
  await progress(12,'Unfolding a new birthday adventure…');
  world=new ForestWorld($('world'),state);
  await world.initialize(progress);
  world.setTimeOfDay(timeOfDay,true);audio.setNight(timeOfDay==='night');
  world.setWeather(weatherMode,true);audio.setRain(weatherMode==='rain');
  // Saves from an older forest layout must not trap a returning player.
  if(!isWalkable(state.position.x,state.position.z,world.obstacles))state.position={...START};
  world.addBackpackGifts();updateUI();updateSoundButton();
  await world.warmUp(progress);
  ready=true;$('start-button').disabled=false;lastTime=performance.now();requestAnimationFrame(animate);
  // Read-only state for browser diagnostics, with ordinary input driving tests.
  if(import.meta.env.DEV)window.__dudu={snapshot:()=>JSON.parse(JSON.stringify({state,ready,playing,paused:isPaused(),camera:{mode:world.cameraMode,perspective:!!world.camera.isPerspectiveCamera,position:world.camera.position,target:world.story==='moon'?world.moonLook:world.thirdPerson?world.follow.target:world.cameraTarget,yaw:world.movementYaw,pitch:world.follow.pitch,fov:world.camera.fov,distance:world.follow.distance,arm:world.follow.arm,avoidYaw:world.follow.avoidYaw,avoidPitch:world.follow.avoidPitch},nearby:nearby?.id,position:state.position,obstacles:world.obstacles,sound:audio.enabled,route:route.length,render:world.renderer.info.render,quality:world.quality,time:world.time,view:world.viewSize,zoom:world.cameraMode==='third-person'?world.follow.distance:world.zoomView,overview:world.overview,story:world.story,bubuVisible:world.bubu.visible,bubuPosition:world.bubu.position,duduPosition:world.dudu.position,animals:world.animals.map(a=>({kind:a.kind,x:a.group.position.x,z:a.group.position.z,action:a.brain.mode,model:a.blenderSheep?'blender':'procedural',clip:a.blenderSheep?.clip,blink:a.blenderSheep?.blink,distance:a.brain.distance})),balloons:world.balloons.length,worldRadius:WORLD_RADIUS,timeOfDay:world.timeOfDay,nightBlend:world.nightBlend,trees:world.treeKinds,treeSizes:world.treeSizes,bearScale:world.dudu.scale.x,characterModel:world.dudu.userData.blenderDudu?{source:'blender',weights:world.dudu.userData.blenderDudu.weights,bones:world.dudu.userData.blenderDudu.asset.bones.size}:null,moonJourney:world.moonJourney?{phase:world.moonJourney.phase,progress:world.moonJourney.progress}:null,flowerBeds:world.flowerBeds,butterflies:world.butterflies.map(b=>b.kind),lamps:{count:world.roadLighting.sites.length,sites:world.roadLighting.sites,glowing:world.roadLighting.glass.emissiveIntensity,lights:world.roadLighting.lights.map(l=>l.intensity)},guidance:guideTarget?{id:guideTarget.id,path:guidePath}:null,following:!!world.companion,expressions:[world.dudu,world.bubu].map(b=>({name:b.name,mood:b.userData.expression.mood,reaction:b.userData.expression.reaction,remaining:b.userData.expression.remaining,values:b.userData.expression.values,stride:b.userData.strideWeight,run:b.userData.runWeight})),partyTime:world.storyTime,candleLit:world.candleFlame.visible,weather:{mode:world.weather.mode,blend:world.weather.blend,time:world.weather.time,rain:world.rain.streaks.visible?world.rain.drops.length:0,puddles:world.rain.puddles.visible?world.rain.sites.length:0,ripples:world.rain.ripples.visible?world.rain.rippleSites.length:0,audioRain:!!audio.raining,snowVisible:world.atmosphere.snow.visible,snow:world.atmosphere.flakes.length,birds:world.atmosphere.birds.map(b=>({x:b.group.position.x,y:b.group.position.y,z:b.group.position.z})),windLeaves:world.atmosphere.leaves.count,sun:world.sky.sun.visible,moon:world.sky.moon.visible,clouds:world.sky.clouds.length,stars:world.sky.stars.geometry.attributes.position.count,shootingStar:world.sky.meteor.visible,nightTime:world.sky.nightTime,fireflies:world.atmosphere.fireflies.visible?world.atmosphere.fireflyData.length:0,petals:world.atmosphere.petals.count}})),project:(x,z,y=0)=>{const point=new THREE.Vector3(x,y,z).project(world.camera),rect=$('world').getBoundingClientRect();return{x:rect.left+(point.x*.5+.5)*rect.width,y:rect.top+(-point.y*.5+.5)*rect.height};}};
}
