/* MediaPipe runs in a classic worker so its WASM loader can use importScripts.
   Only landmarks come back to the UI. No frames are transmitted over a network. */
let detector;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      importScripts('./tracking/vision_bundle.js');
      const files = await Vision.FilesetResolver.forVisionTasks(new URL('./tracking/wasm', self.location.href).href);
      detector = await Vision.HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./models/hand_landmarker.task', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: .6, minHandPresenceConfidence: .6, minTrackingConfidence: .6,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
  }
  if (data.type === 'frame') {
    try {
      const result = detector.detectForVideo(data.bitmap, data.time);
      self.postMessage({ type: 'result', landmarks: result.landmarks, handedness: result.handedness, time: data.time });
    } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
    finally { data.bitmap.close(); }
  }
};
