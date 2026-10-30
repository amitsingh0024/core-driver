import { SkillBranch } from '../../config/skillTree';
import { GameContext } from '../../core/GameContext';
import { podLayers } from '../../render/podView';
import { $ } from '../../ui/dom';

/** Pod Garage tab: live layered pod preview plus one card per upgrade layer. */
export class GarageTab {
  private garageCanvas = $<HTMLCanvasElement>('garage-pod-canvas');
  private garageCtx = this.garageCanvas.getContext('2d')!;
  private hoveredLayer: number | null = null;

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
      layerNum: number;
      layer: string;
      title: string;
      status: string;
      branch: SkillBranch;
    }> = [
      {
        layerNum: 1,
        layer: 'LAYER 1 • REAR',
        title: 'Vector Thruster Array',
        status: `Move Speed ${Math.round(this.game.stats.moveSpeed)} px/s • Winch ${this.game.stats.winchHoldSeconds.toFixed(2)}s`,
        branch: 'utility',
      },
      {
        layerNum: 2,
        layer: 'LAYER 2 • NOSE',
        title: 'Rotary Drill Head',
        status: `Tier ${this.game.stats.drillVisualTier + 1} Bit • ${Math.round(this.game.stats.drillPower).toLocaleString()} DPS`,
        branch: 'drill',
      },
      {
        layerNum: 3,
        layer: 'LAYER 3 • CORE',
        title: 'Main Pod Chassis',
        status: `Mark ${this.game.stats.podTier + 1} Hull Frame`,
        branch: 'core',
      },
      {
        layerNum: 4,
        layer: 'LAYER 4 • ARMOR',
        title: 'Thermal & Void Hull Plating',
        status: `Armor Level ${this.game.stats.hullPlatingLevel} • Fuel Tank ${this.game.stats.maxFuel} U`,
        branch: 'fuel',
      },
      {
        layerNum: 5,
        layer: 'LAYER 5 • FLANKS',
        title: 'Expandable Cargo Saddlebags',
        status: `Pod Level ${this.game.stats.cargoPodLevel} • ${this.game.stats.maxCargo} Ore Capacity`,
        branch: 'cargo',
      },
      {
        layerNum: 6,
        layer: 'LAYER 6 • DORSAL',
        title: 'Seismic Scanner Dish & Drones',
        status: `${this.game.stats.hasScannerDish ? `Radar ${this.game.stats.scannerRangeTiles} Tiles` : 'Standard Radar'} • ${this.game.stats.droneCount} Drones`,
        branch: 'drone',
      },
      {
        layerNum: 7,
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
      card.addEventListener('pointerenter', () => {
        this.hoveredLayer = s.layerNum;
      });
      card.addEventListener('pointerleave', () => {
        if (this.hoveredLayer === s.layerNum) this.hoveredLayer = null;
      });
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
    const t = this.game.animTime;
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // 1. Dark Steel Hangar Interior Bay Wall & Blueprint Grid (Page 10)
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
    wallGrad.addColorStop(0, '#12082c');
    wallGrad.addColorStop(0.7, '#1a0b3a');
    wallGrad.addColorStop(1, '#0a0420');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
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

    // 2. Overhead Gantry Crane Beam & Floodlight Cones
    ctx.fillStyle = '#1b2638';
    ctx.fillRect(0, 8, w, 18);
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 8, w, 18);

    // Gantry Diagonal Trusses
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 1.5;
    for (let x = 10; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.lineTo(x + 16, 26);
      ctx.lineTo(x + 32, 8);
      ctx.stroke();
    }

    // Dual Overhead Floodlight Cones illuminating the Pod
    for (const lx of [w * 0.28, w * 0.72]) {
      const cone = ctx.createLinearGradient(lx, 26, w * 0.5, h * 0.85);
      cone.addColorStop(0, 'rgba(0, 229, 255, 0.14)');
      cone.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(lx - 14, 26);
      ctx.lineTo(lx + 14, 26);
      ctx.lineTo(w * 0.5 + (lx < w * 0.5 ? 95 : 130), h - 30);
      ctx.lineTo(w * 0.5 - (lx < w * 0.5 ? 130 : 95), h - 30);
      ctx.closePath();
      ctx.fill();

      // Floodlight fixture
      ctx.fillStyle = '#84ffff';
      ctx.fillRect(lx - 8, 24, 16, 4);
    }

    // Side Tool Cabinets & Animated Telemetry Waveform Monitor in background
    ctx.fillStyle = '#141d2b';
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 1.5;
    ctx.fillRect(16, h - 115, 58, 82);
    ctx.strokeRect(16, h - 115, 58, 82);
    ctx.fillStyle = '#ff7043';
    for (let dy = 0; dy < 3; dy++) {
      ctx.fillRect(22, h - 105 + dy * 18, 46, 12);
    }

    ctx.fillStyle = '#141d2b';
    ctx.fillRect(w - 76, h - 122, 60, 89);
    ctx.strokeRect(w - 76, h - 122, 60, 89);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.18)';
    ctx.fillRect(w - 69, h - 114, 46, 28);
    // Live sine wave on monitor
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let mx = 0; mx <= 42; mx += 3) {
      const my = h - 100 + Math.sin(t * 6 + mx * 0.25) * 6;
      if (mx === 0) ctx.moveTo(w - 67 + mx, my);
      else ctx.lineTo(w - 67 + mx, my);
    }
    ctx.stroke();

    // 3. Hydraulic Lift Platform with Hazard Stripes & Rising Steam Vents at Bottom
    const padY = h - 34;
    ctx.fillStyle = '#1c2636';
    ctx.fillRect(w * 0.5 - 125, padY, 250, 18);
    ctx.strokeStyle = '#f5a623';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w * 0.5 - 125, padY, 250, 18);

    // Hydraulic pillars under lift
    ctx.fillStyle = '#37474f';
    ctx.fillRect(w * 0.5 - 75, padY + 18, 18, 16);
    ctx.fillRect(w * 0.5 + 57, padY + 18, 18, 16);

    // Hazard stripe ticks along lift edge
    ctx.fillStyle = '#f5a623';
    for (let hx = w * 0.5 - 118; hx < w * 0.5 + 114; hx += 18) {
      ctx.fillRect(hx, padY + 4, 9, 4);
    }

    // Rising hydraulic floor steam puffs
    for (let s = 0; s < 4; s++) {
      const p = (t * 0.45 + s * 0.25) % 1;
      const sx = w * 0.5 + (s % 2 === 0 ? -96 : 96) + Math.sin(t * 2 + s) * 8;
      const sy = padY - p * 36;
      ctx.fillStyle = `rgba(178, 235, 242, ${(1 - p) * 0.22})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 5 + p * 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw Scaled-Up 7-Layer Drill Pod in Center of Garage Bay (with subtle hover float)
    const podCx = w * 0.5;
    const podCy = h * 0.48 + Math.sin(t * 2.2) * 2.5;
    ctx.save();
    ctx.translate(podCx, podCy);
    this.game.atlas.drawLayeredDrillPod(
      ctx,
      podLayers(this.game.stats, t, {
        isMoving: true,
        highlightedLayer: this.hoveredLayer,
      }),
      2.35
    );
    ctx.restore();

    // Sweeping vertical diagnostic scanner laser across the pod
    const scanY = podCy - 95 + ((Math.sin(t * 1.4) * 0.5 + 0.5) * 190);
    const scanGrad = ctx.createLinearGradient(podCx - 85, scanY, podCx + 85, scanY);
    scanGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
    scanGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.28)');
    scanGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
    ctx.strokeStyle = scanGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(podCx - 85, scanY);
    ctx.lineTo(podCx + 85, scanY);
    ctx.stroke();

    // 5. Draw Orbiting Drone Preview if unlocked
    const droneTier = Math.min(3, Math.max(1, this.game.stats.podTier + 1));
    const droneSprite = this.game.atlas.droneSprites.get(droneTier);
    if (this.game.stats.droneCount > 0 && droneSprite) {
      for (let d = 0; d < this.game.stats.droneCount; d++) {
        const a = t * 2.2 + (d * Math.PI * 2) / this.game.stats.droneCount;
        const dx = podCx + Math.cos(a) * 98;
        const dy = podCy - 18 + Math.sin(a) * 32;
        ctx.drawImage(droneSprite, dx - 18, dy - 18, 36, 36);
      }
    }

    // 6. Technical Callout Pins & Labels for the 7 Layers (Page 13)
    const callouts: Array<{
      layerNum: number;
      px: number;
      py: number;
      lx: number;
      ly: number;
      label: string;
      color: string;
      align: CanvasTextAlign;
    }> = [
      { layerNum: 1, px: podCx, py: podCy - 76, lx: 88, ly: 56, label: 'L1 • THRUSTER ARRAY', color: '#29b6f6', align: 'left' },
      { layerNum: 4, px: podCx - 42, py: podCy - 45, lx: 88, ly: 102, label: 'L4 • HULL ARMOR', color: '#00e676', align: 'left' },
      { layerNum: 5, px: podCx - 54, py: podCy - 8, lx: 88, ly: 156, label: 'L5 • CARGO HOPPERS', color: '#ab47bc', align: 'left' },
      { layerNum: 2, px: podCx - 16, py: podCy + 64, lx: 88, ly: 238, label: 'L2 • ROTARY DRILL', color: '#ff7043', align: 'left' },
      { layerNum: 6, px: podCx + 12, py: podCy - 88, lx: w - 88, ly: 66, label: 'L6 • SCANNER & DRONES', color: '#00e5ff', align: 'right' },
      { layerNum: 7, px: podCx + 16, py: podCy - 24, lx: w - 88, ly: 132, label: 'L7 • COCKPIT BEACON', color: '#00e676', align: 'right' },
      { layerNum: 3, px: podCx + 36, py: podCy + 8, lx: w - 88, ly: 196, label: 'L3 • CORE CHASSIS', color: '#f5a623', align: 'right' },
    ];

    for (const c of callouts) {
      const isHi = this.hoveredLayer === c.layerNum;
      const dimmed = this.hoveredLayer !== null && !isHi;
      ctx.save();
      ctx.globalAlpha = dimmed ? 0.32 : 1;
      ctx.strokeStyle = isHi ? '#ffffff' : c.color;
      ctx.lineWidth = isHi ? 2.4 : 1.2;
      ctx.beginPath();
      ctx.moveTo(c.px, c.py);
      ctx.lineTo(c.lx, c.ly);
      ctx.stroke();

      ctx.fillStyle = isHi ? '#ffffff' : c.color;
      ctx.beginPath();
      ctx.arc(c.px, c.py, isHi ? 4.8 : 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = isHi ? '800 11px "Rajdhani", sans-serif' : '700 10px "Rajdhani", sans-serif';
      ctx.textAlign = c.align;
      ctx.fillStyle = isHi ? '#ffffff' : c.color;
      ctx.fillText(c.label, c.lx + (c.align === 'left' ? -4 : 4), c.ly - 4);
      ctx.restore();
    }

    ctx.restore();
  }
}
