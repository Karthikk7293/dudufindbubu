import test from 'node:test';
import assert from 'node:assert/strict';
import { DESTINATIONS, DESTINATION_RADIUS } from '../src/destinations.js';
import { DestinationScene } from '../src/destination-scene.js';
import { isWalkable } from '../src/game-state.js';

const places = DESTINATIONS.slice(1);

test('nothing in a destination is built inside anything else, or off the island', () => {
  for (const place of places) {
    const scene = new DestinationScene(place, true);
    for (let i = 0; i < scene.obstacles.length; i++) for (let j = i + 1; j < scene.obstacles.length; j++) {
      const a = scene.obstacles[i], b = scene.obstacles[j], apart = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(apart > (a.radius + b.radius) * .62,
        `${place.id}: a prop at ${a.x}, ${a.z} sits inside the one at ${b.x}, ${b.z}`);
    }
    for (const obstacle of scene.obstacles)
      assert.ok(Math.hypot(obstacle.x, obstacle.z) + obstacle.radius <= 41.5,
        `${place.id}: the prop at ${obstacle.x}, ${obstacle.z} hangs off the island`);
    assert.ok(isWalkable(place.spawn.x, place.spawn.z, scene.obstacles, scene.layout), `${place.id}: you can stand where you arrive`);
    scene.dispose();
  }
});

test('everything that travels keeps to its own route and its own element', () => {
  for (const place of places) {
    const scene = new DestinationScene(place, true);
    for (const { kind, route, clearance } of scene.routes) {
      assert.ok(route.length > 8, `${place.id}: a ${kind} route is long enough to be worth travelling`);
      for (const at of route.samples(.5)) {
        if (kind === 'air') continue;
        if (kind === 'water') {
          // Boats stay in open water, never over the beach or its tide line.
          assert.ok(at.z < -11, `${place.id}: a boat reaches the shore at ${at.x.toFixed(1)}, ${at.z.toFixed(1)}`);
          continue;
        }
        assert.ok(isWalkable(at.x, at.z, scene.obstacles, scene.layout),
          `${place.id}: a ${kind} route leaves the ground at ${at.x.toFixed(1)}, ${at.z.toFixed(1)}`);
        const blocking = scene.obstacles.find(o => Math.hypot(at.x - o.x, at.z - o.z) < o.radius + clearance);
        assert.ok(!blocking, `${place.id}: a ${kind} route clips the prop at ${blocking?.x}, ${blocking?.z}`);
      }
    }
    // And they actually go somewhere over a minute of play.
    const start = scene.riders.map(({ rider }) => ({ x: rider.x, z: rider.z }));
    for (let frame = 0; frame < 1800; frame++) scene.update(1 / 30, 0, 0, false, [], { x: 70, z: 70 }, { gifts: [] });
    scene.riders.forEach(({ rider }, index) => {
      assert.ok(Math.hypot(rider.x - start[index].x, rider.z - start[index].z) > .5 || rider.pingPong,
        `${place.id}: something that should travel stayed put`);
      assert.ok(Number.isFinite(rider.x) && Number.isFinite(rider.heading), `${place.id}: a travelling prop lost its place`);
    });
    scene.dispose();
  }
});

test('the wider island still holds every landmark, gift and resident', () => {
  for (const place of places) {
    const scene = new DestinationScene(place, true);
    for (const landmark of place.landmarks)
      assert.ok(Math.hypot(landmark.x, landmark.z) < DESTINATION_RADIUS, `${place.id}: ${landmark.id} is inside the island`);
    assert.equal(scene.gifts.length, place.gifts.length);
    assert.equal(scene.animals.length, place.friends.length);
    scene.dispose();
  }
});

test('reduced motion stills the scenery that travels, while animals go about their day', () => {
  for (const place of places) {
    const scene = new DestinationScene(place, true);
    const travelling = [...(scene.traffic ?? []).map(car => car.vehicle), ...scene.riders.map(entry => entry.rider)];
    const parked = travelling.map(item => ({ x: item.x, z: item.z }));
    const resting = scene.animals.map(animal => ({ ...animal.brain.position }));
    for (let frame = 0; frame < 300; frame++)
      scene.update(1 / 60, 0, 0, true, [], { x: 70, z: 70 }, { gifts: [], walkable: () => true });
    assert.equal(scene.time, 0, `${place.id}: the scene clock holds, so the tram, windmill and surf hold with it`);
    travelling.forEach((item, index) => assert.equal(
      Math.hypot(item.x - parked[index].x, item.z - parked[index].z), 0,
      `${place.id}: something kept travelling with reduced motion turned on`));
    if (scene.animals.length) assert.ok(
      scene.animals.some((animal, index) => Math.hypot(animal.brain.position.x - resting[index].x, animal.brain.position.z - resting[index].z) > .2),
      `${place.id}: its animals should still wander, as the forest's do`);
    scene.dispose();
  }
});
