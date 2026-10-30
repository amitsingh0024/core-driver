import { ComputedPlayerStats } from '../config/skillTree';
import { SpriteAtlas } from '../assets/spriteGenerator';

type PodLayerState = Parameters<SpriteAtlas['drawLayeredDrillPod']>[1];

/** Builds the layered pod draw state from player stats, with per-call overrides for live dive state. */
export function podLayers(
  stats: ComputedPlayerStats,
  animTime: number,
  live: Partial<PodLayerState> = {}
): PodLayerState {
  return {
    podTier: stats.podTier,
    drillVisualTier: stats.drillVisualTier,
    hullPlatingLevel: stats.hullPlatingLevel,
    cargoPodLevel: stats.cargoPodLevel,
    hasScannerDish: stats.hasScannerDish,
    isLowFuel: false,
    isCargoFull: false,
    drillRadiusPx: stats.drillRadiusPx,
    animTime,
    isMoving: false,
    isDrilling: false,
    extractProgress: 0,
    ...live,
  };
}

/**
 * Device pixel ratio capped at 2. Phones report 3 or more, which makes every canvas
 * fill 2.25x the pixels of 2x for no visible gain at this art's resolution.
 */
export function canvasDpr(): number {
  return Math.min(2, window.devicePixelRatio || 1);
}

/** Resizes a canvas backing store to its CSS size times the capped devicePixelRatio. Returns the CSS size. */
export function fitCanvasToDisplay(canvas: HTMLCanvasElement): { w: number; h: number; dpr: number } {
  const dpr = canvasDpr();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  return { w, h, dpr };
}
