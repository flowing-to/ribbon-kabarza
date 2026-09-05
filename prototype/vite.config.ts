import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    outDir: 'dist/prototype',
    lib: {
      entry: fileURLToPath(new URL('./carousel.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'ribbon-carousel',
    },
    minify: 'esbuild',
  },
});
