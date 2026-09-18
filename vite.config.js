import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        forest: fileURLToPath(new URL('./index.html', import.meta.url)),
        character: fileURLToPath(new URL('./character.html', import.meta.url)),
      },
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
