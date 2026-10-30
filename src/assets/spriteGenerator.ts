import { PLANETS } from '../config/planets';
import { ORES } from '../config/ores';
import { SkillIconType } from '../config/skillTree';
import { TILE_SIZE } from '../game/DiveWorld';
import {
  neonBeacon,
  neonCore,
  neonDrone,
  neonFuelCell,
  neonOre,
  neonPod,
  neonRelic,
  neonRockTile,
} from './neonArt';

const HD_SIZE = 128;

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface PodLayerState {
  podTier: number;          // 1..3 (MK-I Pioneer, Cryo Lancer, Void Breaker)
  drillVisualTier: number;  // 0..3 (Single Cone, Twin-Bore, Tri-Cone, Singularity Bore)
  hullPlatingLevel: number; // 0..2 (Bare, Bolted Plates, Heavy Armor)
  cargoPodLevel: number;    // 0..3 (None, 1 Side Pod, 2 Side Pods, 2 Large Pods)
  hasScannerDish: boolean;  // Seismic Vein Scanner
  isLowFuel: boolean;       // Cockpit red blink & sputter
  isCargoFull: boolean;     // Cargo pods visibly bulge
  drillRadiusPx: number;
  animTime: number;
  isMoving: boolean;
  isDrilling: boolean;
  extractProgress: number;
  steeringDir?: number;     // -1 left, 0 straight, 1 right: fires the opposite side thruster
}

export class SpriteAtlas {
  public blockTiles: Map<string, HTMLCanvasElement> = new Map();
  public crackTiles: HTMLCanvasElement[] = [];
  public oreOverlays: Map<string, HTMLCanvasElement> = new Map();
  public coreTiles: Map<number, HTMLCanvasElement> = new Map();
  public podSprites: Map<number, HTMLCanvasElement> = new Map();
  public fuelCellTile!: HTMLCanvasElement;
  public beaconTile!: HTMLCanvasElement;
  public relicChestTile!: HTMLCanvasElement;
  public droneSprites: Map<number, HTMLCanvasElement> = new Map();
  public skillIcons: Map<SkillIconType, HTMLCanvasElement> = new Map();
  /** Resolves once every texture is drawn (all procedural, so immediately). */
  public readonly ready: Promise<void>;

  constructor() {
    this.generateCrackTiles();
    this.generateSkillIcons();
    this.generateNeonArt();
    this.ready = Promise.resolve();
  }

