import { ORES } from '../config/ores';
import { GameContext } from '../core/GameContext';
import { DiveInput } from '../core/Input';
import { DiveWorld } from '../game/DiveWorld';
import { DrillPod } from '../game/DrillPod';
import { GameFeel } from '../game/GameFeel';
import { DiveContract, ContractProgress, contractProgress, contractProgressText, rollContract } from '../game/DiveContract';
import { DiveRenderer } from '../render/DiveRenderer';
import { PortalSDK } from '../sdk/PortalSDK';
import { $, setStyle, setText } from '../ui/dom';

/** Active dive: world simulation, input, HUD and canvas rendering. */
export class DiveScreen {
  public world: DiveWorld;
  public pod: DrillPod;
  public isPaused = false;
  public readonly feel = new GameFeel();
  public contract!: DiveContract;
  public contractCompleted = false;
  private canvas = $<HTMLCanvasElement>('dive-canvas');
  private lowFuelVignette = $('low-fuel-vignette');
  private coarsePointer = window.matchMedia?.('(pointer: coarse)');
  private renderer: DiveRenderer;
  private input: DiveInput;
  private endTransitionTimer = 0;
  private finished = false;
  private currentStratumId = '';
  private stratumBannerTimer = 0;
  private fuelAlarmTimer = 0;
  private toastTimer = 0;
  private musicDepthTimer = 0;
  private recordToastShown = false;
  private cargoToastShown = false;
  private startBestDepth = 0;
  private coach = { active: false, shown: new Set<string>(), timer: 0, elapsed: 0 };

  constructor(
    private game: GameContext,
    private isActive: () => boolean,
    private onFinished: () => void,
    private onPauseOpened: () => void
  ) {
    this.world = new DiveWorld(game.planet(), Date.now());
    this.pod = new DrillPod(game.stats);
    this.renderer = new DiveRenderer(this.canvas, game, this);
    this.input = new DiveInput(
      this.canvas,
      () => this.isActive(),
      () => this.isPaused,
      () => this.setPaused(!this.isPaused)
    );
    this.input.bindExtractButton($('btn-hold-extract'));

    // The depth gauge starts below the top HUD, whose height changes as it wraps on phones
    const hudTop = $('dive-hud-top');
    new ResizeObserver(() => {
      $('dive-screen').style.setProperty('--hud-top-h', `${hudTop.offsetHeight}px`);
    }).observe(hudTop);

    $('btn-pause-dive').addEventListener('click', () => this.setPaused(!this.isPaused));
    $('btn-close-pause').addEventListener('click', () => this.setPaused(false));
    $('btn-pause-resume').addEventListener('click', () => this.setPaused(false));
    $('btn-pause-extract').addEventListener('click', () => {
      this.setPaused(false);
      this.pod.endReason = 'extracted';
      this.finish();
    });
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    $('pause-modal').classList.toggle('hidden', !paused);
    if (paused) {
      this.input.clear();
      this.onPauseOpened();
    }
  }

  public start(): void {
    this.game.refreshStats();
    const planet = this.game.planet();
    this.game.applyPlanetAccent();

    this.world = new DiveWorld(planet, Date.now() ^ (this.game.save.totalDives * 7919));
    this.pod = new DrillPod(this.game.stats);
    this.game.particles.clear();
    this.feel.clear();
    this.contract = rollContract(planet, this.game.save.deepestByPlanet[planet.id] ?? 0, this.game.stats);
    this.contractCompleted = false;
    $('hud-contract').classList.remove('done');
    $('hud-contract-label').textContent = this.contract.label;
    $('hud-contract-reward').textContent = `+$${this.contract.reward.toLocaleString()}`;
    this.endTransitionTimer = 0;
    this.finished = false;
    this.currentStratumId = planet.strata[0].id;
    this.stratumBannerTimer = 0;
    $('stratum-banner').classList.remove('show');
    this.resetCallouts(planet.id);

    // Configure Ambient Planet Vignette
    const vig = $('planet-ambient-vignette');
    vig.className = 'planet-ambient-vignette';
    if (planet.id === 2) vig.classList.add('cryo');
    else if (planet.id === 3) vig.classList.add('pyra');

    $('hud-planet-name').textContent = planet.name.toUpperCase();
    $('hud-planet-dot').style.background = planet.accentColor;
    $('hud-planet-dot').style.boxShadow = `0 0 10px ${planet.accentColor}`;
    $('hud-core-dist').textContent = `${planet.maxDepth}m`;

    // Hard-edged bands, one per stratum, so the gauge reads like a core sample
    const n = planet.strata.length;
    const stops = planet.strata
      .map((s, idx) => `${s.palette.base} ${(idx / n) * 100}% ${((idx + 1) / n) * 100}%`)
      .join(', ');
    $('depth-meter-track').style.background = `linear-gradient(180deg, ${stops})`;

    this.input.clear();
    this.setPaused(false);
    this.renderer.resetCamera();
    PortalSDK.gameplayStart();
    this.updateDiveHUD();
  }

