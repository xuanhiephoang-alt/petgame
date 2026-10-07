/** Hard cap on players sharing one world. */
export const MAX_PLAYERS = 5;

/** Server simulation rate (ticks per second). */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/** Server pixels per 3D scene unit (1 unit = 1 m). */
export const PIXELS_PER_UNIT = 32;

/** World size in pixels. */
export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 2400;

/** Pixels per second. */
export const PLAYER_SPEED = 160;
export const PLAYER_RADIUS = 12;

export const ATTACK_RANGE = 48;
export const ATTACK_DAMAGE = 10;
export const ATTACK_COOLDOWN_MS = 400;

export const THROW_RANGE = 180;
export const THROW_COOLDOWN_MS = 800;

/** How many wild pals the server tries to keep alive at once. */
export const WILD_PAL_TARGET = 36;
export const PAL_RESPAWN_MS = 5000;

/** Player colors, indexed by join order. */
export const PLAYER_COLORS = [0x4fc3f7, 0xffb74d, 0xba68c8, 0x81c784, 0xe57373] as const;

export const ROOM_NAME = "world";

/** Most pals one player can carry. */
export const MAX_PARTY = 30;

/** Companions trail their owner at about this distance (pixels). */
export const COMPANION_FOLLOW_DISTANCE = 56;
/** Companions farther than this from their owner jump back next to them. */
export const COMPANION_TELEPORT_DISTANCE = 480;
export const COMPANION_SPEED = 190;
/** How long (ms) a companion keeps fighting the wild pal its owner last hit. */
export const COMPANION_AGGRO_MS = 6000;
export const COMPANION_ATTACK_RANGE = 40;
export const COMPANION_ATTACK_COOLDOWN_MS = 900;
export const COMPANION_DAMAGE = 6;
