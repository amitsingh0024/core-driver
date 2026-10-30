import { GameContext } from './GameContext';
import { settleDive } from '../game/DivePayout';
import { TitleScreen } from '../screens/TitleScreen';
import { DiveScreen } from '../screens/DiveScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { SettingsForm } from '../screens/SettingsForm';
import { HangarScreen } from '../screens/hangar/HangarScreen';
import { SVG_ICONS, CORE_DIVER_LOGO_SVG } from '../ui/svgIcons';
import { $ } from '../ui/dom';
import { applyUiLocks } from '../ui/Progression';

type ScreenMode = 'TITLE' | 'DIVE' | 'RESULTS' | 'HANGAR';

/** Top-level screen router and frame loop. */
export class Game {
  private ctx = new GameContext();
  private mode: ScreenMode = 'TITLE';
  private lastFrameTime = performance.now();
  private transitioning = false;

  private settings = new SettingsForm(this.ctx);
  private title = new TitleScreen(this.ctx);
  private results = new ResultsScreen(this.ctx);
  private hangar = new HangarScreen(this.ctx, this.settings);
  private dive = new DiveScreen(
    this.ctx,
    () => this.mode === 'DIVE',
    () => this.finishDive(),
    () => this.settings.render()
  );

  constructor() {
    this.injectStaticSVGs();
    this.bindNavigation();
    this.settings.render();
    this.ctx.applyPlanetAccent();
    this.bindPolish();
    this.showScreen('TITLE');
    requestAnimationFrame((t) => this.loop(t));
    void this.boot();
  }

