// This small entry point paints the loading shell before downloading the game.
const app=document.getElementById('app'),loading=document.getElementById('loading');
const status=document.getElementById('loading-status'),bar=document.getElementById('loading-progress');
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
async function progress(value,label){
  status.textContent=label;bar.value=value;
  document.getElementById('loading-percent').textContent=`${value}%`;
  loading.dataset.stage=String(value);await nextPaint();
}
document.getElementById('loading-retry').addEventListener('click',()=>location.reload());
async function boot(){
let slowTimer=setTimeout(()=>{document.getElementById('loading-tip').textContent='This first visit may take a little longer. We’re still getting the forest ready.';},18000);
try{
  await progress(5,'Opening the forest…');
  const {initialize}=await import('./main.js');
  await initialize(progress);
  await progress(100,'Your little adventure is ready.');
  app.inert=false;app.setAttribute('aria-busy','false');app.classList.remove('is-loading');
  loading.classList.add('is-ready');
  loading.addEventListener('transitionend',()=>loading.remove(),{once:true});
  // Reduced motion and background tabs may not dispatch a transition event.
  setTimeout(()=>loading.remove(),500);
}catch(error){
  console.error('Could not open the forest:',error);
  loading.classList.add('has-error');status.textContent='The forest couldn’t open.';
  document.getElementById('loading-tip').textContent='Check your connection and try again. If this keeps happening, enable hardware acceleration in your browser.';
  bar.hidden=true;document.getElementById('loading-percent').hidden=true;
  document.getElementById('loading-retry').hidden=false;
}finally{clearTimeout(slowTimer);}

}
boot();
