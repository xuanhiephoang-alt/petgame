import { describe, expect, it } from "vitest";
import { TOAST, ToastQueue, toastDuration, toastRoom } from "./toastQueue.ts";

const texts = (q: ToastQueue) => q.visible.map((t) => t.text);

/**
 * Plays pushes (time, text, level) in 10 ms steps on a queue with `room` slots; returns, in show order, when each toast
 * first showed and when it was last seen shown (`to` follows the toast while it is in `visible`, so a toast removed early is short).
 */
function playOut(pushes: [number, string, "low" | "normal" | "high"][], room = 2): { text: string; from: number; to: number }[] {
  const q = new ToastQueue(() => room);
  const log = new Map<string, { text: string; from: number; to: number }>();
  for (let now = 0; now <= 30000; now += 10) {
    for (const [at, text, level] of pushes) if (at > now - 10 && at <= now) q.push(text, level, at);
    q.update(now);
    for (const t of q.visible) {
      const entry = log.get(t.text) ?? { text: t.text, from: t.shownAt, to: t.shownAt };
      entry.to = now + 10;
      log.set(t.text, entry);
    }
  }
  return [...log.values()];
}

describe("toastDuration", () => {
  it("short texts get the floor of their level", () => {
    expect(toastDuration("Máu đang đầy", "low")).toBe(1800);
    expect(toastDuration("Bắt được Leafkit! 🎉", "high")).toBe(3000);
    expect(toastDuration("ok", "normal")).toBe(2500);
  });
  it("long texts grow by 55 ms a character, capped at 7000", () => {
    expect(toastDuration("x".repeat(60), "normal")).toBe(1000 + 55 * 60);
    expect(toastDuration("x".repeat(500), "high")).toBe(7000);
  });
  it("an emoji counts once", () => {
    expect(toastDuration("🎉".repeat(60), "low")).toBe(1000 + 55 * 60);
  });
});

describe("toastRoom", () => {
  it("one toast on short or low upright screens, two otherwise", () => {
    expect(toastRoom(390, 844)).toBe(2);
    expect(toastRoom(390, 664)).toBe(1);
    expect(toastRoom(375, 667)).toBe(1);
    expect(toastRoom(844, 390)).toBe(1);
    expect(toastRoom(1280, 720)).toBe(2);
    expect(toastRoom(768, 1024)).toBe(2);
    expect(toastRoom(1280, 500)).toBe(1);
  });
});

