import { PlanetConfig, StratumConfig } from '../config/planets';
import { ORES } from '../config/ores';

export const TILE_SIZE = 44;
export const WORLD_COLS = 21;
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

  private pickWeightedOre(weights: Record<string, number>): string | null {
    let total = 0;
    for (const w of Object.values(weights)) total += w;
    if (total <= 0) return null;
    let r = this.rand() * total;
    for (const [oreId, w] of Object.entries(weights)) {
      r -= w;
      if (r <= 0) return oreId;
    }
    return Object.keys(weights)[0] ?? null;
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

      const stratumSpan = Math.max(1, stratum.endDepth - stratum.startDepth);
      const localProgress = Math.max(0, Math.min(1, (depthMeters - stratum.startDepth) / stratumSpan));
      const depthHpScale = 1 + localProgress * 0.45;

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

        // Fuel Cell Canisters (approx 2.2% of tiles)
        if (gy >= 5 && gy < this.coreStartRow - 1 && r >= 0.032 && r < 0.054) {
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

        // Armored Veins (~4% of rock from stratum 2 down): 3x HP, guaranteed rarest ore
        if (stratumIdx >= 1 && gy < this.coreStartRow - 2 && r >= 0.062 && r < 0.102) {
          const oreId = rarestOre(stratum);
          const armorHp = Math.round((stratum.baseHp * depthHpScale + (oreId ? ORES[oreId].extraHp : 0)) * 3);
          row.push({
            gx,
            gy,
            type: 'rock',
            stratumIdx,
            stratumId: stratum.id,
            oreId,
            hp: armorHp,
            maxHp: armorHp,
            armored: true,
          });
          continue;
        }

        let oreId: string | null = null;
        if (this.rand() < stratum.oreDensity) {
          oreId = this.pickWeightedOre(stratum.oreWeights);
        }

        if (gy >= 1 && gy <= 4 && Math.abs(gx - centerCol) <= 3 && this.rand() < 0.45) {
          oreId = this.pickWeightedOre(stratum.oreWeights);
        }

        const oreCfg = oreId ? ORES[oreId] : null;
        const blockHp = Math.round(stratum.baseHp * depthHpScale + (oreCfg ? oreCfg.extraHp : 0));

        row.push({
          gx,
          gy,
          type: 'rock',
          stratumIdx,
          stratumId: stratum.id,
          oreId,
          hp: blockHp,
          maxHp: blockHp,
        });
      }

      this.grid.push(row);
    }

    for (let gy = 2; gy < this.coreStartRow - 2; gy++) {
      for (let gx = 2; gx < WORLD_COLS - 2; gx++) {
        const b = this.grid[gy][gx];
        if (b.type === 'rock' && b.oreId && !b.armored && this.rand() < 0.32) {
          const nx = gx + (this.rand() < 0.5 ? -1 : 1);
          const nb = this.grid[gy][nx];
          if (nb && nb.type === 'rock' && !nb.oreId && !nb.armored) {
            nb.oreId = b.oreId;
            const oreCfg = ORES[b.oreId];
            if (oreCfg) {
              nb.hp += oreCfg.extraHp;
              nb.maxHp = nb.hp;
            }
          }
        }
      }
    }
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
