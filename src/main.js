import * as THREE from 'three';
import { ForestWorld } from './world.js';
import { ForestAudio } from './audio.js';
import { ForestHaptics } from './haptics.js';
import { renderDestinations } from './destination-ui.js';
import { freshAdventure, discoverPlaces, befriend, FRIENDS } from './adventure.js';
import { AdventureJournal } from './adventure-ui.js';
import { PostcardCamera } from './postcard.js';
import { turnBear } from './bear-motion.js';
import { currentScreen } from './screen-support.js';
import { icons, giftArt } from './icons.js';
import { FOLLOW_MIN, FOLLOW_MAX } from './follow-camera.js';
import { GIFTS, BUBU, START, DUDU_NEST, BUBU_NEST, DESTINATION, MOON_NEST, WORLD_RADIUS, TRAILS, PONDS, SAVE_KEY, freshState, restoreState, collectGift, canCelebrate, shouldRevealBubu, isWalkable } from './game-state.js';

const $=id=>document.getElementById(id);
const show=id=>$(id).classList.remove('hidden'), hide=id=>$(id).classList.add('hidden');
const audio=new ForestAudio(),haptics=new ForestHaptics();
let state=freshState(),adventure=freshAdventure(),photo;
let discoveryQueue=[],discoveryRemaining=0,photoSession=0;
// Adventure progress belongs to this page visit. Refresh always starts at home.
try{localStorage.removeItem(SAVE_KEY);}catch{/* Storage is optional. */}
// Explicit browser-test fixtures are only accepted in a development build.
if(import.meta.env.DEV&&window.__DUDU_TEST_STATE__){state=restoreState(JSON.stringify(window.__DUDU_TEST_STATE__));delete window.__DUDU_TEST_STATE__;}
let weatherMode='clear';try{if(localStorage.getItem('dudu-weather')==='rain')weatherMode='rain';}catch{}
let timeOfDay='day';try{if(localStorage.getItem('dudu-time-of-day')==='night')timeOfDay='night';}catch{}
let travelling=false;
let world, ready=false, playing=false, nearby=null, route=[], toastTimer, speechTimer, speechBear='dudu', lastTime=0, stepTime=0, mapTime=0, wasPaused=false, fullscreenTransition=false;
let inspectedGift=null;
let joystick={x:0,y:0}, joystickPointer=null;
const keys=new Set();
const dialogs=[...document.querySelectorAll('dialog')];
const isPaused=()=>travelling||!!photo?.active||dialogs.some(d=>d.open)||document.hidden||document.documentElement.dataset.rotateRequired==='true';

function updateHapticButton(){
  const button=$('pause-haptics');button.hidden=!haptics.touch;button.disabled=!haptics.supported;
  button.textContent=haptics.supported?`Haptics ${haptics.enabled?'on':'off'}`:'Haptics unavailable';
  button.setAttribute('aria-pressed',String(haptics.supported&&haptics.enabled));
  button.title=haptics.supported?'Gentle vibration for taps and discoveries':'This browser does not offer vibration';
}
$('pause-haptics').addEventListener('click',()=>{haptics.setEnabled(!haptics.enabled);updateHapticButton();haptics.pulse('tap');});
// Semantic action handlers run first, so their richer pulse wins over a tap.
document.addEventListener('click',event=>{if(event.target.closest('button:not(:disabled)'))haptics.pulse('tap');});
updateHapticButton();
const journal=new AdventureJournal();
$('journey-icon').innerHTML=icons.book;
$('travel-icon').innerHTML=icons.map;
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
  if(playing&&!isPaused())toast(timeOfDay==='night'?'Moonlit paths, little lanterns, and wishes among the stars.':weatherMode==='rain'?'A soft, cloudy morning. ♡':'Hello, sunshine. A new day to wander. ♡',3800);
}
['intro-time','play-time','pause-time'].forEach(id=>$(id).addEventListener('click',toggleTime));updateTimeControls();
function updateWeatherControls(){
  const rainy=weatherMode==='rain',snowy=world?.travel?.current.id==='snowlands',label=snowy?(rainy?'Lighter snowfall':'More snowfall'):rainy?'Clear the sky':'Start gentle rain';
  $('app').classList.toggle('rainy',rainy);
  ['intro-weather','play-weather','pause-weather'].forEach(id=>{
    const button=$(id),caption=id==='intro-weather'?(rainy?'Gentle rain':'Clear skies'):label;
    button.innerHTML=(snowy?icons.snow:rainy?icons.rain:icons.cloudSun)+(id==='play-weather'?'':`<span>${caption}</span>`);
    button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(rainy));button.title=`${label} (V)`;
  });
}
function toggleWeather(){
  if(!world||!ready)return;
  weatherMode=weatherMode==='clear'?'rain':'clear';world.setWeather(weatherMode,isPaused());
  audio.setRain(weatherMode==='rain'&&world.travel.current.id!=='snowlands');updateWeatherControls();
  try{localStorage.setItem('dudu-weather',weatherMode);}catch{}
  if(playing&&!isPaused())toast(world.travel.current.id==='snowlands'?(weatherMode==='rain'?'A few more snowflakes, a little more magic. ♡':'Soft snow, quiet footsteps. ♡'):weatherMode==='rain'?'A little rain, a softer world. ♡':'The clouds are clearing. ♡');
}
['intro-weather','play-weather','pause-weather'].forEach(id=>$(id).addEventListener('click',toggleWeather));updateWeatherControls();


