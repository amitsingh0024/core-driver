/**
 * Procedural ambient score built from Web Audio oscillators, so the game ships with music
 * and no audio files. A slow pad plays a four-chord loop per planet, a sub drone holds the
 * root, and sparse delayed plucks drift over the top. During a dive the low-pass filter
 * closes with depth, so the deeper the pod goes the more muffled the world sounds.
 */

export type MusicMood = 'menu' | 'dive' | 'off';

interface PlanetScore {
  /** Root frequency of each chord in the loop. */
  roots: number[];
  /** Semitone offsets stacked on each root to build the chord. */
  chord: number[];
  /** Pentatonic offsets (semitones above the root) the plucks choose from. */
  pluck: number[];
  padWave: OscillatorType;
}

const SCORES: Record<number, PlanetScore> = {
  // Terra-Vein: warm minor loop (Am, F, C, G)
  1: { roots: [110, 87.31, 130.81, 98], chord: [0, 7, 12, 15], pluck: [12, 15, 19, 22, 24, 27], padWave: 'triangle' },
  // Cryo-Vex: open suspended chords, glassy
  2: { roots: [146.83, 116.54, 130.81, 110], chord: [0, 7, 14, 17], pluck: [19, 24, 26, 29, 31, 36], padWave: 'sine' },
  // Pyra-Void: low and tense, phrygian half-step
  3: { roots: [82.41, 87.31, 82.41, 73.42], chord: [0, 7, 12, 13], pluck: [12, 13, 17, 19, 24], padWave: 'sawtooth' },
};

const CHORD_SECONDS = 8;
const semis = (f: number, s: number) => f * Math.pow(2, s / 12);

export class MusicDirector {
  private bus: GainNode;
  private filter: BiquadFilterNode;
  private delay: DelayNode;
  private mood: MusicMood = 'off';
  private planetId = 1;
  private chordIdx = 0;
  private nextChordAt = 0;
  private nextPluckAt = 0;
  private timer: number | null = null;
  private voices: { gain: GainNode }[] = [];

  constructor(private ctx: AudioContext, out: AudioNode) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1200;
    this.filter.Q.value = 0.7;

    // Feedback echo gives the plucks a cavern tail
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    this.delay.connect(feedback);
    feedback.connect(this.delay);
    this.delay.connect(this.filter);

    this.filter.connect(this.bus);
    this.bus.connect(out);
  }

  public setMood(mood: MusicMood, planetId: number): void {
    const planetChanged = planetId !== this.planetId;
    this.planetId = SCORES[planetId] ? planetId : 1;
    if (mood === this.mood && !planetChanged) return;
    this.mood = mood;

    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(mood === 'off' ? 0 : mood === 'menu' ? 0.55 : 0.4, t, 0.8);
    this.filter.frequency.setTargetAtTime(mood === 'menu' ? 1500 : 1100, t, 0.6);

    if (mood === 'off') {
      this.stopScheduler();
      return;
    }
    // A new mood or planet starts a fresh chord right away
    this.nextChordAt = t + 0.05;
    this.chordIdx = 0;
    this.nextPluckAt = t + 1.5;
    this.startScheduler();
  }

  /** 0 at the surface, 1 at the core: closes the filter as the pod descends. */
  public setDepth(depthRatio: number): void {
    if (this.mood !== 'dive') return;
    const cutoff = 1100 * Math.pow(0.28, Math.max(0, Math.min(1, depthRatio)));
    this.filter.frequency.setTargetAtTime(Math.max(260, cutoff), this.ctx.currentTime, 0.5);
  }

  private startScheduler(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.schedule(), 200);
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
    const lookahead = this.ctx.currentTime + 0.4;

    if (this.nextChordAt < lookahead) {
      this.playChord(score, score.roots[this.chordIdx % score.roots.length], this.nextChordAt);
      this.chordIdx++;
      this.nextChordAt += CHORD_SECONDS;
    }
    if (this.nextPluckAt < lookahead) {
      const root = score.roots[(this.chordIdx + score.roots.length - 1) % score.roots.length];
      const step = score.pluck[Math.floor(Math.random() * score.pluck.length)];
      this.playPluck(semis(root, step), this.nextPluckAt);
      const gap = this.mood === 'dive' ? 1.6 + Math.random() * 2.6 : 0.9 + Math.random() * 1.8;
      this.nextPluckAt += gap;
    }
  }

  private playChord(score: PlanetScore, root: number, at: number): void {
    const end = at + CHORD_SECONDS + 2.5;
    // Release the previous chord as the new one swells in (each voice already has its stop time)
    for (const v of this.voices) v.gain.gain.setTargetAtTime(0, at, 1.2);
    this.voices = [];

    const notes = [root / 2, ...score.chord.map((s) => semis(root, s))];
    notes.forEach((freq, i) => {
      for (const detune of i === 0 ? [0] : [-6, 6]) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = i === 0 ? 'sine' : score.padWave;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const level = i === 0 ? 0.09 : score.padWave === 'sawtooth' ? 0.012 : 0.026;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(level, at + 2.2);
        osc.connect(gain);
        gain.connect(this.filter);
        osc.start(at);
        osc.stop(end);
        this.voices.push({ gain });
      }
    });
  }

  private playPluck(freq: number, at: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(this.mood === 'dive' ? 0.035 : 0.05, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
    osc.connect(gain);
    gain.connect(this.filter);
    gain.connect(this.delay);
    osc.start(at);
    osc.stop(at + 1.7);
  }
}
