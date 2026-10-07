/**
 * Procedural sound: every effect and the background music are synthesized
 * with Web Audio, so the game ships no audio files. Muting is remembered.
 */

export type SoundName =
  | "hit" | "hurt" | "throw" | "capture" | "escape" | "levelup"
  | "skill" | "stomp" | "craft" | "produce" | "victory" | "faint" | "chest" | "quest";

/** Major pentatonic (day) and minor pentatonic (night), as semitones from the root. */
const DAY_SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
const NIGHT_SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
const DAY_CHORDS = [0, 5, 7, 3]; // I - IV - V - vi-ish roots (semitones)
const NIGHT_CHORDS = [0, 8, 3, 7];

export class Sound {
  private ctx?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private sfxBus?: GainNode;
  private musicTimer = 0;
  private step = 0;
  private night = false;
  muted: boolean;

  constructor() {
    this.muted = readMuted();
  }

  /** Browsers only allow audio after a user gesture; call from one. */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.22;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.6;
    this.sfxBus.connect(this.master);
    this.startMusic();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem("petgame:muted", this.muted ? "1" : "0");
    } catch {
      /* storage unavailable: keep it for this session only */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  setNight(night: boolean) {
    this.night = night;
  }

  play(name: SoundName) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted) return;
    const t = ctx.currentTime;
    switch (name) {
      case "hit": this.noise(t, 0.08, 1200, 0.5); this.tone(t, 180, 90, 0.1, "square", 0.25); break;
      case "hurt": this.tone(t, 300, 120, 0.18, "sawtooth", 0.25); break;
      case "throw": this.tone(t, 400, 900, 0.2, "sine", 0.25); break;
      case "capture": [0, 4, 7, 12].forEach((n, i) => this.tone(t + i * 0.09, note(72 + n), undefined, 0.2, "triangle", 0.35)); break;
      case "escape": this.tone(t, 500, 200, 0.25, "triangle", 0.3); break;
      case "levelup": [0, 4, 7, 11, 12].forEach((n, i) => this.tone(t + i * 0.07, note(76 + n), undefined, 0.25, "square", 0.18)); break;
      case "skill": this.tone(t, 300, 1200, 0.25, "sawtooth", 0.15); this.noise(t, 0.2, 3000, 0.25); break;
      case "stomp": this.tone(t, 90, 35, 0.6, "sine", 0.9); this.noise(t, 0.4, 400, 0.6); break;
      case "craft": [0, 7].forEach((n, i) => this.tone(t + i * 0.08, note(67 + n), undefined, 0.15, "square", 0.2)); break;
      case "produce": this.tone(t, note(84), undefined, 0.08, "sine", 0.2); break;
      case "victory": [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(t + i * 0.1, note(64 + n), undefined, 0.35, "triangle", 0.3)); break;
      case "chest": this.noise(t, 0.12, 2500, 0.3); [7, 12, 16, 19].forEach((n, i) => this.tone(t + 0.08 + i * 0.06, note(79 + n), undefined, 0.3, "sine", 0.25)); break;
      case "quest": [0, 7, 12, 7, 12, 16].forEach((n, i) => this.tone(t + i * 0.09, note(67 + n), undefined, 0.3, "triangle", 0.3)); break;
      case "faint": [12, 7, 3, 0].forEach((n, i) => this.tone(t + i * 0.15, note(60 + n), undefined, 0.3, "triangle", 0.3)); break;
    }
  }

  /** A gentle generative loop: pad chord every bar, plucked notes on top. */
  private startMusic() {
    const beat = () => {
      const ctx = this.ctx;
      if (!ctx || !this.musicBus) return;
      const t = ctx.currentTime + 0.05;
      const scale = this.night ? NIGHT_SCALE : DAY_SCALE;
      const chords = this.night ? NIGHT_CHORDS : DAY_CHORDS;
      const root = (this.night ? 50 : 55) + chords[Math.floor(this.step / 8) % chords.length];
      if (this.step % 8 === 0) {
        for (const n of [0, 7, 12, 16]) this.tone(t, note(root + n - 12), undefined, 3.2, "sine", 0.12, this.musicBus, 0.6);
      }
      if (Math.random() < (this.night ? 0.35 : 0.55)) {
        const n = scale[Math.floor(Math.random() * scale.length)];
        this.tone(t, note(root + 12 + n), undefined, 0.6, "triangle", 0.14, this.musicBus, 0.01);
      }
      this.step++;
      this.musicTimer = window.setTimeout(beat, this.night ? 520 : 400);
    };
    clearTimeout(this.musicTimer);
    beat();
  }

  private tone(
    start: number,
    from: number,
    to: number | undefined,
    duration: number,
    type: OscillatorType,
    volume: number,
    bus: AudioNode = this.sfxBus!,
    attack = 0.005,
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 20), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noise(start: number, duration: number, cutoff: number, volume: number) {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(gain).connect(this.sfxBus!);
    src.start(start);
  }
}

function note(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function readMuted(): boolean {
  try {
    return localStorage.getItem("petgame:muted") === "1";
  } catch {
    return false;
  }
}