function openDialog(id){
  haptics.stop();clearInputs();
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
function openMap(){
  $('map-journal').hidden=!playing||world.away;
  $('map-title').textContent=world.travel.current.name;
  $('map-description').textContent=world.away?world.travel.current.detail:'Eight surprises, two little homes, and a Moonwatch nest above the trees.';
  $('large-map').setAttribute('aria-label',`${world.travel.current.name}: paths, Dudu and discoveries you have already made`);
  $('map-legend').innerHTML='<span><i class="map-dot"></i> Dudu</span><span><i class="map-dot gift-dot"></i> Already discovered</span>';
  drawMap($('large-map'),true);openDialog('map-dialog');
}
function openTravel(){
  if(!ready||travelling)return;
  renderDestinations(world.travel,playing&&state.departed&&!world.cinematic);openDialog('travel-dialog');
}
async function travelTo(id){
  if(travelling||!playing||world.cinematic||!state.departed||id===world.travel.current.id)return;
  closePhoto();clearInputs();dialogs.filter(d=>d.open).forEach(d=>d.close());
  travelling=true;haptics.stop();audio.setPaused(true);$('travel-loading').hidden=false;$('travel-loading-title').textContent='A new horizon…';
  hide('speech');hide('toast');hide('interact-button');hide('discovery-notice');discoveryQueue=[];discoveryRemaining=0;
  try{
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(!await world.travel.visit(id))return;
    nearby=null;
    $('current-destination').textContent=world.travel.current.name;
    $('journal-away').hidden=!world.away;
    audio.setDestination(world.travel.current.id);audio.setRain(weatherMode==='rain'&&world.travel.current.id!=='snowlands');updateWeatherControls();
    world.update(0,false,false,true);updateUI();
    toast(world.away?`${world.travel.current.name} · Three little memories to find.`:'Back to Sunnywood. Your birthday adventure is right where you left it.',5000);
  }catch(error){console.error('Destination could not load',error);toast('That journey could not load. Your adventure is safe here; please try again.',6500);}
  finally{travelling=false;$('travel-loading').hidden=true;audio.setPaused(isPaused());world.needsRender=true;lastTime=performance.now();$('world').focus({preventScroll:true});}
}
['travel-button','pause-travel','map-travel','journal-travel'].forEach(id=>$(id).addEventListener('click',openTravel));
$('travel-cards').addEventListener('click',event=>{const button=event.target.closest('[data-destination]');if(button&&!button.disabled)travelTo(button.dataset.destination);});
$('journal-return').addEventListener('click',()=>travelTo('forest'));
$('map-button').addEventListener('click',openMap);$('play-map').addEventListener('click',openMap);
$('play-bag').addEventListener('click',()=>openJournal('gifts'));$('play-pause').addEventListener('click',()=>openDialog('pause-dialog'));
$('journey-status').addEventListener('click',()=>openJournal());
$('pause-journal').addEventListener('click',()=>openJournal());
$('map-journal').addEventListener('click',()=>openJournal('places'));
$('pause-photo').addEventListener('click',openPhoto);$('journal-photo').addEventListener('click',openPhoto);
$('photo-exit').addEventListener('click',closePhoto);
$('photo-reset').addEventListener('click',()=>photo.reset());$('photo-portrait').addEventListener('click',()=>photo.portrait());
$('photo-save').addEventListener('click',savePostcard);
$('stop-walking').addEventListener('click',stopWalking);
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
  const layout=currentScreen(),rotate=playing&&layout.rotate;updateHapticButton();
  if(rotate)haptics.stop();
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
  if(world&&ready){world.resize();world.needsRender=true;photo?.resize();}
}
let suspendedDialog=null;
window.addEventListener('resize',updateScreen);
screen.orientation?.addEventListener('change',updateScreen);
document.addEventListener('fullscreenchange',updateScreen);
function updateZoomUI(){
  if(!world)return;const follow=world.cameraMode==='third-person';
  $('zoom-in').disabled=!world.overview&&(follow?world.follow.distance<=FOLLOW_MIN:world.zoomView<=14);
  $('zoom-out').disabled=!world.overview&&(follow?world.follow.distance>=FOLLOW_MAX:world.zoomView>=108);
  $('zoom-overview').setAttribute('aria-pressed',String(world.overview));$('zoom-overview').setAttribute('aria-label',world.overview?'Follow Dudu':'See whole area');
  $('camera-mode').setAttribute('aria-pressed',String(follow&&!world.overview));$('camera-mode').setAttribute('aria-label',follow?'Switch to overhead view':'Switch to third-person view');
  const label=world.overview?'Whole area':follow?'Third person':'Overhead view';
  if($('camera-mode').dataset.view!==label){$('camera-mode').innerHTML=`${icons.camera}<span>${label}</span>`;$('camera-mode').dataset.view=label;}
  $('camera-recenter').disabled=world.cinematic;
  ['pause-photo','journal-photo'].forEach(id=>{$(id).disabled=!photo?.available;$(id).title=photo?.available?'Make a postcard (X)':'Available after this little scene';});
  $('travel-button').disabled=world.cinematic||travelling;
}
function zoom(factor){if(!world||world.cinematic)return;world.zoomBy(factor);updateZoomUI();}
function overview(){if(!world||world.cinematic)return;world.toggleOverview();updateZoomUI();}
$('zoom-in').addEventListener('click',()=>zoom(1/1.25));$('zoom-out').addEventListener('click',()=>zoom(1.25));$('zoom-overview').addEventListener('click',overview);
function changeCamera(){if(!world||world.cinematic)return;world.toggleCamera();updateZoomUI();}
function recenter(){if(!world||world.cinematic)return;world.recenterCamera();updateZoomUI();}
$('camera-mode').addEventListener('click',changeCamera);$('camera-recenter').addEventListener('click',recenter);
function inspectGift(gift){
  inspectedGift=gift.id;const found=state.collected.includes(gift.id);$('bag-hint').textContent=found?gift.note:gift.hint;
}
document.querySelectorAll('.bag-slot').forEach(slot=>slot.addEventListener('click',()=>inspectGift(GIFTS.find(g=>g.id===slot.dataset.gift))));
$('hint-button').addEventListener('click',()=>{
  if(state.completed){$('bag-hint').textContent='Look for the ladder on the tall Moonwatch tree. There’s a nest for two up there. ♡';return;}
  const next=GIFTS.find(g=>g.id===inspectedGift&&!state.collected.includes(g.id))||GIFTS.find(g=>!state.collected.includes(g.id));
  if(next)inspectGift(next);else $('bag-hint').textContent='All eight gifts are ready! Look for Bubu’s little home among the trees.';
});

