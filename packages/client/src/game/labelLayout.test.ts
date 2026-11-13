import { describe, expect, it } from "vitest";
import { mulberry32 } from "@petgame/shared";
import {
  LABEL_LAYOUT_MAX,
  LABEL_NUDGE_PX,
  LABEL_PINNED_NUDGE_PX,
  LABEL_RANK,
  PINNED_RANK,
  TAG_FORM,
  layoutTags,
  restingNameTop,
  type LayoutItem,
} from "./labelLayout.ts";

let nextSeq = 1;

/** A tag with plain defaults: named, no HP bar, new on screen. */
function tag(over: Partial<LayoutItem> = {}): LayoutItem {
  return {
    x: 100, y: 100, width: 60, height: 17, barWidth: 0, barHeight: 0, named: true,
    rank: LABEL_RANK.player, seq: nextSeq++, fresh: true,
    form: TAG_FORM.full, rise: 0, holdUntil: 0,
    placed: false, forced: false, left: 0, top: 0, right: 0, bottom: 0,
    ...over,
  };
}

/** One frame, as `Labels` runs it: lay out, then clear `fresh`. */
function frame(items: LayoutItem[], now: number) {
  layoutTags(items, items.length, now);
  for (const it of items) it.fresh = false;
}

const me = (over: Partial<LayoutItem> = {}) => tag({ rank: LABEL_RANK.me, width: 40, ...over });

describe("restingNameTop", () => {
  // Measured in the browser (T62): curly hair is 55.8 world px tall, the wizard hat 68.9.
  it("matches the measured name tops", () => {
    expect(restingNameTop(844, 390 / 440, 55.8)).toBeCloseTo(356.4, 1);
    expect(restingNameTop(760, 390 / 440, 55.8)).toBeCloseTo(314.4, 1);
    expect(restingNameTop(844, 390 / 440, 68.9)).toBeCloseTo(344.79, 1);
    expect(restingNameTop(1024, 768 / 440, 55.8)).toBeCloseTo(407.1, 1);
  });
});

