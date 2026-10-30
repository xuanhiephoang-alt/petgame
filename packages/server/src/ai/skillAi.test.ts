import { describe, expect, it } from "vitest";
import { getSkill, getSpecies, knownSkills } from "@petgame/shared";
import { chooseSkill } from "./skillAi.ts";

describe("choosing skills", () => {
  const ember = knownSkills(getSpecies("emberpup"), 15);
  const all = () => true;

  it("uses the strongest ready skill that reaches the target", () => {
    expect(chooseSkill({ known: ember, ready: all, targetDistance: 60, hurt: 1, healBelow: 0.7, fighting: true })?.id).toBe("flame_ring");
    expect(chooseSkill({ known: ember, ready: all, targetDistance: 120, hurt: 1, healBelow: 0.7, fighting: true })?.id).toBe("ember");
    const notRing = (s: { id: string }) => s.id !== "flame_ring";
    expect(chooseSkill({ known: ember, ready: notRing, targetDistance: 60, hurt: 1, healBelow: 0.7, fighting: true })?.id).toBe("fire_breath");
    expect(chooseSkill({ known: ember, ready: all, targetDistance: 400, hurt: 1, healBelow: 0.7, fighting: true })).toBeUndefined();
    expect(chooseSkill({ known: ember, ready: all, hurt: 1, healBelow: 0.7, fighting: false })).toBeUndefined();
  });

  it("heals when its side is hurt, and shields in a fight", () => {
    const bubbloon = knownSkills(getSpecies("bubbloon"), 7);
    expect(chooseSkill({ known: bubbloon, ready: all, hurt: 0.5, healBelow: 0.7, fighting: false })?.id).toBe("healing_rain");
    expect(chooseSkill({ known: bubbloon, ready: all, targetDistance: 60, hurt: 0.9, healBelow: 0.7, fighting: true })?.id).toBe("bubble");
    const pebblet = knownSkills(getSpecies("pebblet"), 7);
    expect(chooseSkill({ known: pebblet, ready: all, targetDistance: 300, hurt: 1, healBelow: 0.7, fighting: true })).toBe(getSkill("stone_shield"));
  });
});
