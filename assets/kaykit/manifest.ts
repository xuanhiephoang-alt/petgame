/** Which KayKit files the game uses. Shared by import.ts and its test. */

export const NATURE_MODELS = [
  "Tree_1_A", "Tree_1_B", "Tree_2_A", "Tree_2_C", "Tree_3_A", "Tree_4_A", "Tree_4_B", "Tree_5_A", "Tree_6_A", "Tree_7_A",
  "Bush_1_A", "Bush_1_C", "Bush_2_A", "Bush_2_C", "Bush_4_A",
  "Rock_1_A", "Rock_1_E", "Rock_2_A", "Rock_3_A", "Rock_3_E", "Rock_5_A",
  "Grass_1_A", "Grass_1_C", "Grass_2_A", "Grass_2_C",
];

/** Player slot order: slot i uses CHARACTERS[i] (see client characters.ts). */
export const CHARACTERS = ["Druid", "Ranger", "Mage", "Barbarian", "Knight"];

export const ANIM_SETS: Record<string, { file: string; keep: string[] }> = {
  general: { file: "Rig_Medium_General.glb", keep: ["Idle_A", "Hit_A", "Throw", "Interact", "PickUp"] },
  movement: { file: "Rig_Medium_MovementBasic.glb", keep: ["Walking_A", "Running_A"] },
  combat: { file: "Rig_Medium_CombatMelee.glb", keep: ["Melee_Unarmed_Attack_Punch_A"] },
};
