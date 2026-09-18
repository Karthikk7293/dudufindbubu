"""Compose the fixed-step game footage into finished social videos.

PYTHONPATH=/tmp/dudu-video-tools python3 social-video/render.py [--preview] [--format portrait|landscape|feed]
Dependencies: Pillow, numpy, imageio-ffmpeg. No external images or music.
"""
from pathlib import Path
from functools import lru_cache
import argparse, math, os, shutil, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import imageio_ffmpeg

SOURCE = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('SOCIAL_VIDEO_OUTPUT',Path.home()/'Documents'/'dudu-find-bubu-social-media')).expanduser().resolve()
FONTS = SOURCE.parent / 'public/fonts'
FPS, SOURCE_FPS, DURATION = 30, 15, 26
SCENES = [
    (0, 3.5, 'hello', 'A LITTLE BIRTHDAY QUEST', ['Eight little gifts.', 'One big adventure.'], 'Meet Dudu. Bubu’s birthday is waiting.'),
    (3.5, 7.5, 'gifts', '01 / FOLLOW THE TRAIL', ['Find a gift.', 'Make her smile.'], 'Gather eight surprises across Sunnywood.'),
    (7.5, 12.5, 'birthday', '02 / MAKE A WISH', ['Find Bubu.', 'Make her day.'], 'A birthday picnic, a candle, and a little magic.'),
    (12.5, 17, 'rain', '03 / WANDER TOGETHER', ['A little rain.', 'A little closer.'], 'Even rainy days are better together.'),
    (17, 22, 'moon', '04 / STAY A LITTLE LONGER', ['Save a moment', 'under the stars.'], 'Climb to Moonwatch and watch the sky together.'),
    (22, 26, 'moon', 'A COZY 3D BROWSER ADVENTURE', ['Dudu', 'finds Bubu'], 'Every little adventure is better together.'),
]
SIZES = {'portrait':(1080,1920),'landscape':(1920,1080),'feed':(1080,1350)}
FONT_CACHE = {}

def font(size, serif=False, bold=False, italic=False):
    name = 'playfair-medium-italic.ttf' if italic else 'playfair-medium.ttf' if serif else 'dm-sans-semibold.ttf' if bold else 'dm-sans-regular.ttf'
    key=(name,size)
    if key not in FONT_CACHE: FONT_CACHE[key]=ImageFont.truetype(str(FONTS/name),size)
    return FONT_CACHE[key]

def ease(t):
    t=max(0,min(1,t)); return t*t*(3-2*t)

def mix(a,b,t): return tuple(round(x+(y-x)*t) for x,y in zip(a,b))

def wrapped(draw,text,f,width):
    lines=[]; line=''
    for word in text.split():
        candidate=f'{line} {word}'.strip()
        if draw.textlength(candidate,font=f)>width and line: lines.append(line); line=word
        else: line=candidate
    if line: lines.append(line)
    return lines

def sparkle(d,x,y,r,color):
    d.polygon([(x,y-r),(x+r*.25,y-r*.25),(x+r,y),(x+r*.25,y+r*.25),(x,y+r),(x-r*.25,y+r*.25),(x-r,y),(x-r*.25,y-r*.25)],fill=color)

def heart(d,x,y,size,color):
    points=[]
    for a in np.linspace(0,2*math.pi,72):
        points.append((x+size*(16*math.sin(a)**3)/17,y-size*(13*math.cos(a)-5*math.cos(2*a)-2*math.cos(3*a)-math.cos(4*a))/17))
    d.polygon(points,fill=color)

def scene_at(t): return next(s for s in SCENES if s[0]<=t<s[1])

@lru_cache(maxsize=8)
def source_frame(index):
    return Image.open(ROOT/'frames'/f'{index:05d}.jpg').convert('RGB')

