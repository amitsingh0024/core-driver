import { DiveEvent } from './DrillPod';
import { TILE_SIZE } from './DiveWorld';

interface TileFlash {
  x: number;
  y: number;
  life: number;
}

interface OreFlyer {
  x: number;
  y: number;
  color: string;
  t: number;
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
const FLY_SECONDS = 0.35;

/**
 * Turns dive events into game feel: a short simulation freeze (hit-stop), a white tile
 * flash, camera shake, ore chunks flying into the pod, and phone vibration.
 */
export class GameFeel {
  public hitStop = 0;
  private flashes: TileFlash[] = [];
  private flyers: OreFlyer[] = [];

  public clear(): void {
    this.hitStop = 0;
    this.flashes.length = 0;
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
      if (e.color && (e.kind === 'ore' || e.kind === 'armored' || e.kind === 'relic')) {
        for (let i = 0; i < (e.kind === 'ore' ? 3 : 6); i++) {
          this.flyers.push({
            x: e.x + (Math.random() - 0.5) * 18,
            y: e.y + (Math.random() - 0.5) * 18,
            color: e.color,
            t: -i * 0.03,
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
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt;
      if (f.t >= FLY_SECONDS) {
        this.flyers.splice(i, 1);
        continue;
      }
      if (f.t > 0) {
        // Ease toward the pod so chunks accelerate into the hull
        const k = Math.min(1, (f.t / FLY_SECONDS) ** 2);
        f.x += (podX - f.x) * k;
        f.y += (podY - f.y) * k;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const fl of this.flashes) {
      ctx.globalAlpha = (fl.life / FLASH_SECONDS) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fl.x - camX - TILE_SIZE / 2, fl.y - camY - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    }
    ctx.globalAlpha = 1;
    for (const f of this.flyers) {
      if (f.t < 0) continue;
      const size = 6 * (1 - (f.t / FLY_SECONDS) * 0.5);
      ctx.fillStyle = f.color;
      ctx.strokeStyle = '#07090e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(f.x - camX - size / 2, f.y - camY - size / 2, size, size);
      ctx.fill();
      ctx.stroke();
    }
  }
}