function updateExplorationHUD(){
  const visible=playing&&!world.cinematic&&!isPaused();
  $('journey-status').classList.toggle('hidden',!visible);
  $('travel-button').classList.toggle('hidden',!visible);
  $('walk-status').classList.toggle('hidden',!visible||!route.length);
}
function stopWalking(){route=[];keys.clear();resetJoystick();if(world)world.clickMarker.visible=false;}
function openJournal(tab){if(tab)journal.select(tab);journal.render(state,adventure);openDialog('bag-dialog');}
function updateDiscoveries(dt){
  const discoveries=world.away?[]:discoverPlaces(adventure,state,world.dudu.position);
  if(discoveries.length){discoveryQueue.push(...discoveries);journal.render(state,adventure);}
  discoveryRemaining=Math.max(0,discoveryRemaining-dt);
  if(discoveryRemaining===0&&discoveryQueue.length){
    const place=discoveryQueue.shift();$('discovery-name').textContent=place.name;$('discovery-icon').innerHTML=icons[place.icon]||icons.leaf;
    discoveryRemaining=4.5;audio.chirp();haptics.pulse('discovery');
  }
}
function openPhoto(){
  if(!playing||!photo?.available)return;
  haptics.stop();clearInputs();dialogs.filter(d=>d.open).forEach(d=>d.close());
  // Finish a stationary frame once, then the photo camera owns rendering.
  world.update(0,false,false,true);world.clickMarker.visible=false;
  if(!photo.open())return;
  $('photo-location').textContent=`POSTCARDS FROM ${world.travel.current.name.toUpperCase()}`;
  photoSession++;$('photo-save').disabled=false;$('photo-status').textContent='';
  $('app').classList.add('photo-mode');show('photo-ui');audio.setPaused(true);wasPaused=true;
  $('photo-exit').focus({preventScroll:true});
}
function closePhoto(){
  if(!photo?.active)return;photoSession++;photo.close();hide('photo-ui');$('app').classList.remove('photo-mode');
  world.needsRender=true;audio.setPaused(isPaused());$('world').focus({preventScroll:true});
}
async function savePostcard(){
  if(!photo?.active||$('photo-save').disabled)return;
  const session=photoSession;$('photo-save').disabled=true;$('photo-status').textContent='Making your postcard…';
  try{
    const blob=await photo.capture($('photo-message').value);
    if(session!==photoSession)return;
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`${world.travel.current.id}-postcard-${adventure.postcards+1}.png`;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);adventure.postcards++;journal.render(state,adventure);
    $('photo-status').textContent='Postcard ready. Check your downloads. ♡';
  }catch(error){if(session===photoSession)$('photo-status').textContent=error.message||'Please try making the postcard again.';}
  finally{if(session===photoSession)$('photo-save').disabled=false;}
}