describe("layoutTags", () => {
  it("1: the later tag rises just enough", () => {
    const a = me();
    const b = tag({ x: 110 });
    layoutTags([b, a], 2, 0);
    expect(a.form).toBe(TAG_FORM.full);
    expect(a.rise).toBe(0);
    expect(b.form).toBe(TAG_FORM.full);
    expect(b.rise).toBe(19);
  });

  it("2a: too tight to rise, a tag with an HP bar shrinks to the bar", () => {
    const a = me();
    const w = tag({ rank: LABEL_RANK.wild, y: 110, width: 80, height: 24, barWidth: 36, barHeight: 5 });
    layoutTags([a, w], 2, 0);
    expect(w.form).toBe(TAG_FORM.compact);
    expect(w.rise).toBe(0);
  });

  it("2b: without an HP bar it hides", () => {
    const a = me();
    const c = tag({ rank: LABEL_RANK.companion, y: 110, width: 80 });
    layoutTags([a, c], 2, 0);
    expect(c.form).toBe(TAG_FORM.hidden);
    expect(c.placed).toBe(false);
  });

  function pinnedScene() {
    const follower = tag({ rank: LABEL_RANK.follower, y: 104, width: 80, height: 16 });
    const mine = me();
    const aimed = tag({ rank: LABEL_RANK.aimed, width: 80, height: 24, barWidth: 36, barHeight: 5 });
    return { follower, mine, aimed, items: [aimed, mine, follower] };
  }

  it("3: pinned tags are placed front to back and never hide", () => {
    const { follower, mine, aimed, items } = pinnedScene();
    layoutTags(items, 3, 0);
    expect(items).toEqual([follower, mine, aimed]);
    for (const it of items) expect(it.form).toBe(TAG_FORM.full);
    expect([follower.rise, mine.rise, aimed.rise]).toEqual([0, 14, 33]);
  });

  it("4: a fourth pinned tag with no room is forced, not hidden", () => {
    const { items } = pinnedScene();
    const leader = tag({ rank: LABEL_RANK.leader, width: 120, height: 27, barWidth: 52, barHeight: 6 });
    items.push(leader);
    layoutTags(items, 4, 0);
    expect(leader.form).toBe(TAG_FORM.compact);
    expect(leader.forced).toBe(true);
    expect(leader.rise).toBe(0);
  });

  it("5: a pal that becomes the aimed one shows at once even when it was hidden", () => {
    const mine = me();
    const wild = tag({ rank: LABEL_RANK.wild, y: 110, width: 80 });
    frame([mine, wild], 0);
    expect(wild.form).toBe(TAG_FORM.hidden);
    wild.rank = LABEL_RANK.aimed;
    frame([mine, wild], 16);
    // The pal is nearer the viewer, so it keeps its place and "me" rises.
    expect(wild.form).toBe(TAG_FORM.full);
    expect(wild.rise).toBe(0);
    expect(mine.form).toBe(TAG_FORM.full);
    expect(mine.rise).toBe(9);
  });

  it("6: a hidden tag needs 250 ms of room; a tight frame restarts the count", () => {
    for (const tightAgain of [false, true]) {
      const mine = me();
      const c = tag({ rank: LABEL_RANK.companion, y: 110, width: 80 });
      for (const t of [0, 50, 100]) frame([mine, c], t);
      expect(c.form).toBe(TAG_FORM.hidden);
      mine.x = 400;
      const seen: Record<number, number> = {};
      for (const t of [150, 200, 300, 349, 350, 449, 450]) {
        if (t === 200 && tightAgain) mine.x = 100;
        if (t === 300 && tightAgain) mine.x = 400;
        frame([mine, c], t);
        seen[t] = c.form;
      }
      if (!tightAgain) {
        expect([seen[150], seen[300], seen[349], seen[350]]).toEqual([2, 2, 2, 0]);
      } else {
        expect([seen[349], seen[350], seen[449]]).toEqual([2, 2, 2]);
        expect(seen[450]).toBe(TAG_FORM.full);
      }
    }
  });

  it("7: a calm wild pal takes no room", () => {
    const mine = me();
    const calm = tag({ rank: LABEL_RANK.wild, named: false });
    const p = tag();
    layoutTags([mine, calm, p], 3, 0);
    expect(p.rise).toBe(19);
    expect(calm.placed).toBe(false);
    expect(calm.form).toBe(TAG_FORM.full);
  });

  it("8: the older tag keeps its place whatever the array order", () => {
    for (const flip of [false, true]) {
      const a = tag({ rank: LABEL_RANK.wild, seq: 5, height: 24, barWidth: 36, barHeight: 5 });
      const b = tag({ rank: LABEL_RANK.wild, seq: 9, height: 24, barWidth: 36, barHeight: 5 });
      layoutTags(flip ? [b, a] : [a, b], 2, 0);
      expect(a.form).toBe(TAG_FORM.full);
      expect(a.rise).toBe(0);
      expect(b.form).toBe(TAG_FORM.hidden);
    }
  });

  /** A random crowd of 25 tags in a 360 x 300 area. */
  function crowd(seed: number): LayoutItem[] {
    const random = mulberry32(seed);
    const kinds = [LABEL_RANK.player, LABEL_RANK.companion, LABEL_RANK.wild, LABEL_RANK.camp];
    const items: LayoutItem[] = [];
    for (let i = 0; i < 25; i++) {
      const bar = random() < 0.5;
      let rank: number = kinds[Math.floor(random() * kinds.length)];
      if (i === 0) rank = LABEL_RANK.me;
      else if (i === 1) rank = LABEL_RANK.aimed;
      else if (i === 2) rank = LABEL_RANK.follower;
      else if (i === 3) rank = LABEL_RANK.leader;
      items.push(tag({
        x: random() * 360, y: 40 + random() * 260, width: 40 + random() * 160, height: bar ? 24 : 17,
        barWidth: bar ? 36 : 0, barHeight: bar ? 5 : 0,
        named: !(rank === LABEL_RANK.wild && random() < 0.1), rank,
      }));
    }
    return items;
  }

  it("9: in a random crowd, tags only overlap when a pinned tag was forced", () => {
    for (let s = 0; s < 300; s++) {
      const items = crowd(1234 + s);
      const mine = items[0];
      layoutTags(items, items.length, 0);
      expect(mine.form).toBe(TAG_FORM.full);
      for (const it of items) {
        const cap = it.rank <= PINNED_RANK ? LABEL_PINNED_NUDGE_PX : LABEL_NUDGE_PX;
        expect(it.rise).toBeLessThanOrEqual(cap);
        if (it.rank <= PINNED_RANK) expect(it.form).not.toBe(TAG_FORM.hidden);
      }
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i], b = items[j];
          if (!a.placed || !b.placed) continue;
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 0 && h > 0) expect(a.forced || b.forced).toBe(true);
        }
      }
    }
  });

  it("10: at most 64 normal tags are laid out", () => {
    const items: LayoutItem[] = [];
    for (let i = 0; i < 80; i++) items.push(tag({ x: 300 * i }));
    layoutTags(items, items.length, 0);
    items.forEach((it, i) => expect(it.form).toBe(i < LABEL_LAYOUT_MAX ? TAG_FORM.full : TAG_FORM.hidden));
  });

  it("11: the same input gives the same output", () => {
    const first = crowd(77), second = crowd(77);
    layoutTags(first, first.length, 0);
    layoutTags(second, second.length, 0);
    expect(second.map((it) => [it.seq - second[0].seq, it.form, it.rise])).toEqual(first.map((it) => [it.seq - first[0].seq, it.form, it.rise]));
  });

  it("12: frame after frame, while the aimed pal changes and tags drift, placed tags only overlap when forced", () => {
    const kinds = [LABEL_RANK.player, LABEL_RANK.companion, LABEL_RANK.wild, LABEL_RANK.camp];
    for (let seed = 1; seed <= 100; seed++) {
      const random = mulberry32(seed);
      // layoutTags sorts `items` in place, so keep stable references and base ranks by tag.
      const items: LayoutItem[] = [];
      const base = new Map<LayoutItem, number>();
      for (let i = 0; i < 20; i++) {
        const rank = i === 0 ? LABEL_RANK.me : kinds[Math.floor(random() * kinds.length)];
        const bar = random() < 0.5;
        const it = tag({
          x: random() * 240, y: random() * 160, rank, width: bar ? 80 : 60,
          height: bar ? 24 : 17, barWidth: bar ? 36 : 0, barHeight: bar ? 5 : 0,
        });
        items.push(it);
        base.set(it, rank);
      }
      const wild = items.filter((it) => base.get(it) === LABEL_RANK.wild);
      for (let f = 0; f < 200; f++) {
        const aimed = wild.length > 0 && random() < 0.5 ? wild[Math.floor(random() * wild.length)] : undefined;
        items.forEach((it) => {
          it.rank = it === aimed ? LABEL_RANK.aimed : base.get(it)!;
          if (random() < 0.1) {
            it.x += (random() * 2 - 1) * 3;
            it.y += (random() * 2 - 1) * 3;
          }
        });
        layoutTags(items, items.length, f * 33);
        if (aimed) expect(aimed.form).not.toBe(TAG_FORM.hidden);
        for (const it of items) if (it.rank <= PINNED_RANK) expect(it.form).not.toBe(TAG_FORM.hidden);
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i], b = items[j];
            if (!a.placed || !b.placed) continue;
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (w > 0 && h > 0) expect(a.forced || b.forced).toBe(true);
          }
        }
        for (const it of items) it.fresh = false;
      }
    }
  });
});
