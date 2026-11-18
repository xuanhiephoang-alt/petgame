import { SEEN_EVERY_MS } from "../ui/joinStatus.ts";

/**
 * Notes when the device was last connected in its world (T79), so the lobby at "/" can offer the way back. A timer
 * writes every `every` ms; the page also calls `note()` when it turns hidden and when it closes (iOS can drop a
 * backgrounded web app without a `pagehide`). Writes only while `online()`: a dropped or replaced tab may no longer be
 * in the world. No DOM: time comes from the global Date.now and setInterval (tests drive them with fake timers).
 */
export class SeenNotes {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly online: () => boolean,
    private readonly write: (seen: number) => void,
    every = SEEN_EVERY_MS,
  ) {
    this.timer = setInterval(() => this.note(), every);
  }

  /** Writes Date.now() if online. */
  note(): void {
    if (this.online()) this.write(Date.now());
  }

  /** The world is lost for good: the timer stops (note() still checks online). Safe to call more than once. */
  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