function toast(message,duration=4500){clearTimeout(toastTimer);$('toast').textContent=message;show('toast');toastTimer=setTimeout(()=>hide('toast'),duration);}
function speak(message,bear='dudu'){clearTimeout(speechTimer);speechBear=bear;$('speech').textContent=message;show('speech');speechTimer=setTimeout(()=>hide('speech'),3800);}

function updateUI(){
  journal.render(state,adventure);
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
  if(world.away){
    const memory=world.travel.nearby();nearby=memory?{id:'destination-memory',memory}:state.completed&&Math.hypot(state.position.x-world.bubu.position.x,state.position.z-world.bubu.position.z)<3.2?{id:'bubu'}:null;
    $('interact-button').classList.toggle('hidden',!nearby);
    if(nearby)$('interact-label').textContent=memory?`Remember ${memory.name.toLowerCase()}`:'Share a little moment';
    $('touch-interact').setAttribute('aria-label',nearby?$('interact-label').textContent:'Explore a nearby landmark');return;
  }
  if(world.story==='moon'){
    const watching=world.moonJourney.phase==='stargazing';
    $('interact-button').classList.toggle('hidden',!watching);$('interact-label').textContent='Climb down together';return;
  }
  if(world.cinematic)return;
  nearby=GIFTS.find(g=>!state.collected.includes(g.id)&&Math.hypot(state.position.x-g.x,state.position.z-g.z)<2.5);
  if(state.completed&&Math.hypot(state.position.x-MOON_NEST.entry.x,state.position.z-MOON_NEST.entry.z)<2.6)nearby={id:'moon-nest'};
  if(!nearby&&state.bubuArrived&&Math.hypot(state.position.x-world.bubu.position.x,state.position.z-world.bubu.position.z)<3.2)nearby={id:'bubu'};
  if(!nearby){const animal=world.nearbyFriend();if(animal)nearby={id:'friend',animal};}
  if(nearby){$('interact-label').textContent=nearby.id==='friend'?`Say hello to the ${nearby.animal.kind}`:nearby.id==='moon-nest'?'Climb to the moon nest together':nearby.id==='bubu'?(state.completed?'Share a little moment':'Celebrate Bubu’s birthday'):`Pick up ${nearby.short.toLowerCase()}`;show('interact-button');}
  else hide('interact-button');
  $('touch-interact').setAttribute('aria-label',nearby?$('interact-label').textContent:'Interact with a nearby gift or friend');
}
function interact(){
  if(!playing||isPaused())return;
  if(world.story==='moon'){if(world.moonJourney.descend()){haptics.pulse('tap');hide('interact-button');keys.clear();}return;}
  if(world.cinematic)return;
  checkNearby();if(!nearby){toast('Wander close to a gift, a forest friend, or Bubu, then say hello.',3000);return;}
  if(nearby.id==='destination-memory'){
    stopWalking();const item=nearby.memory,first=world.travel.remember(item);
    world.dudu.userData.expression.react('delighted',2.5);world.reactions.emit(world.dudu.position,world.reducedMotion);
    if(first){haptics.pulse('discovery');audio.collect();discoveryQueue.push({name:item.name,icon:world.travel.current.icon});}
    speak(`“${item.memory}”`);toast(first?`A little memory from ${world.travel.current.name} tucked into the journal. ♡`:item.memory,5500);return;
  }
  if(nearby.id==='moon-nest'){
    if(world.startMoonVisit()){haptics.pulse('tap');route=[];keys.clear();resetJoystick();hide('speech');hide('toast');hide('interact-button');}
    else toast('Let’s take a step closer to the ladder together.');
    return;
  }
  if(nearby.id==='friend'){
    const animal=nearby.animal;stopWalking();
    if(world.greetAnimal(animal)){
      haptics.pulse('friend');
      const first=befriend(adventure,animal.kind);journal.render(state,adventure);audio.chirp();
      speak('“Hello, little friend.” ♡');
      toast(first?`${FRIENDS.find(f=>f.kind===animal.kind).name} · A new friend in your journal ♡`:'A familiar face, a little hello. ♡');
    }
    checkNearby();return;
  }
  if(nearby.id==='bubu'){
    if(state.completed){route=[];keys.clear();resetJoystick();world.shareMoment();haptics.pulse('friend');audio.chirp(true);speak(['“Can we stay here a little longer?” ♡','“You’re my favorite adventure, Dudu.”','“Best. Birthday. Ever.”'][Math.floor(Math.random()*3)],'bubu');return;}
    if(canCelebrate(state)){
      route=[];keys.clear();joystick={x:0,y:0};$('joystick-knob').style.transform='';world.celebrate();haptics.pulse('celebrate');
      hide('interact-button');hide('speech');
    }else{audio.chirp(true);speak('“I’ll set the picnic. You find the surprises!” ♡','bubu');toast(`${GIFTS.length-state.collected.length} little surprises left. Check your bag for a clue.`,5000);}
    return;
  }
  const gift=nearby;
  if(!collectGift(state,gift.id))return;
  stopWalking();world.collect(gift.id);haptics.pulse('gift');audio.collect();updateUI();hide('interact-button');
  toast(`${gift.short} tucked into the bag · ${state.collected.length} / ${GIFTS.length} ♡`,4000);
  if(state.collected.length===GIFTS.length)speak('“Everything’s ready. Bubu, here I come!”');
}
$('interact-button').addEventListener('click',interact);$('touch-interact').addEventListener('click',interact);
$('stay-button').addEventListener('click',()=>{closeDialog($('ending-dialog'));toast('Look for the ladder on the big Moonwatch tree. There’s a nest under the stars for two. ♡',6500);});
function restart(){
  haptics.stop();closePhoto();world.travel.reset();$('current-destination').textContent=world.travel.current.name;$('journal-away').hidden=true;audio.setDestination('forest');audio.setRain(weatherMode==='rain');updateWeatherControls();clearInputs();adventure=freshAdventure();discoveryQueue=[];discoveryRemaining=0;hide('discovery-notice');journal.select('gifts');$('photo-message').value='A little journey. A lot of love.';
  hide('moon-caption');$('app').classList.remove('moon-visit');['intro-time','play-time','pause-time'].forEach(id=>$(id).disabled=false);
  dialogs.filter(d=>d.open).forEach(closeDialog);audio.party=false;state=freshState();world.state=state;world.dudu.rotation.y=0;world.bubu.rotation.y=.35;
  world.gifts.forEach(g=>{g.group.visible=true;g.ring.visible=true;g.sparkle.visible=true;});
  world.picnicCake.visible=false;world.confetti.forEach(h=>{h.removeFromParent();h.material.dispose();});world.confetti=[];
  world.addBackpackGifts();route=[];nearby=null;inspectedGift=null;hide('party-caption');hide('speech');hide('interact-button');hide('toast');updateUI();world.resetStory();updateZoomUI();world.setCamera(true);
}
$('restart-button').addEventListener('click',restart);$('play-again-button').addEventListener('click',restart);
$('reload-button').addEventListener('click',()=>location.reload());

