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
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev --workspace=@petgame/client",
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