  private finish(): void {
    // The screen fade keeps frames running briefly, so settle the dive exactly once
    if (this.finished) return;
    this.finished = true;
    PortalSDK.gameplayStop();
    this.onFinished();
  }

  public frame(dt: number): void {
    if (!this.isPaused) this.update(dt);
    this.renderer.render();
  }

  /** Ore value in the hold plus combo bonus, before any tow loss. */
  public haulValue(): number {
    let value = this.pod.comboBonusCredits;
    for (const [oreId, count] of Object.entries(this.pod.cargoManifest)) {
      const ore = ORES[oreId];
      if (ore) value += Math.round(count * ore.value * this.game.stats.oreValueMultiplier);
    }
    return value;
  }

  public contractState(): ContractProgress {
    return {
      maxDepthReached: this.pod.maxDepthReached,
      cargoManifest: this.pod.cargoManifest,
      haulValue: this.haulValue(),
    };
  }

  private update(dt: number): void {
    const { screenShake, reducedMotion } = this.game.save.settings;
    const feedback = this.feel.handle(this.pod.events, screenShake && !reducedMotion);
    this.pod.screenShake = Math.max(this.pod.screenShake, feedback.shake);
    if (feedback.haptic > 0) this.game.haptic(feedback.haptic);
    this.feel.update(dt, this.pod.x, this.pod.y);

    if (this.stratumBannerTimer > 0) {
      this.stratumBannerTimer = Math.max(0, this.stratumBannerTimer - dt);
      if (this.stratumBannerTimer <= 0) {
        $('stratum-banner').classList.remove('show');
      }
    }

    if (this.pod.endReason) {
      this.setFuelAlarmVisuals(100);
      this.game.particles.update(dt);
      this.endTransitionTimer += dt;
      if (this.endTransitionTimer >= 0.75) {
        this.finish();
      }
      return;
    }

    // Hit-stop: freeze the simulation for a few frames so big breaks land with weight
    if (this.feel.hitStop > 0) return;

    const move = this.input.moveVector();
    const holdingExtract = this.input.holdingExtract();

    let pointerWorldPos: { x: number; y: number } | null = null;
    if (this.input.pointerDown) {
      pointerWorldPos = {
        x: this.input.pointerX + this.renderer.camX,
        y: this.input.pointerY + this.renderer.camY,
      };
    }

    this.pod.update(
      dt,
      this.game.stats,
      this.world,
      move.x,
      move.y,
      pointerWorldPos,
      holdingExtract,
      this.game.particles,
      this.game.sound
    );
    this.game.particles.update(dt);
    this.checkContract();

    // Check Stratum Transition for 2s Slide-In Banner
    const { stratum, index } = this.world.getStratumForDepth(this.pod.depthMeters);
    if (stratum.id !== this.currentStratumId && this.pod.depthMeters > 10) {
      this.currentStratumId = stratum.id;
      this.stratumBannerTimer = 2.2;
      $('banner-stratum-depth').textContent = `${stratum.startDepth}m`;
      $('banner-stratum-title').textContent = stratum.name.toUpperCase();
      $('banner-stratum-sub').textContent =
        `STRATUM ${index + 1} • ${stratum.subtitle.toUpperCase()}`;
      $('stratum-banner').classList.add('show');
    }

    this.updateDiveHUD();
    this.updateCallouts(dt);
  }

  private resetCallouts(planetId: number): void {
    this.fuelAlarmTimer = 0;
    this.toastTimer = 0;
    this.musicDepthTimer = 0;
    this.recordToastShown = false;
    this.cargoToastShown = false;
    this.startBestDepth = this.game.save.deepestByPlanet[planetId] ?? 0;
    this.coach = { active: this.game.save.totalDives < 3, shown: new Set(), timer: 0, elapsed: 0 };
    $('dive-toast').classList.remove('show');
    $('coach-tip').classList.remove('show', 'urgent');
    this.setFuelAlarmVisuals(100);
  }

