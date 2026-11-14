import { Container, Sprite } from "pixi.js";
import { Callbacks } from "@colyseus/sdk";
import { type AimCandidate, getSpecies, BOSS, ALPHA, type Vec2 } from "@petgame/shared";
import type { Tag } from "./labels.ts";
import { LABEL_RANK, PLAYER_TAG_LIFT_PX } from "./labelLayout.ts";
import { Actor, PalActor, PlayerActor } from "./entities.ts";
import { spriteFor } from "./palSprites.ts";
import { campArt, chestArt, gemArt } from "./art/props.ts";
import { lookOf, wornOf, dressKey, remember } from "./looks.ts";
import type { Game, PalEntity, Named } from "./Game.ts";

/** How faint a player waiting to reconnect is drawn (0..1). */
const AWAY_ALPHA = 0.45;

/**
 * Mirrors the synced room state on screen: players, wild pals, companions, camps, chests, felled trees and ripe fruit
 * become actors, sprites and name tags (and go again).
 */
export class StateSync {
  constructor(private readonly game: Game) {}

  /** Registers the state callbacks (Callbacks) and the time of day; called once, from Game.bindRoom, before the message handlers. */
  bind() {
    const $ = Callbacks.get(this.game.room);

    $.onAdd("players", (player, sessionId) => {
      const isMe = sessionId === this.game.room.sessionId;
      const actor = new PlayerActor({ x: player.x, y: player.y }, player.color, this.game.shadowTexture, lookOf(player), wornOf(player));
      let dressed = dressKey(player);
      this.addActor(actor);
      const { tag, label, text } = this.nameTag(player.name, isMe ? "label me" : "label", () => actor.pos, actor.height + PLAYER_TAG_LIFT_PX, isMe ? LABEL_RANK.me : LABEL_RANK.player);
      const hpFill = addHpBar(label);
      this.game.players.set(sessionId, { actor, tag, label });
      // Waiting to reconnect: the figure and the name are dimmed and the name says so, until they are back.
      let away = false;
      const showAway = () => {
        if (player.offline === away) return;
        away = player.offline;
        actor.root.alpha = actor.ground.alpha = away ? AWAY_ALPHA : 1;
        label.classList.toggle("offline", away);
        text.textContent = away ? `${player.name} (mất kết nối)` : player.name;
      };
      showAway(); // a player who joins after the drop still sees them dimmed
      $.onChange(player, () => {
        actor.server.x = player.x;
        actor.server.y = player.y;
        setHp(label, hpFill, player.hp, player.maxHp);
        showAway();
        if (dressKey(player) !== dressed) {
          dressed = dressKey(player);
          actor.dress(lookOf(player), wornOf(player));
          tag.lift = actor.height + PLAYER_TAG_LIFT_PX;
          if (isMe) remember(player);
        }
        this.syncCamp(sessionId, player.hasBase, player.baseX, player.baseY, player.color, player.name, player.baseLevel);
      });
      this.syncCamp(sessionId, player.hasBase, player.baseX, player.baseY, player.color, player.name, player.baseLevel);
      if (isMe) {
        remember(player);
        this.game.camera.x = player.x;
        this.game.camera.y = player.y;
        this.game.camera.ready = true;
      }
    });

    $.onRemove("players", (_player, sessionId) => {
      const entity = this.game.players.get(sessionId);
      if (entity) this.removeActor(entity);
      this.game.players.delete(sessionId);
      this.syncCamp(sessionId, false, 0, 0, 0, "", 1);
    });

    $.onAdd("pals", (pal, id) => {
      const species = getSpecies(pal.speciesId);
      const sprite = spriteFor(this.game.assets.pals, species.id);
      const actor = new PalActor({ x: pal.x, y: pal.y }, sprite, species.id, this.game.shadowTexture, pal.boss ? BOSS.displayScale : pal.alpha ? ALPHA.displayScale : 1);
      if (pal.boss) {
        this.game.bossId = id;
        actor.ring(0xff3d00, 3, 0.7);
        actor.crowned();
      }
      // A pack leader: bigger, glowing gold.
      if (pal.alpha) actor.aura(0xffc107);
      this.addActor(actor);
      const { tag, label } = pal.boss
        ? this.nameTag(`👑 ${BOSS.name}`, "label pal boss", () => actor.pos, actor.height + 8, LABEL_RANK.leader)
        : pal.alpha
          ? this.nameTag(`★ Đầu đàn · Lv ${pal.level} ${species.name}`, "label pal alpha", () => actor.pos, actor.height + 6, LABEL_RANK.leader)
          : this.nameTag(`Lv ${pal.level} ${species.name}`, "label pal", () => actor.pos, actor.height + 4, LABEL_RANK.wild);
      const hpFill = addHpBar(label);
      const aim: AimCandidate = { id, x: pal.x, y: pal.y, hp: pal.hp, maxHp: pal.maxHp, dizzy: pal.dizzy, boss: pal.boss, inBall: false };
      const entity: PalEntity = { actor, tag, label, hpFill, hp: pal.hp, maxHp: pal.maxHp, aim, heldUntil: 0 };
      this.game.pals.set(id, entity);
      this.updateHpBar(entity);
      let { angry, dizzy, windup } = pal;
      actor.setWindup(windup);
      actor.setDizzy(dizzy);
      label.classList.toggle("dizzy", dizzy);
      $.onChange(pal, () => {
        actor.server.x = pal.x;
        actor.server.y = pal.y;
        entity.hp = pal.hp;
        entity.maxHp = pal.maxHp;
        aim.hp = pal.hp;
        aim.maxHp = pal.maxHp;
        aim.dizzy = pal.dizzy;
        this.updateHpBar(entity);
        label.classList.toggle("angry", pal.angry);
        const near = this.game.nearMe(actor.pos, 520);
        if (pal.windup !== windup) {
          windup = pal.windup;
          // A skill's wind-up shows from its cast message (in its element's color).
          if (windup !== "skill") actor.setWindup(windup);
          // Where the boss's stomp will land: get out of the ring.
          if (windup === "stomp") this.game.effects.warning(() => this.game.pals.get(id)?.actor.pos, BOSS.stompRadius, BOSS.stompWindupMs / 1000);
        }
        if (pal.dizzy !== dizzy) {
          dizzy = pal.dizzy;
          actor.setDizzy(dizzy);
          label.classList.toggle("dizzy", dizzy);
          if (dizzy && near) {
            this.game.labels.float(actor.pos, actor.height + 4, "💫 Choáng!", "dizzy");
            if (this.game.nearMe(actor.pos, 260)) this.game.hudBridge.tip("dizzy", this.game.touch
              ? "💫 Thú choáng: bấm Bắt để dễ bắt, hoặc Đánh tiếp để hạ gục lấy đồ"
              : "💫 Thú choáng: ném bóng (E) để dễ bắt, hoặc đánh tiếp (Space) để hạ gục lấy đồ");
          }
        }
        if (pal.angry !== angry) {
          angry = pal.angry;
          // Noticed someone, or gave up the chase.
          if (near && !dizzy) this.game.labels.float(actor.pos, actor.height + 2, angry ? "❗" : "❓", "emote");
        }
      });
    });

    $.onRemove("pals", (_pal, id) => {
      if (id === this.game.bossId) this.game.bossId = undefined;
      const entity = this.game.pals.get(id);
      this.game.pals.delete(id);
      // Kept on screen a moment: falling over, inside a ball, or fading away.
      if (entity) this.game.leaving.set(id, { entity, since: performance.now(), fate: this.game.fates.get(id) });
      this.game.fates.delete(id);
    });

    // Chopped trees and broken rocks, until they grow back.
    $.onAdd("felled", (_value, key) => {
      const index = Number(key.slice(1));
      this.game.scenery.setFelled(index, true);
      const at = this.game.scenery.propTop(index);
      if (at && this.game.frames > 10 && this.game.nearMe(at, 600)) {
        if (this.game.defaultLayout.props[index]?.kind === "tree") this.game.effects.leaves({ x: at.x, y: at.y - 30 }, 14);
        this.game.effects.poof(at);
      }
    });
    $.onRemove("felled", (_value, key) => this.game.scenery.setFelled(Number(key.slice(1)), false));

    $.onAdd("companions", (companion, id) => {
      const species = getSpecies(companion.speciesId);
      const actor = new PalActor({ x: companion.x, y: companion.y }, spriteFor(this.game.assets.pals, species.id), species.id, this.game.shadowTexture);
      // A ring in the owner's color marks whose pal this is.
      actor.ring(this.game.room.state.players.get(companion.ownerId)?.color ?? 0xffffff, 2.5);
      this.addActor(actor);
      // `mode` is set once by the server when the companion is created, so the rank holds for its whole life.
      const rank = companion.ownerId === this.game.room.sessionId && companion.mode === "follow" ? LABEL_RANK.follower : LABEL_RANK.companion;
      // A caught pack leader: a ★ and gold text. Set once by the server when it comes out, like `mode`.
      const star = companion.alpha ? "★ " : "";
      const { tag, label, text } = this.nameTag(`${star}Lv ${companion.level} ${species.name}`, companion.alpha ? "label companion alpha" : "label companion", () => actor.pos, actor.height + 4, rank);
      const hpFill = addHpBar(label);
      this.game.companions.set(id, { actor, tag, label });
      // Just caught: it stays in the ball until it clicks shut, then hops out and runs to its owner.
      const key = `${companion.ownerId}:${companion.speciesId}`;
      const caught = this.game.catches.get(key);
      this.game.catches.delete(key);
      const wait = caught ? caught.revealAt - performance.now() : 0;
      if (caught && wait > 0) {
        actor.root.visible = actor.ground.visible = tag.visible = false;
        setTimeout(() => {
          if (!this.game.companions.has(id)) return;
          actor.pos = { ...caught.at };
          actor.root.visible = actor.ground.visible = tag.visible = true;
          actor.play("pop");
        }, wait + 150);
      }
      $.onChange(companion, () => {
        actor.server.x = companion.x;
        actor.server.y = companion.y;
        // Writing the same text again makes the tag be measured again, and this runs about 20 times a second.
        const shown = `${star}Lv ${companion.level} ${species.name}`;
        if (text.textContent !== shown) text.textContent = shown;
        setHp(label, hpFill, companion.hp, companion.maxHp);
      });
    });

    $.onRemove("companions", (_companion, id) => {
      const entity = this.game.companions.get(id);
      if (entity) this.removeActor(entity);
      this.game.companions.delete(id);
    });

    $.onAdd("chests", (chest, id) => {
      const art = chestArt();
      const body = new Sprite(art.texture);
      body.anchor.set(art.anchor.x, art.anchor.y);
      body.position.set(chest.x, chest.y);
      body.zIndex = chest.y;
      body.scale.set(art.scale ?? 1);
      if ((chest.x * 13 + chest.y * 7) % 2 > 1) body.scale.x *= -1;
      const gemArtwork = gemArt();
      const gem = new Sprite(gemArtwork.texture);
      gem.anchor.set(gemArtwork.anchor.x, gemArtwork.anchor.y);
      gem.zIndex = chest.y + 0.1;
      this.game.stage.objects.addChild(body, gem);
      this.game.chests.set(id, { body, gem, at: { x: chest.x, y: chest.y } });
    });

    $.onRemove("chests", (_chest, id) => {
      const chest = this.game.chests.get(id);
      if (!chest) return;
      chest.body.destroy();
      chest.gem.destroy();
      this.game.chests.delete(id);
    });

    $.onAdd("fruits", (_fruit, id) => this.game.scenery.setRipe(Number(id.replace("fruit", "")), true));
    $.onRemove("fruits", (_fruit, id) => this.game.scenery.setRipe(Number(id.replace("fruit", "")), false));

    $.listen("dayTime", (value) => {
      this.game.serverDay = value;
      this.game.serverDayAt = performance.now();
    });
  }

