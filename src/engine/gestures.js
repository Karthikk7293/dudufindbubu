import { clamp } from './catalog.js';

const distance = (a, b) => Math.hypot((a.x - b.x) * 4 / 3, a.y - b.y);
export function pinchRatio(hand) {
  return distance(hand[4], hand[8]) / Math.max(.015, distance(hand[0], hand[9]));
}
export function handPointer(hand) {
  return { x: clamp((1 - hand[8].x - .12) / .76), y: clamp((hand[8].y - .12) / .76) };
}

// Hysteresis avoids tiny detection changes alternating grab/release. Tracking
// loss cancels a grab and requires an open hand before another can begin.
export class GestureInterpreter {
  constructor(emit) { this.emit = emit; this.reset(); }
  reset() {
    this.pointer = null; this.active = false; this.twoHandDistance = null;
    this.requireRelease = true; this.previousHand = null; this.lastTime = null;
  }
  cancel() { if (this.active) this.emit({ type: 'cancel' }); this.reset(); }
  update(hands, time) {
    if (!hands?.length) { this.cancel(); this.emit({ type: 'idle' }); return; }
    if (this.lastTime !== null && time - this.lastTime > 400) this.cancel();
    this.lastTime = time;
    let hand = hands[0];
    if (this.previousHand) hand = [...hands].sort((a, b) => distance(a[0], this.previousHand) - distance(b[0], this.previousHand))[0];
    if (this.previousHand && distance(hand[0], this.previousHand) > .28) this.cancel();
    this.previousHand = hand[0];
    const pinched = pinchRatio(hand) < (this.active ? .48 : .30);
    const both = hands.length === 2 && hands.every(h => pinchRatio(h) < .38);
    if (this.requireRelease) {
      if (hands.every(h => pinchRatio(h) > .48)) this.requireRelease = false;
      else { this.emit({ type: 'release-required' }); return; }
    }
    if (both) {
      if (this.active) { this.emit({ type: 'cancel' }); this.active = false; }
      const d = distance(hands[0][0], hands[1][0]);
      if (this.twoHandDistance && d > .08) this.emit({ type: 'zoom', factor: clamp(this.twoHandDistance / d, .88, 1.12) });
      this.twoHandDistance = Math.max(.08, d);
      return;
    }
    if (this.twoHandDistance !== null) {
      this.twoHandDistance = null; this.requireRelease = true; this.pointer = null; return;
    }
    const raw = handPointer(hand);
    const previous = this.pointer ?? raw;
    this.pointer = { x: previous.x + (raw.x - previous.x) * .55, y: previous.y + (raw.y - previous.y) * .55 };
    const point = this.pointer;
    this.emit({ type: 'pointer', ...point, pinched });
    if (pinched && !this.active) {
      this.active = true; this.emit({ type: 'start', ...point, time });
    } else if (pinched) {
      this.emit({ type: 'move', ...point, dx: clamp(point.x - previous.x, -.08, .08), dy: clamp(point.y - previous.y, -.08, .08), time });
    } else if (this.active) {
      this.active = false; this.emit({ type: 'end', ...point, time });
    }
  }
}