  private createHDCanvas(w = HD_SIZE, h = HD_SIZE): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return [c, ctx];
  }

  /** Builds the neon art set: rock per stratum, ores, pods, pickups, cores and drones. */
  private generateNeonArt(): void {
    for (const planet of PLANETS) {
      for (const stratum of planet.strata) this.blockTiles.set(stratum.id, neonRockTile(stratum.id));
      this.coreTiles.set(planet.id, neonCore(planet.coreGlowColor));
    }
    for (const ore of Object.values(ORES)) this.oreOverlays.set(ore.id, neonOre(ore));
    for (let tier = 1; tier <= 3; tier++) {
      this.podSprites.set(tier, neonPod(tier));
      this.droneSprites.set(tier, neonDrone(tier));
    }
    this.fuelCellTile = neonFuelCell();
    this.beaconTile = neonBeacon();
    this.relicChestTile = neonRelic();
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * 4 Crack damage stages (25%, 50%, 75%, 90%): white-ish semi-transparent cracks with dark core
   */
  private generateCrackTiles(): void {
    for (let stage = 0; stage < 4; stage++) {
      const [c, ctx] = this.createHDCanvas(HD_SIZE, HD_SIZE);
      const branches = 4 + stage * 3;
      const rand = seededRand(500 + stage * 31);

      for (let b = 0; b < branches; b++) {
        let cx = HD_SIZE * 0.5;
        let cy = HD_SIZE * 0.5;
        const baseAngle = (b / branches) * Math.PI * 2 + 0.25;
        const segs = 3 + stage * 2;

        const pts: Array<{ x: number; y: number }> = [{ x: cx, y: cy }];
        for (let s = 1; s <= segs; s++) {
          const jitter = (rand() - 0.5) * 0.7;
          const stepLen = 8 + stage * 2.5;
          cx += Math.cos(baseAngle + jitter) * stepLen;
          cy += Math.sin(baseAngle + jitter) * stepLen;
          pts.push({ x: cx, y: cy });
        }

        ctx.strokeStyle = 'rgba(160, 250, 255, 0.5)';
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(7, 10, 18, 0.92)';
        ctx.lineWidth = 3.2;
        ctx.stroke();
      }
      this.crackTiles.push(c);
    }
  }

  private drawCrystalPolygon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx + w, cy - h * 0.3);
    ctx.lineTo(cx + w * 0.75, cy + h * 0.65);
    ctx.lineTo(cx, cy + h);
    ctx.lineTo(cx - w * 0.75, cy + h * 0.65);
    ctx.lineTo(cx - w, cy - h * 0.3);
    ctx.closePath();
  }

  private generateSkillIcons(): void {
    const types: SkillIconType[] = [
      'pod',
      'drill_dps',
      'drill_width',
      'hardness_pen',
      'core_damage',
      'fuel_cap',
      'fuel_eff',
      'fuel_cell',
      'hazard_shield',
      'cargo_cap',
      'ore_value',
      'double_ore',
      'thruster',
      'winch',
      'scanner',
      'drone',
    ];

    for (const t of types) {
      const [c, ctx] = this.createHDCanvas(64, 64);
      ctx.save();
      ctx.translate(32, 32);

      switch (t) {
        case 'pod': {
          ctx.fillStyle = '#f5a623';
          this.drawRoundedRect(ctx, -14, -16, 28, 24, 6);
          ctx.fill();
          ctx.fillStyle = '#00e5ff';
          ctx.beginPath();
          ctx.arc(0, -4, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#cfd8dc';
          ctx.beginPath();
          ctx.moveTo(-11, 8);
          ctx.lineTo(11, 8);
          ctx.lineTo(0, 25);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'drill_dps': {
          ctx.fillStyle = '#ff7043';
          ctx.beginPath();
          ctx.moveTo(-15, -18);
          ctx.lineTo(15, -18);
          ctx.lineTo(0, 24);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(-9, -8);
          ctx.lineTo(9, -2);
          ctx.moveTo(-5, 4);
          ctx.lineTo(5, 9);
          ctx.stroke();
          break;
        }
        case 'drill_width': {
          ctx.fillStyle = '#ffca28';
          for (const dx of [-11, 11]) {
            ctx.beginPath();
            ctx.moveTo(dx - 8, -12);
            ctx.lineTo(dx + 8, -12);
            ctx.lineTo(dx, 18);
            ctx.closePath();
            ctx.fill();
          }
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-22, -18);
          ctx.lineTo(22, -18);
          ctx.stroke();
          break;
        }
        case 'hardness_pen': {
          ctx.fillStyle = '#ffa726';
          ctx.beginPath();
          ctx.moveTo(0, -24);
          ctx.lineTo(11, 0);
          ctx.lineTo(0, 24);
          ctx.lineTo(-11, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          this.drawRoundedRect(ctx, -18, -7, 36, 14, 4);
          ctx.stroke();
          break;
        }
        case 'core_damage': {
          const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.4, '#ffff00');
          g.addColorStop(0.8, '#ff1744');
          g.addColorStop(1, 'rgba(255,23,68,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, 22, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'fuel_cap': {
          this.drawRoundedRect(ctx, -14, -16, 28, 34, 6);
          ctx.fillStyle = '#00e676';
          ctx.fill();
          ctx.fillStyle = '#b9f6ca';
          this.drawRoundedRect(ctx, -9, -10, 6, 22, 3);
          ctx.fill();
          break;
        }
        case 'fuel_eff': {
          ctx.fillStyle = '#69f0ae';
          ctx.beginPath();
          ctx.arc(0, 6, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-13, 3);
          ctx.lineTo(0, -22);
          ctx.lineTo(13, 3);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'fuel_cell': {
          this.drawRoundedRect(ctx, -14, -16, 28, 32, 6);
          ctx.strokeStyle = '#00e676';
          ctx.lineWidth = 3.5;
          ctx.stroke();
          ctx.fillStyle = '#ffff00';
          ctx.beginPath();
          ctx.moveTo(3, -12);
          ctx.lineTo(-8, 2);
          ctx.lineTo(2, 2);
          ctx.lineTo(-3, 14);
          ctx.lineTo(9, -2);
          ctx.lineTo(0, -2);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'hazard_shield': {
          ctx.fillStyle = '#00e5ff';
          ctx.beginPath();
          ctx.moveTo(0, -22);
          ctx.lineTo(18, -12);
          ctx.lineTo(14, 10);
          ctx.lineTo(0, 22);
          ctx.lineTo(-14, 10);
          ctx.lineTo(-18, -12);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          break;
        }
        case 'cargo_cap': {
          this.drawRoundedRect(ctx, -18, -14, 36, 28, 6);
          ctx.fillStyle = '#ab47bc';
          ctx.fill();
          ctx.strokeStyle = '#f3e5f5';
          ctx.lineWidth = 3;
          ctx.stroke();
          break;
        }
        case 'ore_value': {
          ctx.fillStyle = '#ffd54f';
          this.drawCrystalPolygon(ctx, 0, 0, 16, 20);
          ctx.fill();
          break;
        }
        case 'double_ore': {
          ctx.fillStyle = '#ea80fc';
          this.drawCrystalPolygon(ctx, -8, 4, 11, 14);
          ctx.fill();
          ctx.fillStyle = '#80d8ff';
          this.drawCrystalPolygon(ctx, 8, -4, 11, 14);
          ctx.fill();
          break;
        }
        case 'thruster': {
          this.drawRoundedRect(ctx, -12, -18, 24, 18, 5);
          ctx.fillStyle = '#29b6f6';
          ctx.fill();
          ctx.fillStyle = '#ff9100';
          ctx.beginPath();
          ctx.moveTo(-11, 0);
          ctx.lineTo(11, 0);
          ctx.lineTo(0, 22);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'winch': {
          ctx.strokeStyle = '#4dd0e1';
          ctx.lineWidth = 4.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, -20);
          ctx.lineTo(0, 8);
          ctx.arc(0, 8, 10, 0, Math.PI);
          ctx.stroke();
          break;
        }
        case 'scanner': {
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, 0, 19, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'drone': {
          ctx.fillStyle = '#00e5ff';
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-21, 0);
          ctx.lineTo(21, 0);
          ctx.stroke();
          break;
        }
      }

      ctx.restore();
      this.skillIcons.set(t, c);
    }
  }

  /**
   * Renders the full Layered Drill Pod (Pages 4–5 of Design Doc):
   * Draw order bottom to top:
   * 1. Thruster flames (3 colors, when moving/drilling)
   * 2. Cargo pods (side saddle hoppers, bulge when full)
   * 3. Body / chassis (3 tiers from transparent PNG + idle hover bob)
   * 4. Hull plating (bolted armor plates)
   * 5. Scanner dish (rotating dish on top when unlocked)
   * 6. Cockpit light (cyan idle, white-cyan drilling, blinking red on low fuel)
   */
  public drawLayeredDrillPod(
    ctx: CanvasRenderingContext2D,
    state: PodLayerState,
    scale = 1.0
  ): void {
    ctx.save();
    ctx.scale(scale, scale);

    // Idle hover bob (2 to 3 px bob at 12 fps when not moving)
    const hoverBob = !state.isMoving && !state.isDrilling ? Math.sin(state.animTime * 5) * 2.5 : 0;
    const vibX = state.isDrilling ? Math.sin(state.animTime * 90) * 1.4 : 0;
    const vibY = (state.isDrilling ? Math.cos(state.animTime * 75) * 1.2 : 0) + hoverBob;
    ctx.translate(vibX, vibY);

    // 1. Volumetric Forward Headlight Cone
    const lightGrad = ctx.createRadialGradient(0, 18, 6, 0, 75, 98);
    lightGrad.addColorStop(0, 'rgba(160, 250, 255, 0.22)');
    lightGrad.addColorStop(0.55, 'rgba(255, 46, 136, 0.07)');
    lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lightGrad;
    ctx.beginPath();
    ctx.moveTo(-16, 12);
    ctx.lineTo(16, 12);
    ctx.lineTo(68, 130);
    ctx.lineTo(-68, 130);
    ctx.closePath();
    ctx.fill();

    // 2. Layer 1: Thruster Flames (orange, cyan, magenta)
    if (state.isMoving || state.isDrilling) {
      const flameLen = 16 + Math.sin(state.animTime * 52) * 5 + (state.isDrilling ? 7 : 0);
      const flameColor =
        state.podTier === 3 ? '#ff4081' : state.podTier === 2 ? '#00e5ff' : '#ff9100';
      const flameGrad = ctx.createLinearGradient(0, -30, 0, -30 - flameLen);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.4, flameColor);
      flameGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-11, -28);
      ctx.quadraticCurveTo(0, -30 - flameLen * 1.25, 11, -28);
      ctx.closePath();
      ctx.fill();
    }

    // Side thruster puff opposite the steering direction
    const steer = state.steeringDir ?? 0;
    if (steer !== 0 && (state.isMoving || state.isDrilling)) {
      const puffLen = 9 + Math.sin(state.animTime * 60) * 3;
      const sx = -steer * 30;
      const puff = ctx.createLinearGradient(sx, 0, sx - steer * puffLen, 0);
      puff.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      puff.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = puff;
      ctx.beginPath();
      ctx.moveTo(sx, -6);
      ctx.lineTo(sx - steer * puffLen, 0);
      ctx.lineTo(sx, 6);
      ctx.closePath();
      ctx.fill();
    }

    const widthScale = 1 + Math.min(0.42, Math.max(0, (state.drillRadiusPx - 21) / 95));
    const drawW = 66 * widthScale;
    const drawH = 86;

    // 3. Layer 2: External Cargo Pods (driven by Cargo branch, bulge when cargo is full!)
    if (state.cargoPodLevel > 0) {
      const bulge = state.isCargoFull ? 3.5 + Math.sin(state.animTime * 12) * 1.2 : 0;
      const podW = (7 + state.cargoPodLevel * 2.2) + bulge;
      const podH = 22 + state.cargoPodLevel * 3 + bulge;
      const sideX = drawW * 0.44;

      const sides = state.cargoPodLevel === 1 ? [-1] : [-1, 1];
      for (const dir of sides) {
        ctx.fillStyle = state.isCargoFull ? '#ff9100' : '#ab47bc';
        ctx.strokeStyle = '#140c1c';
        ctx.lineWidth = 2.5;
        this.drawRoundedRect(
          ctx,
          dir > 0 ? sideX - 2 : -sideX - podW + 2,
          -18,
          podW,
          podH,
          4
        );
        ctx.fill();
        ctx.stroke();
      }
    }

    // 4. Layer 3: Body / Chassis + Drill Head from halo-free transparent PNG
    const activeTier = Math.max(state.podTier, Math.min(3, state.drillVisualTier + 1));
    const podCanvas = this.podSprites.get(activeTier) ?? this.podSprites.get(1);
    if (podCanvas) {
      ctx.drawImage(podCanvas, -drawW * 0.5, -drawH * 0.46, drawW, drawH);
    }

    // 5. Layer 4: Hull Plating (bolted armor plates driven by Fuel & Thermal branch)
    if (state.hullPlatingLevel > 0) {
      ctx.fillStyle = state.hullPlatingLevel >= 2 ? '#00e5ff' : '#cfd8dc';
      ctx.strokeStyle = '#101820';
      ctx.lineWidth = 2;
      for (const dir of [-1, 1]) {
        this.drawRoundedRect(ctx, dir * 18 - 4, -22, 8, 16, 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // 6. Layer 5: Scanner Dish (driven by Seismic Vein Scanner)
    if (state.hasScannerDish) {
      ctx.save();
      ctx.translate(0, -drawH * 0.45);
      const dishSweep = Math.sin(state.animTime * 4) * 0.45;
      ctx.rotate(dishSweep);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -4, 9, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.lineTo(0, -5);
      ctx.stroke();
      ctx.fillStyle = '#84ffff';
      ctx.beginPath();
      ctx.arc(0, -6, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. Layer 6: Cockpit Light State (blinks red when Low Fuel < 25%!)
    if (state.isLowFuel) {
      const blink = Math.sin(state.animTime * 16) > 0;
      if (blink) {
        ctx.fillStyle = 'rgba(255, 23, 68, 0.72)';
        ctx.beginPath();
        ctx.arc(0, -10, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 8. Winch Extraction Ring
    if (state.extractProgress > 0) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.extractProgress);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 4-bit Autotile Edge Rim where rock meets dug-out empty tunnel (Page 6)
   * mask bits: 1 = Top empty, 2 = Right empty, 4 = Bottom empty, 8 = Left empty
   */
  public drawTunnelEdgeRim(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    mask: number,
    bevelColor: string
  ): void {
    if (mask === 0) return;
    ctx.save();
    ctx.fillStyle = bevelColor;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.58)';
    ctx.lineWidth = 2;
    const rim = 5;

    if (mask & 1) {
      // Top exposed edge
      ctx.fillRect(sx, sy, TILE_SIZE, rim);
    }
    if (mask & 2) {
      // Right exposed edge
      ctx.fillRect(sx + TILE_SIZE - rim, sy, rim, TILE_SIZE);
    }
    if (mask & 4) {
      // Bottom exposed edge
      ctx.fillRect(sx, sy + TILE_SIZE - rim, TILE_SIZE, rim);
    }
    if (mask & 8) {
      // Left exposed edge
      ctx.fillRect(sx, sy, rim, TILE_SIZE);
    }
    ctx.restore();
  }

  public drawTile(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    sx: number,
    sy: number
  ): void {
    ctx.drawImage(canvas, sx, sy, TILE_SIZE, TILE_SIZE);
  }
}
