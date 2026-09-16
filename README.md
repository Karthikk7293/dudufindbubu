# Dudu finds Bubu

A browser-based 3D birthday adventure inspired by the gentle exploration of [Messenger by Abeto](https://messenger.abeto.co/). Play as the brown bear Dudu, leave Dudu’s nest, gather eight gifts in a larger Sunnywood Forest, and visit the white bear Bubu at her nest. Bubu opens her door only when Dudu arrives with all eight gifts. Celebrate her birthday, then explore the forest together.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. Use Node.js 18.19+ (Node.js 20+ recommended).

## Deploy to Vercel

The repository includes [`vercel.json`](./vercel.json), which configures Vercel to install the locked dependencies with `npm ci`, build the game with `npm run build`, and publish `dist` as a static Vite site. These settings use Vercel's [project configuration](https://vercel.com/docs/project-configuration/vercel-json).

1. Commit and push the latest changes, including `vercel.json` and `package-lock.json`, to GitHub.
2. In Vercel, choose **Add New → Project** and import this repository.
3. Keep **Root Directory** at the repository root (the folder containing `package.json`). The framework is **Vite**; the install, build, and output settings come from `vercel.json`.
4. Leave **Environment Variables** empty and click **Deploy**.

Open the deployment URL to play. Future pushes to the connected production branch trigger another deployment through Vercel's [Git integration](https://vercel.com/docs/git).

The game runs entirely in the browser. The published files include its fonts and favicon; no database, backend service, or API keys are required. The local port `3000` is only for development. Vercel serves the built game over HTTPS. The `.vercel/` folder created by the optional Vercel CLI is ignored by Git.

## Play

- **WASD / arrow keys:** move relative to the camera
- **Shift:** run
- **Click / tap the ground:** walk there, routing around trees and water
- **Drag / swipe the forest:** orbit the third-person camera
- **J / L and I / K:** rotate / tilt the camera with the keyboard
- **C / camera label:** switch third person and overhead view
- **R / circular arrow:** look from behind Dudu
- **E / Space:** collect a nearby present or talk to Bubu
- **M:** map
- **B:** gift bag, notes, and hints; select a missing gift and choose its trail
- **Gift pointer / top-left card:** walk to the tracked gift; tap again nearby to collect it
- **+ / − or mouse wheel:** zoom in / out
- **0 / overview button:** see the whole forest or follow Dudu
- **T / sun–moon button:** switch between day and night (also available before play and in the pause menu)
- **V / weather button:** switch between clear skies and gentle rain
- **Escape / P:** pause (Escape also exits native browser fullscreen)
- **Phone / tablet:** drag the thumbstick; tap the heart to collect or talk; pinch with two fingers to zoom

**Phones, tablets, and desktops are supported.** On a phone, Play requests fullscreen and landscape orientation where available. If the browser cannot rotate automatically, turn your phone sideways; the portrait prompt pauses the adventure until then. Rotation preserves gifts, story progress, and open dialogs. On-screen controls respect display safe areas, and the canvas uses the real viewport dimensions so taps and swipes stay aligned. Portrait tablet play remains available.

On phones, use the left thumbstick to walk, swipe the forest with the other thumb to look around, pinch to zoom, and tap the heart to collect or interact. The camera controls stay along the bottom. The renderer caps phone pixel density, reduces distant ground decoration and leaf detail, and uses a smaller shadow map. The world, gift locations, and story are identical across devices. Real-device performance still depends on GPU and browser; phone behavior is verified with browser touch emulation.

A skeleton of the forest appears immediately while the game loads. The progress bar follows real building stages and stays visible while shaders compile and the first forest frame renders. Play becomes available when the scene is ready. A failed download or unsupported graphics setup shows a retry screen.

Play begins in a close third-person perspective, with a low camera that follows Dudu. Drag to look around the trees, flowers and presents; adjust the distance with the zoom controls. When a trunk, canopy, roadside lamp, or wooden sign blocks Dudu, the camera eases toward a clear side and returns after leaving the tree. Accurate crown volumes and continuous trunk boundaries keep the camera outside the foliage. The overhead view and whole-forest overview are still available.

The eight gifts can be collected in any order. The expanded forest has connected inner and outer roads, two ponds with bridges, two bear nests, heart balloons, and roaming rabbits, deer, foxes, and sheep. Collecting a gift displays a brief message without interrupting your walk. A labelled pointer and a glowing, collision-aware trail lead to the next missing gift, including the love letter. The pointer stays at the screen edge when the gift is off screen. Open the bag to track a particular gift, read a note, or get a hint. The trail leads to Bubu once the bag is full. Gentle snow, warm sunshine, flying birds, and windblown leaves bring the forest to life; lambs have rounded faces, soft ears, and little smiles.

The trees have textured bark, tapering branch forks, pointed leaves, and uneven pine boughs, with denser foliage on larger screens. The forest mixes spreading oaks, green trees with pink blossoms, umbrella crowns with hanging vines, willows, white-barked birches, and pines. Flower beds contain daisies, sunflowers, tulips, lavender, bluebells, and roses. Saplings, tall birches and pines, broad mature oaks, and elder trees have different heights and crown widths. Dudu and Bubu are smaller in proportion to their surroundings. Four small butterfly varieties visit the flowers; drifting clouds, gently swaying foliage, and falling blossom petals add movement.

Use the **sun–moon button** or **T** to change the time of day. Night brings a moon and twinkling stars, occasional shooting stars, roadside lanterns, glowing nest windows, and fireflies. Day brings the sun, birds, and butterflies back. Lighting fades smoothly between modes. Reduced-motion settings keep decorative movement still and switch lighting immediately. Your day/night preference survives refreshing or restarting the adventure; changing it in the pause menu keeps the game paused.

The **weather button** (or **V**) brings gentle rain to the forest. The palette uses sage greens, warm earth, and blue-grey overcast light, inspired by the user's [rainy scene reference](https://www.instagram.com/reel/DdQjknbt66F/). Fine procedural grain textures the grass and paths; rain darkens the ground, adds shallow puddles and expanding rings on puddles and ponds, and dims the sun. Roadside lamps glow softly in rainy daylight. Rain and day/night can be combined independently. Snow, birds, and butterflies give way to rain; leaves sway more in the breeze. These are original 3D effects, not extracted reel assets or real-time mirror reflections.

Weather changes fade during play and apply immediately from the pause menu without resuming the adventure. The setting is remembered, while refreshing still resets the gift hunt. Phones use half the rain particles; streaks, puddles, and ripples use three batched draws. Reduced motion keeps the wet surfaces and overcast lighting while hiding falling rain and expanding ripples. A synthesized stereo rain layer fades in when sound is enabled; no audio is downloaded from Instagram.

The playground fills the viewport when play starts and requests native browser fullscreen where supported. Only compact gift guidance, day/night, weather, bag, map, pause, and zoom controls stay visible. Sound, help, fullscreen, and restart are available from the pause menu.

Bubu stays inside until **all eight gifts are collected and Dudu reaches her clearing**. Visiting early keeps her door closed. When she walks outside, choose **Celebrate Bubu’s birthday** (or press E nearby) to start the party: Dudu sets down the gifts, Bubu makes a candle wish, and both enjoy music and heart confetti. After the party, choose **Walk together**. Bubu follows Dudu around trees and over bridges, and you can stop to share a little moment.

After the party, the pointer leads to the **Moonwatch nest** in the northwestern forest. At the ladder, press **E** or tap **Climb to the moon nest together**. Both bears walk to the ladder, then climb as daylight gradually turns to night. The camera rises with them to an open nest with a moon, clouds, stars, and shooting stars. Stay as long as you like; choose **Climb down together** to return to the paths. Pause and restart work during the climb. The moon visit keeps the rest of this adventure at night; it does not overwrite your saved day/night preference.

**Refreshing always starts a new adventure:** Dudu returns to his nest, the bag is empty, Bubu stays inside, and the birthday and companion walk reset. Progress is kept only while this page remains open. Older stored progress is cleared. Sound, weather, and day/night preferences remain saved. The pause menu’s restart button also starts over.

## Audio and artwork

An editable **Blender Dudu prototype** is available at **`/character.html`**. Rotate and zoom the model, preview its idle/walk clips and three facial expressions, then use **Try in the forest** to play with it at `/?dudu=blender`. The default forest keeps the established cast while this first model is reviewed. Open `art/characters/dudu.blend` in Blender; see [the character workflow](art/characters/README.md) for rebuilding, export settings and tests. Bubu and wildlife have not been migrated yet.

The forest, characters, objects, UI icons, and animation are custom code-built assets. Music, forest ambience, birds, footsteps, gift chimes, and cute character chirps are generated with Web Audio. Sound begins after pressing Play or the sound button, as required by browsers. These are **original synthesized sounds, not the Instagram characters’ recorded voices**. The plush character models are refined from the user’s [look reference](https://www.instagram.com/reel/Dar3t6FNPJT/): oversized rounded heads, short bodies and limbs, tiny low-set eyes and smiles, Dudu’s honey cheeks and Bubu’s white face, pink cheeks, dark ear and paw tips, and bow tie. They have subtle fur shading, softly defined muzzles, eye highlights, occasional blinks, and smiling eyes during the birthday party. Walking steps follow distance traveled, with gentle breathing, arm swings, and ear movements. Strides ease in and out, with a small body lean and head counterturn when changing direction. Butterflies bank gently and face their flight paths. The user's [movement and expression reel](https://www.instagram.com/reel/DdTewNJTGyj/) guides the broader arm swings, rounder running steps, raised paws, surprised eyes, and closed-eye smiles. Elbow joints let paws fold towards the chest. Expressions follow the adventure: curiosity near gifts, surprise then delight on collection, a shy greeting, a candle-wish face, birthday joy, and wonder in the Moonwatch nest. After the party, “Share a little moment” stops the current route and gives both bears a warm reaction. Expressions blend smoothly, pause with the game, and reset on restart. Wildlife alternates between short walks, grazing, and rests; rabbits hop, nearby animals look up and retreat, and animals settle down at night. These are stylized characters rather than photorealistic models. Dudu keeps his gift backpack with a little white-bear charm. Local visual references are documented in `references/characters/README.md`. No assets or code are copied from Messenger.

Night ambience adds gentle synthesized cricket chirps and occasional owl calls when sound is enabled.

Fonts: locally hosted DM Sans and Playfair Display, with licenses included and system fallbacks. The game requires WebGL 2. No backend, account, API key, or external audio service is needed. The forest uses batched geometry and cached static shadows to reduce rendering work. All lanterns have luminous glass and soft light pools; six nearby point lights illuminate Dudu and the surroundings without requiring a separate shadow map for every lamp.

## Build and verify

```sh
npm run build
npm run preview
npm test
npm run test:browser
npm run test:mobile
npm run test:weather
npm run test:interaction
npm run test:browser -- --refinements
npm run test:browser -- --characters
npm run test:browser -- --day-night
npm run test:browser -- --experience --loading
npm run test:browser -- --experience --camera
npm run test:browser -- --experience --reset
npm run test:browser -- --experience --tablet
npm run test:browser -- --moon-nest
```

Browser checks run against the dev server on port 3000 and use Google Chrome at `/usr/bin/google-chrome`. Override `GAME_URL` or `CHROME_PATH` as needed. Screenshots are saved to `test-results/`. The full browser suite checks the departure, gift pointer and letter collection, all-gifts arrival gate, candle wish and birthday party, walking together, reset on refresh, restart, fullscreen layout, zoom, map and bag menus, sound, atmosphere, and real tablet pinch and joystick events. The shorter interaction suite skips the gift and ending checkpoints. The refinements check focuses on the picnic pointer, pausing the birthday party, walking together, refresh behaviour, reduced motion, lamb visuals, and tablet controls. The character check renders front and three-quarter previews, then checks the refined bears during their birthday and companion walk. Logic tests cover save migration, all-gift gating, gift selection and proximity, safe companion restoration, following around trees and across both bridges without teleporting, zoom limits, collision, and pathfinding.

Deploy the generated `dist/` directory to any static web host. No backend is needed.

The day/night browser check covers vegetation varieties, routes to every gift and Bubu, lantern lighting, fireflies, shooting stars, preference restoration, pausing, reduced motion, gift collection at night, and tablet controls. Add `--preview` to skip walking to and collecting a gift, or `--controls-only` to focus on saved settings, paused switching, reduced motion, night gift collection, and tablet input. It also captures day and night screenshots. Chrome's software renderer can make these checks considerably slower than play with hardware acceleration.

The experience checks separately cover the initial skeleton and download failure, third-person controls and night rendering, a real gift collection followed by refresh, and tablet orbit / pinch / movement. Camera logic tests cover clearance, smoothing, distance limits, and tilt limits. Browser fixtures use an explicit development-only initial state; production never restores birthday progress.

The moon-nest browser check covers tablet rendering, actual forest routes, climbing through dusk, paused elevated positions, stargazing and meteors, descent, and restarting during a visit. Add `--preview` for the climb and desktop/tablet treetop screenshots only.

## Engine prototype

The interactive engine study is preserved at **`/engine.html`** in both development and the Vercel build. The forest is the homepage. See [ENGINE.md](./ENGINE.md) for assembly, inspection, and experimental webcam hand controls. Engine modules and tracking assets are loaded only by that page.

The mobile check exercises portrait entry, a denied orientation lock, landscape touch controls, simultaneous movement and camera swipes, pinch zoom, cancelled touches, dialog restoration after rotation, gift collection, night mode, small landscape screens, and a fresh adventure after refresh. `node tests/forest-story.mjs` checks arrival, celebration, pausing, and companion walking; `node tests/deployment.browser.mjs` checks both built pages against a preview server on port 4174 (`PREVIEW_URL` overrides it). `node tests/forest-visuals.mjs` captures the bear, wildlife, and tree studies.

The weather check covers rainy phone rendering, pause and weather controls, rainy night lighting, the five-action HUD at 568 × 320, preference restoration with a fresh adventure, and reduced motion. Unit checks cover weather timing, paused rain, bounded particles, phone particle limits, wet materials, and world-space texture scale.

`node tests/expressions.browser.mjs` renders close-up studies of eight moods. Expression and motion unit checks cover timed reactions, candle-wish priority, pause/reset, reduced motion, bounded head tracking, frame-rate independent turns, and releasing paw gestures when walking resumes.

`node tests/emotions-game.browser.mjs` checks mobile gift reactions and touch walking, arrival, candle wishes, birthday smiles, the shared-moment interaction, companion walking, and reset. Story-pose checks ensure the ending dialog preserves raised paws and pausing the ladder approach freezes both actors' poses.
