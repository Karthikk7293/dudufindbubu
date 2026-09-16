import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

if (process.argv.includes('--inputs')) { await import('./engine.inputs.mjs'); process.exit(0); }

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream'] });
const url = process.env.ENGINE_URL || 'http://localhost:3000/engine.html';
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const page = await context.newPage(), errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => requests.push(request.url()));
const snap = () => page.evaluate(() => window.__engineLab.snapshot());
const waitReady = () => page.waitForFunction(() => window.__engineLab, null, { timeout: 60000 });
try {
  await page.goto(url); await waitReady();
  assert.equal((await snap()).removed.length, 0);
  assert.equal(await page.locator('.part-row').count(), 11);
  assert.ok(!requests.some(url => url.includes('/tracking/') || url.includes('hand_landmarker.task')), 'Camera assets are not requested at startup');
  await page.screenshot({ path: 'test-results/engine-inspect.png' });
  console.log('Engine loaded; 11 components, no camera download at startup.');
  if (process.argv.includes('--preview')) { console.log(JSON.stringify(await snap())); }
  else {
    const d = (await snap()).distance;
    await page.locator('#zoom-in').click(); assert.ok((await snap()).distance < d);
    await page.locator('#zoom-out').click(); assert.ok(Math.abs((await snap()).distance - d) < .1);
    const before = (await snap()).camera;
    await page.mouse.move(1000, 510); await page.mouse.down(); await page.mouse.move(1120, 570, { steps: 10 }); await page.mouse.up();
    assert.notDeepEqual((await snap()).camera, before, 'Real pointer drag orbits the model');
    await page.locator('[data-part="piston"]').click();
    assert.equal((await snap()).selected, 'piston');
    await page.locator('#isolate-part').click();
    assert.deepEqual((await snap()).parts.filter(p => p.visible).map(p => p.id), ['piston']);
    await page.locator('[data-view="bottom"]').click();
    await page.waitForFunction(() => window.__engineLab.snapshot().camera[1] < 0, null, { timeout: 30000 });
    await page.screenshot({ path: 'test-results/engine-piston-bottom.png' });
    await page.locator('#reset-view').click();
    await page.locator('#explode-button').click(); assert.equal((await snap()).explode, 1);
    await page.waitForFunction(() => window.__engineLab.snapshot().parts.find(p => p.id === 'cover').position[1] > 7.5, null, { timeout: 30000 });
    await page.screenshot({ path: 'test-results/engine-exploded.png' });
    assert.equal((await snap()).removed.length, 0, 'Exploded inspection does not alter assembly state');
    await page.locator('#reset-view').click();
    await page.locator('#run-button').click();
    await page.waitForFunction(() => window.__engineLab.snapshot().angle > .3, null, { timeout: 30000 });
    assert.equal((await snap()).cutaway, true);
    await page.screenshot({ path: 'test-results/engine-running.png' });
    await page.locator('#run-button').click(); const frozen = (await snap()).angle;
    await page.waitForTimeout(300); assert.equal((await snap()).angle, frozen);
    await page.locator('#hologram-toggle').click();
    await page.locator('#cutaway-toggle').click();
    await page.screenshot({ path: 'test-results/engine-hologram.png' });
    await page.locator('#reset-view').click();
    await page.locator('#assemble-mode').click();
    assert.equal((await snap()).next, 'plug');
    assert.ok(await page.locator('#explode-range').isDisabled());
    assert.ok(await page.locator('#run-button').isDisabled());
    await page.locator('[data-part="crank"]').click();
    assert.equal((await snap()).removed.length, 0, 'Selecting a locked part does not remove it');
    const order = ['plug','cover','rockers','head','barrel','piston','flywheel','case-front','rod','crank'];
    for (let i = 0; i < order.length; i++) {
      assert.equal((await snap()).next, order[i]); await page.locator('#step-action').click();
      assert.deepEqual((await snap()).removed, order.slice(0, i + 1));
    }
    assert.ok(await page.locator('#step-action').isDisabled());
    await page.screenshot({ path: 'test-results/engine-disassembled.png' });
    await page.locator('#undo-button').click(); assert.equal((await snap()).removed.length, 9);
    await page.locator('#step-action').click();
    await page.locator('#put-together').click();
    for (let i = order.length - 1; i >= 0; i--) { assert.equal((await snap()).next, order[i]); await page.locator('#step-action').click(); assert.equal((await snap()).removed.length, i); }
    await page.locator('#inspect-mode').click(); await page.locator('#run-button').click(); assert.equal((await snap()).running, true);
    await page.reload(); await waitReady(); assert.equal((await snap()).running, false); assert.equal((await snap()).removed.length, 0);
    console.log('Orbit, zoom, isolation, underside, exploded view, cutaway, animation, hologram, full disassembly / reassembly, undo and refresh passed.');

    if (process.argv.includes('--camera')) {
      await context.grantPermissions(['camera']);
      await page.locator('#camera-toggle').click(); await page.locator('#enable-camera').click();
      await page.waitForFunction(() => { const s = window.__engineLab.snapshot().hands; return s.frames > 1 || (!s.starting && !s.ready); }, null, { timeout: 65000 });
      const camera = (await snap()).hands;
      assert.equal(camera.ready, true, await page.locator('#camera-status').textContent());
      assert.ok(camera.frames > 1, 'The real model processed synthetic camera frames in the worker');
      await page.screenshot({ path: 'test-results/engine-camera.png' });
      await page.locator('#camera-close').click(); assert.equal((await snap()).hands.tracks, 0);
      assert.equal((await snap()).hands.ready, false);
      console.log('Real MediaPipe worker loaded and processed camera frames; closing stopped all camera tracks.');
    }
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.screenshot({ path: 'test-results/engine-tablet.png' });
    assert.ok(await page.locator('#app').isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator('#device-notice').isVisible()); assert.equal(await page.locator('#app').isVisible(), false);
    const phone = await context.newPage(); await phone.setViewportSize({ width: 390, height: 844 });
    const phoneRequests = []; phone.on('request', r => phoneRequests.push(r.url())); await phone.goto(url);
    assert.ok(await phone.locator('#device-notice').isVisible());
    assert.ok(!phoneRequests.some(url => url.includes('/viewer.js') || url.includes('/model.js')), 'Phones do not download the renderer');
    await phone.close();
    console.log('Tablet layout, resize gate, and lightweight phone notice passed.');
  }
  assert.deepEqual(errors, []); console.log('No browser runtime errors.');
} finally { await browser.close(); }
