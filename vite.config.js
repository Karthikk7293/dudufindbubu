import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Serve the pinned tracking runtime locally in development and emit identical
// files for Vercel. They are requested only after the camera is enabled.
const visionRoot = fileURLToPath(new URL('./node_modules/@mediapipe/tasks-vision/', import.meta.url));
const trackingFiles = ['vision_bundle.js', ...['vision_wasm_internal', 'vision_wasm_nosimd_internal', 'vision_wasm_module_internal'].flatMap(name => [`wasm/${name}.js`, `wasm/${name}.wasm`])];
const trackingAssets = () => ({
  name: 'local-hand-tracking',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split('?')[0];
      const file = trackingFiles.find(file => path === `/tracking/${file}`);
      if (!file) return next();
      res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(readFileSync(`${visionRoot}${file}`));
    });
  },
  generateBundle() {
    for (const file of trackingFiles) this.emitFile({ type: 'asset', fileName: `tracking/${file}`, source: readFileSync(`${visionRoot}${file}`) });
  },
});
export default defineConfig({
  plugins: [trackingAssets()],
  build: { rollupOptions: { input: { forest: fileURLToPath(new URL('./index.html', import.meta.url)), engine: fileURLToPath(new URL('./engine.html', import.meta.url)), character: fileURLToPath(new URL('./character.html', import.meta.url)) }, output: { manualChunks: { three: ['three'] } } } },
});