def footage(index, preview=False):
    if preview:
        s=scene_at(index/FPS);return Image.open(ROOT/'previews'/f'{s[2]}.jpg').convert('RGB')
    pos=index*SOURCE_FPS/FPS;lo=math.floor(pos);fraction=pos-lo
    current=source_frame(lo).copy()
    if fraction and lo+1<DURATION*SOURCE_FPS:
        # Gentle temporal blending smooths the offline 15 fps capture for 30 fps delivery.
        if scene_at(index/FPS)[2]==scene_at((lo+1)/SOURCE_FPS)[2]:current=Image.blend(current,source_frame(lo+1),fraction)
    for boundary in (3.5,7.5,12.5,17):
        delta=index/FPS-boundary
        if 0<=delta<.3:
            previous=source_frame(math.ceil(boundary*SOURCE_FPS)-1)
            current=Image.blend(previous,current,ease(delta/.3))
    return current

def compose(index,kind,preview=False):
    t=index/FPS;start,end,shot,kicker,head,sub=scene_at(t)
    w,h=SIZES[kind]; night=ease((t-17)/.7)
    bg=mix((246,241,226),(19,31,46),night)
    ink=mix((54,67,44),(249,240,215),night)
    muted=mix((109,118,92),(174,190,199),night)
    accent=mix((156,112,62),(219,183,117),night)
    border=mix((223,218,198),(66,79,91),night)
    canvas=Image.new('RGB',(w,h),bg);d=ImageDraw.Draw(canvas)
    land=kind=='landscape';feed=kind=='feed';final=t>=22
    if land:
        x,y,fw,fh=600,66,1260,945;tx=64;title_y=300;title_size=58 if not final else 76
        text_width=500; brand_y=69;kicker_y=235;sub_y=493;bottom_y=915
    elif feed:
        x,y,fw,fh=36,347,1008,750;tx=62;title_y=136;title_size=68 if not final else 73
        text_width=950;brand_y=48;kicker_y=106;sub_y=306;bottom_y=1150
    else:
        x,y,fw,fh=42,492,996,1056;tx=74;title_y=213;title_size=81 if not final else 84
        text_width=932;brand_y=122;kicker_y=176;sub_y=407 if not final else 440;bottom_y=1636

    # Restrained botanical corner marks and a warm frame around the real game.
    d.arc((-120,-150,w*.5,h*.38),210,320,fill=border,width=2)
    sparkle(d,w-65,92 if land else 134 if not feed else 66,11,accent)
    sparkle(d,w-95,110 if land else 159 if not feed else 87,5,accent)
    d.rounded_rectangle((x-3,y-3,x+fw+3,y+fh+3),radius=27,fill=border)
    im=footage(index,preview)
    # The landscape edit preserves the complete native 4:3 frame.
    im=ImageOps.fit(im,(fw,fh),method=Image.Resampling.LANCZOS,centering=(.50,.48))
    mask=Image.new('L',(fw,fh));ImageDraw.Draw(mask).rounded_rectangle((0,0,fw-1,fh-1),radius=24,fill=255)
    canvas.paste(im,(x,y),mask);d=ImageDraw.Draw(canvas)

    heart(d,tx+12,brand_y+17,13,accent)
    d.text((tx+40,brand_y),'DUDU FINDS BUBU',font=font(24 if land else 27,bold=True),fill=ink)
    offset=int((1-ease((t-start)/.42))*15)
    d.text((tx,kicker_y+offset),kicker,font=font(18 if land else 22,bold=True),fill=accent)
    if feed:
        # A compact title leaves most of the feed card to the game footage.
        for j,line in enumerate(head):d.text((tx,title_y+j*70+offset),line,font=font(title_size,serif=True,italic=(j==1 and not final)),fill=ink)
    else:
        for j,line in enumerate(head):d.text((tx,title_y+j*(title_size+13)+offset),line,font=font(title_size,serif=True,italic=(j==1 and not final)),fill=ink)
    if not feed:
        for j,line in enumerate(wrapped(d,sub,font(27 if land else 30),text_width-35)):
            d.text((tx,sub_y+j*41+offset),line,font=font(27 if land else 30),fill=muted)
    else:
        d.text((tx,sub_y+offset),sub,font=font(24),fill=muted)

    if final:
        cta='Explore Sunnywood'
        by=660 if land else 1605 if not feed else 1138
        bw=357 if land else 408;bh=66
        d.rounded_rectangle((tx,by,tx+bw,by+bh),radius=33,fill=accent)
        d.text((tx+28,by+15),cta,font=font(26 if land else 30,bold=True),fill=bg)
        d.line([(tx+bw-47,by+33),(tx+bw-24,by+33)],fill=bg,width=2)
        d.line([(tx+bw-33,by+24),(tx+bw-24,by+33),(tx+bw-33,by+42)],fill=bg,width=2)
        d.text((tx,by+91),'dudufindbubu.vercel.app',font=font(27 if land else 36,bold=True),fill=ink)
        if not feed:d.text((tx,by+137),'Play in your browser',font=font(22 if land else 27),fill=muted)
    else:
        line='EXPLORE  /  COLLECT  /  CELEBRATE'
        d.text((tx,bottom_y),line,font=font(19 if land else 23,bold=True),fill=accent)
        d.text((tx,bottom_y+39),'A small world. A lot of heart.',font=font(24 if land else 30,serif=True,italic=True),fill=muted)

    # Small chapter progress, kept away from the usual social app controls.
    px,py,pw=(tx,1020,476) if land else (tx,1810,932) if not feed else (tx,1296,950)
    for k in range(5):
        seg=(pw-4*12)/5;sx=px+k*(seg+12)
        d.rounded_rectangle((sx,py,sx+seg,py+3),radius=1,fill=border)
        progress=max(0,min(1,t/26*5-k))
        if progress:d.rectangle((sx,py,sx+seg*progress,py+3),fill=accent)
    return canvas

