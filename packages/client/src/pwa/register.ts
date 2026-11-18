/**
 * Registers the service worker (dist/sw.js). Does nothing unless all of these hold:
 * - the build is a production one (Vite dev has HMR and the e2e tests on 5173 must not see a worker);
 * - the browser has service workers (missing on plain http over the LAN, e.g. `npm run play` from a phone, and in
 *   old browsers);
 * - registering does not throw (some private modes raise SecurityError).
 * It registers on `load` so that precaching never competes with the first download, and never throws, not even
 * later in the load callback.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  const warn = (err: unknown) => console.warn("Service worker not registered", err);
  try {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      try {
        navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(warn);
      } catch (err) {
        warn(err);
      }
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  } catch (err) {
    warn(err);
  }
}
