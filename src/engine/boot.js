const $ = id => document.getElementById(id);
let started = false, app;
function supported() {
  return innerWidth >= 768 && (!matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) >= 600);
}
async function boot() {
  const ok = supported();
  $('device-notice').hidden = ok;
  if (!ok) { $('loading').hidden = true; $('app').hidden = true; app?.setVisible(false); return; }
  if (app) { $('app').hidden = false; app.setVisible(true); return; }
  if (started) return;
  started = true; $('loading').hidden = false;
  const progress = async (value, message) => {
    $('loading-progress').value = value; $('loading-message').textContent = message;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  try {
    await progress(15, 'Preparing the 3D workspace…');
    const { createLab } = await import('./main.js');
    $('app').hidden = false;
    app = await createLab(progress);
    $('loading').hidden = true;
    if (!supported()) { $('app').hidden = true; app.setVisible(false); }
  } catch (error) {
    console.error(error);
    $('app').hidden = true;
    $('loading-message').textContent = 'The workbench could not open. Check your connection and that WebGL / hardware acceleration is enabled, then retry.';
    $('retry').hidden = false;
  }
}
$('retry').addEventListener('click', () => location.reload());
window.addEventListener('resize', boot);
boot();
