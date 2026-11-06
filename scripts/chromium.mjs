// Not a script to run: shared by playwright.config.ts and scripts/shots.mjs so
// that every place that starts Chromium picks the browser the same way.
import { existsSync } from "node:fs";

/**
 * Chromium preinstalled in the cloud container (a symlink kept by the container
 * image). Its build can differ from the one the pinned @playwright/test wants
 * (for example 1243 versus 1194), so Playwright cannot find it on its own.
 */
export const PREINSTALLED_CHROMIUM = "/opt/pw-browsers/chromium";

/**
 * Chooses which Chromium to start. The first matching rule wins:
 * 1. PETGAME_CHROMIUM=playwright: Playwright's own browser (CI sets this).
 * 2. PETGAME_CHROMIUM=<path>: that executable; throws if the file is missing,
 *    so a typo fails once at config load instead of in every test.
 * 3. Unset or blank: PREINSTALLED_CHROMIUM when it exists.
 * 4. Otherwise `{}`, which keeps Playwright's default (CI, players' machines).
 *
 * No extra browser flags are needed: Playwright adds --headless and --no-sandbox
 * itself, and headless WebGL runs on SwiftShader. Beware of a long TMPDIR: the
 * full Chrome creates a socket there and exits with "Socket path too long".
 * Prints nothing, because Playwright reloads the config in every worker.
 *
 * @param {Record<string, string | undefined>} [env] environment to read (injectable for tests)
 * @param {(path: string) => boolean} [exists] file check (injectable for tests)
 * @returns {{ executablePath?: string }} options for `launch` / `use.launchOptions`
 */
export function chromiumLaunchOptions(env = process.env, exists = existsSync) {
  const choice = (env.PETGAME_CHROMIUM ?? "").trim();
  if (choice === "playwright") return {};
  if (choice) {
    if (!exists(choice)) {
      throw new Error(`PETGAME_CHROMIUM is "${choice}", but there is no file there: give the path to a Chromium executable, or "playwright" for Playwright's own browser`);
    }
    return { executablePath: choice };
  }
  if (exists(PREINSTALLED_CHROMIUM)) return { executablePath: PREINSTALLED_CHROMIUM };
  return {};
}
