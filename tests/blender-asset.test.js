import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = readFileSync(new URL('../public/models/characters/dudu.glb', import.meta.url));
const jsonLength = data.readUInt32LE(12);
const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString());
const binary = data.subarray(28 + jsonLength);

test('Dudu ships a bounded GLB with a deforming rig, independent expressions and loopable clips', () => {
  assert.equal(data.toString('ascii', 0, 4), 'glTF');assert.equal(data.readUInt32LE(4), 2);
  assert.ok(data.length < 1_500_000, 'Keep the first character download below 1.5 MB');
  assert.equal(gltf.skins.length, 1);assert.equal(gltf.skins[0].joints.length, 11);
  assert.deepEqual(gltf.animations.map(a => a.name).sort(), ['Idle', 'Walk']);
  const faces = gltf.meshes.flatMap(mesh => mesh.extras?.targetNames || []);
  for (const name of ['Happy', 'Shy', 'Surprised', 'Blink']) assert.ok(faces.includes(name));
  let triangles = 0;
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    triangles += gltf.accessors[primitive.indices].count / 3;
    assert.ok(primitive.attributes.JOINTS_0 !== undefined);
    const accessor = gltf.accessors[primitive.attributes.WEIGHTS_0];
    assert.equal(accessor.componentType, 5126);
    const view = gltf.bufferViews[accessor.bufferView], stride = view.byteStride || 16;
    for (let i = 0; i < accessor.count; i++) {
      const start = (view.byteOffset || 0) + (accessor.byteOffset || 0) + i * stride;
      const weights = [0, 1, 2, 3].map(j => binary.readFloatLE(start + j * 4));
      assert.ok(weights.every(w => Number.isFinite(w) && w >= 0 && w <= 1));
      assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < .0001, 'Every vertex must follow its rig');
    }
  }
  assert.ok(triangles < 35000);assert.ok(gltf.materials.length <= 10);
  for (const clip of gltf.animations) {
    assert.ok(clip.channels.every(channel => channel.target.path !== 'weights'), 'Faces must remain independent of walking');
    for (const sampler of clip.samplers) {
      const accessor = gltf.accessors[sampler.output], view = gltf.bufferViews[accessor.bufferView];
      const size = { VEC3: 3, VEC4: 4 }[accessor.type];
      assert.ok(size);
      const start = (view.byteOffset || 0) + (accessor.byteOffset || 0), stride = view.byteStride || size * 4;
      for (let j = 0; j < size; j++) {
        assert.ok(Math.abs(binary.readFloatLE(start + j * 4) - binary.readFloatLE(start + (accessor.count - 1) * stride + j * 4)) < .0001, `${clip.name} must loop without a pose jump`);
      }
    }
  }
});
