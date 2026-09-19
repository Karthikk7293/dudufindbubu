import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadDuduModel, poseDuduFace } from './blender-dudu.js';
import { BearExpression } from './bear-expression.js';

const $ = id => document.getElementById(id), stage = $('stage');
const params = new URLSearchParams(location.search);
const sheep = params.get('animal') === 'sheep';
const bear = params.get('bear') === 'bubu' ? 'bubu' : 'dudu';
const characterName = sheep ? 'The sheep' : bear === 'bubu' ? 'Bubu' : 'Dudu';
document.querySelector(`[data-subject="${sheep ? 'sheep' : bear}"]`)?.setAttribute('aria-current', 'page');
if (!sheep && bear === 'bubu') {
  document.title = 'Bubu · Character workshop';
  document.querySelector('h1').textContent = 'Meet Bubu';
  stage.setAttribute('aria-label', 'Interactive 3D preview of Bubu');
  document.querySelector('.note').textContent = 'A big round head, a ribbon at her neck, and her brightest everyday smile.';
}
if (sheep) {
  document.title = 'Sheep · Character workshop';
  document.querySelector('h1').textContent = 'Meet the sheep';
  document.querySelector('.forest-link').href = '/';
  stage.setAttribute('aria-label', 'Interactive 3D preview of the forest sheep');
  $('expression-label').parentElement.hidden = true;
  document.querySelector('.note').textContent = 'Soft fleece, sleepy eyes, and quiet mornings in the meadow.';
  const buttons = document.querySelector('[aria-labelledby="movement-label"]');
  for (const name of ['Graze', 'Rest']) {
    const button = document.createElement('button');button.dataset.clip = name;
    button.textContent = name;button.setAttribute('aria-pressed', 'false');buttons.appendChild(button);
  }
}
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let asset, mixer, active, renderer, orbit, clock = 0, paused = false, lastTime = 0;
let mood = 'calm', clip = 'Idle', distance = 0;
const expression = new BearExpression();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeee9df);
const camera = new THREE.PerspectiveCamera(32, 1, .05, 50);
scene.add(new THREE.HemisphereLight(0xfff5e3, 0xada78e, 2.2));
const key = new THREE.DirectionalLight(0xffecd8, 3);
key.position.set(-3, 5, 4);scene.add(key);
const fill = new THREE.DirectionalLight(0xf4f7ff, 1.5);
fill.position.set(3, 3, -3);scene.add(fill);
const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: 0xeee9df, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;ground.position.y = -.01;scene.add(ground);
// A soft contact shadow avoids an extra shadow pass on phones.
const canvas = document.createElement('canvas');canvas.width = canvas.height = 128;
const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
gradient.addColorStop(0, '#50482c55');gradient.addColorStop(1, '#50482c00');ctx.fillStyle = gradient;ctx.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 1.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;shadow.position.y = 0;scene.add(shadow);