  private nameTag(text: string, className: string, at: () => Vec2 | undefined, lift: number, rank: number): { tag: Tag; label: HTMLDivElement; text: HTMLSpanElement } {
    const label = document.createElement("div");
    label.className = className;
    const span = document.createElement("span");
    span.textContent = text;
    label.append(span);
    return { tag: this.game.labels.add(label, at, lift, rank), label, text: span };
  }

  private updateHpBar(pal: PalEntity) {
    const ratio = pal.maxHp > 0 ? pal.hp / pal.maxHp : 1;
    pal.hpFill.style.width = `${Math.round(ratio * 100)}%`;
    pal.label.classList.toggle("hurt", ratio < 1);
  }

  /** Creates, moves or removes a player's camp to match the synced state. */
  private syncCamp(sessionId: string, hasBase: boolean, x: number, y: number, color: number, owner: string, level: number) {
    let camp = this.game.camps.get(sessionId);
    // Upgrades change the drawing: rebuild it.
    if (camp && hasBase && (camp.level !== level || camp.color !== color)) {
      this.syncCamp(sessionId, false, 0, 0, 0, "", 1);
      camp = undefined;
    }
    if (!hasBase) {
      if (camp) {
        camp.root.destroy({ children: true });
        camp.floor.destroy();
        this.game.labels.remove(camp.tag);
        this.game.camps.delete(sessionId);
      }
      return;
    }
    if (!camp) {
      const art = campArt(color, level);
      const root = new Container();
      const base = new Sprite(art.base.texture);
      base.anchor.set(art.base.anchor.x, art.base.anchor.y);
      const flag = new Sprite(art.flag.texture);
      flag.anchor.set(art.flag.anchor.x, art.flag.anchor.y);
      flag.position.set(art.flagAt.x, art.flagAt.y);
      root.addChild(base, flag);
      this.game.stage.objects.addChild(root);
      const floor = new Sprite(art.floor.texture);
      floor.anchor.set(art.floor.anchor.x, art.floor.anchor.y);
      this.game.stage.marks.addChild(floor);
      const at = { x, y };
      const label = document.createElement("div");
      label.className = "label base";
      const span = document.createElement("span");
      span.textContent = `🏕️ Trại của ${owner} · Cấp ${level}`;
      label.append(span);
      const tag = this.game.labels.add(label, () => at, 96, LABEL_RANK.camp);
      camp = { root, floor, flag, level, color, tag, at };
      this.game.camps.set(sessionId, camp);
    }
    camp.at.x = x;
    camp.at.y = y;
    camp.root.position.set(x, y);
    camp.root.zIndex = y;
    camp.floor.position.set(x, y);
  }

  private addActor(actor: Actor) {
    this.game.stage.shadows.addChild(actor.ground);
    this.game.stage.objects.addChild(actor.root);
  }

  removeActor(entity: Named<Actor>) {
    this.game.labels.remove(entity.tag);
    entity.actor.destroy();
  }
}

/** A small health bar under a label, hidden while at full health. */
function addHpBar(label: HTMLDivElement): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "hp-bar";
  const fill = document.createElement("div");
  bar.append(fill);
  label.append(bar);
  return fill;
}

function setHp(label: HTMLDivElement, fill: HTMLDivElement, hp: number, maxHp: number) {
  const ratio = maxHp > 0 ? Math.max(0, hp) / maxHp : 1;
  fill.style.width = `${Math.round(ratio * 100)}%`;
  fill.classList.toggle("low", ratio < 0.3);
  label.classList.toggle("hurt", ratio < 1);
}
