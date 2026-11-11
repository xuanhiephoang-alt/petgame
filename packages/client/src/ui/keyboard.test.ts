import { describe, expect, it } from "vitest";
import { worldKeysPaused } from "./keyboard.ts";

describe("worldKeysPaused", () => {
  it("pauses in an open dialog whatever the focus", () => {
    for (const focusInOpenPanel of [false, true]) {
      for (const focusByKeyboard of [false, true]) {
        expect(worldKeysPaused({ dialogOpen: true, focusInOpenPanel, focusByKeyboard })).toBe(true);
      }
    }
  });

  it("pauses when the keyboard brought the focus into an open panel", () => {
    expect(worldKeysPaused({ dialogOpen: false, focusInOpenPanel: true, focusByKeyboard: true })).toBe(true);
  });

  it("keeps the keys on when a click left the focus in a panel", () => {
    expect(worldKeysPaused({ dialogOpen: false, focusInOpenPanel: true, focusByKeyboard: false })).toBe(false);
  });

  it("keeps the keys on for a keyboard focus outside the panels (a HUD button)", () => {
    expect(worldKeysPaused({ dialogOpen: false, focusInOpenPanel: false, focusByKeyboard: true })).toBe(false);
  });

  it("does not pause with nothing going on", () => {
    expect(worldKeysPaused({ dialogOpen: false, focusInOpenPanel: false, focusByKeyboard: false })).toBe(false);
  });
});