window.addEventListener('keydown',event=>{
  const k=event.key.toLowerCase();
  if(photo?.active){
    const typing=event.target.closest('input,textarea');
    if(k==='escape'||(k==='x'&&!typing)){event.preventDefault();closePhoto();return;}
    if(!typing){
      if(['arrowleft','arrowright','arrowup','arrowdown'].includes(k)){event.preventDefault();photo.orbit(k==='arrowleft'?.12:k==='arrowright'?-.12:0,k==='arrowup'?-.08:k==='arrowdown'?.08:0);}
      if(['+','=','-','_'].includes(k)){event.preventDefault();photo.zoom(k==='+'||k==='='?1/1.15:1.15);}
    }
    return;
  }
  if(isPaused())return;
  if(!playing)return;
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','w','a','s','d','j','l','i','k'].includes(k)){event.preventDefault();keys.add(k);route=[];}
  if(k==='shift')keys.add(k);
  if(event.repeat)return;
  if(k==='e'||k===' '){event.preventDefault();interact();}
  if(k==='m'){event.preventDefault();openMap();}
  if(k==='g'){event.preventDefault();openTravel();}
  if(k==='b'){event.preventDefault();openJournal('gifts');}
  if(k==='x'){event.preventDefault();openPhoto();}
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
window.addEventListener('blur',()=>{haptics.stop();clearInputs();if(playing&&!isPaused()&&!fullscreenTransition)openDialog('pause-dialog');});
document.addEventListener('visibilitychange',()=>{audio.setPaused(isPaused());if(document.hidden){haptics.stop();clearInputs();}});


function walkTo(clientX,clientY){
  if(!playing||isPaused()||world.cinematic)return;
  const point=world.groundPoint(clientX,clientY);if(!point)return;
  const path=world.findPath(state.position,point);
  if(path.length){haptics.pulse('tap');route=path;world.mark(point);$('world').focus({preventScroll:true});}
  else toast('That spot is behind the scenery. Try a nearby path.');
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
$('joystick').addEventListener('pointerdown',event=>{if(isPaused()||joystickPointer!==null||world.cinematic)return;joystickPointer=event.pointerId;haptics.pulse('tap');$('joystick').setPointerCapture(event.pointerId);moveJoystick(event);});
$('joystick').addEventListener('pointermove',event=>{if(event.pointerId===joystickPointer)moveJoystick(event);});
function resetJoystick(){joystickPointer=null;joystick={x:0,y:0};$('joystick-knob').style.transform='';}
['pointerup','pointercancel','lostpointercapture'].forEach(name=>$('joystick').addEventListener(name,event=>{if(event.pointerId===joystickPointer)resetJoystick();}));
function clearInputs(){
  keys.clear();route=[];resetJoystick();forestTouches.clear();pinched=false;pinchDistance=0;mouseLook=null;
}
updateScreen();

function drawMap(canvas,large=false){
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  if(world?.away){world.travel.drawMap(ctx,w,h);return;}
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
    if(nest===BUBU_NEST&&!state.bubuArrived)return;
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(...point(nest.x,nest.z),2.2*scale,0,Math.PI*2);ctx.fill();
    if(large){ctx.fillStyle='#66785b';ctx.textAlign='center';ctx.font=`500 ${Math.round(scale*1.5)}px "DM Sans",sans-serif`;const[x,y]=point(nest.x,nest.z);ctx.fillText(label,x,y+4.8*scale);}
  });
  if(adventure.places.includes('moonwatch')){const [x,y]=point(MOON_NEST.entry.x,MOON_NEST.entry.z);ctx.fillStyle='#667591';ctx.beginPath();ctx.arc(x,y,1.35*scale,0,Math.PI*2);ctx.fill();if(large){ctx.fillStyle='#fff3d0';ctx.textAlign='center';ctx.font=`${Math.round(scale*2)}px Georgia`;ctx.fillText('☾',x,y+.65*scale);ctx.fillStyle='#60718b';ctx.font=`500 ${Math.round(scale*1.3)}px "DM Sans",sans-serif`;ctx.fillText('Moonwatch nest',x,y-2.5*scale);}}
  [[-17,3],[-7,-17],[17,-5],[14,13],[-5,17],[-15,-12],[27,-11],[-29,11],[-11,31],[14,-31]].forEach(([x,z])=>{ctx.fillStyle='#94ad7a';ctx.beginPath();ctx.moveTo(...point(x,z-1.6));ctx.lineTo(...point(x-1.1,z+1));ctx.lineTo(...point(x+1.1,z+1));ctx.closePath();ctx.fill();});
  GIFTS.filter(g=>state.collected.includes(g.id)).forEach(g=>{
    const[x,y]=point(g.x,g.z);ctx.fillStyle='#9cab80';
    ctx.beginPath();ctx.arc(x,y,(large?1:1.3)*scale,0,Math.PI*2);ctx.fill();
    if(large){ctx.fillStyle='#faf6e8';ctx.font=`${Math.round(scale*1.4)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✓',x,y);ctx.fillStyle='#8b947e';ctx.font=`500 ${Math.round(scale*1.25)}px "DM Sans",sans-serif`;ctx.fillText(g.short,x,y+2.6*scale);}
  });
  if(large){ctx.fillStyle='#6d7d63';ctx.font=`500 ${Math.round(scale*2)}px Georgia,serif`;ctx.textAlign='center';ctx.fillText('N',w-28,28);ctx.strokeStyle='#849474';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w-28,38);ctx.lineTo(w-28,61);ctx.moveTo(w-32,45);ctx.lineTo(w-28,38);ctx.lineTo(w-24,45);ctx.stroke();}
  const[px,py]=point(state.position.x,state.position.z);ctx.fillStyle='#fff8e5';ctx.beginPath();ctx.arc(px,py,(large?1.5:2)*scale,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8b6344';ctx.beginPath();ctx.arc(px,py,(large?1:1.3)*scale,0,Math.PI*2);ctx.fill();
}

function animate(time){
  const dt=Math.min((time-lastTime)/1000,.25);lastTime=time;let moving=false,running=false;
  const paused=isPaused();
  if(travelling){requestAnimationFrame(animate);return;}
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
      world.move(state.position,dx*travel,dz*travel);
      moving=Math.hypot(state.position.x-oldX,state.position.z-oldZ)>.001;
      if(!moving&&route.length){stopWalking();toast('A tree is in the way. Tap the trail to find another route.');}
      turnBear(world.dudu,Math.atan2(dx,dz),dt);
      stepTime+=dt;if(moving&&stepTime>(running?.23:.34)){audio.footstep(running);stepTime=0;}
    }
    checkNearby();
    if(!world.away&&shouldRevealBubu(state)){route=[];keys.clear();hide('interact-button');world.revealBubu();}
  }
  if(!photo?.active&&(!paused||!wasPaused||world.needsRender)){world.update(paused?0:dt,moving,running,paused);world.needsRender=false;}
  if(photo?.active&&!document.hidden)photo.render();
  if(playing&&!paused)updateDiscoveries(dt);
  $('discovery-notice').classList.toggle('hidden',paused||discoveryRemaining===0||(world.cinematic&&world.moonJourney?.phase!=='stargazing'));
  wasPaused=paused;
  for(const event of world.events.splice(0)){
    if(event==='departed'){updateUI();audio.chirp();toast('Explore the paths and look for birthday surprises. Get close and press E or tap ♡ to collect. B opens your bag.',6500);}
    if(event==='arrival-start'){hide('interact-button');speak('“Bubu…? It’s me!”');audio.chirp();}
    if(event==='arrived'){updateUI();audio.chirp(true);speak('“All these surprises… for me?” ♡','bubu');}
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
      hide('moon-caption');$('app').classList.remove('moon-visit');['intro-time','play-time','pause-time'].forEach(id=>$(id).disabled=false);keys.clear();resetJoystick();route=[];toast('There’s still a whole moonlit forest to wander, together. ♡');
    }
  }
  if(world.story==='moon')checkNearby();
  if(!playing){const p=world.screenPosition(world.duduNest.group,4.5);$('dudu-label').style.left=`${p.x-155}px`;$('dudu-label').style.top=`${p.y-25}px`;}
  if(!$('speech').classList.contains('hidden')){const p=world.screenPosition(world[speechBear],2.3);$('speech').style.left=`${Math.max(110,Math.min(world.width-110,p.x))}px`;$('speech').style.top=`${Math.max(95,p.y)}px`;}
  updateZoomUI();
  updateExplorationHUD();
  mapTime+=dt;if(mapTime>.3){if(!playing)drawMap($('mini-map'));if($('map-dialog').open)drawMap($('large-map'),true);mapTime=0;}
  requestAnimationFrame(animate);
}

export async function initialize(progress){
  await progress(12,'Unfolding a new birthday adventure…');
  world=new ForestWorld($('world'),state);
  await world.initialize(progress);photo=new PostcardCamera(world);
  world.setTimeOfDay(timeOfDay,true);audio.setNight(timeOfDay==='night');
  world.setWeather(weatherMode,true);audio.setRain(weatherMode==='rain');
  // Saves from an older forest layout must not trap a returning player.
  if(!isWalkable(state.position.x,state.position.z,world.obstacles))state.position={...START};
  world.addBackpackGifts();updateUI();updateSoundButton();
  await world.warmUp(progress);
  ready=true;$('start-button').disabled=false;lastTime=performance.now();requestAnimationFrame(animate);
  // Read-only state for browser diagnostics, with ordinary input driving tests.
  if(import.meta.env.DEV)window.__dudu={snapshot:()=>JSON.parse(JSON.stringify({state,adventure,destination:world.travel.snapshot(),travelling,photo:{active:photo.active,perspective:!!photo.camera?.isPerspectiveCamera,position:photo.camera?.position,target:photo.controls?.target},ready,playing,paused:isPaused(),camera:{mode:world.cameraMode,perspective:!!world.camera.isPerspectiveCamera,position:world.camera.position,target:world.story==='moon'?world.moonLook:world.thirdPerson?world.follow.target:world.cameraTarget,yaw:world.movementYaw,pitch:world.follow.pitch,fov:world.camera.fov,distance:world.follow.distance,arm:world.follow.arm,avoidYaw:world.follow.avoidYaw,avoidPitch:world.follow.avoidPitch},nearby:nearby?.id,position:state.position,obstacles:world.obstacles,sound:audio.enabled,route:route.length,render:world.renderer.info.render,resources:world.renderer.info.memory,quality:world.quality,environment:{tufts:world.meadow.tufts,grassCells:world.meadow.cells.length,grassTime:world.meadow.uniforms.time.value,breeze:world.meadow.uniforms.breeze.value,ferns:world.understory.count,sunbeams:world.sunlight.group.visible,fogNear:world.scene.fog.near,fogFar:world.scene.fog.far},time:world.time,view:world.viewSize,zoom:world.cameraMode==='third-person'?world.follow.distance:world.zoomView,overview:world.overview,story:world.story,bubuVisible:world.bubu.visible,bubuPosition:world.bubu.position,duduPosition:world.dudu.position,animals:world.animals.map(a=>({kind:a.kind,x:a.group.position.x,z:a.group.position.z,action:a.brain.mode,model:a.blenderSheep?'blender':'procedural',clip:a.blenderSheep?.clip,blink:a.blenderSheep?.blink,distance:a.brain.distance})),balloons:world.balloons.length,worldRadius:WORLD_RADIUS,timeOfDay:world.timeOfDay,nightBlend:world.nightBlend,trees:world.treeKinds,treeSizes:world.treeSizes,bearScale:world.dudu.scale.x,characterModel:world.dudu.userData.blenderDudu?{source:'blender',weights:world.dudu.userData.blenderDudu.weights,bones:world.dudu.userData.blenderDudu.asset.bones.size}:null,moonJourney:world.moonJourney?{phase:world.moonJourney.phase,progress:world.moonJourney.progress}:null,flowerBeds:world.flowerBeds,butterflies:world.butterflies.map(b=>b.kind),lamps:{count:world.roadLighting.sites.length,sites:world.roadLighting.sites,glowing:world.roadLighting.glass.emissiveIntensity,lights:world.roadLighting.lights.map(l=>l.intensity)},following:!!world.companion,expressions:[world.dudu,world.bubu].map(b=>({name:b.name,mood:b.userData.expression.mood,reaction:b.userData.expression.reaction,remaining:b.userData.expression.remaining,values:b.userData.expression.values,stride:b.userData.strideWeight,run:b.userData.runWeight})),partyTime:world.storyTime,candleLit:world.candleFlame.visible,haptics:{supported:haptics.supported,enabled:haptics.enabled},umbrellas:[world.dudu,world.bubu].map(b=>({bear:b.name,visible:b.visible&&b.userData.umbrella.active,position:b.userData.umbrella.group.position,grip:b.userData.forearms[b.userData.umbrella.hand].rotation})),weather:{mode:world.weather.mode,blend:world.weather.blend,time:world.weather.time,rain:world.rain.streaks.visible?world.rain.drops.length:0,puddles:world.rain.puddles.visible?world.rain.sites.length:0,ripples:world.rain.ripples.visible?world.rain.rippleSites.length:0,audioRain:!!audio.raining,snowVisible:world.atmosphere.snow.visible,snow:world.atmosphere.flakes.length,birds:world.atmosphere.birds.map(b=>({x:b.group.position.x,y:b.group.position.y,z:b.group.position.z})),windLeaves:world.atmosphere.leaves.count,sun:world.sky.sun.visible,moon:world.sky.moon.visible,clouds:world.sky.clouds.length,stars:world.sky.stars.geometry.attributes.position.count,shootingStar:world.sky.meteor.visible,nightTime:world.sky.nightTime,fireflies:world.atmosphere.fireflies.visible?world.atmosphere.fireflyData.length:0,petals:world.atmosphere.petals.count}})),project:(x,z,y=0)=>{const point=new THREE.Vector3(x,y,z).project(world.camera),rect=$('world').getBoundingClientRect();return{x:rect.left+(point.x*.5+.5)*rect.width,y:rect.top+(-point.y*.5+.5)*rect.height};}};
}
