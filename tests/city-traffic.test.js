import test from 'node:test';
import assert from 'node:assert/strict';
import { RoadNetwork, TrafficLights, Vehicle } from '../src/city-traffic.js';
import { DESTINATIONS } from '../src/destinations.js';
import { DestinationScene } from '../src/destination-scene.js';
import { isWalkable } from '../src/game-state.js';

const city = () => DESTINATIONS.find(place => place.id === 'city');

test('every driving lane stays on open road, and no car ever reaches a building', () => {
  const scene = new DestinationScene(city(), true);
  assert.ok(scene.roads.nodes.length >= 12, 'the city is laid out as a grid');
  assert.equal(scene.roads.nodes.filter(node => scene.roads.signalled(node)).length, 2, 'two signalled crossroads');
  // Sample each lane across the width of a car; all of it must be open ground.
  for (const edge of scene.roads.edges) for (let along = 0; along <= edge.length; along += .4) {
    const at = scene.roads.point(edge, along);
    for (const side of [-.8, 0, .8]) {
      const x = at.x + edge.dz * side, z = at.z - edge.dx * side;
      const blocking = scene.obstacles.find(o => Math.hypot(x - o.x, z - o.z) < o.radius + .38);
      assert.ok(isWalkable(x, z, scene.obstacles, scene.layout),
        `lane ${edge.from.id}->${edge.to.id} at ${along.toFixed(1)} (${x.toFixed(1)}, ${z.toFixed(1)}) meets ${blocking ? `an obstacle at ${blocking.x}, ${blocking.z} r${blocking.radius}` : 'the island edge'}`);
    }
  }
  // Then drive the whole fleet for forty seconds and watch where it goes.
  assert.ok(scene.traffic.length >= 6, 'the city has traffic');
  const travelled = scene.traffic.map(() => 0);
  for (let frame = 0; frame < 2400; frame++) {
    scene.update(1 / 60, 0, 0, false, [], { x: 60, z: 60 }, { gifts: [] });
    scene.traffic.forEach(({ vehicle }, index) => {
      travelled[index] += vehicle.speed / 60;
      for (const obstacle of scene.obstacles)
        assert.ok(Math.hypot(vehicle.x - obstacle.x, vehicle.z - obstacle.z) > obstacle.radius,
          `a car reached ${vehicle.x.toFixed(1)}, ${vehicle.z.toFixed(1)}`);
    });
  }
  assert.ok(travelled.every(distance => distance > 40), 'every car keeps moving through the signals');
  scene.dispose();
});

test('signals alternate, and a car holds at a red light before crossing on green', () => {
  const network = new RoadNetwork([-25, 0, 25], [25, 8, -11, -27]), lights = new TrafficLights();
  for (const time of [0, 5, 11, 15, 21]) {
    const at = new TrafficLights();at.update(time);
    assert.ok(!(at.isGreen('ns') && at.isGreen('ew')), 'both directions are never green at once');
  }
  const approach = network.edgeAt(0, 1, 1, 1);
  assert.equal(approach.axis, 'ew');
  const car = new Vehicle(network, approach, { speed: 7, seed: 3 });
  for (let frame = 0; frame < 600; frame++) car.update(1 / 60, lights, [car]);
  assert.equal(car.edge, approach, 'the car is still waiting on its approach');
  assert.ok(car.speed < .2, 'and it is stopped');
  assert.ok(car.t < approach.length - 4.4, 'behind the stop line, not in the junction');
  lights.update(11.4);assert.equal(lights.isGreen('ew'), true);
  for (let frame = 0; frame < 300; frame++) car.update(1 / 60, lights, [car]);
  assert.notEqual(car.edge, approach, 'green lets it through the crossroads');
});

test('cars keep a gap, wait for a bear on the crossing, and can always move on', () => {
  const network = new RoadNetwork([-25, 0, 25], [25, 8, -11, -27]), lights = new TrafficLights();
  const edge = network.edgeAt(0, 1, 1, 1);
  const leader = new Vehicle(network, edge, { speed: 7, seed: 5, start: 8 });
  const follower = new Vehicle(network, edge, { speed: 7, seed: 9, start: 0 });
  const traffic = [leader, follower];
  for (let frame = 0; frame < 900; frame++) {
    for (const car of traffic) car.update(1 / 60, lights, traffic);
    if (leader.edge === follower.edge) assert.ok(leader.t - follower.t > 3.4, 'the follower keeps its distance');
  }
  // A bear standing in the road ahead is always reason enough to wait.
  const waiting = new Vehicle(network, edge, { speed: 7, seed: 2, start: 2 });
  const ahead = network.point(edge, 8);
  for (let frame = 0; frame < 400; frame++) waiting.update(1 / 60, lights, [waiting], ahead);
  assert.ok(waiting.speed < .2, 'the car stops for someone in front of it');
  assert.ok(waiting.t < 8, 'and stops short of them');
  // Every junction offers a way on, including a legal U-turn.
  for (const node of network.nodes) {
    const exits = network.out.get(node.id) || [];
    assert.ok(exits.length >= 2, `${node.id} is not a dead end`);
  }
  const corner = network.edgeAt(0, 0, 1, 0);
  assert.ok(network.exits(corner).some(next => next.dx === -corner.dx && next.dz === -corner.dz), 'a U-turn is available');
});
