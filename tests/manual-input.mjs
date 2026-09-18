import assert from 'node:assert/strict';
import { destinationHeight } from '../src/destinations.js';

// Tests choose a visible ground point just as a player can. This never selects
// an objective in the app or changes game state through diagnostic hooks.
export async function chooseGroundPoint(page,point,{wait=true,touch=false}={}){
  const initial=await page.evaluate(()=>window.__dudu.snapshot());
  if(!initial.overview)await page.locator('#zoom-overview').click();
  await page.waitForFunction(()=>{
    const s=window.__dudu.snapshot(),r=document.querySelector('#world').getBoundingClientRect(),aspect=r.width/r.height;
    const target=s.destination.id==='forest'?Math.max(94,86/aspect):Math.max(65,62/aspect);
    return s.overview&&Math.abs(s.view-target)<.1;
  });
  const y=initial.destination.id==='forest'?0:destinationHeight(initial.destination.id,point.x,point.z);
  await page.waitForFunction(({point,y})=>{
    const p=window.__dudu.project(point.x,point.z,y);
    return !!document.elementFromPoint(p.x,p.y)?.closest('#world');
  },{point,y});
  const screen=await page.evaluate(({point,y})=>window.__dudu.project(point.x,point.z,y),{point,y});
  if(touch)await page.touchscreen.tap(screen.x,screen.y);else await page.mouse.click(screen.x,screen.y);
  assert.ok((await page.evaluate(()=>window.__dudu.snapshot())).route>0,'The chosen ground point starts a walk');
  if(!initial.overview)await page.locator('#zoom-overview').click();
  if(wait)await page.waitForFunction(point=>{
    const s=window.__dudu.snapshot();return s.route===0&&Math.hypot(s.position.x-point.x,s.position.z-point.z)<.8;
  },point);
}
