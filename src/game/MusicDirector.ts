/**
 * Procedural synthwave score built from Web Audio oscillators, so the game ships with music
 * and no audio files. A 16-step sequencer drives four layers per planet: detuned saw pads on
 * a four-chord loop, an eighth-note pulsing bass, a sixteenth-note arpeggio through a dotted
 * echo, and a soft drum machine (kick, noise snare, hats). The menu plays the full mix; a dive
 * drops the snare and thins the arp, and the low-pass closes with depth so the deep reads muffled.
 */

export type MusicMood = 'menu' | 'dive' | 'off';

interface PlanetScore {
  bpm: number;
  /** Root frequency of each chord in the loop (two bars per chord). */
  roots: number[];
  /** Semitone offsets stacked on each root to build the pad chord. */
  chord: number[];
  /** Semitone offsets the arpeggio walks through, one per sixteenth. */
  arp: number[];
  arpWave: OscillatorType;
}

const SCORES: Record<number, PlanetScore> = {
  // Terra-Vein: classic sunset minor loop (Am, F, C, G)
  1: { bpm: 100, roots: [110, 87.31, 130.81, 98], chord: [0, 7, 12, 15], arp: [12, 19, 24, 15, 19, 24, 27, 24], arpWave: 'square' },
  // Cryo-Vex: open suspended chords, glassy triangle arp
  2: { bpm: 92, roots: [146.83, 116.54, 130.81, 110], chord: [0, 7, 14, 17], arp: [19, 24, 26, 31, 26, 24, 19, 14], arpWave: 'triangle' },
  // Pyra-Void: dark phrygian drive, faster
  3: { bpm: 112, roots: [82.41, 87.31, 82.41, 73.42], chord: [0, 7, 12, 13], arp: [12, 13, 19, 24, 13, 19, 12, 25], arpWave: 'sawtooth' },
};

const STEPS_PER_CHORD = 32; // two bars of sixteenths
const semis = (f: number, s: number) => f * Math.pow(2, s / 12);

export class MusicDirector {
  private bus: GainNode;
  private filter: BiquadFilterNode;
  private delay: DelayNode;
  private noise: AudioBuffer;
  private mood: MusicMood = 'off';
  private planetId = 1;
  private step = 0;
  private nextStepAt = 0;
  private timer: number | null = null;
  private voices: { gain: GainNode }[] = [];

  constructor(private ctx: AudioContext, out: AudioNode) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2400;
    this.filter.Q.value = 0.9;

    // Dotted-eighth echo on the arp, the genre's signature shimmer
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.45;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    this.delay.connect(feedback);
    feedback.connect(this.delay);
    this.delay.connect(this.filter);

    this.filter.connect(this.bus);
    this.bus.connect(out);

    // Half a second of white noise, reused by every snare and hat
    this.noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  public setMood(mood: MusicMood, planetId: number): void {
    const planetChanged = planetId !== this.planetId;
    this.planetId = SCORES[planetId] ? planetId : 1;
    if (mood === this.mood && !planetChanged) return;
    this.mood = mood;

    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(mood === 'off' ? 0 : mood === 'menu' ? 0.5 : 0.36, t, 0.8);
    this.filter.frequency.setTargetAtTime(mood === 'menu' ? 2600 : 1800, t, 0.6);
    const score = SCORES[this.planetId];
    this.delay.delayTime.setValueAtTime((60 / score.bpm) * 0.75, t);

    if (mood === 'off') {
      this.stopScheduler();
      return;
    }
    // A new mood or planet restarts the loop from its first chord
    this.step = 0;
    this.nextStepAt = t + 0.1;
    this.startScheduler();
  }

  /** 0 at the surface, 1 at the core: closes the filter as the pod descends. */
  public setDepth(depthRatio: number): void {
    if (this.mood !== 'dive') return;
    const cutoff = 1800 * Math.pow(0.22, Math.max(0, Math.min(1, depthRatio)));
    this.filter.frequency.setTargetAtTime(Math.max(320, cutoff), this.ctx.currentTime, 0.5);
  }

