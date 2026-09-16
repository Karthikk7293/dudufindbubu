import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, REMOVABLE } from '../src/engine/catalog.js';
import { initialState, nextPart, stepPart, undoStep, setMode, setExplosion, toggleRunning, resetAssembly, mechanismPose, strokeAt } from '../src/engine/state.js';
import { GestureInterpreter, pinchRatio } from '../src/engine/gestures.js';

test('guided assembly enforces removal order and reverses it without losing parts', () => {
  const state = initialState();
  assert.equal(stepPart(state, 'plug'), false, 'Inspect mode cannot remove parts');
  setMode(state, 'assemble');
  assert.equal(stepPart(state, 'crank'), false, 'Crankshaft stays until accessible');
  assert.equal(stepPart(state, 'case'), false, 'Foundation stays on the bench');
  for (const part of REMOVABLE) { assert.equal(nextPart(state).id, part.id); assert.equal(stepPart(state), true); }
  assert.equal(nextPart(state), null); assert.equal(stepPart(state), false);
  assert.equal(state.removed.length, 10); assert.equal(new Set(state.removed).size, 10);
  state.direction = 'install';
  assert.equal(stepPart(state, 'plug'), false, 'Assembly follows the reverse removal order');
  for (const part of [...REMOVABLE].reverse()) { assert.equal(nextPart(state).id, part.id); assert.equal(stepPart(state), true); }
  assert.equal(nextPart(state), null); assert.deepEqual(state.removed, []);
  assert.equal(PARTS.length, 11);
});
test('undo and restore retain valid mechanical states; animation requires a complete engine', () => {
  const state = initialState(); setMode(state, 'assemble'); stepPart(state); stepPart(state);
  assert.equal(toggleRunning(state), false); undoStep(state); assert.deepEqual(state.removed, ['plug']);
  resetAssembly(state); assert.deepEqual(state.removed, []); undoStep(state); assert.deepEqual(state.removed, ['plug']);
  setMode(state, 'inspect'); assert.equal(toggleRunning(state), false);
  resetAssembly(state); assert.equal(toggleRunning(state), true); assert.equal(state.cutaway, true);
  setExplosion(state, 5); assert.equal(state.explode, 1); assert.equal(state.running, false); assert.deepEqual(state.removed, []);
  setExplosion(state, -5); assert.equal(state.explode, 0);
  assert.deepEqual(initialState().removed, [], 'Every session starts assembled');
});
test('piston and rod obey the slider-crank geometry throughout two revolutions', () => {
  for (let i = 0; i <= 720; i++) {
    const pose = mechanismPose(i / 180 * Math.PI);
    const length = Math.hypot(pose.crankX, pose.pistonY - (1 + pose.crankY));
    assert.ok(Math.abs(length - 1.2) < 1e-10, 'Rod length remains constant');
    assert.ok(Math.abs(pose.crankX - Math.sin(pose.rodAngle) * 1.2) < 1e-10, 'Wrist pin stays on cylinder axis');
  }
  assert.ok(Math.abs(mechanismPose(0).pistonY - mechanismPose(Math.PI).pistonY - .84) < 1e-10);
  assert.deepEqual([.1, 1.1, 2.1, 3.1].map(p => strokeAt(p * Math.PI)), ['Intake','Compression','Power','Exhaust']);
});
function hand({ x = .5, pinch = false } = {}) {
  const h = Array.from({ length: 21 }, () => ({ x, y: .5, z: 0 }));
  h[0] = { x, y: .75, z: 0 }; h[9] = { x, y: .5, z: 0 };
  h[8] = { x, y: .3, z: 0 }; h[4] = { x: x + (pinch ? .025 : .14), y: .3, z: 0 };
  return h;
}
test('gestures require release, suppress jitter, and cancel rather than commit when tracking is lost', () => {
  const events = [], g = new GestureInterpreter(event => events.push(event));
  g.update([hand({ pinch: true })], 0); assert.ok(!events.some(e => e.type === 'start'));
  g.update([hand()], 60); g.update([hand({ pinch: true })], 120); assert.equal(events.filter(e => e.type === 'start').length, 1);
  const noisy = hand({ pinch: true }); noisy[4].x += .04;
  assert.ok(pinchRatio(noisy) > .3 && pinchRatio(noisy) < .48);
  g.update([noisy], 180); assert.ok(!events.some(e => e.type === 'end'), 'Hysteresis keeps a slightly noisy pinch held');
  g.update([], 240); assert.ok(events.some(e => e.type === 'cancel')); assert.ok(!events.some(e => e.type === 'end'));
  g.update([hand({ pinch: true })], 300); assert.equal(events.filter(e => e.type === 'start').length, 1);
  g.update([hand()], 360); g.update([hand({ pinch: true })], 420); g.update([hand()], 480);
  assert.equal(events.filter(e => e.type === 'end').length, 1);
});
test('two-hand zoom cancels a single grab and requires a release before a new action', () => {
  const events = [], g = new GestureInterpreter(event => events.push(event));
  g.update([hand({ x: .4 })], 0); g.update([hand({ x: .4, pinch: true })], 60);
  g.update([hand({ x: .4, pinch: true }), hand({ x: .7, pinch: true })], 120);
  g.update([hand({ x: .35, pinch: true }), hand({ x: .75, pinch: true })], 180);
  assert.ok(events.some(e => e.type === 'cancel'));
  assert.ok(events.some(e => e.type === 'zoom' && e.factor < 1));
  const starts = events.filter(e => e.type === 'start').length;
  g.update([hand({ x: .35, pinch: true })], 240); g.update([hand({ x: .35, pinch: true })], 300);
  assert.equal(events.filter(e => e.type === 'start').length, starts);
});
