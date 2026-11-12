/** Hard cap on players sharing one world. */
export const MAX_PLAYERS = 5;

/** Server simulation rate (ticks per second). */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/** Server pixels per 3D scene unit (1 unit = 1 m). */
export const PIXELS_PER_UNIT = 32;

/** World size in pixels. */
export const WORLD_WIDTH = 6400;
export const WORLD_HEIGHT = 4800;

/** Pixels per second. */
export const PLAYER_SPEED = 160;
export const PLAYER_RADIUS = 12;

export const ATTACK_RANGE = 48;
export const ATTACK_DAMAGE = 10;
export const ATTACK_COOLDOWN_MS = 400;

export const THROW_RANGE = 180;
/**
 * The server accepts a throw this much beyond THROW_RANGE: the client draws wild pals about 0.25 s late (interpolation,
 * half a patch interval, a network round trip) and a fleeing pal (96 px/s) moves about 25 px in that time. Clients only aim within THROW_RANGE.
 */
export const THROW_REACH_SLACK = 32;
export const THROW_COOLDOWN_MS = 800;

/** How many wild pals the server tries to keep alive at once. */
export const WILD_PAL_TARGET = 80;
export const PAL_RESPAWN_MS = 5000;

/** Player colors, indexed by join order. */
export const PLAYER_COLORS = [0x4fc3f7, 0xffb74d, 0xba68c8, 0x81c784, 0xe57373] as const;

export const ROOM_NAME = "world";

/**
 * How long (ms) the server keeps a player, and their seat, after their connection drops, so a short outage
 * (patchy mobile data, a Wi-Fi switch, a quick app change) does not throw them out. The seat is held for about
 * 29 s in all: 6-9 s for the server to notice a dead socket, plus this.
 */
export const RECONNECT_GRACE_MS = 20_000;
/**
 * How long (ms) a client keeps trying to reconnect: the grace, plus the most the server may need to notice the
 * dead socket (9 s), plus 1 s to spare. By then the server has certainly let the seat go.
 */
export const RECONNECT_TRY_MS = RECONNECT_GRACE_MS + 10_000;
/**
 * How long (ms) a world with no player in it (a waiting-to-reconnect player still counts) stays open, so a page
 * reload, an invite link or "back to the lobby" still finds it. 60 s covers a slow-3G lobby load (about 25 s with
 * the click) and a player who drops, then taps "back to the lobby" after RECONNECT_TRY_MS, with plenty to spare.
 * Colyseus closes the world up to about 1 s after the hold runs out.
 */
export const EMPTY_WORLD_HOLD_MS = 60_000;
/**
 * Close code of a session ended because the same device joined again. 4000-4999 is free for applications
 * (Colyseus uses 4000-4003 and 4010), and the client does not try to reconnect after it.
 */
export const CLOSE_REPLACED = 4201;

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
