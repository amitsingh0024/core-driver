import { GameContext } from '../core/GameContext';
import { fitCanvasToDisplay, podLayers } from '../render/podView';
import { $ } from '../ui/dom';
import { TILE_SIZE } from '../game/DiveWorld';
import { flatRockTile } from '../render/rockTiles';
import { drawGroundLip, drawSurfaceBase, drawSurfaceSky } from '../render/SurfaceBase';

/** Animated planet surface with the idling pod behind the title menu. */
export class TitleScreen {
  private canvas = $<HTMLCanvasElement>('title-canvas');
  private ctx = this.canvas.getContext('2d')!;

  constructor(private game: GameContext) {}

  public onShow(): void {
    $('title-play-label').textContent =
      this.game.save.totalDives > 0
        ? `CONTINUE (${this.game.planet().name.toUpperCase()})`
        : 'LAUNCH FIRST DIVE';
  }

  public render(): void {
    const { w, h, dpr } = fitCanvasToDisplay(this.canvas);
    const ctx = this.ctx;
    const planet = this.game.planet();
    const groundY = Math.round(h * 0.7);
    const t = this.game.animTime;
    // Slow drift across the yard so the menu feels alive
    const pan = Math.sin(t * 0.08) * 120;
    const padX = w * 0.5 - pan;

    ctx.save();
    ctx.scale(dpr, dpr);
    drawSurfaceSky(ctx, planet, w, groundY, pan, t);
    drawSurfaceBase(ctx, planet, padX, groundY, w, t);

    // Ground: first-stratum rock with the shaft mouth open under the derrick
    const sheetTile = this.game.atlas.blockTiles.get(planet.strata[0].id);
    const rock = sheetTile ? flatRockTile(sheetTile) : undefined;
    const T = TILE_SIZE;
    const holeHalf = T * 2.5;
    for (let y = groundY; y < h; y += T) {
      for (let x = ((padX % T) - T) % T - T; x < w; x += T) {
        const inHole = y < groundY + T && Math.abs(x + T / 2 - padX) < holeHalf;
        if (rock) ctx.drawImage(rock, x, y, T + 0.5, T + 0.5);
        if (inHole) {
          ctx.fillStyle = 'rgba(8, 6, 10, 0.7)';
          ctx.fillRect(x, y, T + 0.5, T + 0.5);
        }
      }
    }
    drawGroundLip(ctx, planet.id, 0, padX - holeHalf, groundY);
    drawGroundLip(ctx, planet.id, padX + holeHalf, w, groundY);
    const fade = ctx.createLinearGradient(0, groundY + T, 0, h);
    fade.addColorStop(0, 'rgba(4, 3, 8, 0)');
    fade.addColorStop(1, 'rgba(4, 3, 8, 0.75)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, groundY + T, w, h - groundY - T);

    ctx.translate(padX, groundY + 20);
    this.game.atlas.drawLayeredDrillPod(ctx, podLayers(this.game.stats, t), 1.0);
    ctx.restore();
  }
}
