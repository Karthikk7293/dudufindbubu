# Dudu and Bubu — Blender characters

Open **`dudu.blend`** or **`bubu.blend`** in Blender to edit the models, materials, armatures, facial shape keys and animation actions. These are original, script-built interpretations of the user's reel references, not extracted character models or motion capture.

Review the bears at `/character.html` and `/character.html?bear=bubu`, or play the forest with `/?dudu=blender`. The regular forest URL keeps the code-built bears and does not request either GLB. A failed prototype download falls back to the current bears with a message when play begins.

## What is in each file

- **13 deforming bones**, including separate shoulders, elbows and **ankles**. Smooth vertex weights bend each arm across the elbow and each leg across the ankle, so the soles can stay level and roll off the toes.
- Independent `Happy`, `Shy`, `Surprised`, `Blink` and `Sleepy` shape keys on the facial meshes. Fine brows are part of the face mesh and are carried by every shape key, so they raise in surprise, draw in when shy, soften with a smile and lower when sleepy.
- Looping `Idle`, `Walk`, `Run` and `Wave` skeletal actions. The studio plays and crossfades those exported clips. The forest drives the same bones from its distance-based pose controls, so gift collection, birthday poses, ladders, pause and restart keep their existing timing.
- Paw pads with little toe beans on the front paws, soles on the feet, a round plush tail, and a small embedded normal texture that suggests plush fabric. There are no strand hairs or cloth simulations.

**Dudu** is caramel with fur-coloured ears, a warm muzzle tone, orange cheeks, his blue-banded head tuft, the gift backpack and the little white-bear keepsake. 25,824 triangles, 10 materials, about 1.23 MB.

**Bubu** follows the user's Bubu reference frames: a large round head, small cocoa ears, low wide-set eyes, broad rose blush, cocoa mitten paws and feet, and a flat ribbon collar with a knot and two loops. 19,712 triangles, 7 materials, about 1.0 MB.

The `.blend` files are editable source and are not included in the deployment. `public/models/characters/dudu.glb` and `bubu.glb` each contain one browser model, its textures, skeleton and clips in a single file. `dudu.json` and `bubu.json` record build statistics. No account, Blender server or Blender browser plugin is needed to play.

## Rebuild

Use Blender 4.4 or newer; these assets were generated and checked with Blender 5.2.2 LTS.

```sh
npm run model:dudu
npm run model:bubu
npm run dev
# Open /character.html, /character.html?bear=bubu or /?dudu=blender
npm test
npm run test:character
GAME_URL='http://localhost:3000/?dudu=blender' node tests/emotions-game.browser.mjs
npm run build
```

Both bears are built by `scripts/bear_builder.py`, which holds the shared surfaces, rig, clips and export. `scripts/build-dudu.py` and `scripts/build-bubu.py` are the per-character sheets: a palette, a material **slot** map (which material the ears, paws, belly, brows and mouth use), a `shape` dictionary of proportions, and an `extras` function for that bear's accessories. To restyle a bear, edit its sheet rather than the shared builder. The `shape` values mirror `BEAR_FORMS` in `src/world.js`, so the code-built and Blender bears keep the same proportions.

**Rebuilding replaces the `.blend`, `.glb` and `.json` for that bear.** Save manual artistic edits under a different filename before running it again, or incorporate them into the sheet. Blender's `.blend1`/`.blend2` backups are ignored by Git.

For a manual GLB export, select the rig and its meshes, export skinning and shape keys, and use the Actions animation mode. Keep the bone names, shape-key names and rest pivots intact: `src/blender-dudu.js` uses them to connect either model to the game. Do not apply the armature modifier or flatten a model to a static mesh. Keep the clips independent of facial shape-key animation.

The browser checks cover asset loading, facial weights, actual leg movement, pause/resume, landscape touch controls and failed-download retry. `tests/blender-asset.test.js` checks both GLBs for the 13-bone rig with its ankles, the five shape keys, the four looping clips, normalised skin weights, the triangle and material budgets, and a download under 1.5 MB each. No changes are required to Vercel; Vite builds the studio as a third page and copies the public GLBs.

## Sheep — active in the forest

Open **`sheep.blend`** to edit the flock's new model. `scripts/build-sheep.py` constructs one continuous fleece surface with subtle curls, a grey velvet face, drooping ears, a moving jaw, and cloven hooves. It exports 15 deforming bones, a `Blink` shape key, and four looping clips: `Idle`, `Walk`, `Graze`, `Rest`.

The browser model has 16,744 triangles, five materials and an embedded 128 × 128 normal texture, with a total download of about 741 KB. `src/blender-sheep.js` loads it once, shares geometry and materials across the four sheep, and clones skeletons and facial weights for independent movement. Each instance blends clips according to the existing wildlife controller. Walking is sampled from actual distance travelled (.66 world units per cycle); idle/graze/rest use independent phase offsets. Conservative animated bounds retain frustum culling. The default sheep are retained as a fallback if loading fails.

Preview at **`/character.html?animal=sheep`**. The same page still offers the Dudu and Bubu studies through its navigation. Sheep automatically appear in the regular forest on desktop and mobile.

```sh
npm run model:sheep
npm test
npm run test:sheep
npm run build
```

Rebuilding replaces `sheep.blend`, `public/models/characters/sheep.glb` and `sheep.json`; keep manual artistic edits in a separate file or incorporate them into the builder. The source opens with `Idle` ready to play. For manual export, retain bone and clip names, skinning, the `Blink` key and Actions export mode. Only the GLB and metadata ship to the website.

`test:sheep -- --studio` checks the four clips, independent instances with shared resources, pause, reduced motion, waking and landscape touch controls. `test:sheep -- --forest` checks all four models in normal gameplay, roaming, pause, night/rest transitions and download failure fallback. Use `GAME_URL` to select a different local port.
