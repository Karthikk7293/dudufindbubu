import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildEngine } from './model.js';
import { PARTS, partById, clamp } from './catalog.js';
import { nextPart } from './state.js';

export function createViewer(container, state) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .94;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .08, 120);
  camera.position.set(7.2, 5.5, 8.8);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.85, 0); controls.enableDamping = true; controls.dampingFactor = .09;
  controls.minDistance = 1.1; controls.maxDistance = 32; controls.minPolarAngle = .03; controls.maxPolarAngle = Math.PI - .03;
  controls.zoomSpeed = .75; controls.rotateSpeed = .65;
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x7c866d, 1.4));
  const key = new THREE.DirectionalLight(0xfff4dc, 2.7); key.position.set(-3, 8, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 10; key.shadow.camera.bottom = -6; key.shadow.normalBias = .02; key.shadow.bias = -.0001;
  key.shadow.radius = 4; scene.add(key);
  const rim = new THREE.DirectionalLight(0xe6f2ff, 1.8); rim.position.set(5, 3, -5); scene.add(rim);
  const engine = buildEngine(); scene.add(engine.root);
  const ground = new THREE.Group(); scene.add(ground);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: .14, color: 0x38452c }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.235; floor.receiveShadow = true; ground.add(floor);
  const grid = new THREE.GridHelper(26, 52, 0x8d9a7d, 0x9ca58c); grid.position.y = -.24;
  grid.material.transparent = true; grid.material.opacity = .09; ground.add(grid);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.02, 2.06, .07, 96), new THREE.MeshStandardMaterial({ color: 0xdadfcf, roughness: .88, metalness: .05 }));
  platform.position.y = -.19; platform.receiveShadow = true; ground.add(platform);
  const circle = new THREE.Mesh(new THREE.TorusGeometry(2.02, .012, 5, 128), new THREE.MeshBasicMaterial({ color: 0xb5c1a5, transparent: true, opacity: .6 }));
  circle.rotation.x = Math.PI / 2; circle.position.y = -.14; ground.add(circle);
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), .015);
  const guideMaterial = new THREE.LineDashedMaterial({ color: 0xdb6839, dashSize: .09, gapSize: .075, transparent: true, opacity: .75, depthTest: false });
  const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), guideMaterial);
  guide.renderOrder = 10; scene.add(guide);
  const raycaster = new THREE.Raycaster(), screen = new THREE.Vector2(), projected = new THREE.Vector3();
  const progress = new Map(PARTS.map(p => [p.id, 0]));
  let tween = null, drag = null, visible = true;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const meshes = [];
  engine.root.traverse(m => { if (m.isMesh) meshes.push(m); });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x8be4e1, transparent: true, opacity: .55 });
  for (const m of meshes) {
    m.geometry.computeBoundingBox();
    const size = m.geometry.boundingBox.getSize(new THREE.Vector3());
    if (Math.max(size.x, size.y, size.z) < .28) continue;
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 24), edgeMaterial);
    line.visible = false; line.userData.holo = true; m.add(line);
  }
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height); camera.aspect = width / height;
    camera.setViewOffset(width, height, -(state.mode === 'assemble' || state.selected ? .11 : .015) * width, height * .025, width, height);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  function amount(def) {
    if (def.fixed) return 0;
    if (drag?.id === def.id) return drag.amount;
    return state.removed.includes(def.id) ? 1 : state.explode;
  }
  function appearance() {
    const next = state.mode === 'assemble' ? nextPart(state)?.id : null;
    for (const def of PARTS) {
      const group = engine.parts.get(def.id), selected = def.id === state.selected || def.id === next;
      group.visible = (!state.isolated || state.selected === def.id) && !(state.cutaway && def.id === 'case-front' && !state.isolated);
      for (const m of group.userData.materials) {
        m.color.copy(m.userData.original.color);
        m.metalness = m.userData.original.metalness; m.roughness = m.userData.original.roughness;
        m.emissive.set(selected ? 0xcc6d22 : 0x000000); m.emissiveIntensity = selected ? .16 : 0;
        const clipped = state.cutaway && ['case', 'barrel', 'head', 'cover'].includes(def.id) && !state.isolated;
        m.clippingPlanes = clipped ? [cutPlane] : []; m.clipShadows = true;
        m.side = clipped || state.hologram ? THREE.DoubleSide : THREE.FrontSide;
        m.transparent = state.hologram; m.opacity = state.hologram ? .16 : 1; m.depthWrite = !state.hologram;
        if (state.hologram) { m.color.set(selected ? 0xffa573 : 0x79d9d5); m.emissive.copy(m.color); m.emissiveIntensity = .45; m.metalness = .1; }
        m.needsUpdate = true;
      }
      group.traverse(m => { if (m.userData.holo) m.visible = state.hologram && !state.cutaway; });
    }
    ground.visible = !state.isolated && camera.position.y > -.1;
    platform.material.color.set(state.hologram ? 0x1e4548 : 0xdadfcf);
    grid.material.color.set(state.hologram ? 0x72d8ca : 0x9ca58c);
    grid.material.opacity = state.hologram ? .13 : .09;
    resize();
  }
  function worldPoint(id, anchor = [0, 0, 0]) {
    engine.root.updateMatrixWorld(true);
    return engine.parts.get(id).localToWorld(new THREE.Vector3(...anchor));
  }
  function toScreen(point) {
    const rect = container.getBoundingClientRect();
    projected.copy(point).project(camera);
    return { x: (projected.x + 1) * rect.width / 2 + rect.left, y: (1 - projected.y) * rect.height / 2 + rect.top, visible: projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < .98 && Math.abs(projected.y) < .96 };
  }
  function pick(x, y) {
    const rect = container.getBoundingClientRect();
    screen.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(screen, camera);
    const hit = raycaster.intersectObjects(meshes, false).find(hit => {
      const def = partById(hit.object.userData.part);
      if (!engine.parts.get(def.id).visible) return false;
      return !hit.object.material.clippingPlanes.length || cutPlane.distanceToPoint(hit.point) >= 0;
    });
    return hit?.object.userData.part ?? null;
  }
  function bounds(id) {
    const box = new THREE.Box3();
    for (const def of PARTS) {
      if (id && id !== def.id) continue;
      const group = engine.parts.get(def.id);
      const localBox = new THREE.Box3().setFromObject(group);
      const current = group.position.clone();
      const target = new THREE.Vector3(...def.position).addScaledVector(new THREE.Vector3(...def.offset), amount(def));
      localBox.translate(target.sub(current)); box.union(localBox);
      if (!id && state.mode === 'assemble' && nextPart(state)?.id === def.id && state.direction === 'remove') {
        // The next removal endpoint must be reachable before a user starts dragging.
        box.union(localBox.clone().translate(new THREE.Vector3(...def.offset).multiplyScalar(1 - amount(def))));
      }
    }
    return box;
  }
  function flyTo(position, target) {
    controls.update();
    tween = { from: camera.position.clone(), fromTarget: controls.target.clone(), position, target, t: 0 };
    if (reducedMotion) { camera.position.copy(position); controls.target.copy(target); tween = null; controls.update(); }
  }
  function fit(id = state.isolated ? state.selected : null, view) {
    const box = bounds(id), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const directions = { perspective: new THREE.Vector3(1, .48, 1.22), front: new THREE.Vector3(0, .08, 1), side: new THREE.Vector3(1, .06, 0), top: new THREE.Vector3(0, 1, .001), bottom: new THREE.Vector3(0, -1, .001) };
    const direction = (directions[view] || camera.position.clone().sub(controls.target)).normalize();
    // Bounding sphere framing remains safe from every angle, including underneath.
    const radius = size.length() / 2;
    const limitingFov = Math.min(THREE.MathUtils.degToRad(camera.fov), 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    const distance = clamp(radius / Math.sin(limitingFov / 2) * (id ? 1.25 : 1.22), 2, 31);
    flyTo(center.clone().addScaledVector(direction, distance), center);
  }
  function orbit(dx, dy) {
    tween = null; controls.update();
    const offset = camera.position.clone().sub(controls.target), spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= dx * 5; spherical.phi = clamp(spherical.phi - dy * 5, .03, Math.PI - .03);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical)); controls.update();
  }
  function zoom(factor) {
    tween = null; controls.update();
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset); controls.update();
  }
  function beginDrag(id, x, y) {
    if (state.mode !== 'assemble' || nextPart(state)?.id !== id) return false;
    const def = partById(id), start = state.direction === 'remove' ? 0 : 1;
    const origin = new THREE.Vector3(...def.position), destination = origin.clone().add(new THREE.Vector3(...def.offset));
    const a = toScreen(origin), b = toScreen(destination);
    let dx = b.x - a.x, dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 40) { dx = 0; dy = -160; }
    drag = { id, x, y, dx, dy, start, amount: start };
    tween = null; controls.enabled = false; return true;
  }
  function moveDrag(x, y) {
    if (!drag) return;
    const shift = ((x - drag.x) * drag.dx + (y - drag.y) * drag.dy) / (drag.dx ** 2 + drag.dy ** 2);
    drag.amount = clamp(drag.start + shift);
  }
  function endDrag(cancel = false) {
    if (!drag) return null;
    const completed = !cancel && (drag.start === 0 ? drag.amount >= .72 : drag.amount <= .28);
    const id = completed ? drag.id : null; drag = null; controls.enabled = true; return id;
  }
  controls.addEventListener('start', () => { tween = null; });
  function render(dt, angle) {
    if (!visible) return;
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / .65); const ease = 1 - (1 - tween.t) ** 3;
      camera.position.lerpVectors(tween.from, tween.position, ease); controls.target.lerpVectors(tween.fromTarget, tween.target, ease);
      if (tween.t === 1) tween = null;
    }
    for (const def of PARTS) {
      const a = amount(def), last = progress.get(def.id);
      const value = reducedMotion || drag?.id === def.id ? a : THREE.MathUtils.damp(last, a, 9, dt);
      progress.set(def.id, value);
      const group = engine.parts.get(def.id);
      group.position.set(...def.position).addScaledVector(new THREE.Vector3(...def.offset), value);
      group.rotation.set(0, 0, 0);
    }
    engine.pose(state.explode === 0 && state.removed.length === 0 && !drag ? angle : 0);
    const next = state.mode === 'assemble' ? nextPart(state) : null;
    guide.visible = !!next && !state.isolated;
    if (next) {
      const a = new THREE.Vector3(...next.position), b = a.clone().add(new THREE.Vector3(...next.offset));
      const positions = guide.geometry.attributes.position;
      positions.setXYZ(0, a.x, a.y, a.z); positions.setXYZ(1, b.x, b.y, b.z); positions.needsUpdate = true; guide.computeLineDistances(); guide.geometry.computeBoundingSphere();
    }
    controls.update(); ground.visible = !state.isolated && camera.position.y > -.1;
    renderer.render(scene, camera);
  }
  appearance(); controls.update();
  return {
    renderer, camera, controls, engine, render, appearance, fit, zoom, orbit, pick, toScreen, worldPoint, beginDrag, moveDrag, endDrag,
    projectPart: id => toScreen(worldPoint(id, partById(id).anchor)),
    dragPath: id => { const def = partById(id); return { a: toScreen(new THREE.Vector3(...def.position)), b: toScreen(new THREE.Vector3(...def.position).add(new THREE.Vector3(...def.offset))) }; },
    isSettled: () => !tween && !drag && PARTS.every(p => Math.abs(progress.get(p.id) - amount(p)) < .001),
    dragSnapshot: () => drag ? { id: drag.id, amount: drag.amount, start: drag.start } : null,
    async warmup() { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); render(.016, 0); },
    setVisible(value) { visible = value; controls.enabled = value; if (value) resize(); else endDrag(true); },
    dispose() { observer.disconnect(); controls.dispose(); environment.dispose(); scene.traverse(o => { o.geometry?.dispose(); if (o.material) for (const m of [].concat(o.material)) m.dispose(); }); renderer.dispose(); },
  };
}
