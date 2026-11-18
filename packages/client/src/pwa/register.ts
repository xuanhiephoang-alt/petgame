/**
 * Registers the service worker (dist/sw.js). Does nothing unless all of these hold:
 * - the build is a production one (Vite dev has HMR and the e2e tests on 5173 must not see a worker);
 * - the browser has service workers (missing on plain http over the LAN, e.g. `npm run play` from a phone, and in
 *   old browsers);
 * - registering does not throw (some private modes raise SecurityError).
 * It registers on `load` so that precaching never competes with the first download, and never throws.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const register = () => {
      navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch((err) => console.warn("Service worker not registered", err));
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  } catch (err) {
    console.warn("Service worker not registered", err);
  }
}
