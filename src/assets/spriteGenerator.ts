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
  steeringDir?: number;          // -1 left, 0 straight, +1 right (for outer-side steering puff)
  isHardGrinding?: boolean;      // Molten friction heat glow on drill tip
  cargoCatchPulse?: number;      // 0..1 bounce when ore lands in cargo hopper
  highlightedLayer?: number | null; // 1..7 when hovering a component card in Pod Garage
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

  /** Re-draws a flat icon as neon: a coloured glow behind it and a bright inner core on top. */
  private neonize(src: HTMLCanvasElement): HTMLCanvasElement {
    const [c, ctx] = this.createHDCanvas(src.width, src.height);
    for (const blur of [10, 4]) {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 46, 136, 0.55)';
      ctx.shadowBlur = blur;
      ctx.drawImage(src, 0, 0);
      ctx.restore();
    }
    // Lighten the fill toward white at its centre so each shape reads as a lit tube
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createRadialGradient(src.width / 2, src.height / 2, 2, src.width / 2, src.height / 2, src.width / 2);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, src.width, src.height);
    return c;
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
      this.skillIcons.set(t, this.neonize(c));
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

    // Idle hover bob + Drilling high-frequency vibration + Squash & Stretch
    const hoverBob = !state.isMoving && !state.isDrilling ? Math.sin(state.animTime * 5) * 2.5 : 0;
    const vibX = state.isDrilling ? Math.sin(state.animTime * 95) * (state.isHardGrinding ? 2.1 : 1.4) : 0;
    const vibY = (state.isDrilling ? Math.cos(state.animTime * 80) * 1.2 : 0) + hoverBob;
    ctx.translate(vibX, vibY);

    // Subtle squash & stretch when thrusting vs drilling impact
    const stretchY = state.isDrilling
      ? -0.03 + Math.sin(state.animTime * 45) * 0.018
      : state.isMoving
      ? 0.025
      : Math.sin(state.animTime * 5) * 0.008;
    ctx.scale(1 - stretchY * 0.65, 1 + stretchY);

    // 1. Volumetric Forward Headlight Cone + Twin Beam Core
    const lightGrad = ctx.createRadialGradient(0, 18, 6, 0, 78, 104);
    lightGrad.addColorStop(0, state.isDrilling ? 'rgba(200, 252, 255, 0.32)' : 'rgba(160, 250, 255, 0.22)');
    lightGrad.addColorStop(0.55, 'rgba(255, 46, 136, 0.08)');
    lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lightGrad;
    ctx.beginPath();
    ctx.moveTo(-16, 12);
    ctx.lineTo(16, 12);
    ctx.lineTo(72, 134);
    ctx.lineTo(-72, 134);
    ctx.closePath();
    ctx.fill();

    // 2. Layer 1: Multi-Stage Thruster Plume, Shock Diamonds & Steering Side Jets
    const flameColor =
      state.podTier === 3 ? '#ff4081' : state.podTier === 2 ? '#00e5ff' : '#ff9100';
    if (state.isMoving || state.isDrilling) {
      const flameLen = 19 + Math.sin(state.animTime * 58) * 6 + (state.isDrilling ? 9 : 0);
      const flameGrad = ctx.createLinearGradient(0, -28, 0, -30 - flameLen * 1.3);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.35, flameColor);
      flameGrad.addColorStop(0.75, state.podTier === 3 ? 'rgba(213, 0, 249, 0.45)' : 'rgba(255, 87, 34, 0.45)');
      flameGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      // Outer plasma plume
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-12, -28);
      ctx.quadraticCurveTo(0, -32 - flameLen * 1.35, 12, -28);
      ctx.closePath();
      ctx.fill();

      // White-hot inner supersonic core
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.moveTo(-5.5, -28);
      ctx.quadraticCurveTo(0, -30 - flameLen * 0.68, 5.5, -28);
      ctx.closePath();
      ctx.fill();

      // Animated shock-diamond rings pulsing down the exhaust jet
      for (let d = 0; d < 2; d++) {
        const phase = (state.animTime * 9 + d * 0.5) % 1;
        const dy = -31 - phase * flameLen * 0.95;
        const dw = (1 - phase) * 7.5;
        ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - phase) * 0.75})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, dy, dw, 2.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Side vector thruster jet + puff on the outer side of a turn
      if (state.steeringDir && Math.abs(state.steeringDir) > 0.08) {
        const outerSide = state.steeringDir > 0 ? -1 : 1;
        const jetLen = 11 + Math.sin(state.animTime * 48) * 3;
        ctx.strokeStyle = '#84ffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(outerSide * 19, -15);
        ctx.lineTo(outerSide * (19 + jetLen), -19);
        ctx.stroke();

        const puffX = outerSide * (24 + Math.sin(state.animTime * 40) * 3);
        const puffR = 4.2 + Math.sin(state.animTime * 35) * 1.4;
        ctx.fillStyle = 'rgba(224, 247, 250, 0.72)';
        ctx.beginPath();
        ctx.arc(puffX, -17, puffR, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Idle pilot-flame glow inside rear thruster nozzle
      const idlePulse = 0.45 + Math.sin(state.animTime * 10) * 0.2;
      ctx.fillStyle = flameColor;
      ctx.globalAlpha = idlePulse;
      ctx.beginPath();
      ctx.arc(0, -29, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Low fuel (< 25%) thruster red sputter puffs
    if (state.isLowFuel) {
      for (let s = 0; s < 2; s++) {
        const sputterPhase = (state.animTime * 5.5 + s * 0.5) % 1;
        const sputterX = Math.sin(state.animTime * 19 + s * 3) * 9;
        const sputterY = -32 - sputterPhase * 22;
        const sputterAlpha = (1 - sputterPhase) * 0.78;
        ctx.fillStyle = s === 0
          ? `rgba(255, 82, 82, ${sputterAlpha.toFixed(2)})`
          : `rgba(38, 50, 56, ${(sputterAlpha * 0.7).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sputterX, sputterY, 3.2 + sputterPhase * 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const widthScale = 1 + Math.min(0.42, Math.max(0, (state.drillRadiusPx - 21) / 95));
    const drawW = 66 * widthScale;
    const drawH = 86;

    // 3. Layer 2: External Cargo Pods (bulge when full + elastic bounce on ore catch!)
    if (state.cargoPodLevel > 0) {
      const catchBounce = (state.cargoCatchPulse ?? 0) * 4.5;
      const bulge = (state.isCargoFull ? 3.5 + Math.sin(state.animTime * 12) * 1.2 : 0) + catchBounce;
      const podW = 7 + state.cargoPodLevel * 2.2 + bulge;
      const podH = 22 + state.cargoPodLevel * 3 + bulge * 0.7;
      const sideX = drawW * 0.44;

      const sides = state.cargoPodLevel === 1 ? [-1] : [-1, 1];
      for (const dir of sides) {
        const rx = dir > 0 ? sideX - 2 : -sideX - podW + 2;
        const ry = -18 - catchBounce * 0.4;
        ctx.fillStyle = state.isCargoFull ? '#ff9100' : '#ab47bc';
        ctx.strokeStyle = '#140c1c';
        ctx.lineWidth = 2.5;
        this.drawRoundedRect(ctx, rx, ry, podW, podH, 4);
        ctx.fill();
        ctx.stroke();

        // Glowing cargo window strip on each saddlebag
        ctx.fillStyle = state.isCargoFull
          ? '#ffd54f'
          : (state.cargoCatchPulse ?? 0) > 0.1
          ? '#ffffff'
          : '#e1bee7';
        ctx.fillRect(rx + podW * 0.28, ry + 4, podW * 0.44, podH - 8);
      }
    }

    // 4. Layer 3: Body / Chassis + Drill Head from halo-free transparent PNG
    const activeTier = Math.max(state.podTier, Math.min(3, state.drillVisualTier + 1));
    const podCanvas = this.podSprites.get(activeTier) ?? this.podSprites.get(1);
    if (podCanvas) {
      ctx.drawImage(podCanvas, -drawW * 0.5, -drawH * 0.46, drawW, drawH);
    }

    // 4b. Live Spinning Helical Drill Bit & Friction Heat Overlay (Nose Cone y = +10 .. +41)
    {
      const spinRate = state.isDrilling ? 28 : state.isMoving ? 14 : 2.5;
      const spinPhase = (state.animTime * spinRate) % 1;
      const recoilY = state.isDrilling ? -1.8 + Math.sin(state.animTime * 65) * 1.2 : 0;
      const coneTopY = 11 + recoilY;
      const coneTipY = 41 + recoilY;
      const coneHalfW = drawW * 0.27;

      ctx.save();
      // Clip helical auger flutes to the conical drill bit silhouette
      ctx.beginPath();
      ctx.moveTo(-coneHalfW, coneTopY);
      ctx.lineTo(coneHalfW, coneTopY);
      ctx.lineTo(0, coneTipY);
      ctx.closePath();
      ctx.clip();

      // Rotating diagonal spiral flutes scrolling down the cone
      const fluteColor =
        state.isHardGrinding
          ? 'rgba(255, 171, 0, 0.72)'
          : state.podTier === 3
          ? 'rgba(255, 128, 171, 0.62)'
          : state.podTier === 2
          ? 'rgba(132, 255, 255, 0.62)'
          : 'rgba(255, 248, 225, 0.58)';

      ctx.strokeStyle = fluteColor;
      ctx.lineWidth = state.isDrilling ? 3.2 : 2.2;
      for (let i = -2; i <= 4; i++) {
        const fy = coneTopY + ((i + spinPhase) * 8.5);
        ctx.beginPath();
        ctx.moveTo(-coneHalfW - 4, fy - 5);
        ctx.lineTo(coneHalfW + 4, fy + 5);
        ctx.stroke();

        // Dark groove shadow alongside each flute
        ctx.strokeStyle = 'rgba(7, 10, 18, 0.55)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-coneHalfW - 4, fy - 2);
        ctx.lineTo(coneHalfW + 4, fy + 8);
        ctx.stroke();
        ctx.strokeStyle = fluteColor;
        ctx.lineWidth = state.isDrilling ? 3.2 : 2.2;
      }

      // High-speed vertical specular flash when actively drilling
      if (state.isDrilling || state.isMoving) {
        const glintX = Math.sin(state.animTime * 36) * (coneHalfW * 0.45);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(glintX, coneTopY);
        ctx.lineTo(0, coneTipY);
        ctx.stroke();
      }
      ctx.restore();

      // Side rotary cutter teeth moving up/down along cone edges when drilling
      if (state.drillVisualTier >= 1 || state.isDrilling) {
        const teethCount = 3;
        ctx.fillStyle = state.isHardGrinding ? '#ffd54f' : '#eceff1';
        for (let t = 0; t < teethCount; t++) {
          const prog = (t / teethCount + spinPhase / teethCount) % 1;
          const ty = coneTopY + prog * (coneTipY - coneTopY - 4);
          const halfSpan = coneHalfW * (1 - prog);
          for (const dir of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(dir * (halfSpan + 1.2), ty, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Molten Friction Heat Glow at Drill Tip when drilling / hard-grinding
      if (state.isDrilling) {
        const heatR = state.isHardGrinding ? 16 : 10;
        const heatGrad = ctx.createRadialGradient(0, coneTipY - 2, 1, 0, coneTipY - 2, heatR);
        heatGrad.addColorStop(0, '#ffffff');
        heatGrad.addColorStop(0.45, state.isHardGrinding ? '#ff6d00' : '#ffd54f');
        heatGrad.addColorStop(1, 'rgba(255, 87, 34, 0)');
        ctx.fillStyle = heatGrad;
        ctx.beginPath();
        ctx.arc(0, coneTipY - 2, heatR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Layer 4: Hull Plating (bolted armor plates driven by Fuel & Thermal branch)
    if (state.hullPlatingLevel > 0) {
      ctx.fillStyle = state.hullPlatingLevel >= 2 ? '#00e5ff' : '#cfd8dc';
      ctx.strokeStyle = '#101820';
      ctx.lineWidth = 2;
      for (const dir of [-1, 1]) {
        const px = dir * 18 - 4;
        this.drawRoundedRect(ctx, px, -22, 8, 16, 2);
        ctx.fill();
        ctx.stroke();
        // Rivet dots on armor plate
        ctx.fillStyle = '#263238';
        ctx.beginPath();
        ctx.arc(px + 4, -19, 1.1, 0, Math.PI * 2);
        ctx.arc(px + 4, -9, 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = state.hullPlatingLevel >= 2 ? '#00e5ff' : '#cfd8dc';
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
      ctx.arc(0, -6, 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Expanding radar wave arc from dish tip
      const wavePhase = (state.animTime * 1.8) % 1;
      ctx.strokeStyle = `rgba(0, 229, 255, ${(1 - wavePhase) * 0.65})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, -6, 4 + wavePhase * 12, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Layer 6 & 7: Animated Cockpit Pilot Visor, Specular Glass Glint & Low-Fuel Strobe
    {
      const lookX = (state.steeringDir ?? 0) * 2.2;
      const isBlinking = (state.animTime % 3.8) > 3.66;
      const visorY = -10;

      // Pilot visor eyes inside cockpit dome
      if (!isBlinking) {
        ctx.fillStyle = state.isLowFuel ? '#ff8a80' : '#e0f7fa';
        ctx.fillRect(lookX - 4.2, visorY - 1.2, 3, 2.2);
        ctx.fillRect(lookX + 1.2, visorY - 1.2, 3, 2.2);
      }

      // Dynamic curved glass glint that shifts with steering/idle bob
      const glintShift = Math.sin(state.animTime * 2.5) * 1.5 - lookX * 0.6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(glintShift, -10, 6.5, -Math.PI * 0.78, -Math.PI * 0.32);
      ctx.stroke();

      // Red warning strobe when Low Fuel (< 25%)
      if (state.isLowFuel) {
        const blink = Math.sin(state.animTime * 16) > 0;
        if (blink) {
          ctx.fillStyle = 'rgba(255, 23, 68, 0.68)';
          ctx.beginPath();
          ctx.arc(0, -10, 9.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 8. Interactive Garage Layer Highlight Bracket (when hovering a slot card in Pod Garage)
    if (state.highlightedLayer) {
      const bounds: Record<number, { x: number; y: number; w: number; h: number; color: string }> = {
        1: { x: -20, y: -48, w: 40, h: 24, color: '#29b6f6' }, // Thrusters
        2: { x: -24, y: 8, w: 48, h: 36, color: '#ff7043' },   // Rotary Drill
        3: { x: -24, y: -28, w: 48, h: 38, color: '#f5a623' }, // Core Chassis
        4: { x: -26, y: -25, w: 52, h: 22, color: '#00e676' }, // Hull Armor
        5: { x: -38, y: -22, w: 76, h: 30, color: '#ab47bc' }, // Cargo Hoppers
        6: { x: -18, y: -52, w: 36, h: 20, color: '#00e5ff' }, // Scanner & Drones
        7: { x: -13, y: -22, w: 26, h: 22, color: '#00e676' }, // Cockpit Canopy
      };
      const b = bounds[state.highlightedLayer];
      if (b) {
        const pad = 2 + Math.sin(state.animTime * 10) * 1.5;
        ctx.save();
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        this.drawRoundedRect(ctx, b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, 5);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 9. Winch Extraction Grapple Hook & Ring (Page 5: Grapple hook clamps to top)
    if (state.extractProgress > 0) {
      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.fillStyle = '#102436';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, -32);
      ctx.lineTo(-7, -42);
      ctx.lineTo(7, -42);
      ctx.lineTo(12, -32);
      ctx.stroke();
      this.drawRoundedRect(ctx, -6, -46, 12, 8, 3);
      ctx.fill();
      ctx.stroke();

      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.extractProgress);
      ctx.stroke();
      ctx.restore();
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
