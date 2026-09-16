# Dudu — first Blender character

Open **`dudu.blend`** in Blender to edit the model, materials, armature, facial shape keys and animation actions. This is an original, script-built interpretation of the user's reel references, not an extracted character model or motion capture.

The first asset is Dudu only. Bubu and the wildlife retain their current models. Review Dudu at `/character.html`, or play the forest with `/?dudu=blender`. The regular forest URL keeps the established characters and does not request the GLB. A failed prototype download falls back to the current Dudu with a message when play begins.

## What is in the file

- 11 deforming bones, including separate shoulders and elbows. Smooth vertex weights bend each arm across the elbow.
- 28,688 triangles and 10 shared materials. A small embedded normal texture suggests plush fabric; there are no strand hairs or cloth simulations.
- Independent `Happy`, `Shy`, `Surprised` and `Blink` shape keys on the facial meshes.
- Looping `Idle` and `Walk` skeletal actions. The studio plays/crossfades those exported clips. The forest drives the same bones from its distance-based pose controls so gift collection, birthday poses, ladders, pause and restart keep their existing timing.
- A gift backpack and small white-bear keepsake. Collected gifts still attach to the game's backpack socket.

The `.blend` is editable source and is not included in the deployment. `public/models/characters/dudu.glb` contains the browser model, textures, skeleton and clips in a single file of about 1.25 MB. `dudu.json` records build statistics. No account, Blender server or Blender browser plugin is needed to play.

## Rebuild

Use Blender 4.4 or newer; this asset was generated and checked with Blender 5.2.2 LTS.

```sh
npm run model:dudu
npm run dev
# Open /character.html or /?dudu=blender
npm test
npm run test:character
GAME_URL='http://localhost:3000/?dudu=blender' node tests/emotions-game.browser.mjs
npm run build
```

The builder is `scripts/build-dudu.py`. **Rebuilding replaces `dudu.blend` and `dudu.glb`.** Save manual artistic edits under a different filename before running it again, or incorporate them into the builder. Blender's `.blend1`/`.blend2` backups are ignored by Git.

For a manual GLB export, select the rig and its meshes, export skinning and shape keys, and use the Actions animation mode. Keep the bone names, shape-key names and rest pivots intact: `src/blender-dudu.js` uses them to connect the model to the game. Do not apply the armature modifier or flatten the model to a static mesh. Keep `Idle` and `Walk` independent of facial shape-key animation.

The browser checks cover asset loading, facial weights, actual leg movement, pause/resume, landscape touch controls and failed-download retry. The regular emotion/game suite can also run against the Blender query URL. No changes are required to Vercel; Vite builds the studio as a third page and copies the public GLB.
