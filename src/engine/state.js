import { REMOVABLE, clamp } from './catalog.js';

export function initialState() {
  return { mode: 'inspect', direction: 'remove', removed: [], selected: null, explode: 0, running: false, cutaway: false, hologram: false, isolated: false, labels: true, speed: 1, history: [] };
}
export function nextPart(state) {
  const index = state.direction === 'remove' ? state.removed.length : state.removed.length - 1;
  return REMOVABLE[index] ?? null;
}
export function stepPart(state, id = nextPart(state)?.id) {
  const next = nextPart(state);
  if (!next || id !== next.id || state.mode !== 'assemble') return false;
  state.history.push([...state.removed]);
  if (state.direction === 'remove') state.removed.push(next.id);
  else state.removed.pop();
  state.running = false;
  state.selected = next.id;
  state.isolated = false;
  return true;
}
export function undoStep(state) {
  if (!state.history.length) return false;
  state.removed = state.history.pop();
  state.running = false;
  return true;
}
export function setMode(state, mode) {
  state.mode = mode;
  state.running = false;
  state.explode = 0;
  state.isolated = false;
  if (mode === 'assemble') { state.selected = nextPart(state)?.id ?? null; state.cutaway = false; }
}
export function setExplosion(state, amount) {
  state.explode = clamp(Number(amount) || 0);
  state.running = false;
  state.isolated = false;
}
export function toggleRunning(state) {
  if (state.removed.length || state.mode !== 'inspect') return false;
  state.running = !state.running;
  if (state.running) { state.explode = 0; state.isolated = false; state.cutaway = true; }
  return true;
}
export function resetAssembly(state) {
  if (state.removed.length) state.history.push([...state.removed]);
  state.removed = [];
  state.explode = 0;
  state.running = false;
  state.isolated = false;
}
// Slider-crank kinematics. The rod's endpoints remain on the wrist and crank pins.
export function mechanismPose(angle, radius = .42, length = 1.2) {
  const x = radius * Math.sin(angle), y = radius * Math.cos(angle);
  return { crankX: x, crankY: y, pistonY: 1 + y + Math.sqrt(length * length - x * x), rodAngle: Math.asin(x / length) };
}
export function strokeAt(angle) {
  return ['Intake', 'Compression', 'Power', 'Exhaust'][Math.floor(((angle % (Math.PI * 4)) + Math.PI * 4) % (Math.PI * 4) / Math.PI)];
}