  /** Low-fuel alarm, mid-dive toasts, first-dive tips and depth-driven music. */
  private updateCallouts(dt: number): void {
    const pod = this.pod;
    const fuelPct = (pod.fuel / pod.maxFuel) * 100;

    this.setFuelAlarmVisuals(fuelPct);
    if (fuelPct <= 25) {
      this.fuelAlarmTimer -= dt;
      if (this.fuelAlarmTimer <= 0) {
        const urgent = fuelPct <= 10;
        this.game.sound.playFuelAlarm(urgent);
        this.fuelAlarmTimer = urgent ? 0.6 : 1.3;
      }
    } else {
      this.fuelAlarmTimer = 0;
    }

    if (!this.recordToastShown && this.startBestDepth >= 40 && pod.maxDepthReached > this.startBestDepth) {
      this.recordToastShown = true;
      this.showToast('NEW DEPTH RECORD', `PAST ${this.startBestDepth}m`, '#ffd54f');
      this.game.sound.playContractComplete();
    }
    if (!this.cargoToastShown && pod.cargoUsed >= pod.maxCargo) {
      this.cargoToastShown = true;
      this.showToast('CARGO FULL', 'HOLD [SPACE] TO WINCH UP AND SELL', '#69f0ae');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) $('dive-toast').classList.remove('show');
    }

    this.musicDepthTimer -= dt;
    if (this.musicDepthTimer <= 0) {
      this.musicDepthTimer = 0.5;
      this.game.sound.setMusicDepth(pod.depthMeters / this.world.planet.maxDepth);
    }

