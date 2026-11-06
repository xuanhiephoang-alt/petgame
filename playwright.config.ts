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
      env: { PETGAME_DEBUG: "1", PETGAME_DB: ":memory:" },
      reuseExistingServer: false,
    },
    {
      command: "npm run dev --workspace=@petgame/client",
      port: 5173,
      reuseExistingServer: false,
    },
  ],
});
