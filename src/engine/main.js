import { PARTS, REMOVABLE, partById, clamp } from './catalog.js';
import { initialState, nextPart, stepPart, undoStep, setMode, setExplosion, toggleRunning, resetAssembly, strokeAt } from './state.js';
import { createViewer } from './viewer.js';
import { createHandCamera } from './camera.js';
import { icon, fillIcons } from './icons.js';

export async function createLab(progress) {
  const $ = id => document.getElementById(id);
  const state = initialState();
  let angle = 0, visible = true, pointer = null, handAction = null, toastTimer, frame, last = performance.now();
  fillIcons();
  $('parts-list').innerHTML = PARTS.map((p, i) => `<button class="part-row" data-part="${p.id}" aria-pressed="false" title="${p.name}${p.fixed ? ' · fixed foundation' : ''}"><span class="part-number">${String(i + 1).padStart(2, '0')}</span>${icon(p.id === 'plug' ? 'plus' : p.id === 'barrel' ? 'layers' : 'cube')}<span class="part-row-name">${p.name}</span><span class="part-state" aria-hidden="true"></span></button>`).join('');
  $('part-labels').innerHTML = PARTS.map((p, i) => `<button class="part-label" data-label="${p.id}" hidden><span>${String(i + 1).padStart(2, '0')}</span>${p.name}</button>`).join('');
  await progress(35, 'Machining the crankshaft, piston, and cylinder…');
  const viewer = createViewer($('viewport'), state), canvas = viewer.renderer.domElement;
  await progress(70, 'Setting the lights and preparing the materials…');

  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200); }
  function pressed(id, value) { $(id).setAttribute('aria-pressed', String(value)); }
  function sync() {
    const assembling = state.mode === 'assemble', next = nextPart(state), count = state.removed.length;
    pressed('inspect-mode', !assembling); pressed('assemble-mode', assembling);
    pressed('take-apart', state.direction === 'remove'); pressed('put-together', state.direction === 'install');
    for (const key of ['labels', 'cutaway', 'hologram']) pressed(`${key}-toggle`, state[key]);
    pressed('isolate-part', state.isolated); pressed('run-button', state.running);
    $('app').classList.toggle('hologram', state.hologram);
    $('stage').classList.toggle('assembly-mode', assembling);
    $('guide-panel').hidden = !assembling;
    $('part-card').hidden = !state.selected || assembling;
    $('scene-status').innerHTML = `<span class="live-dot"></span> ${state.isolated ? 'Component isolated' : state.running ? 'Cycle running · slow motion' : count ? `${count} of 10 assemblies removed` : state.explode ? 'Exploded inspection view' : 'Fully assembled'}`;
    $('run-button').innerHTML = `${icon(state.running ? 'pause' : 'play')}${state.running ? 'Pause engine' : 'Run engine'}`;
    $('run-button').disabled = assembling || count > 0;
    $('run-button').title = count ? 'Reassemble the engine before running it' : assembling ? 'Switch to Inspect to run the engine' : 'Animate the four-stroke cycle';
    $('explode-range').disabled = assembling; $('explode-button').disabled = assembling;
    $('explode-range').value = Math.round(state.explode * 100); $('explode-range').style.setProperty('--fill', `${state.explode * 100}%`);
    $('explode-value').value = `${Math.round(state.explode * 100)}%`;
    $('explode-button').setAttribute('aria-label', state.explode ? 'Collapse exploded view' : 'Fully explode engine');
    $('cycle-panel').hidden = !state.running;
    $('undo-button').disabled = !state.history.length;
    $('restore-button').disabled = !count;
    $('step-count').textContent = next ? `STEP ${String(state.direction === 'remove' ? count + 1 : 11 - count).padStart(2, '0')} / 10` : 'ALL STEPS COMPLETE';
    $('step-title').textContent = next ? `${state.direction === 'remove' ? 'Remove' : 'Install'} ${next.name.toLowerCase()}` : count === 10 ? 'Every part, understood.' : 'Whole again. Well done.';
    $('step-description').textContent = next ? state.direction === 'remove' ? next.instruction : `Return the ${next.name.toLowerCase()} along the dotted guide. Release near its seat to snap it into place.` : count === 10 ? 'You’ve reached the foundation. Choose Put together to rebuild the engine, one component at a time.' : 'The engine is fully assembled. Switch to Inspect and run it to see all the parts work together.';
    $('step-action').innerHTML = `${icon('arrow')}${state.direction === 'remove' ? 'Remove part' : 'Install part'}`; $('step-action').disabled = !next;
    $('step-progress').style.width = `${(state.direction === 'remove' ? count : 10 - count) * 10}%`;
    document.querySelectorAll('[data-part]').forEach(el => {
      el.setAttribute('aria-pressed', String(state.selected === el.dataset.part));
      el.dataset.removed = state.removed.includes(el.dataset.part);
      el.dataset.next = assembling && next?.id === el.dataset.part;
    });
    if (state.selected) {
      const part = partById(state.selected);
      $('part-name').textContent = part.name; $('part-material').textContent = part.material.toUpperCase(); $('part-description').textContent = part.description;
    }
    viewer.appearance();
  }
  function select(id) {
    if (!id) return;
    const wasIsolated = state.isolated;
    state.selected = id;
    if (state.mode === 'assemble' && id !== nextPart(state)?.id) {
      toast(partById(id).fixed ? 'The crankcase is the fixed foundation.' : `Next: ${nextPart(state)?.name ?? 'switch assembly direction to continue'}.`);
    }
    sync(); if (wasIsolated) viewer.fit(id);
  }
  function cancelDrag() { viewer.endDrag(true); pointer = null; handAction = null; }
  function commit(id = nextPart(state)?.id) {
    if (!stepPart(state, id)) return;
    angle = 0; sync(); viewer.fit();
    toast(`${partById(id).name} ${state.direction === 'remove' ? 'removed' : 'installed'}.`);
  }
  function mode(mode) { cancelDrag(); setMode(state, mode); angle = 0; sync(); viewer.fit(); }
  function explode(value) {
    const previous = state.explode;
    setExplosion(state, value); angle = 0; sync();
    // Reframe toward final part positions, rather than letting the parts leave the viewport.
    if (Math.abs(state.explode - previous) > .001) viewer.fit();
  }
  function reset() {
    cancelDrag(); Object.assign(state, initialState()); angle = 0;
    $('speed-range').value = 1; $('speed-value').value = '1×';
    document.querySelectorAll('[data-view]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.view === 'perspective')));
    sync(); viewer.fit(null, 'perspective'); toast('A fresh engine, ready to explore.');
  }
  $('inspect-mode').onclick = () => mode('inspect'); $('assemble-mode').onclick = () => mode('assemble');
  $('take-apart').onclick = () => { cancelDrag(); state.direction = 'remove'; state.selected = nextPart(state)?.id ?? null; sync(); };
  $('put-together').onclick = () => { cancelDrag(); state.direction = 'install'; state.selected = nextPart(state)?.id ?? null; sync(); };
  $('step-action').onclick = () => { cancelDrag(); commit(); };
  $('undo-button').onclick = () => { cancelDrag(); if (undoStep(state)) { sync(); viewer.fit(); toast('Assembly step undone.'); } };
  $('restore-button').onclick = () => { cancelDrag(); resetAssembly(state); angle = 0; sync(); viewer.fit(); };
  for (const key of ['labels', 'cutaway', 'hologram']) $(`${key}-toggle`).onclick = () => { state[key] = !state[key]; sync(); };
  $('close-part').onclick = () => { state.selected = null; state.isolated = false; sync(); };
  $('focus-part').onclick = () => { if (state.selected) viewer.fit(state.selected); };
  $('isolate-part').onclick = () => { state.isolated = !state.isolated; sync(); viewer.fit(); };
  $('zoom-in').onclick = () => viewer.zoom(.84); $('zoom-out').onclick = () => viewer.zoom(1 / .84);
  $('fit-view').onclick = () => viewer.fit(); $('reset-view').onclick = reset;
  $('explode-range').oninput = event => explode(Number(event.target.value) / 100);
  $('explode-button').onclick = () => explode(state.explode > .01 ? 0 : 1);
  $('run-button').onclick = () => { if (toggleRunning(state)) { sync(); viewer.fit(); } };
  $('speed-range').oninput = event => { state.speed = Number(event.target.value); $('speed-value').value = `${state.speed}×`; };
  $('fullscreen').onclick = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { toast('Fullscreen is unavailable in this browser. The workbench still fits your window.'); }
  };
  document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => {
    viewer.fit(state.isolated ? state.selected : null, button.dataset.view);
    document.querySelectorAll('[data-view]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
  }; });
  document.querySelectorAll('[data-part]').forEach(button => { button.onclick = () => select(button.dataset.part); });
  document.querySelectorAll('[data-label]').forEach(button => { button.onclick = () => select(button.dataset.label); });
  $('help-button').onclick = () => { cancelDrag(); $('help-dialog').showModal(); };
  $('help-close').onclick = $('help-done').onclick = () => $('help-dialog').close();
  $('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (pointer) { viewer.endDrag(true); pointer = null; return; }
    handAction = null;
    const id = viewer.pick(event.clientX, event.clientY);
    const dragging = viewer.beginDrag(id, event.clientX, event.clientY);
    pointer = { id, x: event.clientX, y: event.clientY, moved: false, dragging, pointerId: event.pointerId };
    if (dragging) { select(id); canvas.setPointerCapture(event.pointerId); event.stopImmediatePropagation(); }
  }, { capture: true });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) pointer.moved = true;
    if (pointer.dragging) { viewer.moveDrag(event.clientX, event.clientY); event.stopImmediatePropagation(); }
  }, { capture: true });
  canvas.addEventListener('pointerup', event => {
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const p = pointer; pointer = null;
    if (p.dragging) {
      const id = viewer.endDrag(); if (id) commit(id);
      else if (p.moved) toast('Move along the dotted guide, then release near the end.');
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      event.stopImmediatePropagation();
    } else if (!p.moved && p.id) select(p.id);
  }, { capture: true });
  canvas.addEventListener('pointercancel', cancelDrag);
  canvas.addEventListener('lostpointercapture', () => { if (pointer?.dragging) cancelDrag(); });
  window.addEventListener('blur', cancelDrag);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') { cancelDrag(); if (!$('camera-panel').hidden) closeCamera(); else if (state.isolated) { state.isolated = false; sync(); viewer.fit(); } return; }
    if (event.target.matches('input,textarea,select,button') || $('help-dialog').open || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '=', '-', 'f'].includes(key)) event.preventDefault();
    if (key === 'arrowleft') viewer.orbit(-.04, 0); if (key === 'arrowright') viewer.orbit(.04, 0);
    if (key === 'arrowup') viewer.orbit(0, -.04); if (key === 'arrowdown') viewer.orbit(0, .04);
    if (key === '+' || key === '=') viewer.zoom(.88); if (key === '-') viewer.zoom(1 / .88); if (key === 'f') viewer.fit();
  });

  function rangeAt(input, x) {
    const rect = input.getBoundingClientRect(), min = Number(input.min), max = Number(input.max), step = Number(input.step) || 1;
    input.value = min + Math.round(clamp((x - rect.left) / rect.width) * (max - min) / step) * step;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function gesture(event) {
    if (pointer || !visible) return;
    const cursor = $('hand-cursor');
    if (event.type === 'idle' || event.type === 'release-required') { cursor.hidden = true; return; }
    if (event.type === 'cancel') { viewer.endDrag(true); handAction = null; cursor.classList.remove('pinching'); return; }
    if (event.type === 'zoom') { if (!$('help-dialog').open) viewer.zoom(event.factor); cursor.hidden = true; return; }
    const x = event.x * innerWidth, y = event.y * innerHeight;
    if (event.type === 'pointer') {
      cursor.hidden = false; cursor.style.left = `${x}px`; cursor.style.top = `${y}px`; cursor.classList.toggle('pinching', event.pinched);
      // Open-hand edge scrolling keeps the entire component list reachable.
      const list = $('parts-list'), rect = list.getBoundingClientRect();
      if (!event.pinched && x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) {
        if (y < rect.top + 24) list.scrollTop -= 12;
        if (y > rect.bottom - 24) list.scrollTop += 12;
      }
      return;
    }
    if (event.type === 'start') {
      const target = document.elementFromPoint(x, y), button = target?.closest('button'), range = target?.closest('input[type=range]');
      if (button && !button.disabled) { handAction = { type: 'button', target: button, x, y, time: event.time }; return; }
      if (range && !range.disabled) { handAction = { type: 'range', target: range }; rangeAt(range, x); return; }
      if (target !== canvas || $('help-dialog').open) return;
      const id = viewer.pick(x, y);
      const dragging = viewer.beginDrag(id, x, y);
      if (id && state.mode === 'assemble') select(id);
      handAction = { type: dragging ? 'part' : 'orbit', id, x, y, time: event.time, moved: false };
    }
    if (event.type === 'move' && handAction) {
      const a = handAction;
      if (a.type === 'range') { rangeAt(a.target, x); return; }
      if (Math.hypot(x - a.x, y - a.y) > 12) a.moved = true;
      if (a.type === 'part') viewer.moveDrag(x, y);
      else if (a.type === 'orbit' && a.moved) viewer.orbit(event.dx, event.dy);
    }
    if (event.type === 'end' && handAction) {
      const a = handAction; handAction = null;
      if (a.type === 'part') { const id = viewer.endDrag(); if (id) commit(id); }
      else if (a.type === 'button' && Math.hypot(x - a.x, y - a.y) < 48 && event.time - a.time < 1500 && document.elementFromPoint(x, y)?.closest('button') === a.target) a.target.click();
      else if (a.type === 'orbit' && !a.moved && a.id) select(a.id);
    }
  }
  const handCamera = createHandCamera(gesture);
  function closeCamera() { handCamera.stop(); $('camera-panel').hidden = true; $('camera-toggle').setAttribute('aria-expanded', 'false'); $('hand-cursor').hidden = true; }
  $('camera-toggle').onclick = () => { if (!$('camera-panel').hidden) closeCamera(); else { $('camera-panel').hidden = false; $('camera-toggle').setAttribute('aria-expanded', 'true'); } };
  $('camera-close').onclick = closeCamera;

  function updateLabels() {
    const rect = $('stage').getBoundingClientRect(), used = [];
    const next = state.mode === 'assemble' ? nextPart(state)?.id : null;
    const defaults = state.explode > .3 || state.removed.length ? PARTS.map(p => p.id) : state.cutaway ? ['piston', 'crank', 'rockers'] : ['cover', 'barrel', 'case-front'];
    const order = [...new Set([next, state.selected, ...defaults].filter(Boolean))];
    const positions = new Map();
    for (const id of order) {
      const def = partById(id), point = viewer.projectPart(id), x = point.x - rect.left, y = point.y - rect.top;
      if (!state.labels || !point.visible || !viewer.engine.parts.get(id).visible || x < 15 || x > rect.width - 185 || y < 90 || y > rect.height - 150) continue;
      if ((state.mode === 'assemble' || state.selected) && x < (state.mode === 'assemble' ? 310 : 268) && y < (state.mode === 'assemble' ? 395 : 345)) continue;
      if (used.some(p => Math.abs(p.x - x) < 170 && Math.abs(p.y - y) < 33)) continue;
      used.push({ x, y }); positions.set(def.id, { x, y });
    }
    document.querySelectorAll('[data-label]').forEach(el => { const p = positions.get(el.dataset.label); el.hidden = !p; if (p) { el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; } });
  }
  await viewer.warmup();
  await progress(95, 'Putting the finishing touches on your workbench…');
  sync();
  function tick(now) {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(.06, (now - last) / 1000); last = now;
    if (!visible || document.hidden) return;
    if (state.running && !$('help-dialog').open) angle = (angle + dt * Math.PI * .7 * state.speed) % (Math.PI * 4);
    viewer.render(dt, angle); updateLabels();
    if (state.running) $('cycle-stroke').textContent = strokeAt(angle);
  }
  frame = requestAnimationFrame(tick);
  await progress(100, 'Ready to explore.');
  const snapshot = () => ({ mode: state.mode, direction: state.direction, removed: [...state.removed], selected: state.selected, next: nextPart(state)?.id ?? null, explode: state.explode, running: state.running, angle, cutaway: state.cutaway, hologram: state.hologram, isolated: state.isolated, labels: state.labels, camera: viewer.camera.position.toArray(), target: viewer.controls.target.toArray(), distance: viewer.camera.position.distanceTo(viewer.controls.target), hands: handCamera.snapshot(), parts: PARTS.map(p => ({ id: p.id, position: viewer.engine.parts.get(p.id).position.toArray(), visible: viewer.engine.parts.get(p.id).visible })) });
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') window.__engineLab = { snapshot, settled: () => viewer.isSettled(), drag: () => viewer.dragSnapshot(), project: id => viewer.projectPart(id), path: id => viewer.dragPath(id), pick: (x, y) => viewer.pick(x, y) };
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); });
  window.addEventListener('pageshow', event => { if (event.persisted) { last = performance.now(); frame = requestAnimationFrame(tick); } });
  return { setVisible(value) { visible = value; viewer.setVisible(value); if (!value) { cancelDrag(); $('hand-cursor').hidden = true; handCamera.stop('Camera stopped while the workspace is unavailable.'); } } };
}
