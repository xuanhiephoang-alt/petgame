// Sessions that dropped less than shelterDelayMs ago and still stand in the world, exposed to whatever is under way.
// A fresh join of the same device waits for them, so a blow under way lands first and a lost place is read after it (T25b).

/** One open exposure: its promise and the function that ends it. */
interface Open {
  done: Promise<void>;
  end: () => void;
}

/** Tracks which sessions are exposed and lets a join wait until they are not. No Colyseus, no timers. */
export class Exposures {
  private open_ = new Map<string, Open>();

  /** Starts the exposure of a session; one already open stays as it is. */
  open(sessionId: string): void {
    if (this.open_.has(sessionId)) return;
    let end!: () => void;
    const done = new Promise<void>((resolve) => (end = resolve));
    this.open_.set(sessionId, { done, end });
  }

  /** Ends it and wakes whoever waits; harmless for a session that is not open, and when repeated. */
  close(sessionId: string): void {
    const exposure = this.open_.get(sessionId);
    if (!exposure) return;
    this.open_.delete(sessionId);
    exposure.end();
  }

  /** Whether the session is exposed now. */
  isOpen(sessionId: string): boolean {
    return this.open_.has(sessionId);
  }

  /** Resolves when the session is not exposed: at once if it is not, else once it closes (and again if it was reopened meanwhile). */
  async settled(sessionId: string): Promise<void> {
    for (let e = this.open_.get(sessionId); e; e = this.open_.get(sessionId)) await e.done;
  }

  /** Ends every exposure (the room is closing: nobody may wait for it for ever). */
  closeAll(): void {
    for (const id of [...this.open_.keys()]) this.close(id);
  }
}
