import { SkillBranch } from '../../config/skillTree';
import { GameContext } from '../../core/GameContext';
import { podLayers } from '../../render/podView';
import { $ } from '../../ui/dom';

/** Pod Garage tab: live layered pod preview plus one card per upgrade layer. */
export class GarageTab {
  private garageCanvas = $<HTMLCanvasElement>('garage-pod-canvas');
  private garageCtx = this.garageCanvas.getContext('2d')!;

  constructor(
    private game: GameContext,
    private onJumpToBranch: (branch: SkillBranch) => void
  ) {}

  public populate(): void {
    const tierNames = [
      'MK-I PROSPECTOR RIG',
      'MK-II INDUSTRIAL EXCAVATOR',
      'MK-III CRYO-PLASMA BORER',
      'MK-IV SINGULARITY DREADNOUGHT',
    ];
    document.getElementById('garage-chassis-title')!.textContent =
      tierNames[this.game.stats.podTier] ?? tierNames[0];

    const slots: Array<{
      layer: string;
      title: string;
      status: string;
      branch: SkillBranch;
    }> = [
      {
        layer: 'LAYER 1 • REAR',
        title: 'Vector Thruster Array',
        status: `Move Speed ${Math.round(this.game.stats.moveSpeed)} px/s • Winch ${this.game.stats.winchHoldSeconds.toFixed(2)}s`,
        branch: 'utility',
      },
      {
        layer: 'LAYER 2 • NOSE',
        title: 'Rotary Drill Head',
        status: `Tier ${this.game.stats.drillVisualTier + 1} Bit • ${Math.round(this.game.stats.drillPower).toLocaleString()} DPS`,
        branch: 'drill',
      },
      {
        layer: 'LAYER 3 • CORE',
        title: 'Main Pod Chassis',
        status: `Mark ${this.game.stats.podTier + 1} Hull Frame`,
        branch: 'core',
      },
      {
        layer: 'LAYER 4 • ARMOR',
        title: 'Thermal & Void Hull Plating',
        status: `Armor Level ${this.game.stats.hullPlatingLevel} • Fuel Tank ${this.game.stats.maxFuel} U`,
        branch: 'fuel',
      },
      {
        layer: 'LAYER 5 • FLANKS',
        title: 'Expandable Cargo Saddlebags',
        status: `Pod Level ${this.game.stats.cargoPodLevel} • ${this.game.stats.maxCargo} Ore Capacity`,
        branch: 'cargo',
      },
      {
        layer: 'LAYER 6 • DORSAL',
        title: 'Seismic Scanner Dish & Drones',
        status: `${this.game.stats.hasScannerDish ? `Radar ${this.game.stats.scannerRangeTiles} Tiles` : 'Standard Radar'} • ${this.game.stats.droneCount} Drones`,
        branch: 'drone',
      },
      {
        layer: 'LAYER 7 • CANOPY',
        title: 'Cockpit Telemetry Beacon',
        status: 'Blinks Red Warning when Fuel < 25%',
        branch: 'fuel',
      },
    ];

    const grid = document.getElementById('garage-slots-grid')!;
    grid.innerHTML = '';
    for (const s of slots) {
      const card = document.createElement('div');
      card.className = 'garage-slot-card';
      card.innerHTML = `
        <div class="slot-card-top">
          <span class="slot-layer-num">${s.layer}</span>
          <span class="slot-branch-tag">JUMP TO ${s.branch.toUpperCase()} →</span>
        </div>
        <div class="slot-card-title">${s.title}</div>
        <div class="slot-card-status">${s.status}</div>
      `;
      card.addEventListener('click', () => {
        this.onJumpToBranch(s.branch);
      });
      grid.appendChild(card);
    }
  }

  public render(): void {
    const ctx = this.garageCtx;
    const w = this.garageCanvas.width;
    const h = this.garageCanvas.height;
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Subtle Blueprint Grid & Hangar Gantry
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 20; x < w; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 20; y < h; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw scaled-up 7-layer Drill Pod in center of Garage Bay
    ctx.translate(w * 0.5, h * 0.5);
    this.game.atlas.drawLayeredDrillPod(
      ctx,
      podLayers(this.game.stats, this.game.animTime, { isMoving: true }),
      2.35
    );
    ctx.restore();
  }
}
