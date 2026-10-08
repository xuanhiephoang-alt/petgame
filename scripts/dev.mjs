// Starts the game server and the Vite client together, on any OS
// (`a & b` in an npm script runs them one after the other on Windows).
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = ["@petgame/server", "@petgame/client"].map((workspace) =>
  spawn(npm, ["run", "dev", `--workspace=${workspace}`], { stdio: "inherit", shell: process.platform === "win32" }),
);
const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) child.on("exit", (code) => { stop(); process.exitCode = code ?? 0; });
