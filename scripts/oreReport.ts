/**
 * Ore distribution report for DiveWorld generation.
 *
 *   npm run ore-report                 # stats per stratum, averaged over 20 seeds
 *   npm run ore-report -- --seeds 50   # more seeds
 *   npm run ore-report -- --map 1 42   # ASCII map of planet 1, seed 42
 */
import { DiveWorld, WORLD_COLS, METERS_PER_ROW } from '../src/game/DiveWorld';
import { PLANETS } from '../src/config/planets';
import { ORES } from '../src/config/ores';

const args = process.argv.slice(2);
const argVal = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

function printMap(planetId: number, seed: number): void {
  const planet = PLANETS.find((p) => p.id === planetId) ?? PLANETS[0];
  const world = new DiveWorld(planet, seed);
  // One letter per ore, uppercase when armored.
  const glyph: Record<string, string> = {};
  for (const ore of Object.values(ORES)) {
    const tierInPlanet = ((ore.tier - 1) % 5) + 1;
    glyph[ore.id] = 'abcde'[tierInPlanet - 1];
  }
  console.log(`${planet.name} seed ${seed}   . rock  a-e ore tier 1-5 (CAPS armored)  F fuel  B beacon  R relic  # core  space empty`);
  let lastStratum = -1;
  for (let gy = 0; gy < world.totalRows; gy++) {
    const row = world.grid[gy];
    if (row[1].stratumIdx !== lastStratum) {
      lastStratum = row[1].stratumIdx;
      console.log(`---- ${planet.strata[lastStratum].name} (${Object.keys(planet.strata[lastStratum].oreWeights).join(', ')})`);
    }
    let line = '';
    for (const b of row) {
      if (b.type === 'bedrock') line += '|';
      else if (b.type === 'empty') line += ' ';
      else if (b.type === 'fuel_cell') line += 'F';
      else if (b.type === 'beacon') line += 'B';
      else if (b.type === 'relic') line += 'R';
      else if (b.type === 'core') line += '#';
      else if (b.oreId) line += b.armored ? glyph[b.oreId].toUpperCase() : glyph[b.oreId];
      else line += '.';
    }
    console.log(`${String(gy * METERS_PER_ROW).padStart(5)}m ${line}`);
  }
}

interface StratumStats {
  rock: number;
  ore: Record<string, number>;
  armored: number;
  clusters: number;
  singletons: number;
}

function report(seeds: number): void {
  for (const planet of PLANETS) {
    const stats: StratumStats[] = planet.strata.map(() => ({ rock: 0, ore: {}, armored: 0, clusters: 0, singletons: 0 }));
    let fuel = 0;
    let tiles = 0;
    for (let s = 0; s < seeds; s++) {
      const world = new DiveWorld(planet, 1000 + s * 7919);
      const seen = new Set<number>();
      for (let gy = 1; gy < world.coreStartRow; gy++) {
        for (let gx = 1; gx < WORLD_COLS - 1; gx++) {
          const b = world.grid[gy][gx];
          tiles++;
          if (b.type === 'fuel_cell') fuel++;
          if (b.type !== 'rock') continue;
          const st = stats[b.stratumIdx];
          st.rock++;
          if (!b.oreId) continue;
          st.ore[b.oreId] = (st.ore[b.oreId] ?? 0) + 1;
          if (b.armored) st.armored++;
          const key = gy * WORLD_COLS + gx;
          if (seen.has(key)) continue;
          // Flood-fill the 4-connected run of the same ore.
          let size = 0;
          const stack = [key];
          seen.add(key);
          while (stack.length) {
            const k = stack.pop()!;
            size++;
            const x = k % WORLD_COLS;
            const y = Math.floor(k / WORLD_COLS);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const n = world.getBlock(x + dx, y + dy);
              const nk = (y + dy) * WORLD_COLS + (x + dx);
              if (n && n.type === 'rock' && n.oreId === b.oreId && !seen.has(nk)) {
                seen.add(nk);
                stack.push(nk);
              }
            }
          }
          st.clusters++;
          if (size === 1) st.singletons++;
        }
      }
    }
    console.log(`\n=== ${planet.name}  (${seeds} seeds, fuel cells ${(100 * fuel / tiles).toFixed(2)}% of tiles)`);
    console.log('stratum                         ore%  armored%  avg cluster  singletons%  per-ore % of rock');
    planet.strata.forEach((stratum, i) => {
      const st = stats[i];
      const oreTotal = Object.values(st.ore).reduce((a, b) => a + b, 0);
      const perOre = Object.keys(stratum.oreWeights)
        .map((id) => `${id} ${(100 * (st.ore[id] ?? 0) / st.rock).toFixed(1)}`)
        .join('  ');
      console.log(
        `${stratum.name.padEnd(30)} ${(100 * oreTotal / st.rock).toFixed(1).padStart(5)}  ${(100 * st.armored / st.rock).toFixed(1).padStart(8)}  ${(oreTotal / Math.max(1, st.clusters)).toFixed(1).padStart(11)}  ${(100 * st.singletons / Math.max(1, st.clusters)).toFixed(0).padStart(11)}  ${perOre}`,
      );
    });
  }
}

const map = argVal('--map');
if (map) printMap(Number(map), Number(args[args.indexOf('--map') + 2] ?? 42));
else report(Number(argVal('--seeds') ?? 20));