function resetCamera() {
  camera.position.set(2.3, sheep ? 1.3 : 1.5, sheep ? 3.7 : 5.4);
  orbit.target.set(0, sheep ? .6 : .9, 0);orbit.update();
}
function resize() {
  const { width, height } = stage.getBoundingClientRect();
  camera.aspect = width / Math.max(1, height);camera.updateProjectionMatrix();
  renderer.setSize(width, Math.max(1, height));
}
function chooseClip(name) {
  clip = name;
  if (!sheep) {
    const next = mixer.clipAction(asset.animations.find(a => a.name === name));
    if (next !== active) { next.reset().fadeIn(.25).play();active?.fadeOut(.25);active = next; }
  }
  document.querySelectorAll('[data-clip]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.clip === name)));
}
function render(now) {
  requestAnimationFrame(render);
  const dt = document.hidden || paused ? 0 : Math.min(.05, (now - (lastTime || now)) / 1000);lastTime = now;
  clock += dt;
  if (asset) {
    if (sheep) {
      const speed = clip === 'Walk' ? .42 : 0;distance += speed * dt;
      asset.update(dt, clock, { mode: clip === 'Rest' ? 'sleep' : clip.toLowerCase(), speed, distance }, reduced.matches);
    } else {
      // Reduced motion still allows an explicitly requested walking preview.
      mixer.update(reduced.matches && clip === 'Idle' ? 0 : dt);
      expression.update(dt, { mood }, reduced.matches);
      poseDuduFace(asset, expression.values, clock, reduced.matches);
    }
  }
  orbit.update();renderer.render(scene, camera);
}
async function load() {
  $('loading').hidden = false;$('retry').hidden = true;
  $('load-label').textContent = sheep ? 'Fluffing the sheep’s wool…' : `Getting ${characterName} ready…`;
  try {
    const progress = event => {
      if (event.total) { $('load-progress').max = event.total;$('load-progress').value = event.loaded; }
    };
    if (sheep) {
      const { SheepModel, loadSheepTemplate } = await import('./blender-sheep.js');
      asset = new SheepModel(await loadSheepTemplate(progress));
    } else asset = await loadDuduModel(progress, bear);
    asset.scene.scale.setScalar(sheep ? .82 : bear === 'bubu' ? .66 : .68);scene.add(asset.scene);
    mixer = sheep ? asset.mixer : new THREE.AnimationMixer(asset.scene);chooseClip('Idle');
    $('controls').disabled = false;$('reset-camera').disabled = false;$('loading').hidden = true;
    if (import.meta.env.DEV) window.__duduStudio = {
      snapshot: () => ({ ready: true, animal: sheep ? 'sheep' : bear, mood, clip, paused, time: clock, triangles: asset.triangles,
        bones: asset.bones.size, clips: asset.animations.map(a => a.name),
        weights: asset.faces.map(mesh => ({ name: mesh.name, keys: mesh.morphTargetDictionary, values: [...mesh.morphTargetInfluences] })),
        leg: asset.bones.get(sheep ? 'Leg_Front_L' : 'Leg_L').quaternion.toArray(),
        neck: asset.bones.get('Neck')?.quaternion.toArray(), drawCalls: renderer.info.render.calls }),
      front: () => { camera.position.set(0, sheep ? .95 : 1.3, sheep ? 4 : 5.3);orbit.target.set(0, sheep ? .6 : .87, 0);orbit.update(); },
    };
  } catch (error) {
    console.error(error);$('load-label').textContent = `${characterName} couldn’t load. Check your connection and try again.`;
    $('retry').hidden = false;
  }
}
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = 1.15;
  stage.prepend(renderer.domElement);
  orbit = new OrbitControls(camera, renderer.domElement);orbit.enableDamping = !reduced.matches;
  orbit.minDistance = 2.4;orbit.maxDistance = 8;orbit.minPolarAngle = .4;orbit.maxPolarAngle = Math.PI / 2;
  orbit.enablePan = false;resetCamera();resize();new ResizeObserver(resize).observe(stage);
  $('reset-camera').addEventListener('click', resetCamera);
  $('retry').addEventListener('click', load);
  $('pause').addEventListener('click', () => {
    paused = !paused;$('pause').textContent = paused ? 'Resume' : 'Pause';$('pause').setAttribute('aria-pressed', String(paused));
  });
  document.querySelectorAll('[data-clip]').forEach(button => button.addEventListener('click', () => chooseClip(button.dataset.clip)));
  document.querySelectorAll('[data-mood]').forEach(button => button.addEventListener('click', () => {
    mood = button.dataset.mood;
    document.querySelectorAll('[data-mood]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    // Deliberate selections remain usable while the movement is paused.
    if (paused) expression.update(1, { mood }, true);
  }));
  requestAnimationFrame(render);load();
} catch (error) {
  console.error(error);$('load-label').textContent = 'This preview needs WebGL. Please enable hardware acceleration or try another browser.';
}
