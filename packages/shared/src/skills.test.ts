import { describe, expect, it } from "vitest";
import { PAL_SPECIES, getSpecies } from "./pals.ts";
import {
  SKILL_DEFS,
  SKILL_LEVELS,
  getSkill,
  inSkillArea,
  isSupport,
  knownSkills,
  learnset,
  newSkillAt,
  skillPower,
  skillReach,
  skillTravelMs,
} from "./skills.ts";

describe("skills", () => {
  it("has unique ids and what each shape needs", () => {
    expect(new Set(SKILL_DEFS.map((s) => s.id)).size).toBe(SKILL_DEFS.length);
    for (const s of SKILL_DEFS) {
      expect(s.castMs, s.id).toBeGreaterThan(0);
      expect(s.cooldownMs, s.id).toBeGreaterThan(s.castMs);
      if (!isSupport(s)) expect(s.power, s.id).toBeGreaterThan(0);
      if (["projectile", "lob", "wave"].includes(s.shape)) expect(s.speed, s.id).toBeGreaterThan(0);
      if (s.shape === "cone") expect(s.angle, s.id).toBeGreaterThan(0);
      if (!isSupport(s) && s.shape !== "cone") expect(s.radius, s.id).toBeGreaterThan(0);
      if (["projectile", "lob", "beam", "strike", "zone", "cone", "wave", "melee"].includes(s.shape)) expect(s.range, s.id).toBeGreaterThan(0);
      if (s.shape === "shield") expect(s.shieldMs, s.id).toBeGreaterThan(0);
    }
  });

  it("gives every species three skills, all of them used, the first one at level 1", () => {
    const used = new Set<string>();
    for (const species of PAL_SPECIES) {
      const set = learnset(species);
      expect(set.map((l) => l.level)).toEqual([...SKILL_LEVELS]);
      set.forEach((l) => used.add(l.skill.id));
      expect(isSupport(set[0].skill), species.id).toBe(false); // something to fight with from the start
    }
    expect(used.size).toBe(SKILL_DEFS.length);
  });

  it("learns skills as it levels up", () => {
    const ember = getSpecies("emberpup");
    expect(knownSkills(ember, 1).map((s) => s.id)).toEqual(["ember"]);
    expect(knownSkills(ember, 7).map((s) => s.id)).toEqual(["ember", "fire_breath"]);
    expect(knownSkills(ember, 30).map((s) => s.id)).toEqual(["ember", "fire_breath", "flame_ring"]);
    expect(newSkillAt(ember, 7)?.id).toBe("fire_breath");
    expect(newSkillAt(ember, 8)).toBeUndefined();
  });

  it("hits harder at higher levels", () => {
    const ember = getSkill("ember");
    expect(skillPower(ember, 1)).toBe(ember.power);
    expect(skillPower(ember, 10)).toBe(Math.round(ember.power * (1 + 0.12 * 9)));
    for (let level = 2; level <= 30; level++) expect(skillPower(ember, level)).toBeGreaterThanOrEqual(skillPower(ember, level - 1));
    expect(skillPower(getSkill("meteor"), 15)).toBeGreaterThan(skillPower(getSkill("ember"), 15));
  });

  it("travels at its speed, or takes its own time", () => {
    expect(skillTravelMs(getSkill("ember"), 180)).toBe(500);
    expect(skillTravelMs(getSkill("thunder"), 999)).toBe(getSkill("thunder").durationMs);
    expect(skillTravelMs(getSkill("pincer"), 40)).toBe(0);
    expect(skillReach(getSkill("flame_ring"))).toBeLessThan(getSkill("flame_ring").radius!);
  });

  it("covers its area: around where it lands, around the caster, a fan or a line", () => {
    const from = { x: 0, y: 0 }, aim = { x: 100, y: 0 };
    const ember = getSkill("ember");
    expect(inSkillArea(ember, from, aim, { x: 110, y: 0 })).toBe(true);
    expect(inSkillArea(ember, from, aim, { x: 140, y: 0 })).toBe(false);
    expect(inSkillArea(ember, from, aim, { x: 140, y: 0 }, 25)).toBe(true);

    const ring = getSkill("flame_ring");
    expect(inSkillArea(ring, from, aim, { x: -80, y: 30 })).toBe(true);
    expect(inSkillArea(ring, from, aim, { x: 0, y: 120 })).toBe(false);

    const breath = getSkill("fire_breath");
    expect(inSkillArea(breath, from, aim, { x: 60, y: 20 })).toBe(true);
    expect(inSkillArea(breath, from, aim, { x: 0, y: 60 })).toBe(false); // beside, not in front
    expect(inSkillArea(breath, from, aim, { x: -40, y: 0 })).toBe(false); // behind

    const wave = getSkill("tidal_wave");
    expect(inSkillArea(wave, from, aim, { x: 130, y: 20 })).toBe(true); // rolls on past the aim
    expect(inSkillArea(wave, from, aim, { x: 60, y: 60 })).toBe(false);
    expect(inSkillArea(getSkill("pollen"), from, aim, from)).toBe(false);
  });
});
