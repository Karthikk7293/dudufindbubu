import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const root=path.dirname(fileURLToPath(import.meta.url));
const output=path.resolve(process.env.SOCIAL_VIDEO_OUTPUT||path.join(homedir(),'Documents','dudu-find-bubu-social-media'));
const preview=process.argv.includes('--preview');
const shots=[['hello',3.5],['gifts',4],['birthday',5],['rain',4.5],['moon',9]];
const fps=15;
const server=process.env.GAME_URL?null:await createServer({root:path.dirname(root),server:{host:'127.0.0.1',port:3101,strictPort:true},logLevel:'error'});
if(server)await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:960,height:720},deviceScaleFactor:1,isMobile:true,hasTouch:true,screen:{width:390,height:844}});
  // Capture-only graphics settings: preserve the scene while reducing software MSAA cost.
  await page.route('**/src/world.js',async route=>{
    const response=await route.fetch();let body=await response.text();
    body=body.replace('antialias:true','antialias:false');
    await route.fulfill({response,body});
  });
  page.setDefaultTimeout(180000);page.on('pageerror',e=>console.error(e));
  page.on('console',m=>{if(m.type()==='log')console.log(m.text());});
  await page.goto((process.env.GAME_URL||'http://127.0.0.1:3101')+'/social-video/capture.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ready);
  const out=path.join(output,preview?'previews':'frames');await mkdir(out,{recursive:true});
  let frame=0;let elapsed=0;const start=Date.now();
  for(const [shot,duration] of shots){
    if(preview){
      let data;for(let i=0;i<=6;i++)data=await page.evaluate(({shot,t})=>window.renderShot(shot,t,.5),{shot,t:i*.5});
      await writeFile(path.join(out,`${shot}.jpg`),Buffer.from(data,'base64'));
      console.log(shot,await page.evaluate(()=>window.captureInfo()));continue;
    }
    const count=Math.round((elapsed+duration)*fps)-Math.round(elapsed*fps);
    for(let i=0;i<count;i++){
      const data=await page.evaluate(({shot,t,dt})=>window.renderShot(shot,t,dt),{shot,t:i/fps,dt:1/fps});
      await writeFile(path.join(out,`${String(frame).padStart(5,'0')}.jpg`),Buffer.from(data,'base64'));frame++;
      if(i%30===0)console.log(`${shot}: ${i/fps}/${duration}s, ${frame} frames, ${Math.round((Date.now()-start)/1000)}s elapsed`);
    }
    elapsed+=duration;
  }
  await writeFile(path.join(output,'capture-manifest.json'),JSON.stringify({fps,width:960,height:720,shots,duration:26,source:'Game engine rendered at fixed 1/15-second steps with cinematic cameras; existing gift, party, rain and Moonwatch animations. Phone detail settings, MSAA disabled for software capture.'},null,2)+'\n');
}finally{await browser.close();await server?.close();}
