import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { build, defineConfig, type Plugin } from "vite";
import { precacheUrls, swVersion } from "./src/pwa/swLogic.ts";

/** Lists the files under `dir` recursively, as POSIX paths relative to `base`. */
function listFiles(dir: string, base: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [relative(base, full).split("\\").join("/")];
  });
}

/**
 * After the build, bundles src/pwa/sw.ts into dist/sw.js (one classic script) with the build version and the
 * precache list baked in. The version hashes index.html, the manifest, the worker's own source and the precache
 * list, so an unchanged build gives the same version and any change to what the worker stores or does gives a new cache.
 */
function serviceWorker(): Plugin {
  let root = "";
  let outDir = "";
  let failed = false;
  return {
    name: "petgame-service-worker",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    buildStart() {
      failed = false;
    },
    buildEnd(error) {
      if (error) failed = true;
    },
    renderError() {
      failed = true;
    },
    async closeBundle(error) {
      // A failed main build keeps its own error; reading dist/index.html here would only add an ENOENT on top.
      if (error || failed) return;
      const precache = precacheUrls(listFiles(outDir, outDir));
      const version = await swVersion({
        indexHtml: readFileSync(join(outDir, "index.html"), "utf8"),
        manifest: readFileSync(join(outDir, "manifest.webmanifest"), "utf8"),
        workerSources: [resolve(root, "src/pwa/sw.ts"), resolve(root, "src/pwa/swLogic.ts")].map((f) => readFileSync(f, "utf8")),
        precache,
      });
      // configFile: false, so this second build does not load this plugin again.
      await build({
        configFile: false,
        root,
        logLevel: "warn",
        publicDir: false,
        define: { __PETGAME_SW__: JSON.stringify({ version, precache }) },
        build: {
          outDir,
          emptyOutDir: false,
          copyPublicDir: false,
          minify: true,
          sourcemap: false,
          lib: { entry: resolve(root, "src/pwa/sw.ts"), formats: ["iife"], name: "petgameSw", fileName: () => "sw.js" },
        },
      });
      console.log(`service worker ${version}: ${precache.length} files precached`);
    },
  };
}

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  plugins: [serviceWorker()],
  // PixiJS is ~600 kB minified; it is cached after the first load.
  // Hashed bundles go to build/ (cached forever); public/assets keeps stable names.
  // sprites.html (the art gallery) is for development only and not built.
  build: { chunkSizeWarningLimit: 900, assetsDir: "build" },
});
