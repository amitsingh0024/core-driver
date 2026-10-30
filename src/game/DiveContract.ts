import { ORES } from '../config/ores';
import { PlanetConfig, StratumConfig } from '../config/planets';
import { ComputedPlayerStats, SKILL_NODE_MAP, buyableUpgrades } from '../config/skillTree';
import { SaveState } from '../sdk/PortalSDK';

export type ContractKind = 'depth' | 'ore' | 'haul';

/**
 * A work order: one goal at a time that can take several dives. Ore and haul orders bank
 * progress from every dive; depth orders must be met in a single dive. The reward is usually a
 * free level of the upgrade the player is saving for, so orders feed progression directly.
 */
export interface DiveContract {
  kind: ContractKind;
  label: string;
  target: number;
  oreId?: string;
  /** Credits paid on completion (0 when the reward is an upgrade level). */
  reward: number;
  /** A free level of this upgrade on completion. */
  rewardNodeId?: string;
  rewardLabel: string;
  /** Ore delivered or credits hauled on earlier dives. */
  progress: number;
  planet: number;
}

/** No work orders on the first dives, while the player learns to steer and extract. */
export const FIRST_WORK_ORDER_DIVE = 2;

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

/** Picks the reward: a free level of the cheapest upgrade the player can't afford yet. */
function pickReward(save: SaveState, fallbackCredits: number): Pick<DiveContract, 'reward' | 'rewardNodeId' | 'rewardLabel'> {
  const options = buyableUpgrades(save).sort((a, b) => a.cost - b.cost);
  const pick = options.find((o) => o.cost > save.cash) ?? options[0];
  if (pick) {
    const node = SKILL_NODE_MAP[pick.id];
    const lv = (save.ownedSkills[pick.id] ?? 0) + 1;
    return { reward: 0, rewardNodeId: pick.id, rewardLabel: `Free ${node.name} Lv ${lv}` };
  }
  const reward = niceRound(fallbackCredits);
  return { reward, rewardLabel: `+$${reward.toLocaleString()}` };
}

/**
 * Rolls a work order scaled to the player's record on this planet. Ore and haul orders take
 * about two to three dives; depth orders sit a little past the best depth.
 */
export function rollContract(
  planet: PlanetConfig,
  save: SaveState,
  stats: ComputedPlayerStats,
  rand: () => number = Math.random
): DiveContract {
  const bestDepth = save.deepestByPlanet[planet.id] ?? 0;
  const kinds: ContractKind[] = ['depth', 'ore', 'haul'];
  const depthCap = planet.maxDepth - 40;
  const depthTarget = niceRound(Math.min(depthCap, Math.max(60, bestDepth + 30 + rand() * 50)));
  // Once the core is in reach there is no further depth to chase
  const pool = bestDepth >= depthCap ? kinds.filter((k) => k !== 'depth') : kinds;
  const kind = pool[Math.floor(rand() * pool.length)];

  const workDepth = Math.max(20, Math.min(depthCap, bestDepth * 0.8));
  const stratum = stratumAt(planet, workDepth);
  const valueMult = stats.oreValueMultiplier;
  const diveHaul = avgOreValue(stratum) * stats.maxCargo * valueMult;
  const reward = pickReward(save, diveHaul * 1.2);

  if (kind === 'depth') {
    return { kind, label: `Reach ${depthTarget}m`, target: depthTarget, progress: 0, planet: planet.id, ...reward };
  }

  if (kind === 'ore') {
    const oreIds = Object.keys(stratum.oreWeights);
    const oreId = oreIds[Math.floor(rand() * oreIds.length)];
    const ore = ORES[oreId];
    let weight = 0;
    for (const w of Object.values(stratum.oreWeights)) weight += w;
    const share = stratum.oreWeights[oreId] / weight;
    const count = Math.max(4, Math.round(stats.maxCargo * share * (1.2 + rand() * 0.6)));
    return { kind, label: `Deliver ${count} ${ore.name}`, target: count, oreId, progress: 0, planet: planet.id, ...reward };
  }

  const haulTarget = niceRound(diveHaul * (1.2 + rand() * 0.6));
  return {
    kind,
    label: `Sell $${haulTarget.toLocaleString()} of ore`,
    target: haulTarget,
    progress: 0,
    planet: planet.id,
    ...reward,
  };
}

/** The active work order, rolling a new one when there is none for this planet. */
export function currentWorkOrder(save: SaveState, planet: PlanetConfig, stats: ComputedPlayerStats): DiveContract | null {
  if (save.totalDives < FIRST_WORK_ORDER_DIVE) return null;
  if (!save.workOrder || save.workOrder.planet !== planet.id) {
    save.workOrder = rollContract(planet, save, stats);
  }
  return save.workOrder;
}

/** This dive's contribution to the order (before any fuel-out loss). */
function diveValue(c: DiveContract, p: ContractProgress): number {
  if (c.kind === 'depth') return p.maxDepthReached;
  if (c.kind === 'ore') return p.cargoManifest[c.oreId ?? ''] ?? 0;
  return p.haulValue;
}

/** Progress toward the target, 0..1, counting earlier dives. */
export function contractProgress(c: DiveContract, p: ContractProgress): number {
  const value = c.kind === 'depth' ? diveValue(c, p) : c.progress + diveValue(c, p);
  return Math.max(0, Math.min(1, value / c.target));
}

export function contractProgressText(c: DiveContract, p: ContractProgress): string {
  if (c.kind === 'depth') return `${Math.min(p.maxDepthReached, c.target)} / ${c.target}m`;
  const value = Math.min(c.progress + diveValue(c, p), c.target);
  if (c.kind === 'ore') return `${value} / ${c.target}`;
  return `$${value.toLocaleString()} / $${c.target.toLocaleString()}`;
}
