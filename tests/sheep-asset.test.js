import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file = readFileSync(new URL('../public/models/characters/sheep.glb', import.meta.url));
const jsonLength = file.readUInt32LE(12);
const gltf = JSON.parse(file.subarray(20, 20 + jsonLength));
const bytes = file.subarray(28 + jsonLength);
const components = { SCALAR: 1, VEC3: 3, VEC4: 4 };
function float(accessor, row, component) {
  const view = gltf.bufferViews[accessor.bufferView];
  const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0) + row * (view.byteStride || components[accessor.type] * 4) + component * 4;
  return bytes.readFloatLE(offset);
}
test('the flock shares a small sheep asset with skinned knees, eyelids and four seamless actions', () => {
  assert.equal(file.toString('ascii', 0, 4), 'glTF');assert.ok(file.length < 850000);
  assert.equal(gltf.skins.length, 1);assert.equal(gltf.skins[0].joints.length, 15);
  assert.equal(gltf.materials.length, 5);
  assert.ok(gltf.meshes.some(mesh => mesh.extras?.targetNames.includes('Blink')));
  let triangles = 0;
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    triangles += gltf.accessors[primitive.indices].count / 3;
    assert.ok(primitive.attributes.JOINTS_0 !== undefined);
    const weights = gltf.accessors[primitive.attributes.WEIGHTS_0];
    for (let i = 0; i < weights.count; i++) {
      const values = [0, 1, 2, 3].map(j => float(weights, i, j));
      assert.ok(values.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
      assert.ok(Math.abs(values.reduce((a, b) => a + b, 0) - 1) < .00001);
    }
  }
  assert.ok(triangles < 20000);
  assert.deepEqual(gltf.animations.map(a => a.name).sort(), ['Graze', 'Idle', 'Rest', 'Walk']);
  for (const animation of gltf.animations) for (const sampler of animation.samplers) {
    const data = gltf.accessors[sampler.output];
    for (let i = 0; i < components[data.type]; i++) assert.ok(Math.abs(float(data, 0, i) - float(data, data.count - 1, i)) < .00001, `${animation.name} should loop smoothly`);
  }
});