  private startScheduler(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.schedule(), 100);
    this.schedule();
  }

  private stopScheduler(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    for (const v of this.voices) {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, 0.4);
    }
    this.voices = [];
  }

  private schedule(): void {
    if (this.ctx.state !== 'running') return;
    const score = SCORES[this.planetId];
    const stepLen = 60 / score.bpm / 4;
    const lookahead = this.ctx.currentTime + 0.3;
    // After a stall (tab hidden), skip ahead instead of firing a burst of late notes
    if (this.nextStepAt < this.ctx.currentTime - 0.2) this.nextStepAt = this.ctx.currentTime + 0.05;

    while (this.nextStepAt < lookahead) {
      this.playStep(score, this.step, this.nextStepAt, stepLen);
      this.step++;
      this.nextStepAt += stepLen;
    }
  }

  private playStep(score: PlanetScore, step: number, at: number, stepLen: number): void {
    const chordIdx = Math.floor(step / STEPS_PER_CHORD) % score.roots.length;
    const root = score.roots[chordIdx];
    const s = step % 16;
    const dive = this.mood === 'dive';

    if (step % STEPS_PER_CHORD === 0) this.playPad(score, root, at, stepLen * STEPS_PER_CHORD);

    // Bass: eighth-note pulse, octave jump on the off-beat
    if (s % 2 === 0) this.playBass(s % 4 === 2 ? root : root / 2, at, stepLen * 1.6);

    // Arp: every sixteenth on the menu, every eighth while diving
    if (!dive || s % 2 === 0) {
      const off = score.arp[step % score.arp.length];
      this.playArp(semis(root, off), at, stepLen, score.arpWave, dive ? 0.022 : 0.03);
    }

    // Drums
    if (s % 4 === 0) this.playKick(at, dive ? 0.32 : 0.45);
    if (!dive && (s === 4 || s === 12)) this.playSnare(at);
    if (s % 2 === 1) this.playHat(at, dive ? 0.012 : 0.02);
  }

  private playPad(score: PlanetScore, root: number, at: number, length: number): void {
    const end = at + length + 2;
    for (const v of this.voices) v.gain.gain.setTargetAtTime(0, at, 0.8);
    this.voices = [];
    for (const off of score.chord) {
      for (const detune of [-9, 9]) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = semis(root, off);
        osc.detune.value = detune;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.009, at + 1.4);
        osc.connect(gain);
        gain.connect(this.filter);
        osc.start(at);
        osc.stop(end);
        this.voices.push({ gain });
      }
    }
  }

  private playBass(freq: number, at: number, len: number): void {
    const osc = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, at);
    lp.frequency.exponentialRampToValueAtTime(180, at + len);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.07, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(this.filter);
    osc.start(at);
    osc.stop(at + len + 0.02);
  }

  private playArp(freq: number, at: number, len: number, wave: OscillatorType, level: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + len * 0.9);
    osc.connect(gain);
    gain.connect(this.filter);
    gain.connect(this.delay);
    osc.start(at);
    osc.stop(at + len);
  }

  private playKick(at: number, level: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.14);
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    osc.connect(gain);
    gain.connect(this.bus);
    osc.start(at);
    osc.stop(at + 0.3);
  }

  private playSnare(at: number): void {
    const src = this.ctx.createBufferSource();
    const bp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    src.buffer = this.noise;
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    gain.gain.setValueAtTime(0.12, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.filter);
    gain.connect(this.delay);
    src.start(at);
    src.stop(at + 0.24);
  }

  private playHat(at: number, level: number): void {
    const src = this.ctx.createBufferSource();
    const hp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    src.buffer = this.noise;
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.filter);
    src.start(at, Math.random() * 0.4);
    src.stop(at + 0.06);
  }
}
