# Assembly — The engine lab

A browser-based, interactive single-cylinder engine study. Inspect eleven component groups, dismantle ten removable assemblies, rebuild the engine in reverse order, and watch a slow-motion four-stroke mechanism. Experimental webcam hand controls run locally on your device.

The model is custom geometry built with Three.js. It is a simplified educational model, not manufacturer CAD, a service procedure, or a combustion/thermal/torque simulation. Fasteners and some mechanisms are grouped; removal paths are illustrative and are not collision-validated mechanical extraction paths.

## Run locally

```sh
npm ci
npm run dev
```

Open **http://localhost:3000/engine.html**. The dev server uses port 3000 with strict port selection. Use a Node.js version compatible with Vite 6 (Node 18.19+ works locally; a supported Node 22 LTS release is a suitable hosting choice).

## Explore

- **Inspect / Assemble:** switch between free inspection and the guided assembly workbench.
- **Drag:** orbit. **Scroll / pinch:** zoom. **Right-drag / two-finger drag:** pan.
- **Click a component or its name:** select it and read its purpose/material.
- **Focus / Isolate:** frame a selected component or hide the others.
- **Front / Side / Top / Bottom / 3D:** inspect the engine from any direction. The ground hides when looking underneath.
- **Exploded view:** separate the components without changing the assembly progress.
- **Cutaway:** slice the outer housing and cylinder to expose the moving internals. This is an open section, not a capped CAD section.
- **Hologram:** switch to translucent surfaces and illuminated edges.
- **Run engine:** animate the fully assembled crankshaft, flywheel, piston, rod, and valves. Cutaway switches on automatically. Pause freezes the mechanism; speed adjusts the illustrative slow-motion cycle.
- **Arrow keys:** orbit. **+ / −:** zoom. **F:** fit. **Escape:** cancel a grab, close the camera panel, or leave isolation. Inputs and dialogs retain their native keyboard behavior.

Refresh starts a fresh, assembled engine. There is no saved progress or account. Desktop and tablet screens are supported; phones receive a lightweight notice without loading the renderer. Keep the window at least 768 CSS pixels wide. Touch devices need a screen with a short edge of at least 600 CSS pixels.

## Guided assembly

Choose **Assemble → Take apart**. The next component is marked in the list and has a dotted movement guide. Either use **Remove part**, or drag that component along its guide and release near the end. An incomplete drag returns to its starting position. When a movement axis faces directly into the camera, vertical dragging is used as a fallback.

Removal order:

1. Spark plug
2. Rocker cover and captive fasteners
3. Grouped valve train
4. Cylinder head
5. Cylinder barrel
6. Piston and wrist pin
7. Flywheel
8. Crankcase cover
9. Connecting rod
10. Crankshaft

The crankcase/base stays on the workbench. **Put together** reverses this order. Release a component near its mounting position to snap it back into place. **Undo** reverses a completed operation; **Restore all** reinstalls all components. The engine cannot run until all assemblies are installed. Exploded inspection does not count as dismantling.

## Webcam hand controls (experimental)

Choose **Try hand controls → Enable camera** and grant browser permission. Use HTTPS (the Vercel URL) or localhost. A plain HTTP LAN address will not provide browser camera access. Mouse and touch controls always remain available.

Start with an open hand. The orange cursor follows your index fingertip in a mirrored view.

- **Quick pinch and release:** click a button or select a component.
- **Hold a pinch and move:** orbit in Inspect, or drag the next eligible component along its guide in Assemble.
- **Pinch with both hands:** spread/close your hands to zoom. Open both hands before starting another action.
- **Pinch over a slider and move:** change its value.
- **Open hand near the top/bottom of the component list:** scroll the list.
- **Release:** stop controlling. Losing tracking cancels a grab, so it cannot accidentally complete an assembly operation.

The camera panel shows tracking state and a hand skeleton. Pause stops gesture actions while keeping the preview on; Stop camera, closing the panel, hiding the tab, or making the workspace unsupported releases the webcam. Camera-denied, missing-camera, initialization, and inference errors retain the normal controls and offer retry.

Use a current desktop Chrome browser for initial hand-control testing. Worker graphics support and camera permissions vary by browser/device; tablet hand tracking needs device testing. Good lighting, visible fingertips, and a plain background improve tracking. The webcam estimates hand landmarks, so precise depth and small-part control are intentionally constrained to the guided paths.

`@mediapipe/tasks-vision` is pinned in the lockfile. The Vite plugin serves/copies its JS and WASM runtime from the installed dependency. The Google hand-landmarker model is committed under `public/models/`. These assets are loaded **only when enabling the camera**. Inference runs in a web worker, with one frame in flight and a maximum capture rate of about 15 fps. No video frames are uploaded, and no remote inference service or API key is used.

Automated verification can exercise real model loading/inference with Chrome's synthetic camera and test gesture math with synthetic landmarks. A person still needs to verify comfort, accuracy, lighting, and latency using a physical webcam.

## Deploy to Vercel

The existing `vercel.json` configures a static Vite deployment:

| Setting | Value |
| --- | --- |
| Root directory | Repository root (`.`) |
| Framework | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | None |

Commit and push the changes, then import the repository in Vercel. The build includes the local model, worker, WASM runtime, fonts, and favicon. No server, database, camera streaming endpoint, or external CDN configuration is needed. Vercel provides HTTPS for camera access. The larger tracking assets are separate from the initial engine download.

## Verify

```sh
npm test
npm run build
npm run test:engine
npm run test:camera
```

For the additional drag, touch, error-handling, and production checks, keep a built preview running in another terminal (`npm run preview -- --port 4173`), then run `npm run test:engine:inputs`. Use `ENGINE_PREVIEW_URL` for a different preview address. `node tests/engine.browser.mjs --inputs --touch-only` skips the already-tested drag and camera-failure cases; `--production-only` checks just loading failures and the built deployment.

Start the dev server first for browser checks. They use `/usr/bin/google-chrome`; override `CHROME_PATH` or `ENGINE_URL` as needed. `node tests/engine.browser.mjs --preview` captures the initial workbench. Screenshots go to `test-results/`.

Engine unit tests cover removal/install ordering, undo/restore, animation gating, slider-crank geometry, pinch hysteresis, two-hand zoom transitions, and tracking loss. Browser checks cover scene loading, real pointer orbit, zoom, isolated underside inspection, explosion, animation/cutaway, hologram, full guided disassembly/reassembly, reset on refresh, and desktop/tablet/phone layouts. The camera option loads the real MediaPipe worker and processes synthetic webcam frames, then checks that all camera tracks stop on closing.

The engine entry point is `src/engine/boot.js`; its catalog, model, viewer, state, and camera/gesture modules live alongside it. The forest adventure is the homepage; the engine is a separate entry at `/engine.html`. Both pages are included in the Vercel build. Forest browser scripts test the homepage, and engine scripts default to `/engine.html`.

Fonts: locally hosted DM Sans, with its license in `public/fonts/`. Hand model source and documentation are recorded in `public/models/README.md`.
