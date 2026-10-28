import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  // PixiJS is ~600 kB minified; it is cached after the first load.
  // Hashed bundles go to build/ (cached forever); public/assets keeps stable names.
  // sprites.html (the art gallery) is for development only and not built.
  build: { chunkSizeWarningLimit: 900, assetsDir: "build" },
});
