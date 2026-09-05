import { defineConfig, transformWithEsbuild } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [{
    name: 'keep-playground-out-of-library',
    async generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        const leaked = Object.keys(output.modules).find(id => /tweakpane|playground-controls|prototype\/review\.ts/.test(id));
        if (leaked) this.error(`Playground code entered the carousel library: ${leaked}`);
        if (output.isEntry) {
          // Vite deliberately preserves whitespace/pure annotations in ESM
          // libraries for downstream bundlers. Also provide a finished browser
          // artifact for direct imports, where no further bundling takes place.
          const minified = await transformWithEsbuild(output.code, output.fileName, {
            format: 'esm', target: 'es2020', minify: true, legalComments: 'inline',
          });
          this.emitFile({ type: 'asset', fileName: 'ribbon-carousel.min.js', source: minified.code });
        }
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
