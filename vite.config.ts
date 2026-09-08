import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const OUT_DIR = 'public';
const ASSETS_DIR = 'app-assets';
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The React front door is built into ./public, which the Worker already serves
// through its ASSETS binding. emptyOutDir stays false so the vanilla journey
// engine, offline pack, vendored MapLibre and evidence results survive a build.
// Only the React bundle directory is cleared, otherwise stale hashed chunks
// accumulate there and get swept into the offline pack manifest.
export default defineConfig({
  root: 'app',
  base: '/',
  resolve: {
    // MapLibre is already vendored at /vendor/maplibre-gl/ for the engine app
    // under /app and is loaded by index.html. Alias the bare import to that
    // global so the ~920 KB library is not also bundled into the React chunk.
    alias: [
      { find: /^maplibre-gl\/dist\/maplibre-gl\.css$/, replacement: here('app/src/vendor/empty.css') },
      { find: /^maplibre-gl$/, replacement: here('app/src/vendor/maplibre.ts') },
    ],
  },
  plugins: [
    react(),
    {
      name: 'clean-app-assets',
      async buildStart() {
        await rm(`${OUT_DIR}/${ASSETS_DIR}`, { recursive: true, force: true });
      },
    },
  ],
  build: {
    outDir: `../${OUT_DIR}`,
    emptyOutDir: false,
    assetsDir: ASSETS_DIR,
    sourcemap: false,
  },
});
