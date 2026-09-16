import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.GAME_URL || 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(90000);page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/character.html');
  await page.waitForFunction(() => window.__duduStudio?.snapshot().ready);
  const snap = () => page.evaluate(() => window.__duduStudio.snapshot());
  const info = await snap();
  assert.equal(info.bones, 11);assert.deepEqual(info.clips.sort(), ['Idle', 'Walk']);
  assert.ok(info.triangles < 35000);assert.ok(info.drawCalls <= 14);
  const deformation = await page.evaluate(async () => {
    const { createBear } = await import('/src/world.js');
    const { loadDuduModel, attachDuduModel } = await import('/src/blender-dudu.js');
    const bear = createBear(), asset = await loadDuduModel(), driver = attachDuduModel(bear, asset);
    let fur;asset.scene.traverse(node => { if (node.isSkinnedMesh && node.name === 'Dudu_Fur') fur = node; });
    const joint = fur.skeleton.bones.findIndex(bone => bone.name === 'Forearm_L');
    const joints = fur.geometry.attributes.skinIndex, weights = fur.geometry.attributes.skinWeight;
    let vertex = -1;
    for (let i = 0; i < joints.count && vertex < 0; i++) for (let j = 0; j < 4; j++) {
      if (joints.getComponent(i, j) === joint && weights.getComponent(i, j) > .8) { vertex = i;break; }
    }
    const before = fur.getVertexPosition(vertex, bear.position.clone());
    bear.userData.arms[0].rotation.z = -.9;bear.userData.forearms[0].rotation.x = -.5;
    driver.update(2, true);
    const after = fur.getVertexPosition(vertex, bear.position.clone());
    const change = before.distanceTo(after);
    bear.position.set(10, 2, -5);bear.rotation.y = .7;bear.userData.body.position.y = .2;driver.update(2, true);
    const root = asset.bones.get('Body').getWorldPosition(bear.position.clone());
    return { vertex, change, root: root.toArray() };
  });
  assert.ok(deformation.vertex >= 0);assert.ok(deformation.change > .08, 'Game gestures must deform the GLB paw vertices');
  assert.ok(Math.abs(deformation.root[0] - 10) < .00001 && Math.abs(deformation.root[1] - 2.136) < .00001 && Math.abs(deformation.root[2] + 5) < .00001);
  await page.screenshot({ path: 'test-results/blender-dudu-quarter.png' });
  await page.evaluate(() => window.__duduStudio.front());
  for (const [mood, shape] of [['delighted', 'Happy'], ['shy', 'Shy'], ['surprised', 'Surprised']]) {
    await page.locator(`[data-mood="${mood}"]`).click();
    await page.waitForFunction(shape => window.__duduStudio.snapshot().weights.some(mesh => mesh.values[mesh.keys[shape]] > .5), shape);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `test-results/blender-dudu-${mood}.png` });
  }
  await page.locator('[data-mood="calm"]').click();await page.locator('[data-clip="Walk"]').click();
  const before = (await snap()).leg;
  await page.waitForFunction(before => window.__duduStudio.snapshot().leg.some((v, i) => Math.abs(v - before[i]) > .08), before);
  await page.locator('#pause').click();const frozen = await snap();await page.waitForTimeout(200);
  assert.equal((await snap()).time, frozen.time);assert.deepEqual((await snap()).leg, frozen.leg);
  await page.screenshot({ path: 'test-results/blender-dudu-walk.png' });
  await page.locator('[data-mood="shy"]').click();assert.equal((await snap()).mood, 'shy');
  await page.locator('#pause').click();await page.waitForFunction(time => window.__duduStudio.snapshot().time > time, frozen.time);
  console.log('Blender asset, facial morphs, walking clip, pause and studio rendering passed.');
  const phone = await browser.newPage({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  phone.on('pageerror', e => errors.push(e.message));
  await phone.goto(base + '/character.html');await phone.waitForFunction(() => window.__duduStudio?.snapshot().ready);
  await phone.locator('[data-mood="delighted"]').tap();await phone.locator('[data-clip="Walk"]').tap();
  await phone.screenshot({ path: 'test-results/blender-dudu-mobile.png' });
  const layout = await phone.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
  assert.ok(layout.scrollWidth <= layout.width + 1 && layout.scrollHeight <= layout.height + 1, JSON.stringify(layout));
  await phone.close();
  let fail = true;
  await page.route('**/models/characters/dudu.glb', route => fail ? route.abort() : route.continue());
  await page.reload();await page.waitForSelector('#retry:not([hidden])');
  assert.equal(await page.locator('[data-clip="Walk"]').isDisabled(), true);
  fail = false;await page.locator('#retry').click();await page.waitForSelector('#loading', { state: 'hidden' });
  assert.equal(await page.locator('[data-clip="Walk"]').isDisabled(), false);
  assert.deepEqual(errors, []);
  console.log('Mobile landscape controls and failed-download retry passed.');
} finally { await browser.close(); }
