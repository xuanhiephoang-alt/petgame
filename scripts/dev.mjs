// Starts the game server and the Vite client together, on any OS
// (`a & b` in an npm script runs them one after the other on Windows).
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
// One developer opens many worlds from 127.0.0.1 (tabs, "Tạo thế giới mới"), same reason as playwright.config.ts, so the
// server gets a high per-address cap. A value already set is kept so the 429 card can be tried by hand.
// `npm run play` keeps the real caps.
const children = ["@petgame/server", "@petgame/client"].map((workspace) =>
  spawn(npm, ["run", "dev", `--workspace=${workspace}`], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env:
      workspace === "@petgame/server"
        ? {
            ...process.env,
            PETGAME_MAX_WORLDS_PER_ADDRESS: process.env.PETGAME_MAX_WORLDS_PER_ADDRESS ?? "1000",
            // localhost may be ::1 (block 0:0:0::/48), so the /48 cap would hit before the raised address cap.
            PETGAME_MAX_WORLDS_PER_NETWORK: process.env.PETGAME_MAX_WORLDS_PER_NETWORK ?? "1000",
          }
        : process.env,
  }),
);
const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) child.on("exit", (code) => { stop(); process.exitCode = code ?? 0; });
