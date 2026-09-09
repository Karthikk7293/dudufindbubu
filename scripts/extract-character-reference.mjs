import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage();
  await page.goto('http://localhost:3000/references/characters/look-reference-Dar3t6FNPJT.mp4');
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  const meta=await page.evaluate(()=>{const v=document.querySelector('video');v.pause();return {duration:v.duration,width:v.videoWidth,height:v.videoHeight};});console.log(meta);
  const data=await page.evaluate(async()=>{
    const v=document.querySelector('video'),canvas=document.createElement('canvas');canvas.width=1280;canvas.height=680;const ctx=canvas.getContext('2d');ctx.fillStyle='#ece8df';ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<8;i++){
      const t=.2+(v.duration-.4)*i/7;
      await new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=t;});
      ctx.drawImage(v,0,v.videoHeight*.22,v.videoWidth,v.videoHeight*.57,(i%4)*320,Math.floor(i/4)*340,320,320);
      ctx.fillStyle='#40392e';ctx.font='13px sans-serif';ctx.fillText(`${t.toFixed(1)} seconds`,(i%4)*320+10,Math.floor(i/4)*340+335);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await writeFile('references/characters/reel-frames.png',Buffer.from(data,'base64'));console.log('Saved eight reference frames.');
}finally{await browser.close();}
