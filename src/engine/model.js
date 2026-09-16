import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { PARTS } from './catalog.js';
import { mechanismPose } from './state.js';

const palette = {
  alloy: { color: 0x8d999e, metalness: .82, roughness: .36 },
  bright: { color: 0xc8d0d0, metalness: .9, roughness: .24 },
  dark: { color: 0x384247, metalness: .8, roughness: .38 },
  black: { color: 0x192529, metalness: .35, roughness: .6 },
  orange: { color: 0xd95d30, metalness: .38, roughness: .31 },
  brass: { color: 0xbda36b, metalness: .8, roughness: .3 },
  ceramic: { color: 0xf3ece0, metalness: .05, roughness: .28 },
};

export function buildEngine() {
  const root = new THREE.Group(), parts = new Map(), materials = [];
  let current, localMaterials;
  const cylinder = (r, h, segments = 48) => new THREE.CylinderGeometry(r, r, h, segments);
  const rounded = (x, y, z, r = .06) => new RoundedBoxGeometry(x, y, z, 2, r);
  function mat(name) {
    if (!localMaterials[name]) {
      const m = new THREE.MeshStandardMaterial({ ...palette[name], envMapIntensity: 1.1 });
      m.userData.original = { color: m.color.clone(), metalness: m.metalness, roughness: m.roughness };
      localMaterials[name] = m; materials.push(m);
    }
    return localMaterials[name];
  }
  function mesh(geometry, material = 'alloy', pos = [0, 0, 0], rotation = [0, 0, 0], parent = current) {
    const m = new THREE.Mesh(geometry, mat(material));
    m.position.set(...pos); m.rotation.set(...rotation); m.castShadow = true; m.receiveShadow = true;
    m.userData.part = current.userData.id;
    parent.add(m); return m;
  }
  function ring(outer, inner, depth, material, pos, rotation = [Math.PI / 2, 0, 0], parent = current) {
    const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSegments: 1, bevelSize: .008, bevelThickness: .008, curveSegments: 36 });
    g.translate(0, 0, -depth / 2);
    return mesh(toCreasedNormals(g, .6), material, pos, rotation, parent);
  }
  function bolt(pos, axis = 'y', parent = current) {
    const rotation = axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    mesh(cylinder(.075, .075, 6), 'bright', pos, rotation, parent);
    const slot = [...pos]; slot[axis === 'z' ? 2 : 1] += .041;
    mesh(cylinder(.031, .005, 6), 'black', slot, rotation, parent);
  }
  function perimeterBolts(radius, z, n = 8) {
    for (let i = 0; i < n; i++) { const a = (i + .5) / n * Math.PI * 2; bolt([Math.cos(a) * radius, Math.sin(a) * radius, z], 'z'); }
  }
  function fin(y, radius = .86) {
    ring(radius, .58, .055, 'alloy', [0, y, 0]);
  }

  for (const def of PARTS) {
    current = new THREE.Group(); current.name = def.name; current.userData.id = def.id;
    current.position.set(...def.position); localMaterials = {};
    parts.set(def.id, current); root.add(current);
    if (def.id === 'case') {
      // An open top joins the cylinder bore to the crank chamber.
      const casing = new THREE.Shape(), outerAngle = Math.acos(.58 / .96), innerAngle = Math.acos(.58 / .79);
      casing.absarc(0, 0, .96, outerAngle, Math.PI - outerAngle, true);
      casing.lineTo(-.58, Math.sqrt(.79 ** 2 - .58 ** 2));
      casing.absarc(0, 0, .79, Math.PI - innerAngle, innerAngle, false); casing.closePath();
      const shell = new THREE.ExtrudeGeometry(casing, { depth: 1.02, bevelEnabled: false, curveSegments: 36 });
      shell.translate(0, 0, -.51);
      mesh(toCreasedNormals(shell, .6), 'alloy', [0, 0, -.05]);
      ring(.95, .19, .13, 'dark', [0, 0, -.61], [0, 0, 0]);
      ring(.29, .14, .18, 'brass', [0, 0, -.72], [0, 0, 0]);
      ring(.75, .58, .32, 'alloy', [0, .76, 0]);
      // The bore passes through the top flange instead of a solid cylinder cap.
      ring(.74, .58, .16, 'bright', [0, .99, 0]);
      for (const x of [-.7, .7]) {
        mesh(rounded(.22, .46, .88), 'alloy', [x, -.82, 0]);
        mesh(rounded(.46, .15, 1.6), 'dark', [x, -1.08, 0]);
        for (const z of [-.64, .64]) bolt([x, -.98, z]);
      }
      for (let i = 0; i < 5; i++) mesh(rounded(.09, .47, .7, .02), 'alloy', [-.42 + i * .21, -.61, -.08]);
      mesh(cylinder(.12, .08, 6), 'brass', [.65, -.62, .54], [Math.PI / 2, 0, 0]);
    }
    if (def.id === 'case-front') {
      ring(.97, .19, .2, 'alloy', [0, 0, 0], [0, 0, 0]);
      ring(.84, .31, .075, 'dark', [0, 0, .13], [0, 0, 0]);
      ring(.71, .29, .07, 'alloy', [0, 0, .18], [0, 0, 0]);
      ring(.32, .14, .16, 'bright', [0, 0, .25], [0, 0, 0]);
      ring(.24, .145, .02, 'black', [0, 0, .345], [0, 0, 0]);
      perimeterBolts(.875, .15);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        mesh(rounded(.08, .42, .09, .02), 'alloy', [Math.sin(a) * .51, Math.cos(a) * .51, .22], [0, 0, -a]);
      }
    }
    if (def.id === 'crank') {
      // Split journals leave clearance for the rod at bottom dead center.
      for (const z of [-.84, .84]) mesh(cylinder(.14, 1.02), 'bright', [0, 0, z], [Math.PI / 2, 0, 0]);
      for (const z of [-.31, .31]) {
        mesh(cylinder(.62, .19), 'dark', [0, -.12, z], [Math.PI / 2, 0, 0]);
        mesh(cylinder(.26, .21), 'alloy', [0, .28, z], [Math.PI / 2, 0, 0]);
        ring(.23, .145, .12, 'brass', [0, 0, z * 1.8], [0, 0, 0]);
      }
      mesh(cylinder(.13, .57), 'bright', [0, .42, 0], [Math.PI / 2, 0, 0]);
      mesh(rounded(.065, .065, .3, .015), 'dark', [0, .14, 1.1]);
    }
    if (def.id === 'rod') {
      ring(.215, .135, .16, 'bright', [0, 0, 0], [0, 0, 0]);
      ring(.17, .09, .18, 'bright', [0, 1.2, 0], [0, 0, 0]);
      ring(.137, .115, .17, 'brass', [0, 0, 0], [0, 0, 0]);
      mesh(rounded(.19, .94, .12, .035), 'alloy', [0, .61, 0]);
      mesh(rounded(.07, .79, .025, .025), 'dark', [0, .61, .064]);
      for (const x of [-.19, .19]) bolt([x, -.02, .11], 'z');
    }
    if (def.id === 'piston') {
      ring(.55, .45, .64, 'bright', [0, .05, 0]);
      mesh(cylinder(.55, .075), 'alloy', [0, .39, 0]);
      mesh(cylinder(.41, .016), 'dark', [0, .432, 0]);
      for (const y of [.18, .26, .33]) ring(.557, .52, .025, 'black', [0, y, 0]);
      mesh(cylinder(.085, 1.07), 'bright', [0, 0, 0], [Math.PI / 2, 0, 0]);
      for (const z of [-.54, .54]) ring(.115, .073, .02, 'dark', [0, 0, z], [0, 0, 0]);
    }
    if (def.id === 'barrel') {
      ring(.66, .58, 1.32, 'dark', [0, 0, 0]);
      for (let i = 0; i < 10; i++) fin(-.59 + i * .13, .83 + Math.sin(i / 9 * Math.PI) * .09);
      ring(.74, .58, .08, 'bright', [0, .68, 0]);
      for (const x of [-.6, .6]) for (const z of [-.57, .57]) {
        mesh(cylinder(.043, 1.38, 12), 'bright', [x, .04, z]);
        bolt([x, .72, z]);
      }
    }
    if (def.id === 'head') {
      ring(.77, .43, .27, 'alloy', [0, -.04, 0]);
      for (const y of [-.2, -.08, .04]) ring(.88, .43, .05, 'bright', [0, y, 0]);
      const deck = new THREE.Shape();
      deck.moveTo(-.685, -.56); deck.lineTo(.685, -.56); deck.lineTo(.685, .56); deck.lineTo(-.685, .56); deck.closePath();
      for (const x of [-.27, .27]) { const port = new THREE.Path(); port.absarc(x, .05, .08, 0, Math.PI * 2, true); deck.holes.push(port); }
      const deckGeometry = new THREE.ExtrudeGeometry(deck, { depth: .13, bevelEnabled: true, bevelSize: .015, bevelThickness: .01, bevelSegments: 1, curveSegments: 24 });
      deckGeometry.translate(0, 0, -.065);
      mesh(deckGeometry, 'alloy', [0, .17, -.05], [Math.PI / 2, 0, 0]);
      // Two visible valve seats on the chamber side.
      for (const x of [-.27, .27]) ring(.21, .15, .045, 'brass', [x, -.19, 0]);
      for (const x of [-.57, .57]) for (const z of [-.46, .46]) bolt([x, .26, z]);
      ring(.19, .12, .3, 'dark', [-.77, -.02, .05], [0, Math.PI / 2, 0]);
      ring(.18, .1, .2, 'brass', [.48, .08, .65], [0, 0, 0]);
    }
    if (def.id === 'rockers') {
      current.userData.valves = [];
      for (let i = 0; i < 2; i++) {
        const x = i ? .27 : -.27, valve = new THREE.Group(); valve.position.x = x;
        current.add(valve); current.userData.valves.push(valve);
        mesh(cylinder(.041, .57, 20), 'bright', [0, -.1, 0], [0, 0, 0], valve);
        mesh(cylinder(.175, .044), 'dark', [0, -.39, 0], [0, 0, 0], valve);
        mesh(cylinder(.13, .055), 'bright', [0, .19, 0], [0, 0, 0], valve);
        const points = Array.from({ length: 100 }, (_, j) => { const a = j / 99 * Math.PI * 12; return new THREE.Vector3(Math.cos(a) * .091, -.08 + j / 99 * .23, Math.sin(a) * .091); });
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 100, .018, 6, false), 'dark', [0, 0, 0], [0, 0, 0], valve);
        mesh(rounded(.15, .095, .61, .04), 'alloy', [0, .26, 0], [.12, 0, 0], valve);
        bolt([0, .325, .24], 'y', valve);
      }
      mesh(cylinder(.065, 1.04), 'bright', [0, .25, -.1], [0, 0, Math.PI / 2]);
      for (const x of [-.48, .48]) mesh(rounded(.12, .28, .22), 'dark', [x, .12, -.1]);
    }
    if (def.id === 'cover') {
      mesh(rounded(1.58, .37, 1.3, .14), 'orange');
      // A hollow skirt encloses the valve springs; the inside remains inspectable.
      for (const x of [-.727, .727]) mesh(rounded(.09, .31, 1.15, .035), 'orange', [x, -.29, 0]);
      for (const z of [-.596, .596]) mesh(rounded(1.43, .31, .09, .035), 'orange', [0, -.29, z]);
      for (const x of [-.727, .727]) mesh(rounded(.09, .035, 1.15, .01), 'black', [x, -.46, 0]);
      for (const z of [-.596, .596]) mesh(rounded(1.43, .035, .09, .01), 'black', [0, -.46, z]);
      mesh(rounded(.68, .012, .39, .045), 'dark', [0, .19, 0]);
      for (let i = 0; i < 4; i++) mesh(rounded(.81, .03, .035, .008), 'orange', [0, .18, -.4 + i * .055]);
      for (const x of [-.6, .6]) for (const z of [-.42, .42]) bolt([x, .19, z]);
      // Embossed emblem on the orange cover, using geometry rather than an external texture.
      for (let i = 0; i < 3; i++) mesh(rounded(.075, .014, .22 - i * .04, .01), 'bright', [-.13 + i * .13, .205, 0]);
    }
    if (def.id === 'plug') {
      const plug = new THREE.Group(); plug.rotation.x = .55; current.add(plug);
      mesh(cylinder(.102, .28, 24), 'brass', [0, .04, 0], [0, 0, 0], plug);
      for (let i = 0; i < 7; i++) mesh(new THREE.TorusGeometry(.102, .009, 5, 24), 'bright', [0, -.075 + i * .029, 0], [Math.PI / 2, 0, 0], plug);
      mesh(cylinder(.148, .125, 6), 'bright', [0, .19, 0], [0, 0, 0], plug);
      mesh(cylinder(.084, .33), 'ceramic', [0, .41, 0], [0, 0, 0], plug);
      for (let i = 0; i < 5; i++) mesh(new THREE.TorusGeometry(.085, .015, 6, 24), 'ceramic', [0, .32 + i * .045, 0], [Math.PI / 2, 0, 0], plug);
      mesh(cylinder(.053, .13), 'bright', [0, .63, 0], [0, 0, 0], plug);
    }
    if (def.id === 'flywheel') {
      ring(1.07, .86, .29, 'dark', [0, 0, 0], [0, 0, 0]);
      ring(1.08, 1.01, .32, 'bright', [0, 0, 0], [0, 0, 0]);
      ring(.29, .145, .38, 'bright', [0, 0, 0], [0, 0, 0]);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        mesh(rounded(.15, .66, .15, .03), 'alloy', [Math.sin(a) * .56, Math.cos(a) * .56, 0], [0, 0, -a]);
      }
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * Math.PI * 2;
        mesh(rounded(.075, .06, .25, .015), 'alloy', [Math.sin(a) * 1.1, Math.cos(a) * 1.1, 0], [0, 0, -a]);
      }
    }
    current.userData.materials = Object.values(localMaterials);
  }
  function pose(angle) {
    const p = mechanismPose(angle);
    parts.get('piston').position.y += p.pistonY - 2.62;
    parts.get('rod').position.x += p.crankX;
    parts.get('rod').position.y += p.crankY - .42;
    parts.get('rod').rotation.z = p.rodAngle;
    parts.get('crank').rotation.z = -angle;
    parts.get('flywheel').rotation.z = -angle;
    const phase = ((angle % (Math.PI * 4)) + Math.PI * 4) % (Math.PI * 4);
    parts.get('rockers').userData.valves.forEach((v, i) => {
      const start = i === 0 ? 0 : Math.PI * 3;
      v.position.y = phase >= start && phase <= start + Math.PI ? -.12 * Math.sin(phase - start) : 0;
    });
  }
  return { root, parts, materials, pose };
}
