import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./register.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A navigator whose serviceWorker getter throws, like a browser that blocks storage. */
function throwingNavigator() {
  const nav = {};
  Object.defineProperty(nav, "serviceWorker", {
    get() {
      throw new DOMException("denied", "SecurityError");
    },
  });
  return nav;
}

describe("registerServiceWorker", () => {
  it("never throws, not even inside the load callback", () => {
    vi.stubEnv("PROD", true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let onLoad: (() => void) | undefined;
    vi.stubGlobal("navigator", throwingNavigator());
    vi.stubGlobal("document", { readyState: "loading" });
    vi.stubGlobal("window", { addEventListener: (_type: string, listener: () => void) => (onLoad = listener) });
    expect(() => registerServiceWorker()).not.toThrow();
    expect(onLoad).toBeDefined();
    expect(() => onLoad?.()).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("registers at once when the page is already loaded", () => {
    vi.stubEnv("PROD", true);
    const register = vi.fn(() => Promise.resolve({}));
    const addEventListener = vi.fn();
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    vi.stubGlobal("document", { readyState: "complete" });
    vi.stubGlobal("window", { addEventListener });
    registerServiceWorker();
    expect(register).toHaveBeenCalledWith("/sw.js");
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it("warns and does not throw when register rejects", async () => {
    vi.stubEnv("PROD", true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("navigator", { serviceWorker: { register: () => Promise.reject(new Error("no")) } });
    vi.stubGlobal("document", { readyState: "complete" });
    vi.stubGlobal("window", { addEventListener: vi.fn() });
    expect(() => registerServiceWorker()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("does nothing outside a production build", () => {
    vi.stubEnv("PROD", false);
    const addEventListener = vi.fn();
    const nav = {};
    const getter = vi.fn();
    Object.defineProperty(nav, "serviceWorker", { get: getter });
    vi.stubGlobal("navigator", nav);
    vi.stubGlobal("document", { readyState: "loading" });
    vi.stubGlobal("window", { addEventListener });
    registerServiceWorker();
    expect(getter).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalled();
  });
});
