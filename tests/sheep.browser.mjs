import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { freshState } from '../src/game-state.js';
const base = process.env.GAME_URL || 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  if (!process.argv.includes('--forest')) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(90000);page.on('pageerror', e => errors.push(e.message));
    let downloads = 0;page.on('request', r => { if (r.url().endsWith('/sheep.glb')) downloads++; });
    await page.goto(base + '/character.html?animal=sheep');await page.waitForFunction(() => window.__duduStudio?.snapshot().ready);
    const snap = () => page.evaluate(() => window.__duduStudio.snapshot());
    const info = await snap();assert.equal(info.animal, 'sheep');assert.equal(info.bones, 15);
    assert.deepEqual(info.clips.sort(), ['Graze', 'Idle', 'Rest', 'Walk']);
    assert.ok(info.triangles < 20000);assert.ok(info.drawCalls <= 8);
    await page.screenshot({ path: 'test-results/blender-sheep-idle.png' });
    await page.locator('[data-clip="Walk"]').click();const before = (await snap()).leg;
    await page.waitForFunction(before => window.__duduStudio.snapshot().leg.some((v, i) => Math.abs(v - before[i]) > .05), before);
    await page.screenshot({ path: 'test-results/blender-sheep-walk.png' });
    await page.locator('[data-clip="Graze"]').click();const neck = (await snap()).neck;
    await page.waitForFunction(before => window.__duduStudio.snapshot().neck.some((v, i) => Math.abs(v - before[i]) > .3), neck);
    await page.waitForTimeout(500);await page.screenshot({ path: 'test-results/blender-sheep-graze.png' });
    await page.locator('#pause').click();const frozen = await snap();await page.waitForTimeout(180);
    assert.deepEqual(await snap(), frozen);
    await page.locator('#pause').click();await page.locator('[data-clip="Rest"]').click();
    await page.waitForFunction(() => window.__duduStudio.snapshot().weights.every(face => face.values[face.keys.Blink] > .8));
    await page.screenshot({ path: 'test-results/blender-sheep-rest.png' });
    const flock = await page.evaluate(async () => {
      const { SheepModel, loadSheepTemplate } = await import('/src/blender-sheep.js');
      const template = await loadSheepTemplate(), a = new SheepModel(template, 0), b = new SheepModel(template, 2);
      for (let i = 0; i < 60; i++) {
        a.update(1 / 30, i / 30, { mode: 'graze' });
        b.update(1 / 30, i / 30, { mode: 'walk', speed: .42, distance: i * .42 / 30 });
      }
      let meshA, meshB;
      a.scene.traverse(n => { if (n.isSkinnedMesh) meshA = n; });b.scene.traverse(n => { if (n.isSkinnedMesh) meshB = n; });
      const pose = a.bones.get('Head').quaternion.toArray();a.update(0, 10, { mode: 'walk', speed: 1, distance: 5 });
      const frozen = JSON.stringify(pose) === JSON.stringify(a.bones.get('Head').quaternion.toArray());
      a.update(.1, 1, { mode: 'sleep' }, true);const reduced = a.bones.get('Head').quaternion.toArray();
      a.update(.1, 2, { mode: 'sleep' }, true);
      const reducedStill = JSON.stringify(reduced) === JSON.stringify(a.bones.get('Head').quaternion.toArray());
      a.update(.1, 2, { mode: 'idle' }, true);
      return { independent: a.bones.get('Head') !== b.bones.get('Head'), materials: meshA.material === meshB.material,
        geometry: meshA.geometry === meshB.geometry, faces: a.faces[0].morphTargetInfluences !== b.faces[0].morphTargetInfluences,
        frozen, reducedStill, woke: a.faces.every(face => face.morphTargetInfluences[face.morphTargetDictionary.Blink] === 0) };
    });
    assert.ok(Object.values(flock).every(Boolean));assert.equal(downloads, 1);
    const phone = await browser.newPage({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    phone.on('pageerror', e => errors.push(e.message));
    await phone.goto(base + '/character.html?animal=sheep');await phone.waitForFunction(() => window.__duduStudio?.snapshot().ready);
    await phone.locator('[data-clip="Graze"]').tap();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1), true);
    await phone.screenshot({ path: 'test-results/blender-sheep-mobile.png' });await phone.close();await page.close();
    console.log('Sheep studio, four clips, independent flock, shared resources, pause, reduced motion and mobile controls passed.');
  }
  if (!process.argv.includes('--studio')) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    page.setDefaultTimeout(120000);page.on('pageerror', e => errors.push(e.message));
    let downloads = 0;page.on('request', r => { if (r.url().endsWith('/sheep.glb')) downloads++; });
    await page.addInitScript(state => { window.__DUDU_TEST_STATE__ = state;localStorage.setItem('dudu-sound', 'off');localStorage.setItem('dudu-weather', 'clear');localStorage.setItem('dudu-time-of-day', 'day');Object.defineProperty(document, 'fullscreenEnabled', { get: () => false }); }, { ...freshState(), departed: true, position: { x: 8, z: 20 } });
    await page.goto(base);await page.waitForFunction(() => window.__dudu?.snapshot().ready);await page.waitForSelector('#loading', { state: 'hidden' });
    await page.locator('#start-button').tap();
    const sheep = () => page.evaluate(() => window.__dudu.snapshot().animals.filter(a => a.kind === 'sheep'));
    assert.equal((await sheep()).length, 4);assert.ok((await sheep()).every(a => a.model === 'blender'));assert.equal(downloads, 1);
    await page.waitForFunction(() => window.__dudu.snapshot().animals.some(a => a.kind === 'sheep' && a.distance > .1));
    await page.locator('#play-pause').tap();const frozen = await sheep();await page.waitForTimeout(200);assert.deepEqual(await sheep(), frozen);
    await page.locator('#pause-dialog [data-close]').last().tap();
    await page.screenshot({ path: 'test-results/blender-sheep-forest.png' });
    await page.keyboard.press('t');
    await page.waitForFunction(() => window.__dudu.snapshot().animals.some(a => a.kind === 'sheep' && a.clip === 'Rest' && a.blink > .8));
    await page.keyboard.press('t');await page.waitForFunction(() => window.__dudu.snapshot().animals.filter(a => a.kind === 'sheep').every(a => a.clip !== 'Rest'));
    console.log('Default forest uses all four Blender sheep; roaming, pause, night resting and waking passed.');
    await page.close();
    const fallback = await browser.newPage({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 1 });fallback.setDefaultTimeout(120000);
    fallback.on('pageerror', e => errors.push(e.message));
    await fallback.route('**/sheep.glb', route => route.abort());
    await fallback.goto(base);await fallback.waitForFunction(() => window.__dudu?.snapshot().ready);
    assert.ok(await fallback.evaluate(() => window.__dudu.snapshot().animals.filter(a => a.kind === 'sheep').every(a => a.model === 'procedural')));
    console.log('A failed sheep download retains playable fallback animals.');
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
