import { distance, getSkill, isSupport, ELEMENT_COLOR, type SkillCastMessage, type Vec2 } from "@petgame/shared";
import { chainBolt, chargeUp, danger, playSkill, skillPrelude } from "./skillfx.ts";
import type { Game, PalEntity } from "./Game.ts";

/**
 * Pal skills on screen: the wind-up in the element's color, the warning on the ground for a wild pal's skill,
 * the skill's own animation (skillfx.ts) and chain lightning jumps.
 */
export class SkillCasts {
  constructor(private readonly game: Game) {}

  /**
   * A pal's skill: it winds up glowing in its element's color (what is about
   * to hit shows on the ground if a wild pal cast it), then the skill's own
   * animation plays out (skillfx.ts) until it lands with the server's hits.
   */
  castSkill(msg: SkillCastMessage) {
    const skill = getSkill(msg.skill);
    const wild = msg.caster === "wild";
    if (!wild && msg.casterId === this.game.skillBarPal) this.game.skillBar.started(skill.id, skill.cooldownMs);
    const casterOf = () => (wild ? this.game.pals.get(msg.casterId) ?? this.game.leaving.get(msg.casterId)?.entity : this.game.companions.get(msg.casterId));
    const caster = casterOf();
    if (!caster || !this.game.nearMe(caster.actor.pos, 900)) return;
    const { actor } = caster;
    const color = ELEMENT_COLOR[skill.element];
    const height = actor.height;
    const casterPos = () => casterOf()?.actor.pos;
    // Still able to let it go: a wild pal dazed, caught or knocked out mid wind-up drops it (as on the server).
    const able = () => (wild
      ? !!this.game.room.state.pals.get(msg.casterId) && !this.game.room.state.pals.get(msg.casterId)!.dizzy && !this.game.pals.get(msg.casterId)?.inBall
      : this.game.room.state.companions.has(msg.casterId));
    const releaseAt = performance.now() + msg.castMs;
    // Where it lands: where it was aimed, or (companions) wherever its target has gone by then.
    let last = { ...msg.at };
    const to = (): Vec2 => {
      if (!msg.homing || !msg.targetId) return msg.at;
      const id = msg.targetId;
      const target = msg.targetType === "pal" ? this.game.pals.get(id) ?? this.game.leaving.get(id)?.entity : msg.targetType === "companion" ? this.game.companions.get(id) : this.game.players.get(id);
      if (target) last = { ...target.actor.pos };
      return last;
    };
    const ownerId = wild ? undefined : this.game.room.state.companions.get(msg.casterId)?.ownerId;
    const owner = () => (ownerId ? this.game.players.get(ownerId)?.actor : undefined);
    // Who a heal or shield helps: a wild pal itself; a companion and its owner (a shield only the owner).
    const allies = wild ? [casterPos] : skill.shape === "shield" ? [() => owner()?.pos] : [casterPos, () => owner()?.pos];

    actor.faceToward(msg.at);
    actor.setWindup("skill", color);
    chargeUp(this.game.effects, () => (able() ? casterPos() : undefined), color, msg.castMs, height);
    skillPrelude(this.game.effects, skill, to, msg.castMs);
    this.game.labels.float(actor.pos, height + 4, `${skill.icon} ${skill.name}`, wild ? "skill foe" : "skill");
    if (this.game.nearMe(actor.pos, 600)) this.game.sound.play("charge");
    if (wild && !isSupport(skill)) danger(this.game.effects, skill, msg.from, msg.at, (msg.castMs + msg.travelMs) / 1000, () => performance.now() >= releaseAt || able());

    setTimeout(() => {
      const entity = casterOf();
      if (entity?.actor.windingUp === "skill") entity.actor.setWindup("");
      if (!able()) return;
      const from = entity ? { ...entity.actor.pos } : msg.from;
      if (entity) {
        entity.actor.faceToward(to());
        entity.actor.play("attack");
        // A charge leaves a trail of afterimages.
        if (skill.dash) this.game.trails.set(entity.actor, { until: performance.now() + msg.travelMs + 120, last: 0 });
      }
      playSkill({
        fx: this.game.effects,
        skill,
        from,
        to,
        travelMs: msg.travelMs,
        casterHeight: height,
        allies,
        shake: (amount) => {
          const me = this.game.me();
          const d = me ? distance(me.pos, to()) : 0;
          if (d < 500) this.game.shake = Math.max(this.game.shake, amount * (1 - d / 500));
        },
      });
      if (this.game.nearMe(from, 600)) this.game.sound.play(skill.element);
      // A stone shield goes up around its holder as it lands.
      if (skill.shape === "shield") {
        setTimeout(() => {
          const holder = wild ? casterOf()?.actor : owner();
          if (!holder) return;
          this.game.effects.shield(holder.root, (skill.shieldMs ?? 0) / 1000, holder.height);
          if (this.game.nearMe(holder.pos, 600)) this.game.sound.play("shield");
        }, msg.travelMs);
      }
    }, msg.castMs);
  }

  /** Chain lightning: a bolt from the pal it hit last to this one (the hits of one cast come together). */
  chainJump(companionId: string, pal: PalEntity) {
    const now = performance.now();
    const at = { x: pal.actor.pos.x, y: pal.actor.pos.y - pal.actor.height * 0.5 };
    const previous = this.game.chains.get(companionId);
    if (previous && now - previous.time < 300) chainBolt(this.game.effects, previous.at, at);
    this.game.chains.set(companionId, { at, time: now });
  }
}
