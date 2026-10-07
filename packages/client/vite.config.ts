import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  // three.js is ~700 kB minified; it is cached after the first load.
  build: { chunkSizeWarningLimit: 900 },
});