  /** Holds the splash until sprites and fonts are in, then waits for a gesture so audio can start. */
  private async boot(): Promise<void> {
    const splash = $('boot-splash');
    const fill = $('boot-fill');
    const status = $('boot-status');
    requestAnimationFrame(() => (fill.style.width = '35%'));

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 4000));
    const fonts = document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
    void fonts.then(() => (fill.style.width = '70%'));
    await Promise.race([Promise.all([this.ctx.atlas.ready, fonts]), timeout]);

    fill.style.width = '100%';
    status.textContent = 'RIG ONLINE';
    splash.classList.add('ready');

    const begin = () => {
      window.removeEventListener('keydown', begin);
      splash.removeEventListener('pointerdown', begin);
      this.ctx.sound.unlock();
      this.ctx.sound.playWhoosh(false);
      splash.classList.add('done');
    };
    window.addEventListener('keydown', begin);
    splash.addEventListener('pointerdown', begin);
  }

  /** Interface sounds, audio unlock and auto-pause when the tab loses focus. */
  private bindPolish(): void {
    const logoSlot = document.getElementById('boot-logo-slot');
    if (logoSlot) logoSlot.innerHTML = CORE_DIVER_LOGO_SVG;

    // iOS Safari only counts touchend/click as an audio-unlocking gesture, not pointerdown
    for (const type of ['pointerdown', 'touchend', 'keydown']) {
      document.addEventListener(type, () => this.ctx.sound.unlock(), { capture: true });
    }
    document.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      // The winch button has its own audio; buying plays the upgrade chime
      if (btn && btn.id !== 'btn-hold-extract' && !btn.disabled) this.ctx.sound.playUiClick();
    });
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const btn = (e.target as HTMLElement).closest('button');
      const from = (e.relatedTarget as HTMLElement | null)?.closest('button');
      if (btn && btn !== from && !btn.disabled) this.ctx.sound.playUiHover();
    });

    const autoPause = () => {
      if (this.mode === 'DIVE' && !this.dive.pod.endReason && !this.dive.isPaused) this.dive.setPaused(true);
    };
    document.addEventListener('visibilitychange', () => {
      this.ctx.sound.suspend(document.hidden);
      if (document.hidden) autoPause();
    });
    window.addEventListener('blur', autoPause);
  }

  private injectStaticSVGs(): void {
    const logoSlot = document.getElementById('title-logo-slot');
    if (logoSlot) logoSlot.innerHTML = CORE_DIVER_LOGO_SVG;
    document.querySelectorAll<HTMLElement>('[data-svg]').forEach((el) => {
      const key = el.dataset.svg;
      if (key && SVG_ICONS[key]) el.innerHTML = SVG_ICONS[key];
    });
  }

  private bindNavigation(): void {
    $('btn-title-play').addEventListener('click', () => this.startDive());
    $('btn-title-hangar').addEventListener('click', () => this.transitionTo('HANGAR'));
    $('btn-title-settings').addEventListener('click', () => {
      this.transitionTo('HANGAR', () => this.hangar.switchTab('settings'));
    });
    $('btn-title-credits').addEventListener('click', () => $('credits-modal').classList.remove('hidden'));
    $('btn-close-credits').addEventListener('click', () => $('credits-modal').classList.add('hidden'));

    $('btn-results-hangar').addEventListener('click', () => {
      this.transitionTo('HANGAR', () => this.hangar.switchTab('grid'));
    });
    $('btn-results-redive').addEventListener('click', () => this.startDive());

    $('btn-back-title').addEventListener('click', () => this.transitionTo('TITLE'));
    $('btn-launch-dive').addEventListener('click', () => this.startDive());
    $('btn-hangar-settings').addEventListener('click', () => this.hangar.switchTab('settings'));
  }

  /** Fades to black, swaps screens (running `swap` while hidden), then fades back in. */
  private transitionTo(next: ScreenMode, swap?: () => void, mustRun = false): void {
    if (this.transitioning) {
      // Button double-clicks are dropped; game-driven transitions wait their turn
      if (mustRun) window.setTimeout(() => this.transitionTo(next, swap, true), 80);
      return;
    }
    this.transitioning = true;
    const fade = $('screen-fade');
    const ms = this.ctx.save.settings.reducedMotion ? 60 : 230;
    fade.style.transitionDuration = `${ms}ms`;
    fade.classList.add('on');
    window.setTimeout(() => {
      swap?.();
      this.showScreen(next);
      fade.classList.remove('on');
      this.transitioning = false;
    }, ms);
  }

  private showScreen(next: ScreenMode): void {
    this.mode = next;
    applyUiLocks(this.ctx.save);
    this.dive.setPaused(false);
    $('title-screen').classList.toggle('active', next === 'TITLE');
    $('dive-screen').classList.toggle('active', next === 'DIVE');
    $('results-screen').classList.toggle('active', next === 'RESULTS');
    $('hangar-screen').classList.toggle('active', next === 'HANGAR');

    if (next === 'TITLE') this.title.onShow();
    else if (next === 'HANGAR') this.hangar.refresh();
    this.ctx.sound.setMusicMood(next === 'DIVE' ? 'dive' : 'menu', this.ctx.planet().id);
  }

  private startDive(): void {
    this.ctx.sound.playWhoosh(true);
    this.transitionTo('DIVE', () => this.dive.start());
  }

  private finishDive(): void {
    const planet = this.dive.world.planet;
    const pod = this.dive.pod;
    const payout = settleDive(
      {
        reason: pod.endReason,
        cargoManifest: pod.cargoManifest,
        maxDepthReached: pod.maxDepthReached,
        comboBonusCredits: pod.comboBonusCredits,
        relicCredits: pod.relicCredits,
        relicsFound: pod.relicsFound,
        contract: this.dive.contract,
        contractMetDuringDive: this.dive.contractCompleted,
      },
      planet,
      this.ctx.stats,
      this.ctx.save
    );
    this.ctx.persist();
    this.transitionTo('RESULTS', () => this.results.show(payout, planet), true);
  }

  private loop(now: number): void {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;
    this.ctx.animTime += dt;

    if (this.mode === 'TITLE') this.title.render();
    else if (this.mode === 'DIVE') this.dive.frame(dt);
    else if (this.mode === 'HANGAR') this.hangar.render(dt);

    requestAnimationFrame((t) => this.loop(t));
  }
}