describe("ToastQueue", () => {
  it("shows two at once; a third low replaces the older low, a normal stays", () => {
    const q = new ToastQueue();
    expect(q.push("a", "low", 0)).toBe(true);
    expect(q.push("b", "normal", 10)).toBe(true);
    expect(q.push("c", "low", 20)).toBe(true);
    expect(texts(q)).toEqual(["b", "c"]);
  });

  it("high is never replaced: a low waits and goes stale, a normal waits for a slot", () => {
    const q = new ToastQueue();
    q.push("h1", "high", 0);
    q.push("h2", "high", 0);
    expect(q.push("l", "low", 100)).toBe(false);
    expect(q.waiting).toHaveLength(1);
    q.update(1200);
    expect(q.waiting).toHaveLength(0);
    q.push("n", "normal", 1300);
    expect(texts(q)).toEqual(["h1", "h2"]);
    q.update(3000);
    expect(texts(q)).toEqual(["n"]);
    const n = q.visible[0];
    expect(n.shownAt).toBe(3000);
    expect(n.until).toBe(3000 + toastDuration("n", "normal"));
  });

  it("a higher level replaces the weakest shown one", () => {
    const q = new ToastQueue();
    q.push("l", "low", 0);
    q.push("n", "normal", 0);
    q.push("h", "high", 5);
    expect(texts(q)).toEqual(["n", "h"]);
  });

  it("the same level normal replaces the oldest", () => {
    const q = new ToastQueue();
    q.push("n1", "normal", 0);
    q.push("n2", "normal", 10);
    q.push("n3", "normal", 20);
    expect(texts(q)).toEqual(["n2", "n3"]);
  });

  it("a third high waits and shows when the first ends; the strongest waiting goes first", () => {
    const q = new ToastQueue();
    q.push("h1", "high", 0);
    q.push("h2", "high", 0);
    q.push("n", "normal", 10);
    q.push("h3", "high", 20);
    expect(q.waiting.map((w) => w.text)).toEqual(["n", "h3"]);
    q.update(3000);
    expect(texts(q)).toEqual(["h3", "n"]);
  });

  it("the same text as a shown one extends it without a new id or order change", () => {
    const q = new ToastQueue();
    q.push("a", "low", 0);
    q.push("b", "low", 0);
    const ids = q.visible.map((t) => t.id);
    expect(q.push("a", "low", 1000)).toBe(false);
    expect(q.visible.map((t) => t.id)).toEqual(ids);
    expect(q.visible[0].until).toBe(1000 + 1800);
  });

  it("the same text as a waiting one is one entry", () => {
    const q = new ToastQueue();
    q.push("h1", "high", 0);
    q.push("h2", "high", 0);
    q.push("w", "high", 1);
    q.push("w", "high", 2);
    expect(q.waiting).toHaveLength(1);
  });

  it("keeps at most maxWaiting, dropping the oldest", () => {
    const q = new ToastQueue();
    q.push("h1", "high", 0);
    q.push("h2", "high", 0);
    for (let i = 0; i < 6; i++) q.push(`w${i}`, "high", 10 + i);
    expect(q.waiting.map((w) => w.text)).toEqual(["w2", "w3", "w4", "w5"]);
    expect(q.waiting.length).toBe(TOAST.maxWaiting);
  });

  it("maxVisible is read each time", () => {
    let room = 1;
    const q = new ToastQueue(() => room);
    q.push("h1", "high", 0);
    q.push("h2", "high", 0);
    expect(texts(q)).toEqual(["h1"]);
    room = 2;
    expect(q.update(10)).toBe(true);
    expect(texts(q)).toEqual(["h1", "h2"]);
  });

  it("update with nothing due returns false and keeps visible", () => {
    const q = new ToastQueue();
    q.push("a", "low", 0);
    const before = q.visible[0];
    expect(q.update(100)).toBe(false);
    expect(q.visible[0]).toBe(before);
  });

  it("boss kill: reward and level 8 show together, then level 9 and the quest; in order, each for its full time", () => {
    const run = playOut([[0, "reward", "high"], [0, "level 8", "high"], [50, "level 9", "high"], [2100, "quest", "high"]]);
    expect(run.map((r) => r.text)).toEqual(["reward", "level 8", "level 9", "quest"]);
    expect(run.map((r) => r.from)).toEqual([0, 0, 3000, 3000]);
    for (const r of run) expect(r.to - r.from).toBe(toastDuration(r.text, "high"));
  });

  it("pack leader catch: the catch and the quest show together, then the news, then the level-up; each for its full time", () => {
    const run = playOut([[1900, "caught", "high"], [2100, "quest", "high"], [2200, "news", "high"], [2200, "level", "high"]]);
    expect(run.map((r) => r.text)).toEqual(["caught", "quest", "news", "level"]);
    expect(run.map((r) => r.from)).toEqual([1900, 2100, 4900, 5100]);
    for (const r of run) expect(r.to - r.from).toBe(toastDuration(r.text, "high"));
  });

  it("sideways phone (one slot): high toasts wait as long as it takes, then each shows its full time", () => {
    const run = playOut([[0, "reward", "high"], [0, "level 8", "high"], [0, "quest", "high"]], 1);
    expect(run.map((r) => r.text)).toEqual(["reward", "level 8", "quest"]);
    expect(run.map((r) => r.from)).toEqual([0, 3000, 6000]);
    for (const r of run) expect(r.to - r.from).toBe(toastDuration(r.text, "high"));
  });

  it("first catch while a tip is shown: the catch replaces the tip, the quest replaces the miss", () => {
    const q = new ToastQueue();
    q.push("tip", "normal", 0);
    q.push("miss", "normal", 500);
    q.push("caught", "high", 1900);
    expect(texts(q)).toEqual(["miss", "caught"]);
    q.push("quest", "high", 2100);
    expect(texts(q)).toEqual(["caught", "quest"]);
  });

  it("level-up then three refused keys: the level-up stays, the second slot takes the latest, a repeat extends", () => {
    const q = new ToastQueue();
    q.push("level", "high", 0);
    q.push("no ball", "low", 100);
    q.push("locked", "low", 200);
    expect(texts(q)).toEqual(["level", "locked"]);
    q.push("full", "low", 300);
    expect(q.push("full", "low", 400)).toBe(false);
    expect(texts(q)).toEqual(["level", "full"]);
    expect(q.visible[1].until).toBe(400 + 1800);
  });
});
