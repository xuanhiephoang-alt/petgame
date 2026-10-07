import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  // Phaser alone is ~1.2 MB minified; it is cached after the first load.
  build: { chunkSizeWarningLimit: 1600 },
});
