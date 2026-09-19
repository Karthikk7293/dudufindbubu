import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bearBlink } from './bear-expression.js';

export const bearModelUrl = name => `${import.meta.env.BASE_URL || '/'}models/characters/${name}.glb`;
export const DUDU_MODEL_URL = bearModelUrl('dudu');

// Both bears share one rig, one set of face shapes and one set of clips.
export async function loadDuduModel(onProgress, name = 'dudu') {
  const gltf = await new GLTFLoader().loadAsync(bearModelUrl(name), onProgress);
  const bones = new Map(), faces = [];
  let triangles = 0;
  gltf.scene.traverse(node => {
    if (node.isBone) bones.set(node.name, node);
    if (!node.isMesh) return;
    node.receiveShadow = true;
    // Animated paws can leave the rest-pose bounding box.
    node.frustumCulled = false;
    triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3;
    if (node.morphTargetDictionary) faces.push(node);
  });
  const required = ['Body', 'Head', 'Pack', 'Arm_L', 'Arm_R', 'Forearm_L', 'Forearm_R',
    'Leg_L', 'Leg_R', 'Foot_L', 'Foot_R', 'Ear_L', 'Ear_R'];
  if (required.some(bone => !bones.has(bone)) || !faces.length || !gltf.animations.some(clip => clip.name === 'Walk')) {
    disposeDuduModel(gltf.scene);
    throw new Error('This bear’s model is missing its rig, face shapes or walking animation.');
  }
  return { ...gltf, bones, faces, triangles };
}

export function poseDuduFace(asset, values, time = 0, reducedMotion = false) {
  const happy = THREE.MathUtils.clamp(values.smile || 0, 0, 1);
  const shy = THREE.MathUtils.clamp(values.paws || 0, 0, 1) * (1 - happy);
  const droop = THREE.MathUtils.clamp(values.droop || 0, 0, 1);
  const weights = {
    Happy: happy,
    Shy: shy * (1 - droop),
    Sleepy: droop,
    Surprised: THREE.MathUtils.clamp((values.open || 0) * 1.25, 0, 1) * (1 - happy) * (1 - shy) * (1 - droop),
    Blink: (1 - bearBlink(time, 0, reducedMotion, droop)) * (1 - happy),
  };
  for (const mesh of asset.faces) {
    for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
      mesh.morphTargetInfluences[index] = weights[name] || 0;
    }
  }
  return weights;
}

// Keep the adventure's existing pose controls, gift sockets and story timing.
// Each control drives its corresponding deforming bone through a bind offset,
// accounting for Blender's axes without hard-coded Euler conversions.
export function attachDuduModel(bear, asset) {
  const data = bear.userData;
  const controls = { Body: data.body, Head: data.head, Pack: data.pack };
  for (const [index, side] of ['L', 'R'].entries()) {
    controls[`Arm_${side}`] = data.arms[index];
    controls[`Forearm_${side}`] = data.forearms[index];
    controls[`Leg_${side}`] = data.legs[index];
    controls[`Foot_${side}`] = data.feet[index];
    controls[`Ear_${side}`] = data.ears[index];
  }
  const oldMeshes = [];
  bear.traverse(node => { if (node.isMesh) oldMeshes.push(node); });
  bear.add(asset.scene);
  bear.updateMatrixWorld(true);
  const bindings = [];
  asset.scene.traverse(bone => {
    if (!bone.isBone || !controls[bone.name]) return;
    const control = controls[bone.name];
    bindings.push({ bone, control, offset: control.matrixWorld.clone().invert().multiply(bone.matrixWorld) });
  });
  for (const mesh of oldMeshes) mesh.visible = false;
  const desired = new THREE.Matrix4(), local = new THREE.Matrix4();
  data.blenderDudu = {
    asset,
    update(time, reducedMotion) {
      bear.updateMatrixWorld(true);
      for (const { bone, control, offset } of bindings) {
        desired.multiplyMatrices(control.matrixWorld, offset);
        local.copy(bone.parent.matrixWorld).invert().multiply(desired);
        local.decompose(bone.position, bone.quaternion, bone.scale);
        bone.updateMatrix();
        bone.matrixWorld.copy(desired);
      }
      this.weights = poseDuduFace(asset, data.expression.values, time, reducedMotion);
    },
    weights: {},
  };
  data.blenderDudu.update(0, true);
  return data.blenderDudu;
}

export function disposeDuduModel(scene) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  scene.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    for (const material of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => { texture.source?.data?.close?.(); texture.dispose(); });
  skeletons.forEach(skeleton => skeleton.dispose());
}
