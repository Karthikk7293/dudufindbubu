import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const SHEEP_MODEL_URL = `${import.meta.env.BASE_URL || '/'}models/characters/sheep.glb`;
const CLIPS = ['Idle', 'Walk', 'Graze', 'Rest'];
const STRIDE_LENGTH = .66;
let templatePromise;

// One download and one set of geometry/materials for the whole flock. Each
// instance gets its own skeleton, mixer and facial weights.
export function loadSheepTemplate(onProgress) {
  if (!templatePromise) {
    templatePromise = new GLTFLoader().loadAsync(SHEEP_MODEL_URL, onProgress).then(gltf => {
      const bones = new Set();let skinned = 0, blink = false;
      gltf.scene.traverse(node => {
        if (node.isBone) bones.add(node.name);
        if (node.isSkinnedMesh) skinned++;
        if (node.morphTargetDictionary?.Blink !== undefined) blink = true;
      });
      if (!skinned || !blink || !['Body', 'Head', 'Neck', 'Jaw', 'Knee_Front_L'].every(name => bones.has(name)) || !CLIPS.every(name => gltf.animations.some(clip => clip.name === name))) {
        throw new Error('The sheep model is missing its skeleton, eyelids or animation clips.');
      }
      return gltf;
    }).catch(error => { templatePromise = null;throw error; });
  }
  return templatePromise;
}

export class SheepModel {
  constructor(template, phase = 0) {
    this.scene = clone(template.scene);
    this.animations = template.animations;
    this.phase = phase;this.clip = null;this.closed = 0;this.reducedMotion = false;
    this.bones = new Map();this.faces = [];this.triangles = 0;
    this.scene.updateMatrixWorld(true);
    this.scene.traverse(node => {
      if (node.isBone) this.bones.set(node.name, node);
      if (!node.isMesh) return;
      node.receiveShadow = true;node.castShadow = false;
      this.triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3;
      if (node.isSkinnedMesh) {
        // Include the lowered grazing head and stepping feet without rescanning
        // every vertex on every frame, while retaining off-screen culling.
        node.computeBoundingSphere();node.boundingSphere.radius += .85;
      }
      if (node.morphTargetDictionary?.Blink !== undefined) this.faces.push(node);
    });
    this.mixer = new THREE.AnimationMixer(this.scene);
    this.actions = Object.fromEntries(template.animations.map(clip => [clip.name, this.mixer.clipAction(clip)]));
    this.changeClip('Idle', true);
    this.mixer.update(0);
  }

  changeClip(name, immediate) {
    if (this.clip === name) return;
    const previous = this.actions[this.clip], next = this.actions[name];
    next.reset().setEffectiveWeight(1).fadeIn(immediate ? 0 : .4).play();
    next.time = this.phase % next.getClip().duration;
    if (previous) previous.fadeOut(immediate ? 0 : .4);
    this.clip = name;
  }

  update(dt, time, { mode = 'idle', speed = 0, distance = 0 } = {}, reducedMotion = false) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const clip = speed > .01 ? 'Walk' : mode === 'graze' ? 'Graze' : mode === 'sleep' ? 'Rest' : 'Idle';
    this.changeClip(clip, reducedMotion);
    if (reducedMotion && !this.reducedMotion) {
      for (const [name, action] of Object.entries(this.actions)) action.stopFading().setEffectiveWeight(name === clip ? 1 : 0);
    }
    this.reducedMotion = reducedMotion;
    const active = this.actions[clip];
    active.paused = clip === 'Walk' || reducedMotion;
    if (clip === 'Walk') {
      // A full cycle advances .66 world units, so feet follow actual navigation
      // distance rather than continuing to step against a fence or tree.
      active.time = ((distance / STRIDE_LENGTH) % 1) * active.getClip().duration;
    } else if (reducedMotion) active.time = 0;
    this.mixer.update(dt);
    this.closed += ((mode === 'sleep' ? 1 : 0) - this.closed) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 8));
    const blinkTime = (time + this.phase) % 6.3;
    const blink = !reducedMotion && blinkTime < .18 ? Math.sin(blinkTime / .18 * Math.PI) : 0;
    this.blink = Math.max(this.closed * .96, blink);
    for (const face of this.faces) face.morphTargetInfluences[face.morphTargetDictionary.Blink] = this.blink;
  }
}

export function attachSheepModel(animal, template) {
  if (animal.kind !== 'sheep') throw new Error('Only sheep can use the sheep rig.');
  const model = new SheepModel(template, animal.phase);
  animal.body.traverse(node => { if (node.isMesh) node.visible = false; });
  animal.group.add(model.scene);
  animal.blenderSheep = model;
  return model;
}
