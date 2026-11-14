import {
  ServerMessage,
  distance,
  getSpecies,
  knockback,
  captureRevealMs,
  BALL_FLIGHT_MS,
  DASH_MS,
  PLAYER_RADIUS,
  RESOURCE_INFO,
  EAT_COOLDOWN_MS,
  BOSS,
  rewardText,
  ITEM_INFO,
  isSea,
  getWearable,
  weaponStats,
  getSkill,
  skillsLearnedBetween,
  type HarvestedMessage,
  type GatheredMessage,
  type LungeMessage,
  type DefeatedMessage,
  type DashedMessage,
  type ChestOpenedMessage,
  type QuestDoneMessage,
  type BossDefeatedMessage,
  type DamageMessage,
  type FaintedMessage,
  type SkillCastMessage,
  type HealedMessage,
  type CaptureResultMessage,
  type HitMessage,
  type LevelUpMessage,
  CRAFT_SOUND_PREFIXES,
  type NoticeKind,
  type NoticeMessage,
  type ProducedMessage,
  type Resource,
  type Vec2,
  palName,
} from "@petgame/shared";
import type { ToastLevel } from "../ui/toastQueue.ts";
import type { Game } from "./Game.ts";

/** A finished quest is celebrated this long (ms) after the news, once what finished it has played out. */
const QUEST_DELAY_MS = 2100;
/** How much each kind of server notice matters as a toast (see docs/design/hud.md). */
const NOTICE_LEVEL: Record<NoticeKind, ToastLevel> = { refused: "low", done: "normal", warning: "normal", reward: "high", quest: "high", news: "high" };

/**
 * What the server tells everyone (ServerMessage), played out on screen: effects, sounds, floating numbers and toasts.
 */
export class ServerEvents {
  constructor(private readonly game: Game) {}

