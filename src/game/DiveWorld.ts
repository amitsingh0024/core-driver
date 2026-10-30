import { PlanetConfig, StratumConfig } from '../config/planets';
import { ORES } from '../config/ores';
import { VEIN_TUNING } from '../config/veins';

export const TILE_SIZE = 44;
export const WORLD_COLS = 45;
export const METERS_PER_ROW = 4;

export type BlockType = 'empty' | 'rock' | 'fuel_cell' | 'beacon' | 'relic' | 'core' | 'bedrock';

export interface WorldBlock {
  gx: number;
  gy: number;
  type: BlockType;
  stratumIdx: number;
  stratumId: string;
  oreId: string | null;
  hp: number;
  maxHp: number;
  /** Riveted armor plating: 3x HP, always holds the stratum's rarest ore. */
  armored?: boolean;
}

export interface RadarTarget {
  wx: number;
  wy: number;
  kind: 'fuel' | 'ore' | 'core' | 'beacon' | 'relic';
  color: string;
  label: string;
}

/** The highest-tier ore that can appear in a stratum. */
export function rarestOre(stratum: StratumConfig): string | null {
  let best: string | null = null;
  for (const oreId of Object.keys(stratum.oreWeights)) {
    if (!best || (ORES[oreId]?.tier ?? 0) > (ORES[best]?.tier ?? 0)) best = oreId;
  }
  return best;
}

export class DiveWorld {
  public planet: PlanetConfig;
  public totalRows: number;
  public coreStartRow: number;
  public grid: WorldBlock[][] = [];
  public totalCoreMaxHp = 0;
  public currentCoreHp = 0;
  private seed: number;

  constructor(planet: PlanetConfig, seed = Date.now()) {
    this.planet = planet;
    this.seed = seed;
    this.totalRows = Math.ceil(planet.maxDepth / METERS_PER_ROW) + 6;
    this.coreStartRow = Math.floor(planet.maxDepth / METERS_PER_ROW) - 2;
    this.generateWorld();
  }

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  public getStratumForDepth(depthMeters: number): { stratum: StratumConfig; index: number } {
    for (let i = 0; i < this.planet.strata.length; i++) {
      const s = this.planet.strata[i];
      if (depthMeters >= s.startDepth && depthMeters <= s.endDepth) {
        return { stratum: s, index: i };
      }
    }
    const lastIdx = this.planet.strata.length - 1;
    return { stratum: this.planet.strata[lastIdx], index: lastIdx };
  }

