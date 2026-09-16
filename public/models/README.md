# Models

The separate `characters/dudu.glb` is our original Blender-built Dudu prototype. It loads only in `/character.html` or the forest's `?dudu=blender` preview. Editable source and workflow: [art/characters](../../art/characters/README.md).

`characters/sheep.glb` is the original Blender sheep used by the normal forest. All four instances share this one download, geometry and materials; skeletons and facial weights are independent. The editable model is `art/characters/sheep.blend`. Preview it at `/character.html?animal=sheep`.

## Hand landmark model

`hand_landmarker.task` is Google's MediaPipe Hand Landmarker, float16, version 1.

Source: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

Documentation: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker

This model is requested only after the user enables camera controls. It runs locally in a web worker. Video frames are never sent to an external service. The pinned `@mediapipe/tasks-vision` dependency supplies the runtime and WASM loaders; the Vite plugin serves/copies these into `/tracking/` for development and deployment.