  /** Registers a handler for every server message; called once, from Game.bindRoom. */
  bind() {
    this.game.room.onMessage(ServerMessage.Harvested, (msg: HarvestedMessage) => {
      const player = this.game.players.get(msg.playerId);
      if (!player) return;
      this.game.effects.burst(player.actor.pos, [0xe53935, 0xff8a80, 0x66bb6a], 12, 40);
      this.game.labels.float(player.actor.pos, 56, `+${msg.amount} 🫐`);
      if (msg.playerId === this.game.room.sessionId) this.game.sound.play("produce");
    });

    this.game.room.onMessage(ServerMessage.ChestOpened, (msg: ChestOpenedMessage) => {
      const at = this.game.chests.get(msg.chestId)?.at ?? this.game.players.get(msg.playerId)?.actor.pos;
      if (at) {
        this.game.effects.sparkle(at, 0xffc94a);
        this.game.effects.burst(at, [0xffd54f, 0xfff59d, 0x7cf3ff], 24, 60);
        // Clothes or a weapon inside: its icon pops up over the chest.
        const wear = msg.wear ? getWearable(msg.wear) : undefined;
        if (wear) this.game.labels.float(at, 60, `${wear.icon} ${wear.name}`, "skill");
      }
      if (msg.playerId === this.game.room.sessionId) this.game.sound.play("chest");
    });

    this.game.room.onMessage(ServerMessage.QuestDone, (msg: QuestDoneMessage) => {
      // A moment later, after what finished it has played out (a ball still wobbling, a chest's loot);
      // the server's notice with the reward comes at the same time (see Notice).
      setTimeout(() => {
        const player = this.game.players.get(msg.playerId);
        if (player) this.game.effects.ring(player.actor.pos, 0xffca28, 80, 0.8);
        if (msg.playerId === this.game.room.sessionId) this.game.sound.play("quest");
      }, QUEST_DELAY_MS);
    });

    this.game.room.onMessage(ServerMessage.Hit, (msg: HitMessage) => {
      const pal = this.game.pals.get(msg.palId);
      const mine = msg.playerId === this.game.room.sessionId && !msg.companionId;
      const skill = msg.skill ? getSkill(msg.skill) : undefined;
      if (pal && this.game.nearMe(pal.actor.pos, 500)) this.game.sound.play(msg.crit ? "crit" : "hit");
      if (pal && skill) {
        // A skill's own animation shows the blow; the number comes in its element's color.
        this.game.labels.float(pal.actor.pos, pal.actor.height - 2, `${msg.damage}`, `hit skill ${skill.element}`);
        if (skill.chain && msg.companionId) this.game.skillCasts.chainJump(msg.companionId, pal);
      } else if (pal) {
        const lift = pal.actor.height;
        this.game.effects.impact({ x: pal.actor.pos.x, y: pal.actor.pos.y - lift * 0.5 }, msg.crit);
        this.game.labels.float(pal.actor.pos, lift - 6, msg.crit ? `💥${msg.damage}` : `${msg.damage}`, msg.crit ? "crit" : msg.companionId ? "hit small" : "hit");
      }
      if (pal && msg.effect === "super") this.game.labels.float(pal.actor.pos, pal.actor.height + 14, "Hiệu quả! 💥", "super");
      if (pal && msg.effect === "weak") this.game.labels.float(pal.actor.pos, pal.actor.height + 14, "Kém hiệu quả", "weak");
      if (msg.companionId) {
        // (A skill's caster already struck when it let go.)
        const companion = skill ? undefined : this.game.companions.get(msg.companionId);
        if (companion && pal) companion.actor.faceToward(pal.actor.pos);
        companion?.actor.play("attack");
      } else if (msg.playerId !== this.game.room.sessionId) {
        // Another explorer's swing or shot (the local one is shown on the key press).
        const hitter = this.game.players.get(msg.playerId)?.actor;
        if (hitter) {
          if (pal) hitter.faceToward(pal.actor.pos);
          hitter.play("attack");
          if (pal && weaponStats(hitter.weapon).ranged) this.game.effects.shot(hitter.pos, pal.actor.pos, hitter.weapon, pal.actor.height);
        }
      }
      if (!pal) return;
      pal.actor.play("hurt");
      if (mine) {
        // The weight of the blow: both hold still for a moment and the camera jolts.
        const hold = msg.crit ? 0.11 : 0.06;
        pal.actor.freeze(hold);
        this.game.me()?.freeze(hold);
        this.game.shake = Math.max(this.game.shake, msg.crit ? 5 : 2.2);
      }
      // A passive pal runs off in a fright.
      const species = this.game.room.state.pals.get(msg.palId)?.speciesId;
      if (species && getSpecies(species).temperament === "passive" && !this.game.room.state.pals.get(msg.palId)?.dizzy) {
        this.game.labels.float(pal.actor.pos, pal.actor.height + 2, "💦", "emote");
      }
    });

    this.game.room.onMessage(ServerMessage.Lunge, (msg: LungeMessage) => {
      const attacker = this.game.pals.get(msg.palId);
      const target = msg.targetType === "player" ? this.game.players.get(msg.targetId) : this.game.companions.get(msg.targetId);
      if (attacker && !msg.skill) {
        if (target) attacker.actor.faceToward(target.actor.pos);
        attacker.actor.play("attack");
      }
      if (!msg.dodged || !target) return;
      this.game.labels.float(target.actor.pos, target.actor.height, "Né!", "dodge");
      if (msg.targetId === this.game.room.sessionId) this.game.sound.play("dodge");
    });

    this.game.room.onMessage(ServerMessage.Defeated, (msg: DefeatedMessage) => {
      const entity = this.game.pals.get(msg.palId) ?? this.game.leaving.get(msg.palId)?.entity;
      this.setFate(msg.palId, "ko");
      const player = this.game.players.get(msg.playerId);
      if (entity) {
        entity.actor.setDizzy(false);
        entity.actor.setWindup("");
        entity.actor.play("ko");
        const at = { ...entity.actor.pos };
        setTimeout(() => this.game.effects.poof(at), 450);
      }
      const from = entity?.actor.pos ?? player?.actor.pos;
      if (from && player) {
        const at = { ...from };
        setTimeout(() => this.game.effects.lootFly(at, () => this.game.players.get(msg.playerId)?.actor.pos, lootIcons(msg.loot)), 300);
        setTimeout(() => {
          const p = this.game.players.get(msg.playerId);
          if (p) this.game.labels.float(p.actor.pos, p.actor.height + 8, `+${rewardText(msg.loot)}`);
        }, 900);
      }
      if (msg.playerId === this.game.room.sessionId) this.game.sound.play("ko");
    });

    this.game.room.onMessage(ServerMessage.Gathered, (msg: GatheredMessage) => {
      const node = this.game.scenery.propTop(msg.node);
      const player = this.game.players.get(msg.playerId);
      if (!node) return;
      const kind = msg.resource === "wood" ? "tree" : "rock";
      this.game.scenery.hitProp(msg.node);
      this.game.effects.chips(node, kind, node.height);
      if (this.game.nearMe(node, 500)) this.game.sound.play(kind === "tree" ? "chop" : "mine");
      if (!player) return;
      player.actor.faceToward(node);
      if (msg.playerId !== this.game.room.sessionId) player.actor.play("attack");
      const icon = RESOURCE_INFO[msg.resource].icon;
      this.game.effects.lootFly({ x: node.x, y: node.y - 6 }, () => this.game.players.get(msg.playerId)?.actor.pos, Array(msg.amount).fill(icon));
      setTimeout(() => {
        const p = this.game.players.get(msg.playerId);
        if (p) this.game.labels.float(p.actor.pos, p.actor.height + 8, `+${msg.amount} ${icon}`);
      }, 650);
    });

    this.game.room.onMessage(ServerMessage.Dashed, (msg: DashedMessage) => {
      if (msg.playerId === this.game.room.sessionId) return; // already shown on the key press
      const p = this.game.players.get(msg.playerId);
      if (!p) return;
      p.actor.face(msg.x, msg.y);
      p.actor.play("dash");
      this.game.effects.dust(p.actor.pos, 1.2, msg);
      this.game.trails.set(p.actor, { until: performance.now() + DASH_MS + 60, last: 0 });
    });

    this.game.room.onMessage(ServerMessage.CaptureResult, (msg: CaptureResultMessage) => {
      const thrower = this.game.players.get(msg.playerId);
      const entity = this.game.pals.get(msg.palId) ?? this.game.leaving.get(msg.palId)?.entity;
      // Whoever threw: aiming leaves this pal while it is in the ball (a caught pal is about to leave the state, maybe after this message).
      const held = this.game.pals.get(msg.palId);
      if (held) held.heldUntil = msg.success ? Infinity : performance.now() + captureRevealMs(msg.shakes);
      const mine = msg.playerId === this.game.room.sessionId;
      const great = mine && this.game.useGreatBall;
      const name = palName(msg.speciesId, msg.alpha === true);
      const verdict = () => {
        if (!mine) return;
        this.game.sound.play(msg.success ? "capture" : "escape");
        this.game.hud.showToast(msg.success ? `${msg.alpha ? "★ " : ""}Bắt được ${name}! 🎉` : `${name} thoát ra rồi (${Math.round(msg.chance * 100)}%)`, msg.success ? "high" : "normal");
      };
      if (msg.success) this.setFate(msg.palId, "caught");
      if (mine) this.game.sound.play("throw");
      else thrower?.actor.play("throw");
      if (!thrower || !entity) {
        setTimeout(verdict, captureRevealMs(msg.shakes));
        return;
      }
      // The pal holds still in the ball on the server too, until the wobbling ends.
      const at = { ...entity.actor.pos };
      if (msg.success) this.game.catches.set(`${msg.playerId}:${msg.speciesId}`, { at, revealAt: performance.now() + captureRevealMs(msg.shakes) });
      this.game.effects.throwBall(thrower.actor.pos, at, great);
      setTimeout(() => {
        entity.inBall = true;
        entity.actor.play("vanish");
        this.game.effects.ring(at, 0xffffff, 30, 0.25);
        const color = parseInt(getSpecies(msg.speciesId).color.slice(1), 16);
        this.game.effects.captureBall(at, great, msg.shakes, msg.success, () => {
          if (msg.success) {
            this.game.effects.sparkle(at, color);
            if (this.game.nearMe(at, 500)) this.game.sound.play("click");
          } else {
            entity.inBall = false;
            entity.actor.root.visible = true;
            entity.actor.play("pop");
          }
          verdict();
        }, () => this.game.nearMe(at, 500) && this.game.sound.play("wobble"));
      }, BALL_FLIGHT_MS);
    });

    this.game.room.onMessage(ServerMessage.Damage, (msg: DamageMessage) => {
      const target = msg.targetType === "player" ? this.game.players.get(msg.targetId) : this.game.companions.get(msg.targetId);
      const attacker = this.game.pals.get(msg.attackerId);
      if (attacker && target && !msg.skill) attacker.actor.faceToward(target.actor.pos);
      if (!target) return;
      if (msg.cause) {
        // Cold or heat: a quieter tick of damage.
        this.game.labels.float(target.actor.pos, target.actor.height, `${msg.cause === "cold" ? "🥶" : "🥵"} -${msg.amount}`, msg.cause);
        return;
      }
      target.actor.play("hurt");
      if (msg.targetType === "player" && msg.targetId === this.game.room.sessionId) {
        this.game.sound.play("hurt");
        this.game.shake = Math.max(this.game.shake, 4);
        const me = this.game.me();
        // Pushed away from the biter, or from where a skill landed.
        const pushFrom = msg.pushFrom ?? attacker?.actor.pos;
        if (me && msg.push && pushFrom) {
          const sailing = (this.game.room.state.players.get(this.game.room.sessionId)?.raft ?? 0) > 0;
          const sea = sailing ? undefined : (at: Vec2) => isSea(this.game.terrain, at.x, at.y);
          me.pos = knockback(me.pos, pushFrom, msg.push, PLAYER_RADIUS, this.game.obstacles, sea);
          this.game.knockedAt = performance.now();
        }
      }
      const skill = msg.skill ? getSkill(msg.skill) : undefined;
      this.game.labels.float(target.actor.pos, target.actor.height, `-${msg.amount}`, skill ? `damage ${skill.element}` : "damage");
    });

    this.game.room.onMessage(ServerMessage.Fainted, (msg: FaintedMessage) => {
      const target = msg.targetType === "player" ? this.game.players.get(msg.targetId) : this.game.companions.get(msg.targetId);
      if (target) {
        this.game.effects.poof(target.actor.pos);
        this.game.effects.sparkle(target.actor.pos, 0x9e9e9e);
      }
      if (msg.targetType === "player" && msg.targetId === this.game.room.sessionId) this.game.sound.play("faint");
    });

    this.game.room.onMessage(ServerMessage.SkillCast, (msg: SkillCastMessage) => this.game.skillCasts.castSkill(msg));

    this.game.room.onMessage(ServerMessage.Healed, (msg: HealedMessage) => {
      // A berry this player ate: the Ăn button recharges, counted from now (after the server), so it is never ready first.
      if (msg.berry && msg.targetType === "player" && msg.targetId === this.game.room.sessionId) this.game.hud.eatStarted(EAT_COOLDOWN_MS);
      const target = msg.targetType === "player" ? this.game.players.get(msg.targetId) : msg.targetType === "companion" ? this.game.companions.get(msg.targetId) : this.game.pals.get(msg.targetId);
      if (!target || !this.game.nearMe(target.actor.pos, 700)) return;
      target.actor.hit(0x69f0ae);
      this.game.labels.float(target.actor.pos, target.actor.height + 2, `+${msg.amount} ❤`, "heal");
      if (msg.targetType === "player" && msg.targetId === this.game.room.sessionId) this.game.sound.play("heal");
    });

    this.game.room.onMessage(ServerMessage.BossStomp, () => {
      const boss = this.game.bossId ? this.game.pals.get(this.game.bossId) : undefined;
      if (!boss) return;
      this.game.effects.ring(boss.actor.pos, 0xff7043, BOSS.stompRadius * 1.1, 0.6, 5);
      this.game.effects.burst(boss.actor.pos, [0x8d6e63, 0xbcaaa4], 24, 40);
      boss.actor.play("attack");
      const me = this.game.me();
      if (me && distance(me.pos, boss.actor.pos) < 600) {
        this.game.shake = 12;
        this.game.sound.play("stomp");
      }
    });

    this.game.room.onMessage(ServerMessage.BossDefeated, (msg: BossDefeatedMessage) => {
      const boss = this.game.pals.get(msg.bossId);
      if (boss) {
        this.game.effects.sparkle(boss.actor.pos, 0xffd54f);
        this.game.effects.ring(boss.actor.pos, 0xffd54f, 130, 1);
      }
      if (msg.winners.includes(this.game.room.sessionId)) this.game.sound.play("victory");
    });

    this.game.room.onMessage(ServerMessage.Notice, (msg: NoticeMessage) => {
      if (msg.kind === "quest") return void setTimeout(() => this.game.hud.showToast(msg.text, "high"), QUEST_DELAY_MS);
      this.game.hud.showToast(msg.text, NOTICE_LEVEL[msg.kind] ?? "low");
      if (CRAFT_SOUND_PREFIXES.some((p) => msg.text.startsWith(p))) this.game.sound.play("craft");
    });

    this.game.room.onMessage(ServerMessage.LevelUp, (msg: LevelUpMessage) => {
      const companion = this.game.companions.get(msg.palId);
      if (companion) this.game.effects.sparkle(companion.actor.pos, 0xffd54f);
      if (msg.playerId === this.game.room.sessionId) {
        const species = getSpecies(msg.speciesId);
        // Every skill learned on the way, even when the gain climbed past the level that teaches it.
        const learned = skillsLearnedBetween(species, msg.fromLevel, msg.level);
        this.game.hud.showToast(learned.length > 0
          ? `${species.name} lên cấp ${msg.level}! ⭐ Học được chiêu mới: ${learned.map((s) => `${s.icon} ${s.name}`).join(", ")}`
          : `${species.name} lên cấp ${msg.level}! ⭐`, "high");
        this.game.sound.play("levelup");
        if (companion) {
          learned.forEach((skill, i) => {
            setTimeout(() => this.game.labels.float(companion.actor.pos, companion.actor.height + 10, `${skill.icon} ${skill.name}!`, "skill"), 400 + 700 * i);
          });
        }
      }
    });

    this.game.room.onMessage(ServerMessage.Produced, (msg: ProducedMessage) => {
      const worker = this.game.companions.get(msg.palId);
      if (!worker) return;
      worker.actor.play("attack");
      if (msg.playerId === this.game.room.sessionId) this.game.sound.play("produce");
      const info = RESOURCE_INFO[msg.resource as Resource];
      if (info) this.game.labels.float(worker.actor.pos, worker.actor.height, `+${msg.amount} ${info.icon}`);
    });
  }

  /** How a wild pal left the world (it may still be in the state, or already leaving). */
  private setFate(id: string, fate: "ko" | "caught") {
    const leaving = this.game.leaving.get(id);
    if (leaving) {
      leaving.fate = fate;
      leaving.entity.actor.root.alpha = 1;
    } else {
      this.game.fates.set(id, fate);
    }
  }
}

/** One icon per resource or item in a pile of loot (a few at most), for the flying-loot effect. */
function lootIcons(loot: Record<string, number>): string[] {
  const icons: string[] = [];
  for (const [key, amount] of Object.entries(loot)) {
    const icon = RESOURCE_INFO[key as Resource]?.icon ?? ITEM_INFO[key as keyof typeof ITEM_INFO]?.icon;
    if (icon) for (let i = 0; i < Math.min(amount, 4); i++) icons.push(icon);
  }
  return icons;
}
