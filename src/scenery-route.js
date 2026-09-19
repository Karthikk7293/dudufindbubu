// A route for scenery that travels: a cart down a village lane, boats across a
// bay, a cable car between two pylons. Control points are smoothed into a dense
// polyline, so a route can be sampled and checked against the scenery it has to
// keep clear of, without a renderer.
const spline = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return .5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
};

export class Route {
  constructor(points, { loop = true, steps = 14 } = {}) {
    this.loop = loop;
    const count = points.length;
    const at = index => points[loop ? ((index % count) + count) % count : Math.max(0, Math.min(count - 1, index))];
    const dense = [];
    for (let i = 0; i < (loop ? count : count - 1); i++) for (let step = 0; step < steps; step++) {
      const t = step / steps, a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
      dense.push({ x: spline(a[0], b[0], c[0], d[0], t), z: spline(a[1], b[1], c[1], d[1], t) });
    }
    if (!loop) dense.push({ x: points[count - 1][0], z: points[count - 1][1] });
    this.points = dense;this.spans = [];
    let total = 0;
    for (let i = 0; i < dense.length - (loop ? 0 : 1); i++) {
      const a = dense[i], b = dense[(i + 1) % dense.length], length = Math.hypot(b.x - a.x, b.z - a.z);
      this.spans.push({ a, b, length, heading: Math.atan2(b.x - a.x, b.z - a.z) });
      total += length;
    }
    this.length = total;
  }
  at(distance) {
    let along = this.loop ? ((distance % this.length) + this.length) % this.length : Math.max(0, Math.min(this.length, distance));
    for (const span of this.spans) {
      if (along > span.length) { along -= span.length;continue; }
      const t = span.length ? along / span.length : 0;
      return { x: span.a.x + (span.b.x - span.a.x) * t, z: span.a.z + (span.b.z - span.a.z) * t, heading: span.heading };
    }
    const last = this.spans[this.spans.length - 1];
    return { x: last.b.x, z: last.b.z, heading: last.heading };
  }
  samples(step = .5) {
    const out = [];
    for (let along = 0; along <= this.length; along += step) out.push(this.at(along));
    return out;
  }
}

export class RouteRider {
  constructor(route, { speed = 2, offset = 0, turn = 2.4, pingPong = false } = {}) {
    this.route = route;this.speed = speed;this.turn = turn;this.pingPong = pingPong;this.direction = 1;
    this.distance = pingPong ? Math.min(offset, route.length) : offset;
    const at = route.at(this.distance);
    this.x = at.x;this.z = at.z;this.heading = at.heading;
  }
  update(dt) {
    if (!(dt > 0)) return;
    // A shuttle eases away from each end and slows into the next, like a real one.
    const progress = this.route.length ? this.distance / this.route.length : 0;
    const pace = this.pingPong ? .18 + .82 * Math.sin(Math.PI * Math.min(1, Math.max(0, progress))) : 1;
    this.distance += this.speed * pace * dt * this.direction;
    if (this.pingPong) {
      if (this.distance >= this.route.length) { this.distance = this.route.length;this.direction = -1; }
      else if (this.distance <= 0) { this.distance = 0;this.direction = 1; }
    }
    const at = this.route.at(this.distance);
    const want = this.direction > 0 ? at.heading : at.heading + Math.PI;
    const ease = 1 - Math.exp(-dt * this.turn);
    this.heading += Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading)) * ease;
    this.x = at.x;this.z = at.z;
  }
}
