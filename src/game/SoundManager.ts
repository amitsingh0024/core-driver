import { MusicDirector, MusicMood } from './MusicDirector';

export class SoundManager {
  private ctx: AudioContext | null = null;
  public muted = false;
  private lastDrillTick = 0;
  private lastHover = 0;
  /** Everything ends here; muting fades this one node. */
  private out: GainNode | null = null;
  /** SFX bus: every sound effect connects to this. */
  private master: GainNode | null = null;
  private music: MusicDirector | null = null;
  private musicBus: GainNode | null = null;
  private volume = 0.8;
  private musicVolume = 0.6;
  private mood: MusicMood = 'off';
  private moodPlanet = 1;

  /** Master volume 0..1, applied to every sound through one gain node. */
  public setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  public setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    // Unmuting happens on a click, so audio is allowed to start here
    if (!muted && this.ctx) this.unlock();
  }

  /** Browsers only allow audio after a user gesture, so the first click calls this. */
  public unlock(): void {
    if (this.muted) return;
    this.ensureContext();
    this.music?.setMood(this.mood, this.moodPlanet);
  }

  public setMusicMood(mood: MusicMood, planetId: number): void {
    this.mood = mood;
    this.moodPlanet = planetId;
    this.music?.setMood(mood, planetId);
  }

  public setMusicDepth(depthRatio: number): void {
    this.music?.setDepth(depthRatio);
  }

  /** Pause all audio while the tab is hidden. */
  public suspend(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) this.ctx.suspend().catch(() => {});
    else if (!this.muted) this.ctx.resume().catch(() => {});
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.out = this.ctx.createGain();
        this.out.connect(this.ctx.destination);
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.out);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = this.musicVolume;
        this.musicBus.connect(this.out);
        this.music = new MusicDirector(this.ctx, this.musicBus);
        // iOS parks the context as "interrupted" after calls or Siri; resume once the page is back
        this.ctx.addEventListener('statechange', () => {
          const state = this.ctx?.state as string | undefined;
          if ((state === 'interrupted' || state === 'suspended') && !document.hidden && !this.muted) {
            this.ctx?.resume().catch(() => {});
          }
        });
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && !document.hidden) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /** Soft tick for pressing any interface button. */
  public playUiClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.05);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  /** Very quiet blip when the pointer moves onto a button. */
  public playUiHover(): void {
    const now = performance.now();
    if (now - this.lastHover < 60 || !this.ctx) return;
    this.lastHover = now;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, t);
    gain.gain.setValueAtTime(0.012, t);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.03);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  /** Two-tone warning beep; urgent is higher and harsher. */
  public playFuelAlarm(urgent: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 0.11].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = urgent ? 'square' : 'triangle';
      osc.frequency.setValueAtTime((urgent ? 990 : 740) * (i === 0 ? 1 : 0.84), t + offset);
      gain.gain.setValueAtTime(urgent ? 0.045 : 0.05, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.09);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(t + offset);
      osc.stop(t + offset + 0.1);
    });
  }

  /** Low whoosh for screen transitions and the dive drop. */
  public playWhoosh(down = true): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = 0.45;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(down ? 1800 : 300, t);
    filter.frequency.exponentialRampToValueAtTime(down ? 250 : 1600, t + len);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    src.start(t);
  }

  public playDrillTick(hardnessRatio: number): void {
    const now = performance.now();
    if (now - this.lastDrillTick < 55) return;
    this.lastDrillTick = now;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = hardnessRatio > 1.2 ? 'sawtooth' : 'triangle';
    const baseFreq = hardnessRatio > 1.2 ? 95 : 135;
    osc.frequency.setValueAtTime(baseFreq + Math.random() * 25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.045);

    gain.gain.setValueAtTime(0.045, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);

    osc.connect(gain);
    gain.connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  public playBlockBreak(isCore = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isCore ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(isCore ? 210 : 160 + Math.random() * 40, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isCore ? 45 : 65, ctx.currentTime + (isCore ? 0.25 : 0.07));

    gain.gain.setValueAtTime(isCore ? 0.14 : 0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isCore ? 0.25 : 0.07));

    osc.connect(gain);
    gain.connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + (isCore ? 0.26 : 0.08));
  }

  public playOrePickup(tier: number, isDouble = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const f1 = 420 + (tier % 5) * 85;
    osc.frequency.setValueAtTime(f1, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(f1 * (isDouble ? 1.65 : 1.35), ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);

    osc.connect(gain);
    gain.connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  }

  public playFuelPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(480, now + 0.06);
    osc.frequency.setValueAtTime(640, now + 0.12);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playUpgradeBuy(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);
      gain.gain.setValueAtTime(0.09, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.14);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.15);
    });
  }

  public playSurfaceExtract(success: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = success ? [392, 523.25, 659.25, 783.99] : [311.13, 277.18, 220, 164.81];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = success ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.08, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.18);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.19);
    });
  }

  public playCoreShatter(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.12, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.36);
    });
  }

  /** Bright two-note chime for cracking a relic cache. */
  public playRelicOpen(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    [660, 990, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.07;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  /** Short coin tick used by the Results payout count-up. */
  public playCoinTick(pitch = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400 * pitch, ctx.currentTime);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  /** Rising arpeggio when a dive contract is completed. */
  public playContractComplete(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    [523, 659, 784, 1046].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.06;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }
}
