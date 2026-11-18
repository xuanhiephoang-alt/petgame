import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { build, defineConfig, type Plugin } from "vite";
import { precacheUrls } from "./src/pwa/swLogic.ts";

/** Lists the files under `dir` recursively, as POSIX paths relative to `base`. */
function listFiles(dir: string, base: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [relative(base, full).split("\\").join("/")];
  });
}

/**
 * After the build, bundles src/pwa/sw.ts into dist/sw.js (one classic script) with the build version and the
 * precache list baked in. The version depends only on the content, so an unchanged build gives the same version.
 */
function serviceWorker(): Plugin {
  let root = "";
  let outDir = "";
  return {
    name: "petgame-service-worker",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const precache = precacheUrls(listFiles(outDir, outDir));
      const version = createHash("sha256")
        .update(readFileSync(join(outDir, "index.html"), "utf8") + "\n" + precache.join("\n"))
        .digest("hex")
        .slice(0, 12);
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
