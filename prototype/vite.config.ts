import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [{
    name: 'keep-playground-out-of-library',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        const leaked = Object.keys(output.modules).find(id => /tweakpane|playground-controls|prototype\/review\.ts/.test(id));
        if (leaked) this.error(`Playground code entered the carousel library: ${leaked}`);
      }
    },
  }],
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
