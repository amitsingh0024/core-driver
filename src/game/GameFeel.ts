import { DiveEvent } from './DrillPod';
import { TILE_SIZE } from './DiveWorld';
import { SpriteAtlas } from '../assets/spriteGenerator';

interface TileFlash {
  x: number;
  y: number;
  life: number;
}

interface ShockRing {
  x: number;
  y: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface OreFlyer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  oreId?: string;
  angle: number;
  vAngle: number;
  t: number;
  prevX: number;
  prevY: number;
}

// Hit-stop, shake and haptic strength per event (research targets: 50-100 ms stop, 2-10 px shake)
const FEEL: Record<DiveEvent['kind'], { stop: number; shake: number; haptic: number }> = {
  break: { stop: 0, shake: 1.5, haptic: 0 },
  ore: { stop: 0.05, shake: 3, haptic: 12 },
  fuel: { stop: 0.04, shake: 2, haptic: 10 },
  armored: { stop: 0.09, shake: 7, haptic: 25 },
  relic: { stop: 0.09, shake: 8, haptic: 40 },
  core: { stop: 0.06, shake: 6, haptic: 18 },
  core_shattered: { stop: 0.15, shake: 18, haptic: 80 },
};

const FLASH_SECONDS = 0.08;
const FLY_SECONDS = 0.42;

/**
 * Turns dive events into game feel: a short simulation freeze (hit-stop), a white tile
 * flash, radial shockwave rings, camera shake, HD ore gems flying into the pod, and phone vibration.
 */
export class GameFeel {
  public hitStop = 0;
  public cargoCatchPulse = 0;
  private flashes: TileFlash[] = [];
  private rings: ShockRing[] = [];
  private flyers: OreFlyer[] = [];

  public clear(): void {
    this.hitStop = 0;
    this.cargoCatchPulse = 0;
    this.flashes.length = 0;
    this.rings.length = 0;
    this.flyers.length = 0;
  }

  /** Consumes events and returns the screen shake to add and the vibration to play. */
  public handle(events: DiveEvent[], shakeEnabled: boolean): { shake: number; haptic: number } {
    let shake = 0;
    let haptic = 0;
    for (const e of events) {
      const f = FEEL[e.kind];
      if (shakeEnabled) this.hitStop = Math.max(this.hitStop, f.stop);
      shake = Math.max(shake, f.shake);
      haptic = Math.max(haptic, f.haptic);
      this.flashes.push({ x: e.x, y: e.y, life: FLASH_SECONDS });

      if (e.kind !== 'break') {
        const ringLife = e.kind === 'core_shattered' ? 0.55 : e.kind === 'relic' ? 0.36 : 0.25;
        this.rings.push({
          x: e.x,
          y: e.y,
          maxRadius: e.kind === 'core_shattered' ? 92 : e.kind === 'relic' ? 48 : 30,
          color: e.color ?? '#ffffff',
          life: ringLife,
          maxLife: ringLife,
        });
      }

      if (e.color && (e.kind === 'ore' || e.kind === 'armored' || e.kind === 'relic')) {
        const count = e.kind === 'ore' ? 2 : 4;
        for (let i = 0; i < count; i++) {
          const popAngle = -Math.PI * 0.5 + (Math.random() - 0.5) * 2.2;
          const popSpeed = 55 + Math.random() * 65;
          const sx = e.x + (Math.random() - 0.5) * 14;
          const sy = e.y + (Math.random() - 0.5) * 14;
          this.flyers.push({
            x: sx,
            y: sy,
            prevX: sx,
            prevY: sy,
            vx: Math.cos(popAngle) * popSpeed,
            vy: Math.sin(popAngle) * popSpeed,
            color: e.color,
            oreId: e.oreId,
            angle: Math.random() * Math.PI * 2,
            vAngle: (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 6),
            t: -i * 0.04,
          });
        }
      }
    }
    events.length = 0;
    return { shake: shakeEnabled ? shake : 0, haptic };
  }

  /** Advances effect timers. Runs in real time, even during hit-stop. */
  public update(dt: number, podX: number, podY: number): void {
    this.hitStop = Math.max(0, this.hitStop - dt);
    if (this.cargoCatchPulse > 0) {
      this.cargoCatchPulse = Math.max(0, this.cargoCatchPulse - dt * 4.5);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt;
      if (f.t >= FLY_SECONDS) {
        this.flyers.splice(i, 1);
        this.cargoCatchPulse = 1;
        continue;
      }
      if (f.t > 0) {
        f.prevX = f.x;
        f.prevY = f.y;
        f.angle += f.vAngle * dt;
        const progress = f.t / FLY_SECONDS;
        if (progress < 0.28) {
          // Initial parabolic pop outward before vacuuming into the pod
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.vy += 180 * dt;
        } else {
          // Magnetic vacuum pull into the pod saddlebags
          const k = Math.min(1, ((progress - 0.28) / 0.72) ** 1.85 * 0.42 + 0.12);
          f.x += (podX - f.x) * k;
          f.y += (podY - f.y) * k;
        }
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    atlas?: SpriteAtlas
  ): void {
    for (const fl of this.flashes) {
      ctx.globalAlpha = (fl.life / FLASH_SECONDS) * 0.82;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fl.x - camX - TILE_SIZE / 2, fl.y - camY - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    }

    for (const r of this.rings) {
      const p = 1 - r.life / r.maxLife;
      const rad = 6 + p * r.maxRadius;
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.65;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1, 3 * (1 - p));
      ctx.beginPath();
      ctx.arc(r.x - camX, r.y - camY, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    for (const f of this.flyers) {
      if (f.t < 0) continue;
      const sx = f.x - camX;
      const sy = f.y - camY;
      const px = f.prevX - camX;
      const py = f.prevY - camY;

      // Glowing vacuum ribbon trail
      ctx.save();
      ctx.strokeStyle = f.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      const progress = f.t / FLY_SECONDS;
      const scale = progress > 0.8 ? 1 - (progress - 0.8) * 2.2 : 1;
      const gemSprite = f.oreId ? atlas?.oreOverlays.get(f.oreId) : undefined;

      ctx.translate(sx, sy);
      ctx.rotate(f.angle);
      ctx.globalAlpha = 1;
      if (gemSprite) {
        const drawSize = 18 * Math.max(0.35, scale);
        ctx.drawImage(gemSprite, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
      } else {
        const r = 5.5 * Math.max(0.35, scale);
        ctx.fillStyle = f.color;
        ctx.strokeStyle = '#07090e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.85, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.85, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
