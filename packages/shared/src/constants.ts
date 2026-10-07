/** Hard cap on players sharing one world. */
export const MAX_PLAYERS = 5;

/** Server simulation rate (ticks per second). */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/** World size in pixels. */
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1200;

/** Pixels per second. */
export const PLAYER_SPEED = 160;
export const PLAYER_RADIUS = 12;

export const ATTACK_RANGE = 48;
export const ATTACK_DAMAGE = 10;
export const ATTACK_COOLDOWN_MS = 400;

export const THROW_RANGE = 180;
export const THROW_COOLDOWN_MS = 800;

/** How many wild pals the server tries to keep alive at once. */
export const WILD_PAL_TARGET = 12;
export const PAL_RESPAWN_MS = 5000;

/** Player colors, indexed by join order. */
export const PLAYER_COLORS = [0x4fc3f7, 0xffb74d, 0xba68c8, 0x81c784, 0xe57373] as const;

export const ROOM_NAME = "world";
