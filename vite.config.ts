import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import glsl from "vite-plugin-glsl";
import { motionTracePlugin } from "./dev/motion-trace-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), glsl(), motionTracePlugin()],
  // Linked/isolated package installs must share the original app's React runtime.
  resolve: { dedupe: ["react", "react-dom", "three", "@react-three/fiber"] },
  // base: 'https://flowing-canvas.vercel.app/',
  server: {
    host: "0.0.0.0",
    // Allow any origin and all CORS settings
    cors: true,
    hmr: {
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
        esModule: false,
        compact: true,
        globals: {
          jquery: "$",
        },
      },
      external: ["jquery"],
    },
  },
});
