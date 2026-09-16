import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream'] });
const url = process.env.ENGINE_URL || 'http://localhost:3000/engine.html';
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const snap = () => page.evaluate(() => window.__engineLab.snapshot());
const ready = () => page.waitForFunction(() => window.__engineLab, null, { timeout: 60000 });
async function stable() {
  await page.waitForFunction(() => window.__engineLab.settled(), null, { timeout: 45000 });
}
async function partPoint(id) {
  return page.evaluate(id => {
    const origin = window.__engineLab.project(id);
    for (let radius = 0; radius <= 55; radius += 4) {
      for (let a = 0; a < Math.PI * 2; a += .45) {
        const x = origin.x + Math.cos(a) * radius, y = origin.y + Math.sin(a) * radius;
        if (window.__engineLab.pick(x, y) === id && document.elementFromPoint(x, y)?.tagName === 'CANVAS') return { x, y };
      }
    }
    return null;
  }, id);
}
async function dragPart(id, fraction, reverse = false) {
  await stable();
  const start = await partPoint(id); assert.ok(start, `A visible ${id} surface can be grabbed`);
  const path = await page.evaluate(id => window.__engineLab.path(id), id);
  let dx = path.b.x - path.a.x, dy = path.b.y - path.a.y;
  if (Math.hypot(dx, dy) < 40) { dx = 0; dy = -160; }
  const sign = reverse ? -1 : 1;
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  assert.equal(await page.evaluate(() => window.__engineLab.drag()?.id), id, 'Pointer down grabs the intended mesh');
  await page.mouse.move(start.x + dx * fraction * sign, start.y + dy * fraction * sign, { steps: 15 });
  const drag = await page.evaluate(() => window.__engineLab.drag());
  assert.ok(drag && Math.abs(drag.amount - (reverse ? 1 - fraction : fraction)) < .05, `Pointer projects along the movement guide: ${JSON.stringify(drag)}`);
  await page.mouse.up();
}
try {
  if (!process.argv.includes('--touch-only') && !process.argv.includes('--production-only')) {
  await page.goto(url); await ready(); await page.screenshot({ path: 'test-results/engine-final-inspect.png' });
  await page.locator('#labels-toggle').click(); await page.locator('#assemble-mode').click();
  await dragPart('plug', .3); assert.equal((await snap()).removed.length, 0, 'Partial removal snaps back');
  await dragPart('plug', .95); assert.deepEqual((await snap()).removed, ['plug'], 'Dragging the actual mesh completes removal');
  await page.locator('#put-together').click(); await dragPart('plug', .95, true);
  assert.deepEqual((await snap()).removed, [], 'Dragging to the seat snaps the plug back in');
  await page.locator('#take-apart').click(); await page.locator('#step-action').click();
  await stable(); await page.screenshot({ path: 'test-results/engine-final-assembly.png' });
  console.log('Actual mesh drag, partial-drag cancellation, and reverse snap assembly passed.');

  await page.locator('#inspect-mode').click(); await page.locator('#reset-view').click();
  await page.locator('#run-button').click(); await page.locator('#speed-range').fill('2');
  await page.locator('#reset-view').click(); assert.equal(await page.locator('#speed-range').inputValue(), '1');
  await page.locator('#cutaway-toggle').click(); await page.locator('#assemble-mode').click();
  assert.equal((await snap()).cutaway, false, 'Assembly reveals the external parts again');
  await page.locator('#reset-view').click();
  await context.grantPermissions([]);
  await page.locator('#camera-toggle').click(); await page.locator('#enable-camera').click();
  await page.waitForFunction(() => document.getElementById('camera-status').textContent.includes('denied'));
  assert.equal((await snap()).hands.tracks, 0); assert.equal((await snap()).hands.starting, false);
  await page.locator('#camera-close').click();
  await context.grantPermissions(['camera']);
  await context.route('**/models/hand_landmarker.task', route => route.abort());
  await page.locator('#camera-toggle').click(); await page.locator('#enable-camera').click();
  await page.waitForFunction(() => document.getElementById('camera-status').textContent.includes('could not load'), null, { timeout: 60000 });
  assert.equal((await snap()).hands.tracks, 0, 'Model failure releases the camera');
  assert.equal(await page.locator('#enable-camera').isEnabled(), true);
  await page.locator('#camera-close').click();
  await context.unroute('**/models/hand_landmarker.task');
  console.log('Camera denial and real model-download failure show retry and release camera tracks.');
  }
  await page.close();

  if (!process.argv.includes('--production-only')) {
  const touch = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const tablet = await touch.newPage(); tablet.on('pageerror', e => errors.push(e.message));
  await tablet.goto(url); await tablet.waitForFunction(() => window.__engineLab, null, { timeout: 60000 });
  const client = await touch.newCDPSession(tablet);
  const cameraBefore = await tablet.evaluate(() => window.__engineLab.snapshot().camera);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 670, y: 350, id: 1 }] });
  for (let i = 1; i <= 8; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 670 + i * 10, y: 350 + i * 5, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notDeepEqual(await tablet.evaluate(() => window.__engineLab.snapshot().camera), cameraBefore);
  const zoomBefore = await tablet.evaluate(() => window.__engineLab.snapshot().distance);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 610, y: 440, id: 1 }, { x: 740, y: 440, id: 2 }] });
  for (let i = 1; i <= 6; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 610 - i * 7, y: 440, id: 1 }, { x: 740 + i * 7, y: 440, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok(await tablet.evaluate(() => window.__engineLab.snapshot().distance) < zoomBefore, 'Real two-finger touch pinches zoom in');
  await tablet.screenshot({ path: 'test-results/engine-final-tablet.png' });
  await touch.close(); console.log('Tablet touch orbit and two-finger pinch passed.');
  }

  const failure = await context.newPage();
  await failure.route('**/src/engine/main.js*', route => route.abort()); await failure.goto(url);
  await failure.waitForSelector('#retry:not([hidden])');
  assert.ok(await failure.locator('#loading').isVisible()); assert.equal(await failure.locator('#app').isVisible(), false);
  await failure.close(); console.log('Failed app loading preserves the loading/retry screen.');

  // The actual production build must initialize its worker with only built files.
  const prod = await context.newPage(), external = [];
  const prodUrl = process.env.ENGINE_PREVIEW_URL || 'http://localhost:4173/engine.html';
  await context.grantPermissions(['camera'], { origin: new URL(prodUrl).origin });
  prod.on('pageerror', e => errors.push(e.message));
  prod.on('request', r => { if (!r.url().startsWith(new URL(prodUrl).origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await prod.goto(prodUrl); await prod.waitForSelector('#loading[hidden]', { state: 'attached', timeout: 60000 });
  assert.equal(await prod.evaluate(() => typeof window.__engineLab), 'undefined', 'Production does not expose the development test API');
  await prod.locator('#camera-toggle').click(); await prod.locator('#enable-camera').click();
  await prod.waitForFunction(() => document.getElementById('camera-status').textContent.includes('No hands in view'), null, { timeout: 65000 });
  await prod.locator('#camera-close').click();
  await prod.locator('#assemble-mode').click(); await prod.locator('#step-action').click();
  assert.match(await prod.locator('#scene-status').textContent(), /1 of 10/);
  await prod.screenshot({ path: 'test-results/engine-production.png' });
  assert.deepEqual(external, [], 'Production uses only same-origin assets');
  await prod.close(); console.log('Production build renders, assembles, and runs real webcam inference without external asset requests.');
  assert.deepEqual(errors, []); console.log('All additional input and failure checks passed without runtime errors.');
} finally { await browser.close(); }
