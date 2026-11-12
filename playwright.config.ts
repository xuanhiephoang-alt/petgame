import { defineConfig, devices } from "@playwright/test";
import { chromiumLaunchOptions } from "./scripts/chromium.mjs";

export default defineConfig({
  testDir: "tests/e2e",
  // Headless Chromium renders WebGL in software, so the game loads slowly.
  timeout: 180_000,
  use: {
    baseURL: "http://localhost:5173",
    ...devices["Desktop Chrome"],
    // Chromium to start: the cloud container's preinstalled one if present; PETGAME_CHROMIUM overrides (scripts/chromium.mjs).
    launchOptions: chromiumLaunchOptions(),
  },
  webServer: [
    {
      command: "npm run start --workspace=@petgame/server",
      port: 2567,
      // Enables test-only messages such as debug:spawnPal.
      // The world caps are lifted: e2e opens many worlds from one address (127.0.0.1) within a minute and each lives
      // 60 s. The caps themselves are tested in packages/server/src/worldLimits.test.ts.
      env: { PETGAME_DEBUG: "1", PETGAME_DB: ":memory:", PETGAME_MAX_WORLDS: "1000", PETGAME_MAX_WORLDS_PER_ADDRESS: "1000" },
      reuseExistingServer: false,
    },
    {
      command: "npm run dev --workspace=@petgame/client",
      port: 5173,
      reuseExistingServer: false,
    },
  ],
});
