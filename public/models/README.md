# Hand landmark model

`hand_landmarker.task` is Google's MediaPipe Hand Landmarker, float16, version 1.

Source: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

Documentation: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker

This model is requested only after the user enables camera controls. It runs locally in a web worker. Video frames are never sent to an external service. The pinned `@mediapipe/tasks-vision` dependency supplies the runtime and WASM loaders; the Vite plugin serves/copies these into `/tracking/` for development and deployment.
