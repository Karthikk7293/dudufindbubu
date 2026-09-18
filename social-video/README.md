# Dudu finds Bubu — social showcase

A 26-second, cute and cozy showcase of the project's real game engine, characters,
gift collection, birthday party, rainy companion walk, and Moonwatch nest.

Play: https://dudufindbubu.vercel.app

## Finished videos

Generated videos, images, audio, capture frames, and verification reports are
stored locally in `~/Documents/dudu-find-bubu-social-media/`, outside this
repository. Only the capture/render tools, gallery template, and documentation
are committed. Generated media is also ignored if an output folder inside the
repository is selected.

| File | Dimensions | Suggested placement |
| --- | --- | --- |
| `dudu-finds-bubu-portrait.mp4` | 1080 × 1920, 9:16 | Instagram Reels / Stories; vertical posts |
| `dudu-finds-bubu-landscape.mp4` | 1920 × 1080, 16:9 | Twitter/X and LinkedIn |
| `dudu-finds-bubu-feed.mp4` | 1080 × 1350, 4:5 | Instagram and LinkedIn feeds |

All versions have burned-in captions, a closing game URL, H.264 video, AAC stereo
audio, 30 fps delivery, and a fast-start MP4 container. Matching JPG cover images
are included in the local media folder. Open that folder's `index.html` to
preview and download the versions; its fonts are bundled with their licenses.

## Capture and music

The footage is a cinematic capture of this repository's `ForestWorld`, using
preset story checkpoints and the existing animation and interaction methods.
It omits game controls and loading screens. It is not a screen recording of an
uninterrupted play session. No production game code was changed.

To accommodate software graphics, the source footage uses the game's phone
detail settings at 960 × 720, with MSAA disabled. Animation is rendered in fixed
1/15-second steps, with temporal blending for 30 fps delivery. Output dimensions
are larger than the source footage; captions are drawn at the full output size.

The stereo soundtrack is an original synthesized arrangement of the music-box
motif in `src/audio.js`, with gift chimes and a soft rain layer. No reference-reel
audio, external stock footage, AI-generated game scenes, or licensed song
recordings are included.

## Rebuild

```sh
# From the project root. Python needs Pillow, numpy, and imageio-ffmpeg.
node social-video/capture.mjs --preview
PYTHONPATH=/tmp/dudu-video-tools python3 social-video/render.py --preview
node social-video/capture.mjs
PYTHONPATH=/tmp/dudu-video-tools python3 social-video/render.py
```

The capture script starts and stops its own local Vite server on port 3101.
Both scripts default to `~/Documents/dudu-find-bubu-social-media/`. Set
`SOCIAL_VIDEO_OUTPUT` to an absolute directory path to choose a different output
folder. The renderer reads captured frames from the same folder and copies a
standalone gallery there.

`CHROME_PATH` overrides `/usr/bin/google-chrome`; `GAME_URL` uses an existing
development server instead. The temporary Python packages are in
`/tmp/dudu-video-tools`; reinstall them if the temporary folder has been cleared.

Use `--format portrait`, `--format landscape`, or `--format feed` to render only
one output. Captured frames can be reused when changing text, layout, or music.

## Suggested posting copy

**Twitter/X**

Eight little gifts. One big birthday adventure. 🧸🎁

I built Dudu finds Bubu — a cozy 3D browser game about exploring Sunnywood,
finding birthday surprises, and making little memories together.

Play: https://dudufindbubu.vercel.app

#IndieGame #ThreeJS #GameDev

**Instagram**

Two little bears. A whole forest of memories. 🧸🤍

Collect eight birthday gifts, find Bubu, share a rainy walk, and stay a little
longer under the stars.

Dudu finds Bubu — a cozy adventure you can play in your browser.

dudufindbubu.vercel.app

#CozyGames #IndieGame #GameDev #BrowserGame #DuduAndBubu

**LinkedIn**

I've been building Dudu finds Bubu, a cozy 3D browser game with Three.js.

The adventure follows Dudu as he explores Sunnywood, collects eight birthday
gifts, and finds Bubu. Along the way, the forest comes alive with wildlife,
changing weather, day and night lighting, and small character reactions.

This short showcase captures gift collection, the birthday celebration,
walking together in the rain, and stargazing at Moonwatch.

Try it here: https://dudufindbubu.vercel.app

#ThreeJS #WebDevelopment #GameDevelopment #CreativeCoding
