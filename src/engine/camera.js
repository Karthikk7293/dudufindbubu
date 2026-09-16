import { GestureInterpreter } from './gestures.js';
import { icon } from './icons.js';

const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
export function createHandCamera(onGesture) {
  const $ = id => document.getElementById(id), video = $('camera-video');
  const canvas = $('camera-overlay'), ctx = canvas.getContext('2d');
  let stream = null, worker = null, generation = 0, starting = false, ready = false, pending = false, paused = false;
  let timer = null, inferenceTimeout = null, lastFrame = -1, frames = 0;
  const setStatus = value => { if ($('camera-status').textContent !== value) $('camera-status').textContent = value; };
  const interpreter = new GestureInterpreter(event => {
    if (event.type === 'idle') setStatus('No hands in view. Raise an open hand to begin.');
    else if (event.type === 'release-required') setStatus('Open your hand to release, then pinch to begin.');
    else if (event.type === 'zoom') setStatus('Two-hand zoom · move your hands apart or together.');
    else if (event.type === 'pointer') setStatus(event.pinched ? 'Pinch held · move to control. Release to stop.' : 'Tracking · aim with your index finger. Pinch to interact.');
    onGesture(event);
  });
  function draw(hands) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2; ctx.strokeStyle = '#c5efb2'; ctx.fillStyle = '#e57b46';
    for (const hand of hands) {
      for (const [a, b] of CONNECTIONS) { ctx.beginPath(); ctx.moveTo(hand[a].x * canvas.width, hand[a].y * canvas.height); ctx.lineTo(hand[b].x * canvas.width, hand[b].y * canvas.height); ctx.stroke(); }
      for (const p of hand) { ctx.beginPath(); ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  function stop(message = 'Camera stopped. You can keep exploring with mouse or touch.') {
    generation++; starting = false; ready = false; pending = false; paused = false;
    clearTimeout(timer); clearTimeout(inferenceTimeout); timer = null;
    interpreter.cancel(); onGesture({ type: 'idle' });
    worker?.terminate(); worker = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.pause(); video.srcObject = null; ctx.clearRect(0, 0, canvas.width, canvas.height);
    $('camera-placeholder').hidden = false; $('camera-badge').textContent = 'CAMERA OFF';
    $('enable-camera').disabled = false; $('enable-camera').innerHTML = `${icon('camera')} Enable camera`;
    $('pause-camera').hidden = true; $('pause-camera').textContent = 'Pause hand controls'; setStatus(message);
  }
  async function pump(session) {
    if (generation !== session || !ready) return;
    if (!pending && !paused && !document.hidden && video.readyState >= 2 && video.currentTime !== lastFrame) {
      pending = true; lastFrame = video.currentTime;
      try {
        const bitmap = await createImageBitmap(video);
        if (generation !== session || !worker) { bitmap.close(); return; }
        worker.postMessage({ type: 'frame', bitmap, time: performance.now() }, [bitmap]);
        inferenceTimeout = setTimeout(() => { if (generation === session) stop('Hand tracking stopped responding. Try enabling the camera again.'); }, 12000);
      } catch { if (generation === session) stop('This browser could not read camera frames. Try a current desktop Chrome browser.'); }
    }
    if (generation === session) timer = setTimeout(() => pump(session), 66);
  }
  async function start() {
    if (ready || starting) { stop(); return; }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setStatus('Camera access needs HTTPS or localhost. Open the secure Vercel URL, or use localhost on this computer.'); return; }
    if (!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) { setStatus('Hand tracking needs a browser with camera and worker graphics support. Try current desktop Chrome.'); return; }
    const session = ++generation; starting = true; frames = 0;
    $('enable-camera').disabled = true; $('enable-camera').textContent = 'Waiting for camera…';
    setStatus('Allow camera access in your browser. Your video stays on this device.');
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } } });
      if (session !== generation) { nextStream.getTracks().forEach(t => t.stop()); return; }
      stream = nextStream;
      for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => { if (session === generation) stop('Camera access ended. Enable it again to resume hand controls.'); });
      video.srcObject = stream; await video.play();
      if (session !== generation) return;
      $('camera-placeholder').hidden = true; $('camera-badge').textContent = 'LOADING TRACKER';
      $('enable-camera').textContent = 'Loading hand tracking…'; setStatus('Loading the hand model. The first load may take a moment.');
      worker = new Worker('/tracking-worker.js');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('tracker-timeout')), 45000);
        worker.onerror = event => { clearTimeout(timeout); reject(new Error(event.message)); };
        worker.onmessage = ({ data }) => {
          if (data.type === 'ready') { clearTimeout(timeout); resolve(); }
          else if (data.type === 'error') { clearTimeout(timeout); reject(new Error(data.message)); }
        };
        worker.postMessage({ type: 'init' });
      });
      if (session !== generation) return;
      worker.onerror = () => stop('Hand tracking could not continue. Restart the camera or use mouse controls.');
      worker.onmessage = ({ data }) => {
        if (session !== generation) return;
        clearTimeout(inferenceTimeout); pending = false;
        if (data.type === 'error') { stop('Hand tracking could not process this camera. Try restarting it in desktop Chrome.'); return; }
        if (data.type !== 'result') return;
        frames++; draw(data.landmarks);
        if (!paused && !document.hidden) interpreter.update(data.landmarks, data.time);
      };
      starting = false; ready = true; lastFrame = -1;
      $('camera-badge').textContent = 'ON-DEVICE · LIVE'; $('enable-camera').disabled = false;
      $('enable-camera').innerHTML = `${icon('camera')} Stop camera`; $('pause-camera').hidden = false;
      setStatus('Raise an open hand to begin. Pinch to interact.'); pump(session);
    } catch (error) {
      if (session !== generation) return;
      const messages = { NotAllowedError: 'Camera permission was denied. Allow camera access in your browser settings, then try again.', NotFoundError: 'No camera was found. Connect a webcam, then try again.', NotReadableError: 'The camera is unavailable. Close other apps using it, then try again.' };
      stop(messages[error.name] || 'Hand tracking could not load. Check your connection and try again in a current desktop browser.');
    }
  }
  $('enable-camera').addEventListener('click', start);
  $('pause-camera').addEventListener('click', () => {
    paused = !paused; interpreter.cancel(); onGesture({ type: 'idle' });
    $('pause-camera').textContent = paused ? 'Resume hand controls' : 'Pause hand controls';
    $('camera-badge').textContent = paused ? 'CONTROLS PAUSED' : 'ON-DEVICE · LIVE';
    setStatus(paused ? 'Hand controls paused. Camera is still on; stop it to turn it off.' : 'Raise an open hand to resume.');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (ready || starting)) stop('Camera stopped while the tab was hidden. Enable it to resume.'); });
  window.addEventListener('pagehide', () => stop());
  return { start, stop, snapshot: () => ({ ready, starting, paused, frames, tracks: stream?.getTracks().filter(t => t.readyState === 'live').length ?? 0 }) };
}
