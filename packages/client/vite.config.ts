import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  // three.js is ~700 kB minified; it is cached after the first load.
  // Hashed bundles go to build/ (cached forever); public/assets keeps stable names.
  build: { chunkSizeWarningLimit: 900, assetsDir: "build" },
});
