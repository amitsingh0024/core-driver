import { GameContext } from './GameContext';
import { settleDive } from '../game/DivePayout';
import { TitleScreen } from '../screens/TitleScreen';
import { DiveScreen } from '../screens/DiveScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { SettingsForm } from '../screens/SettingsForm';
import { HangarScreen } from '../screens/hangar/HangarScreen';
import { SVG_ICONS, CORE_DIVER_LOGO_SVG } from '../ui/svgIcons';
import { $ } from '../ui/dom';

type ScreenMode = 'TITLE' | 'DIVE' | 'RESULTS' | 'HANGAR';

/** Top-level screen router and frame loop. */
export class Game {
  private ctx = new GameContext();
  private mode: ScreenMode = 'TITLE';
  private lastFrameTime = performance.now();

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
    this.showScreen('TITLE');
    requestAnimationFrame((t) => this.loop(t));
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
    $('btn-title-hangar').addEventListener('click', () => this.showScreen('HANGAR'));
    $('btn-title-settings').addEventListener('click', () => {
      this.showScreen('HANGAR');
      this.hangar.switchTab('settings');
    });
    $('btn-title-credits').addEventListener('click', () => $('credits-modal').classList.remove('hidden'));
    $('btn-close-credits').addEventListener('click', () => $('credits-modal').classList.add('hidden'));

    $('btn-results-hangar').addEventListener('click', () => {
      this.showScreen('HANGAR');
      this.hangar.switchTab('grid');
    });
    $('btn-results-redive').addEventListener('click', () => this.startDive());

    $('btn-back-title').addEventListener('click', () => this.showScreen('TITLE'));
    $('btn-launch-dive').addEventListener('click', () => this.startDive());
  }

  private showScreen(next: ScreenMode): void {
    this.mode = next;
    this.dive.setPaused(false);
    $('title-screen').classList.toggle('active', next === 'TITLE');
    $('dive-screen').classList.toggle('active', next === 'DIVE');
    $('results-screen').classList.toggle('active', next === 'RESULTS');
    $('hangar-screen').classList.toggle('active', next === 'HANGAR');

    if (next === 'TITLE') this.title.onShow();
    else if (next === 'HANGAR') this.hangar.refresh();
  }

  private startDive(): void {
    this.dive.start();
    this.showScreen('DIVE');
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
    this.results.show(payout, planet);
    this.showScreen('RESULTS');
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
