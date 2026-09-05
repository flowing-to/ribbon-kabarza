import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Static review build for sharing independently of the development server.
export default defineConfig({
  plugins: [{
    name: 'share-playground',
    transformIndexHtml(html) {
      return html.replace(/<a href="\/"[^>]*>Original reference ↗<\/a>/, '');
    },
  }],
  build: {
    outDir: 'dist/share',
    rollupOptions: { input: fileURLToPath(new URL('./index.html', import.meta.url)) },
  },
});
