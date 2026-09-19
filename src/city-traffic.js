// A small grid road network with right-hand lanes, signalled crossroads and
// cars that follow them. Pure geometry and state, so the rules can be tested
// without a renderer: lanes are derived from the same grid the roads are drawn
// from, which is what keeps traffic out of the buildings between them.
const APPROACH = 9, COMMIT = 4.4, GAP = 11, CAR = 4.6, ACCEL = 3.8, BRAKE = 9;

export class RoadNetwork {
  constructor(xs, zs, lane = 1.6) {
    this.xs = xs;this.zs = zs;this.lane = lane;this.nodes = [];
    for (let i = 0; i < xs.length; i++) for (let j = 0; j < zs.length; j++)
      this.nodes.push({ id: `${i},${j}`, i, j, x: xs[i], z: zs[j] });
    this.edges = [];
    for (const from of this.nodes) for (const to of this.nodes) {
      const straightX = from.j === to.j && Math.abs(from.i - to.i) === 1;
      const straightZ = from.i === to.i && Math.abs(from.j - to.j) === 1;
      if (!straightX && !straightZ) continue;
      const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz);
      this.edges.push({ from, to, dx: dx / length, dz: dz / length, length, axis: straightX ? 'ew' : 'ns' });
    }
    this.out = new Map();
    for (const edge of this.edges) {
      if (!this.out.has(edge.from.id)) this.out.set(edge.from.id, []);
      this.out.get(edge.from.id).push(edge);
    }
  }
  exits(edge) { return this.out.get(edge.to.id) || []; }
  edgeAt(i1, j1, i2, j2) { return this.edges.find(e => e.from.i === i1 && e.from.j === j1 && e.to.i === i2 && e.to.j === j2); }
  // Only a full crossroads carries signals; the ring corners are give-way.
  signalled(node) { return (this.out.get(node.id) || []).length >= 4; }
  heading(edge) { return Math.atan2(edge.dx, edge.dz); }
  // Traffic keeps to the right of the centre line it is travelling along.
  point(edge, distance) {
    const t = Math.max(0, Math.min(edge.length, distance));
    return { x: edge.from.x + edge.dx * t + edge.dz * this.lane, z: edge.from.z + edge.dz * t - edge.dx * this.lane };
  }
}

// North-south runs, then everything holds, then east-west, then holds again.
export class TrafficLights {
  constructor(green = 9, amber = 2.4) { this.green = green;this.amber = amber;this.time = 0; }
  get cycle() { return (this.green + this.amber) * 2; }
  update(dt) { if (dt > 0) this.time = (this.time + dt) % this.cycle; }
  isGreen(axis) {
    const { time, green, amber } = this;
    return axis === 'ns' ? time < green : time >= green + amber && time < green * 2 + amber;
  }
  isAmber(axis) {
    const { time, green, amber } = this;
    return axis === 'ns' ? time >= green && time < green + amber : time >= green * 2 + amber;
  }
}

export class Vehicle {
  constructor(network, edge, { speed = 6.5, seed = 1, start = 0 } = {}) {
    this.network = network;this.edge = edge;this.t = start;this.speed = speed;this.maxSpeed = speed;
    this.seed = (seed >>> 0) || 1;this.heading = network.heading(edge);this.stopped = false;this.steer = 0;
    const at = network.point(edge, this.t);this.x = at.x;this.z = at.z;
  }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;return this.seed / 4294967296; }
  // Straight on where possible, otherwise a turn, and occasionally a U-turn.
  chooseNext() {
    const exits = this.network.exits(this.edge);
    if (!exits.length) return;
    const ahead = exits.find(e => e.dx === this.edge.dx && e.dz === this.edge.dz);
    const back = exits.find(e => e.dx === -this.edge.dx && e.dz === -this.edge.dz);
    const turns = exits.filter(e => e !== ahead && e !== back);
    const roll = this.random();
    if (ahead && roll < .62) this.edge = ahead;
    else if (turns.length && roll < .95) this.edge = turns[Math.min(turns.length - 1, Math.floor(this.random() * turns.length))];
    else this.edge = back || ahead || turns[0];
  }
  update(dt, lights, traffic = [], avoid = null) {
    if (!(dt > 0)) return;
    const remaining = this.edge.length - this.t;
    let target = this.maxSpeed;
    // Hold at the stop line until the signal turns; once committed, carry on.
    if (this.network.signalled(this.edge.to) && remaining < APPROACH && remaining > COMMIT && !lights.isGreen(this.edge.axis)) target = 0;
    for (const other of traffic) {
      if (other === this || other.edge !== this.edge) continue;
      const gap = other.t - this.t;
      if (gap > 0 && gap < GAP) target = Math.min(target, Math.max(0, (gap - CAR) * 1.2));
    }
    // Someone on the crossing is always reason enough to wait.
    if (avoid) {
      const forward = Math.sin(this.heading), side = Math.cos(this.heading);
      const along = (avoid.x - this.x) * forward + (avoid.z - this.z) * side;
      const across = Math.abs((avoid.x - this.x) * side - (avoid.z - this.z) * forward);
      if (along > 0 && along < 7.5 && across < 2.4) target = 0;
    }
    this.speed = Math.max(0, this.speed + Math.max(-BRAKE * dt, Math.min(ACCEL * dt, target - this.speed)));
    this.stopped = this.speed < .15;
    this.t += this.speed * dt;
    for (let guard = 0; this.t >= this.edge.length && guard < 4; guard++) { this.t -= this.edge.length;this.chooseNext(); }
    const at = this.network.point(this.edge, this.t), want = this.network.heading(this.edge);
    // Easing the drawn pose into the new lane rounds each corner off.
    const ease = 1 - Math.exp(-dt * 3.4), turn = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.steer = Math.max(-.6, Math.min(.6, turn * 1.6));
    this.heading += turn * ease;
    this.x += (at.x - this.x) * ease;this.z += (at.z - this.z) * ease;
  }
}