  private generateWorld(): void {
    this.grid = [];
    this.totalCoreMaxHp = 0;
    this.currentCoreHp = 0;

    const centerCol = Math.floor(WORLD_COLS / 2);

    for (let gy = 0; gy < this.totalRows; gy++) {
      const row: WorldBlock[] = [];
      const depthMeters = gy * METERS_PER_ROW;
      const { stratum, index: stratumIdx } = this.getStratumForDepth(depthMeters);

      const depthHpScale = 1 + this.stratumProgress(depthMeters, stratum) * 0.45;

      for (let gx = 0; gx < WORLD_COLS; gx++) {
        if (gx === 0 || gx === WORLD_COLS - 1) {
          row.push({
            gx,
            gy,
            type: 'bedrock',
            stratumIdx,
            stratumId: stratum.id,
            oreId: null,
            hp: 999999999,
            maxHp: 999999999,
          });
          continue;
        }

        if (gy === 0 && Math.abs(gx - centerCol) <= 2) {
          row.push({
            gx,
            gy,
            type: 'empty',
            stratumIdx,
            stratumId: stratum.id,
            oreId: null,
            hp: 0,
            maxHp: 1,
          });
          continue;
        }

        if (gy >= this.coreStartRow && gy <= this.coreStartRow + 3) {
          const distFromCenter = Math.abs(gx - centerCol);
          if (distFromCenter <= 5) {
            const coreHp = Math.round(this.planet.coreTileHp);
            this.totalCoreMaxHp += coreHp;
            this.currentCoreHp += coreHp;
            row.push({
              gx,
              gy,
              type: 'core',
              stratumIdx,
              stratumId: stratum.id,
              oreId: null,
              hp: coreHp,
              maxHp: coreHp,
            });
            continue;
          }
        }

        if (gy > this.coreStartRow + 3) {
          row.push({
            gx,
            gy,
            type: 'bedrock',
            stratumIdx,
            stratumId: stratum.id,
            oreId: null,
            hp: 999999999,
            maxHp: 999999999,
          });
          continue;
        }

        const r = this.rand();
        if (gy > 4 && gy < this.coreStartRow - 2 && r < 0.032) {
          row.push({
            gx,
            gy,
            type: 'empty',
            stratumIdx,
            stratumId: stratum.id,
            oreId: null,
            hp: 0,
            maxHp: 1,
          });
          continue;
        }

        // Fuel Cell Canisters (approx 1.4% of tiles)
        if (gy >= 5 && gy < this.coreStartRow - 1 && r >= 0.032 && r < 0.046) {
          const cellHp = Math.max(8, Math.round(stratum.baseHp * 0.65));
          row.push({
            gx,
            gy,
            type: 'fuel_cell',
            stratumIdx,
            stratumId: stratum.id,
            oreId: null,
            hp: cellHp,
            maxHp: cellHp,
          });
          continue;
        }

        // Extraction Beacons (~0.6% chance below 60m)
        if (gy >= 15 && gy < this.coreStartRow - 3 && r >= 0.054 && r < 0.060) {
          const beaconHp = Math.max(10, Math.round(stratum.baseHp * 0.5));
          row.push({
            gx,
            gy,
            type: 'beacon',
            stratumIdx,
            stratumId: stratum.id,
            oreId: null,
            hp: beaconHp,
            maxHp: beaconHp,
          });
          continue;
        }

        // Relic Caches (~0.33% below 60m): buried credit bounty
        if (gy >= 15 && gy < this.coreStartRow - 3 && r >= 0.06 && r < 0.062) {
          const relicHp = Math.max(14, Math.round(stratum.baseHp * 1.5));
          row.push({
            gx,
            gy,
            type: 'relic',
            stratumIdx,
            stratumId: stratum.id,
            oreId: null,
            hp: relicHp,
            maxHp: relicHp,
          });
          continue;
        }

        const blockHp = Math.round(stratum.baseHp * depthHpScale);
        row.push({
          gx,
          gy,
          type: 'rock',
          stratumIdx,
          stratumId: stratum.id,
          oreId: null,
          hp: blockHp,
          maxHp: blockHp,
        });
      }

      this.grid.push(row);
    }

    this.placeVeins();
  }

  /** 0 at the top of a stratum, 1 at its bottom. */
  private stratumProgress(depthMeters: number, stratum: StratumConfig): number {
    const span = Math.max(1, stratum.endDepth - stratum.startDepth);
    return Math.max(0, Math.min(1, (depthMeters - stratum.startDepth) / span));
  }

  private randRange([min, max]: [number, number]): number {
    return min + Math.floor(this.rand() * (max - min + 1));
  }

  /** Can this tile take ore? Plain rock inside the vein's stratum, clear of the core cap. */
  private canHoldOre(gx: number, gy: number, stratumIdx: number): boolean {
    if (gx < 1 || gx > WORLD_COLS - 2 || gy < 1 || gy >= this.coreStartRow - 2) return false;
    const b = this.grid[gy][gx];
    return b.type === 'rock' && !b.oreId && b.stratumIdx === stratumIdx;
  }

  private setOre(b: WorldBlock, oreId: string, armored = false): void {
    const { stratum } = this.getStratumForDepth(b.gy * METERS_PER_ROW);
    const base = stratum.baseHp * (1 + this.stratumProgress(b.gy * METERS_PER_ROW, stratum) * 0.45);
    const hp = Math.round((base + (ORES[oreId]?.extraHp ?? 0)) * (armored ? 3 : 1));
    b.oreId = oreId;
    b.hp = hp;
    b.maxHp = hp;
    if (armored) b.armored = true;
  }

