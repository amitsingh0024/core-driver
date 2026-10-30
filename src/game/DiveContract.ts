import { ORES } from '../config/ores';
import { PlanetConfig, StratumConfig } from '../config/planets';
import { ComputedPlayerStats } from '../config/skillTree';

export type ContractKind = 'depth' | 'ore' | 'haul';

/** One optional goal per dive, paid as a bonus on the Results screen. */
export interface DiveContract {
  kind: ContractKind;
  label: string;
  target: number;
  oreId?: string;
  reward: number;
}

export interface ContractProgress {
  maxDepthReached: number;
  cargoManifest: Record<string, number>;
  haulValue: number;
}

function niceRound(n: number): number {
  if (n < 100) return Math.max(10, Math.round(n / 10) * 10);
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}

function stratumAt(planet: PlanetConfig, depth: number): StratumConfig {
  return planet.strata.find((s) => depth >= s.startDepth && depth <= s.endDepth) ?? planet.strata[planet.strata.length - 1];
}

/** Average ore value in a stratum, weighted by spawn weight. */
function avgOreValue(stratum: StratumConfig): number {
  let total = 0;
  let weight = 0;
  for (const [oreId, w] of Object.entries(stratum.oreWeights)) {
    total += (ORES[oreId]?.value ?? 0) * w;
    weight += w;
  }
  return weight > 0 ? total / weight : 5;
}

/**
 * Rolls a contract scaled to the player's record on this planet. Targets sit a little past
 * what the player has already done, so most contracts are reachable with one good dive.
 */
export function rollContract(
  planet: PlanetConfig,
  bestDepth: number,
  stats: ComputedPlayerStats,
  rand: () => number = Math.random
): DiveContract {
  const kinds: ContractKind[] = ['depth', 'ore', 'haul'];
  const depthCap = planet.maxDepth - 40;
  const depthTarget = niceRound(Math.min(depthCap, Math.max(60, bestDepth + 40 + rand() * 60)));
  // Once the core is in reach there is no further depth to chase
  const pool = bestDepth >= depthCap ? kinds.filter((k) => k !== 'depth') : kinds;
  const kind = pool[Math.floor(rand() * pool.length)];

  const workDepth = Math.max(20, Math.min(depthCap, bestDepth * 0.8));
  const stratum = stratumAt(planet, workDepth);
  const valueMult = stats.oreValueMultiplier;

  if (kind === 'depth') {
    const deepStratum = stratumAt(planet, depthTarget);
    return {
      kind,
      label: `Reach ${depthTarget}m`,
      target: depthTarget,
      reward: niceRound(avgOreValue(deepStratum) * 5 * valueMult),
    };
  }

  if (kind === 'ore') {
    const oreIds = Object.keys(stratum.oreWeights);
    const oreId = oreIds[Math.floor(rand() * oreIds.length)];
    const ore = ORES[oreId];
    const count = 3 + Math.floor(rand() * 4);
    return {
      kind,
      label: `Mine ${count} ${ore.name}`,
      target: count,
      oreId,
      reward: niceRound(ore.value * count * 0.75 * valueMult),
    };
  }

  const haulTarget = niceRound(avgOreValue(stratum) * stats.maxCargo * 0.6 * valueMult);
  return {
    kind,
    label: `Haul $${haulTarget.toLocaleString()}`,
    target: haulTarget,
    reward: niceRound(haulTarget * 0.35),
  };
}

/** Progress toward the target, 0..1. */
export function contractProgress(c: DiveContract, p: ContractProgress): number {
  const value =
    c.kind === 'depth'
      ? p.maxDepthReached
      : c.kind === 'ore'
      ? p.cargoManifest[c.oreId ?? ''] ?? 0
      : p.haulValue;
  return Math.max(0, Math.min(1, value / c.target));
}

export function contractProgressText(c: DiveContract, p: ContractProgress): string {
  if (c.kind === 'depth') return `${Math.min(p.maxDepthReached, c.target)} / ${c.target}m`;
  if (c.kind === 'ore') return `${Math.min(p.cargoManifest[c.oreId ?? ''] ?? 0, c.target)} / ${c.target}`;
  return `$${Math.min(p.haulValue, c.target).toLocaleString()} / $${c.target.toLocaleString()}`;
}
