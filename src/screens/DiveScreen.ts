import { ORES } from '../config/ores';
import { GameContext } from '../core/GameContext';
import { DiveInput } from '../core/Input';
import { DiveWorld, TILE_SIZE, WORLD_COLS } from '../game/DiveWorld';
import { DrillPod } from '../game/DrillPod';
import { GameFeel } from '../game/GameFeel';
import { DiveContract, ContractProgress, contractProgress, contractProgressText, rollContract } from '../game/DiveContract';
import { DiveRenderer } from '../render/DiveRenderer';
import { PortalSDK } from '../sdk/PortalSDK';
import { $ } from '../ui/dom';

/** Active dive: world simulation, input, HUD and canvas rendering. */
export class DiveScreen {
  public world: DiveWorld;
  public pod: DrillPod;
  public isPaused = false;
  public readonly feel = new GameFeel();
  public contract!: DiveContract;
  public contractCompleted = false;
  private canvas = $<HTMLCanvasElement>('dive-canvas');
  private renderer: DiveRenderer;
  private input: DiveInput;
  private endTransitionTimer = 0;
  private currentStratumId = '';
  private stratumBannerTimer = 0;

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
    this.currentStratumId = planet.strata[0].id;
    this.stratumBannerTimer = 0;
    $('stratum-banner').classList.remove('show');

    // Configure Ambient Planet Vignette
    const vig = $('planet-ambient-vignette');
    vig.className = 'planet-ambient-vignette';
    if (planet.id === 2) vig.classList.add('cryo');
    else if (planet.id === 3) vig.classList.add('pyra');

    $('hud-planet-name').textContent = planet.name.toUpperCase();
    $('hud-planet-dot').style.background = planet.accentColor;
    $('hud-planet-dot').style.boxShadow = `0 0 10px ${planet.accentColor}`;
    $('hud-core-dist').textContent = `${planet.maxDepth}m`;

    const stops = planet.strata
      .map((s, idx) => `${s.palette.base} ${Math.round((idx / (planet.strata.length - 1)) * 100)}%`)
      .join(', ');
    $('depth-meter-track').style.background = `linear-gradient(180deg, ${stops})`;

    this.input.clear();
    this.setPaused(false);
    PortalSDK.gameplayStart();
    this.updateDiveHUD();
  }

  private finish(): void {
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
    const feedback = this.feel.handle(this.pod.events, this.game.save.settings.screenShake);
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
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      const worldPixelWidth = WORLD_COLS * TILE_SIZE;
      const camX = worldPixelWidth * 0.5 - w * 0.5;
      const camY = this.pod.y - h * 0.38;
      pointerWorldPos = {
        x: this.input.pointerX + camX,
        y: this.input.pointerY + camY,
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

  private updateDiveHUD(): void {
    const planet = this.world.planet;
    const { stratum } = this.world.getStratumForDepth(this.pod.depthMeters);

    $('hud-stratum-name').textContent =
      `${stratum.name} • ${this.pod.depthMeters}m`;

    // Segmented Fuel Bar + Live Burn Rate (0 when idle!)
    const fuelPct = Math.max(0, Math.min(100, (this.pod.fuel / this.pod.maxFuel) * 100));
    const statusLabel = this.pod.isDrilling
      ? `DRILL (-${this.pod.currentFuelBurnRate.toFixed(1)}/s)`
      : this.pod.isMoving
      ? `THRUST (-${this.pod.currentFuelBurnRate.toFixed(1)}/s)`
      : 'IDLE (0/s)';

    $('hud-fuel-text').textContent =
      `${Math.ceil(this.pod.fuel)} / ${this.pod.maxFuel} • ${statusLabel}`;

    const fuelFill = $('hud-fuel-fill');
    fuelFill.style.width = `${fuelPct}%`;

    const fuelWrapper = $('fuel-bar-wrapper');
    const fuelWarning = $('hud-fuel-warning');
    if (fuelPct <= 25) {
      fuelWrapper.classList.add('low-fuel');
      fuelWrapper.classList.remove('warn-fuel');
      fuelWarning.classList.remove('hidden');
      fuelFill.style.background = 'linear-gradient(90deg, #d50000, #ff5252)';
    } else if (fuelPct <= 40) {
      fuelWrapper.classList.remove('low-fuel');
      fuelWrapper.classList.add('warn-fuel');
      fuelWarning.classList.add('hidden');
      fuelFill.style.background = 'linear-gradient(90deg, #ff8f00, #ffd54f)';
    } else {
      fuelWrapper.classList.remove('low-fuel', 'warn-fuel');
      fuelWarning.classList.add('hidden');
      fuelFill.style.background = 'linear-gradient(90deg, #00c853, #69f0ae)';
    }

    // Cargo Hold + Mini Fill Bar + Full Flash
    $('hud-cargo-text').textContent =
      `${this.pod.cargoUsed} / ${this.pod.maxCargo}`;
    const cargoPct = Math.min(100, (this.pod.cargoUsed / Math.max(1, this.pod.maxCargo)) * 100);
    $('hud-cargo-mini-fill').style.width = `${cargoPct}%`;
    document
      .getElementById('hud-cargo-pill')!
      .classList.toggle('cargo-full', this.pod.cargoUsed >= this.pod.maxCargo);

    const haulVal = this.haulValue();
    $('hud-haul-value').textContent = `$${(haulVal + this.pod.relicCredits).toLocaleString()}`;

    const progress = this.contractState();
    $('hud-contract-progress').textContent = contractProgressText(this.contract, progress);
    const pct = contractProgress(this.contract, progress);
    $('hud-contract-fill').style.width = `${Math.round(pct * 100)}%`;
    // Haul contracts settle on extraction, so show them as ready rather than paid
    if (this.contract.kind === 'haul') $('hud-contract').classList.toggle('done', pct >= 1);

    // Vertical Depth Meter Markers
    const depthPct = Math.min(100, (this.pod.depthMeters / planet.maxDepth) * 100);
    $('depth-marker-pod').style.top = `${depthPct}%`;

    const bestDepth = Math.max(
      this.pod.maxDepthReached,
      this.game.save.deepestByPlanet[planet.id] ?? 0
    );
    const bestPct = Math.min(100, (bestDepth / planet.maxDepth) * 100);
    $('depth-marker-best').style.top = `${bestPct}%`;

    // Circular Radial SVG Extract Progress Ring (circumference = 2 * PI * 44 = 276.46)
    $('btn-hold-extract').classList.toggle('beacon-charged', this.pod.beaconCharges > 0);

    const radialCircle = $('extract-radial-circle');
    const offset = 276.46 * (1 - Math.max(0, Math.min(1, this.pod.extractProgress)));
    radialCircle.style.strokeDashoffset = `${offset.toFixed(2)}`;
  }

  public pointer(): { down: boolean; x: number; y: number } {
    return { down: this.input.pointerDown, x: this.input.pointerX, y: this.input.pointerY };
  }
}
