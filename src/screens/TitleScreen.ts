import { GameContext } from '../core/GameContext';
import { fitCanvasToDisplay, podLayers } from '../render/podView';
import { $ } from '../ui/dom';

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
    const groundY = Math.round(h * 0.72);

    ctx.save();
    ctx.scale(dpr, dpr);
    this.game.atlas.drawSurfaceScene(ctx, planet, w, groundY, w * 0.5, this.game.animTime);

    // Underground crust below the landing pad
    ctx.fillStyle = planet.strata[0].palette.bgWall;
    ctx.fillRect(0, groundY, w, h - groundY);

    ctx.translate(w * 0.5, groundY - 22);
    this.game.atlas.drawLayeredDrillPod(ctx, podLayers(this.game.stats, this.game.animTime), 1.0);
    ctx.restore();
  }
}