    this.updateCoach(dt, fuelPct);
  }

  private setFuelAlarmVisuals(fuelPct: number): void {
    const vig = this.lowFuelVignette;
    vig.classList.toggle('low', fuelPct <= 25 && fuelPct > 10);
    vig.classList.toggle('critical', fuelPct <= 10);
    this.hud.extractBtn.classList.toggle('urge', fuelPct <= 25);
  }

  private showToast(title: string, sub: string, color: string): void {
    const toast = $('dive-toast');
    toast.style.setProperty('--toast-color', color);
    $('dive-toast-title').textContent = title;
    $('dive-toast-sub').textContent = sub;
    toast.classList.add('show');
    this.toastTimer = 2.4;
  }

  /** Tips for the first few dives, each shown once when it becomes relevant. */
  private updateCoach(dt: number, fuelPct: number): void {
    const coach = this.coach;
    if (!coach.active) return;
    coach.elapsed += dt;

    const tip = $('coach-tip');
    if (coach.timer > 0) {
      coach.timer -= dt;
      if (coach.timer <= 0) tip.classList.remove('show', 'urgent');
    }

    const touch = this.coarsePointer?.matches;
    const tips: { id: string; when: boolean; text: string; urgent?: boolean }[] = [
      {
        id: 'winch',
        when: fuelPct <= 30,
        urgent: true,
        text: touch
          ? 'Fuel is low! Hold the EXTRACT button to winch up. Running dry loses part of your cargo.'
          : 'Fuel is low! Hold SPACE or the EXTRACT button to winch up. Running dry loses part of your cargo.',
      },
      {
        id: 'contract',
        when: coach.elapsed > 1.2,
        text: 'Each dive comes with a CONTRACT at the top of the screen. Finish it for a bonus payout.',
      },
      {
        id: 'ore',
        when: this.pod.cargoUsed > 0 && this.pod.depthMeters >= 12,
        text: 'Ore fills your cargo hold. It only turns into cash once you bring it back to the surface.',
      },
      {
        id: 'cells',
        when: fuelPct <= 60,
        text: 'Green fuel cells refill your tank. Drill into them when you pass one.',
      },
    ];

    for (const t of tips) {
      if (!t.when || coach.shown.has(t.id)) continue;
      // An urgent tip may replace a calm one; calm tips wait their turn
      if (coach.timer > 0 && !t.urgent) continue;
      coach.shown.add(t.id);
      $('coach-text').textContent = t.text;
      tip.classList.toggle('urgent', !!t.urgent);
      tip.classList.add('show');
      coach.timer = t.urgent ? 6 : 5;
      break;
    }
  }

  private checkContract(): void {
    if (this.contractCompleted) return;
    if (contractProgress(this.contract, this.contractState()) < 1) return;
    // A haul contract only counts once it's safely extracted, so it is settled at the end instead
    if (this.contract.kind === 'haul') return;
    this.contractCompleted = true;
    $('hud-contract').classList.add('done');
    this.game.sound.playContractComplete();
    this.game.particles.addFloatingText(this.pod.x, this.pod.y - 40, 'CONTRACT COMPLETE!', '#69f0ae', 1.25, `+$${this.contract.reward.toLocaleString()}`);
  }

  /** HUD elements looked up once; the HUD updates every frame. */
  private hud = {
    stratumName: $('hud-stratum-name'),
    depthValue: $('hud-depth-value'),
    fuelText: $('hud-fuel-text'),
    fuelStatus: $('hud-fuel-status'),
    fuelFill: $('hud-fuel-fill'),
    fuelWrapper: $('fuel-bar-wrapper'),
    fuelWarning: $('hud-fuel-warning'),
    cargoText: $('hud-cargo-text'),
    cargoMiniFill: $('hud-cargo-mini-fill'),
    cargoPill: $('hud-cargo-pill'),
    haulValue: $('hud-haul-value'),
    contract: $('hud-contract'),
    contractProgress: $('hud-contract-progress'),
    contractFill: $('hud-contract-fill'),
    markerPod: $('depth-marker-pod'),
    markerBest: $('depth-marker-best'),
    extractBtn: $('btn-hold-extract'),
    extractRing: $('extract-radial-circle'),
  };

  private updateDiveHUD(): void {
    const hud = this.hud;
    const planet = this.world.planet;
    const { stratum } = this.world.getStratumForDepth(this.pod.depthMeters);

    setText(hud.stratumName, stratum.name);
    setText(hud.depthValue, `${this.pod.depthMeters}`);

    // Segmented Fuel Bar + Live Burn Rate (0 when idle!)
    const fuelPct = Math.max(0, Math.min(100, (this.pod.fuel / this.pod.maxFuel) * 100));
    const burnState = this.pod.isDrilling ? 'DRILL' : this.pod.isMoving ? 'THRUST' : 'IDLE';
    const statusLabel =
      burnState === 'IDLE' ? 'IDLE' : `${burnState} −${this.pod.currentFuelBurnRate.toFixed(1)}/s`;

    setText(hud.fuelText, `${Math.ceil(this.pod.fuel)}/${this.pod.maxFuel}`);
    setText(hud.fuelStatus, statusLabel);
    if (hud.fuelStatus.dataset.state !== burnState) hud.fuelStatus.dataset.state = burnState;
    setStyle(hud.fuelFill, 'width', `${fuelPct.toFixed(1)}%`);

    const level = fuelPct <= 25 ? 'low' : fuelPct <= 40 ? 'warn' : 'ok';
    hud.fuelWrapper.classList.toggle('low-fuel', level === 'low');
    hud.fuelWrapper.classList.toggle('warn-fuel', level === 'warn');
    hud.fuelWarning.classList.toggle('hidden', level !== 'low');
    setStyle(
      hud.fuelFill,
      'background',
      level === 'low'
        ? 'linear-gradient(180deg, #ff8a65 0%, #e0412f 45%, #a8231a 100%)'
        : level === 'warn'
        ? 'linear-gradient(180deg, #ffe08a 0%, #f6b916 45%, #b9780a 100%)'
        : 'linear-gradient(180deg, #b6f27a 0%, #5cb83a 45%, #2f7a1f 100%)'
    );

    // Cargo Hold + Mini Fill Bar + Full Flash
    setText(hud.cargoText, `${this.pod.cargoUsed} / ${this.pod.maxCargo}`);
    const cargoPct = Math.min(100, (this.pod.cargoUsed / Math.max(1, this.pod.maxCargo)) * 100);
    setStyle(hud.cargoMiniFill, 'width', `${cargoPct.toFixed(1)}%`);
    hud.cargoPill.classList.toggle('cargo-full', this.pod.cargoUsed >= this.pod.maxCargo);

    const haulVal = this.haulValue();
    setText(hud.haulValue, `$${(haulVal + this.pod.relicCredits).toLocaleString()}`);

    const progress = this.contractState();
    setText(hud.contractProgress, contractProgressText(this.contract, progress));
    const pct = contractProgress(this.contract, progress);
    setStyle(hud.contractFill, 'width', `${Math.round(pct * 100)}%`);
    // Haul contracts settle on extraction, so show them as ready rather than paid
    if (this.contract.kind === 'haul') hud.contract.classList.toggle('done', pct >= 1);

    // Vertical Depth Meter Markers
    const depthPct = Math.min(100, (this.pod.depthMeters / planet.maxDepth) * 100);
    setStyle(hud.markerPod, 'top', `${depthPct.toFixed(1)}%`);

    const bestDepth = Math.max(
      this.pod.maxDepthReached,
      this.game.save.deepestByPlanet[planet.id] ?? 0
    );
    const bestPct = Math.min(100, (bestDepth / planet.maxDepth) * 100);
    setStyle(hud.markerBest, 'top', `${bestPct.toFixed(1)}%`);

    // Circular Radial SVG Extract Progress Ring (circumference = 2 * PI * 44 = 276.46)
    hud.extractBtn.classList.toggle('beacon-charged', this.pod.beaconCharges > 0);

    const offset = 276.46 * (1 - Math.max(0, Math.min(1, this.pod.extractProgress)));
    setStyle(hud.extractRing, 'stroke-dashoffset', `${offset.toFixed(2)}`);
  }

  public pointer(): { down: boolean; x: number; y: number } {
    return { down: this.input.pointerDown, x: this.input.pointerX, y: this.input.pointerY };
  }
}