def soundtrack():
    rate=48000; a=np.zeros((rate*DURATION,2),dtype=np.float64)
    def tone(midi,start,length,volume,pan=0,bell=False):
        offset=round(start*rate);count=min(round(length*rate),len(a)-offset)
        if count<=0:return
        t=np.arange(count)/rate;f=440*2**((midi-69)/12)
        signal=np.sin(2*np.pi*f*t)+(.22 if bell else .10)*np.sin(2*np.pi*2*f*t)+.04*np.sin(2*np.pi*3*f*t)
        env=np.minimum(1,t/.018)*np.exp(-t/(length*.27))*np.minimum(1,(length-t)/.09)
        signal*=env*volume
        a[offset:offset+count,0]+=signal*math.sqrt((1-pan)/2)
        a[offset:offset+count,1]+=signal*math.sqrt((1+pan)/2)
    # The project's own music-box motif (src/audio.js), arranged for the trailer.
    melody=[76,0,79,0,83,81,79,0,74,0,78,0,81,0,78,0,72,0,76,0,79,76,74,0,71,0,74,0,78,0,74,0]
    chords=[[48,52,55],[50,54,57],[45,48,52],[43,47,50]]
    step=.25
    for i in range(96):
        at=i*step+.06;n=melody[i%32]
        if n:tone(n,at,1.4,.17,math.sin(i*.45)*.20,True)
        if i%8==0:
            for j,note in enumerate(chords[(i//8)%4]):tone(note,at+j*.065,3.5,.075,(j-1)*.3)
    # Resolve softly under the final title.
    for j,n in enumerate([48,52,55,60,64,67]):tone(n,24+j*.10,2-j*.1,.065,(j-2.5)*.12,True)
    for at in (5.48,10.9):
        for j,n in enumerate([76,79,83,88]):tone(n,at+j*.105,.85,.10,(j-1.5)*.15,True)
    rng=np.random.default_rng(42)
    rain=rng.normal(0,.0022,(len(a),2));tt=np.arange(len(a))/rate
    rain_env=np.clip((tt-12.5)/.7,0,1)*np.clip((17.1-tt)/.7,0,1)
    a+=rain*rain_env[:,None]
    # Quiet stereo echoes give the synthesized music a little room.
    dry=a.copy()
    for delay,gain in ((.13,.14),(.27,.085),(.43,.05)):
        shift=round(delay*rate);a[shift:]+=dry[:-shift,::-1]*gain
    envelope=np.minimum(1,tt/.6)*np.minimum(1,(DURATION-tt)/1.25)
    a*=envelope[:,None];a*=.72/max(.72,float(np.abs(a).max()))
    file=ROOT/'soundtrack.wav'
    with wave.open(str(file),'wb') as out:
        out.setnchannels(2);out.setsampwidth(2);out.setframerate(rate);out.writeframes((np.clip(a,-1,1)*32767).astype('<i2').tobytes())
    return file

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--preview',action='store_true');parser.add_argument('--format',choices=SIZES);args=parser.parse_args()
    ROOT.mkdir(parents=True,exist_ok=True)
    if ROOT != SOURCE:
        # Keep the exported gallery usable after it is moved away from the project.
        (ROOT/'fonts').mkdir(exist_ok=True)
        for name in ('dm-sans-regular.ttf','playfair-medium.ttf','DM-Sans-OFL.txt','Playfair-Display-OFL.txt'):
            shutil.copyfile(FONTS/name,ROOT/'fonts'/name)
        gallery=(SOURCE/'index.html').read_text().replace('../public/fonts/','fonts/')
        (ROOT/'index.html').write_text(gallery)
        shutil.copyfile(SOURCE/'README.md',ROOT/'README.md')
    kinds=[args.format] if args.format else list(SIZES)
    if args.preview:
        (ROOT/'previews').mkdir(exist_ok=True)
        for kind in kinds:
            thumbnails=[]
            for t in (1,5,10,14,19,24):
                frame=compose(round(t*FPS),kind,True);frame.save(ROOT/'previews'/f'{kind}-{t}.jpg',quality=94)
                frame.thumbnail((480,550));thumbnails.append(frame)
            tw=max(im.width for im in thumbnails);th=max(im.height for im in thumbnails)
            sheet=Image.new('RGB',(tw*3,th*2),(220,220,212))
            for i,im in enumerate(thumbnails):sheet.paste(im,((i%3)*tw,(i//3)*th))
            sheet.save(ROOT/f'contact-sheet-{kind}.jpg',quality=94)
        print('Preview sheets ready.',flush=True);return
    sound=soundtrack();ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    for kind in kinds:
        w,h=SIZES[kind];output=ROOT/f'dudu-finds-bubu-{kind}.mp4'
        log=open(ROOT/f'encode-{kind}.log','w')
        command=[ffmpeg,'-y','-hide_banner','-loglevel','warning','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h}','-r',str(FPS),'-i','pipe:0','-i',str(sound),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-profile:v','high','-level:v','4.2','-c:a','aac','-b:a','192k','-ar','48000','-af','loudnorm=I=-16:TP=-1.5:LRA=9','-t',str(DURATION),'-movflags','+faststart','-metadata','title=Dudu finds Bubu | A little birthday adventure',str(output)]
        proc=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log)
        try:
            for i in range(DURATION*FPS):
                frame=compose(i,kind);proc.stdin.write(frame.tobytes())
                if i%90==0:print(f'{kind}: {i//FPS}/{DURATION} seconds',flush=True)
                if i==24*FPS:frame.save(ROOT/f'dudu-finds-bubu-cover-{kind}.jpg',quality=96)
        finally:
            proc.stdin.close();code=proc.wait();log.close()
        if code:raise RuntimeError(f'Encoder failed: {ROOT/f"encode-{kind}.log"}')
        print(f'Created {output.name} ({output.stat().st_size/1024/1024:.1f} MB)',flush=True)

if __name__=='__main__':main()