  /**
   * Grows one vein from (gx, gy) with a wandering walk that drifts mostly
   * sideways, like a seam following the strata. Returns the tiles it filled.
   */
  private growVein(gx: number, gy: number, stratumIdx: number, oreId: string, size: number, armored = false): WorldBlock[] {
    const placed: WorldBlock[] = [];
    const place = (x: number, y: number) => {
      if (placed.length >= size || !this.canHoldOre(x, y, stratumIdx)) return;
      const b = this.grid[y][x];
      this.setOre(b, oreId, armored);
      placed.push(b);
    };

    let x = gx;
    let y = gy;
    let angle = (this.rand() - 0.5) * 1.2 + (this.rand() < 0.5 ? 0 : Math.PI);
    // Compact lodes (armored, rare) curl tighter than long common seams.
    const wander = VEIN_TUNING.wander * (size <= 5 ? 1.8 : 1);
    let px = Math.round(x);
    let py = Math.round(y);
    for (let step = 0; step < size * 4 && placed.length < size; step++) {
      const tx = Math.round(x);
      const ty = Math.round(y);
      // Fill the corner on diagonal steps so the vein stays edge-connected.
      if (tx !== px && ty !== py) place(tx, py);
      place(tx, ty);
      px = tx;
      py = ty;
      if (this.rand() < VEIN_TUNING.thickness) place(tx, ty + (this.rand() < 0.5 ? -1 : 1));
      angle += (this.rand() - 0.5) * 2 * wander;
      let nx = x + Math.cos(angle);
      let ny = y + Math.sin(angle) * 0.75;
      // Bounce off the side walls and the stratum's edges instead of leaking out.
      if (nx < 1 || nx > WORLD_COLS - 2) {
        angle = Math.PI - angle;
        nx = x + Math.cos(angle);
      }
      const nb = this.grid[Math.round(ny)]?.[Math.round(nx)];
      if (!nb || nb.stratumIdx !== stratumIdx || Math.round(ny) < 1 || Math.round(ny) >= this.coreStartRow - 2) {
        angle = -angle;
        ny = y + Math.sin(angle) * 0.75;
      }
      x = Math.max(1, Math.min(WORLD_COLS - 2, nx));
      y = ny;
    }
    return placed;
  }

