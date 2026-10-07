import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // Headless Chromium renders WebGL in software, so 3D pages load slowly.
  timeout: 180_000,
  use: {
    baseURL: "http://localhost:5173",
    ...devices["Desktop Chrome"],
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
