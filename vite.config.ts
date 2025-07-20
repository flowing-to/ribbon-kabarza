import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import glsl from "vite-plugin-glsl";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), glsl()],
  // base: 'https://flowing-canvas.vercel.app/',
  server: {
    host: "0.0.0.0",
    // Allow any origin and all CORS settings
    cors: true,
    hmr: {
      host: "localhost",
      protocol: "ws",
    },
    allowedHosts: true,
  },
  build: {
    minify: true,
    manifest: true,
    outDir: "build",
    rollupOptions: {
      input: "./src/main.tsx",
      output: {
        format: "umd",
        entryFileNames: "main.js",
        compact: true,
        globals: {
          jquery: "$",
        },
        assetFileNames: (assetInfo) => {
          // Keep images and textures as separate files
          if (assetInfo.name?.match(/\.(webp|jpg|jpeg|png|svg)$/i)) {
            return "images/[name][extname]";
          }
          if (assetInfo.name?.match(/\.(ttf|woff|woff2|otf)$/i)) {
            return "fonts/[name][extname]";
          }
          return "assets/[name][extname]";
        },
      },
      external: ["jquery"],
    },
    assetsInlineLimit: (filePath, content) => {
      // Inline fonts regardless of size
      if (
        filePath.endsWith(".ttf") ||
        filePath.endsWith(".woff") ||
        filePath.endsWith(".woff2") ||
        filePath.endsWith(".otf")
      ) {
        return true;
      }
      // Never inline images/textures - keep them as separate files
      if (
        filePath.endsWith(".webp") ||
        filePath.endsWith(".jpg") ||
        filePath.endsWith(".jpeg") ||
        filePath.endsWith(".png") ||
        filePath.endsWith(".svg")
      ) {
        return false;
      }
      // For other assets (including CSS), inline them
      return true;
    },
  },
});