  /** Rings a vein with a sparse halo of the next-lower ore, so rich veins sit inside poorer rock. */
  private haloVein(vein: WorldBlock[], stratumIdx: number, haloOre: string): number {
    let count = 0;
    for (const b of vein) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (this.canHoldOre(b.gx + dx, b.gy + dy, stratumIdx) && this.rand() < VEIN_TUNING.haloChance) {
          this.setOre(this.grid[b.gy + dy][b.gx + dx], haloOre);
          count++;
        }
      }
    }
    return count;
  }

  /** Picks a start row inside the stratum, skewed deeper for higher-tier ores (rank 0..1). */
  private veinRow(rows: number[], rank: number): number {
    const skew = VEIN_TUNING.depthBanding * (rank * 2 - 1);
    const u = this.rand();
    const p = skew >= 0 ? Math.pow(u, 1 / (1 + skew)) : 1 - Math.pow(u, 1 / (1 - skew));
    return rows[Math.min(rows.length - 1, Math.floor(p * rows.length))];
  }

  /**
   * Places ore as veins. Each stratum gets a tile budget per ore (rock tiles x
   * oreDensity x weight share), then veins are grown until the budgets are spent,
   * so the overall ore economy stays tied to the strata config.
   */
  private placeVeins(): void {
    const centerCol = Math.floor(WORLD_COLS / 2);

    this.planet.strata.forEach((stratum, stratumIdx) => {
      const rows: number[] = [];
      let rockTiles = 0;
      for (let gy = 1; gy < this.coreStartRow - 2; gy++) {
        if (this.grid[gy][1].stratumIdx !== stratumIdx) continue;
        rows.push(gy);
        for (let gx = 1; gx < WORLD_COLS - 1; gx++) if (this.grid[gy][gx].type === 'rock') rockTiles++;
      }
      if (rows.length === 0) return;

      // Ores ordered common -> rare by tier; rank 0..1 drives vein size, depth band and halo.
      const ores = Object.keys(stratum.oreWeights).sort((a, b) => (ORES[a]?.tier ?? 0) - (ORES[b]?.tier ?? 0));
      const rankOf = (oreId: string) => (ores.length > 1 ? ores.indexOf(oreId) / (ores.length - 1) : 0);
      let weightTotal = 0;
      for (const id of ores) weightTotal += stratum.oreWeights[id];
      const oreTiles = rockTiles * stratum.oreDensity * VEIN_TUNING.densityScale;
      const budget: Record<string, number> = {};
      for (const id of ores) budget[id] = (oreTiles * stratum.oreWeights[id]) / weightTotal;

      // Armored lodes: compact riveted clusters of the rarest ore, from stratum 2 down.
      const rarest = rarestOre(stratum);
      if (stratumIdx >= 1 && rarest) {
        let armoredBudget = rockTiles * VEIN_TUNING.armoredShare;
        for (let tries = 0; armoredBudget > 0 && tries < 400; tries++) {
          const gy = this.veinRow(rows, 1);
          const gx = 1 + Math.floor(this.rand() * (WORLD_COLS - 2));
          const size = Math.min(Math.ceil(armoredBudget), this.randRange(VEIN_TUNING.armoredLodeSize));
          armoredBudget -= this.growVein(gx, gy, stratumIdx, rarest, size, true).length;
        }
      }

      // A guaranteed seam of the commonest ore right under the launch shaft.
      if (stratumIdx === 0 && ores.length > 0) {
        const seam = this.growVein(centerCol, 2 + Math.floor(this.rand() * 2), 0, ores[0], VEIN_TUNING.starterSeamSize);
        budget[ores[0]] -= seam.length;
      }

      for (let tries = 0; tries < 2000; tries++) {
        // Pick the next vein's ore in proportion to what's left of each budget.
        let remaining = 0;
        for (const id of ores) remaining += Math.max(0, budget[id]);
        if (remaining < 1) break;
        let r = this.rand() * remaining;
        let oreId = ores[ores.length - 1];
        for (const id of ores) {
          r -= Math.max(0, budget[id]);
          if (r <= 0) {
            oreId = id;
            break;
          }
        }

        const rank = rankOf(oreId);
        const [cMin, cMax] = VEIN_TUNING.commonVeinSize;
        const [rMin, rMax] = VEIN_TUNING.rareVeinSize;
        const size = Math.max(1, Math.min(
          Math.ceil(budget[oreId]),
          this.randRange([Math.round(cMin + (rMin - cMin) * rank), Math.round(cMax + (rMax - cMax) * rank)]),
        ));
        const gy = this.veinRow(rows, rank);
        const gx = 1 + Math.floor(this.rand() * (WORLD_COLS - 2));
        const vein = this.growVein(gx, gy, stratumIdx, oreId, size);
        budget[oreId] -= vein.length;

        const idx = ores.indexOf(oreId);
        if (idx > 0 && budget[ores[idx - 1]] > 0) {
          budget[ores[idx - 1]] -= this.haloVein(vein, stratumIdx, ores[idx - 1]);
        }
      }
    });
  }

  public getBlock(gx: number, gy: number): WorldBlock | null {
    if (gy < 0 || gy >= this.totalRows || gx < 0 || gx >= WORLD_COLS) return null;
    return this.grid[gy][gx];
  }

  /**
   * Returns 4-bit mask of empty neighbors (1=Top, 2=Right, 4=Bottom, 8=Left)
   */
  public getEmptyNeighborMask(gx: number, gy: number): number {
    let mask = 0;
    const top = this.getBlock(gx, gy - 1);
    if (!top || top.type === 'empty') mask |= 1;
    const right = this.getBlock(gx + 1, gy);
    if (right && right.type === 'empty') mask |= 2;
    const bottom = this.getBlock(gx, gy + 1);
    if (bottom && bottom.type === 'empty') mask |= 4;
    const left = this.getBlock(gx - 1, gy);
    if (left && left.type === 'empty') mask |= 8;
    return mask;
  }

  public findNearbyRadarTargets(wx: number, wy: number, rangeTiles: number): RadarTarget[] {
    const centerGx = Math.floor(wx / TILE_SIZE);
    const centerGy = Math.floor(wy / TILE_SIZE);
    const results: RadarTarget[] = [];

    const minGy = Math.max(1, centerGy - 2);
    const maxGy = Math.min(this.totalRows - 1, centerGy + rangeTiles);
    const minGx = Math.max(1, centerGx - rangeTiles);
    const maxGx = Math.min(WORLD_COLS - 2, centerGx + rangeTiles);

    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const b = this.grid[gy][gx];
        if (!b || b.type === 'empty') continue;
        const bx = (gx + 0.5) * TILE_SIZE;
        const by = (gy + 0.5) * TILE_SIZE;
        const dist = Math.hypot(bx - wx, by - wy);
        if (dist < 75 || dist > rangeTiles * TILE_SIZE) continue;

        if (b.type === 'fuel_cell') {
          results.push({
            wx: bx,
            wy: by,
            kind: 'fuel',
            color: '#00e676',
            label: 'FUEL',
          });
        } else if (b.type === 'beacon') {
          results.push({
            wx: bx,
            wy: by,
            kind: 'beacon',
            color: '#00e5ff',
            label: 'BEACON',
          });
        } else if (b.type === 'relic') {
          results.push({
            wx: bx,
            wy: by,
            kind: 'relic',
            color: '#ffd54f',
            label: 'RELIC',
          });
        } else if (b.type === 'core') {
          results.push({
            wx: bx,
            wy: by,
            kind: 'core',
            color: '#ff4081',
            label: 'CORE',
          });
        }
      }
    }

    return results.slice(0, 5);
  }
}
