import { describe, expect, it } from "vitest";
import { NOT_EFFECTIVE, SKILLS, SUPER_EFFECTIVE, effectiveness, elementMultiplier, strongAgainst } from "./elements.ts";
import { PAL_SPECIES } from "./pals.ts";

describe("elements", () => {
  it("follows the cycle fire > grass > earth > electric > water > fire", () => {
    expect(elementMultiplier("fire", "grass")).toBe(SUPER_EFFECTIVE);
    expect(elementMultiplier("grass", "earth")).toBe(SUPER_EFFECTIVE);
    expect(elementMultiplier("earth", "electric")).toBe(SUPER_EFFECTIVE);
    expect(elementMultiplier("electric", "water")).toBe(SUPER_EFFECTIVE);
    expect(elementMultiplier("water", "fire")).toBe(SUPER_EFFECTIVE);
    expect(elementMultiplier("grass", "fire")).toBe(NOT_EFFECTIVE);
    expect(elementMultiplier("fire", "fire")).toBe(1);
    expect(elementMultiplier("fire", "electric")).toBe(1);
  });

  it("labels effectiveness and strengths", () => {
    expect(effectiveness(1.5)).toBe("super");
    expect(effectiveness(0.75)).toBe("weak");
    expect(effectiveness(1)).toBe("normal");
    expect(strongAgainst("water")).toBe("fire");
  });

  it("every species element has a skill", () => {
    for (const s of PAL_SPECIES) expect(SKILLS[s.element]).toBeDefined();
  });
});
