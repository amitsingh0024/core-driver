/**
 * Ore vein generation tuning. Ore is placed as connected veins grown by a
 * wandering walk instead of a per-tile dice roll, so a stratum's ore reads as
 * seams and lodes you can steer toward.
 *
 * Run `npm run ore-report` after changing these to see ore share, cluster size
 * and per-ore counts by stratum.
 */
export const VEIN_TUNING = {
  /** Multiplies each stratum's `oreDensity` to get the share of rock tiles that hold ore. */
  densityScale: 1.0,
  /** Share of rock tiles (stratum 2 and down) that are armored lodes of the stratum's rarest ore. */
  armoredShare: 0.04,
  /** Vein length in tiles for the stratum's most common ore [min, max]. */
  commonVeinSize: [8, 16] as [number, number],
  /** Vein length in tiles for the stratum's rarest ore [min, max]. Sizes lerp by tier between the two. */
  rareVeinSize: [3, 7] as [number, number],
  /** Armored lode size in tiles [min, max]. */
  armoredLodeSize: [3, 5] as [number, number],
  /** Chance each step also fills the tile above/below the walk, giving veins a ragged thickness. */
  thickness: 0.4,
  /** How much the walk turns per step (radians). Low = straight seams, high = blobby pockets. */
  wander: 0.7,
  /** Chance each rock tile touching a vein gets the next-lower ore of the stratum (a halo). */
  haloChance: 0.15,
  /**
   * Pushes higher-tier ores toward the bottom of their stratum and common ores toward the top.
   * 0 = uniform, 2 = strong banding.
   */
  depthBanding: 0.8,
  /** Guaranteed seam of the stratum's commonest ore crossing the launch shaft, in tiles. */
  starterSeamSize: 12,
};
