import {
  SKILL_NODES,
  SkillNodeConfig,
  ComputedPlayerStats,
  computePlayerStats,
  evaluateSkillNode,
} from '../../config/skillTree';
import { SaveState } from '../../sdk/PortalSDK';

/**
 * Small read-outs that help a new player pick an upgrade. Kept apart from the tree
 * view so they only depend on the node list, its evaluation and computePlayerStats.
 */

type StatKey = keyof ComputedPlayerStats;

/** Stats worth showing a player, with how to print them. Visual-only fields are left out. */
const STAT_LABELS: Partial<Record<StatKey, { label: string; fmt: (v: number) => string }>> = {
  drillPower: { label: 'Drill Power', fmt: (v) => `${Math.round(v)}` },
  drillRadiusPx: { label: 'Bore Width', fmt: (v) => `${Math.round(v * 2)}px` },
  hardnessPenetration: { label: 'Hard Rock Pierce', fmt: (v) => `${Math.round(v * 100)}%` },
  coreDamageMultiplier: { label: 'Core Damage', fmt: (v) => `×${v.toFixed(2)}` },
  maxFuel: { label: 'Fuel Tank', fmt: (v) => `${Math.round(v)}` },
  fuelBurnMultiplier: { label: 'Fuel Burn', fmt: (v) => `${Math.round(v * 100)}%` },
  fuelCellRestorePct: { label: 'Fuel Cell Refill', fmt: (v) => `${Math.round(v)}%` },
  cryoHazardReduction: { label: 'Frost Shield', fmt: (v) => `${Math.round(v * 100)}%` },
  voidHazardReduction: { label: 'Heat Shield', fmt: (v) => `${Math.round(v * 100)}%` },
  maxCargo: { label: 'Cargo Hold', fmt: (v) => `${Math.round(v)}` },
  oreValueMultiplier: { label: 'Ore Value', fmt: (v) => `×${v.toFixed(2)}` },
  doubleOreChance: { label: 'Double Ore', fmt: (v) => `${Math.round(v * 100)}%` },
  moveSpeed: { label: 'Speed', fmt: (v) => `${Math.round(v)}` },
  turnSpeedRad: { label: 'Steering', fmt: (v) => `${v.toFixed(1)}` },
  winchHoldSeconds: { label: 'Winch Time', fmt: (v) => `${v.toFixed(1)}s` },
  crashCargoKeepRatio: { label: 'Cargo Kept on Tow', fmt: (v) => `${Math.round(v * 100)}%` },
  scannerRangeTiles: { label: 'Scanner Range', fmt: (v) => `${Math.round(v)}` },
  droneCount: { label: 'Drones', fmt: (v) => `${Math.round(v)}` },
  droneDps: { label: 'Drone Damage', fmt: (v) => `${Math.round(v)}` },
};

export interface StatChange {
  label: string;
  from: string;
  to: string;
}

/** What buying the next level of `node` would change, as printable before/after pairs. */
export function nextLevelChanges(node: SkillNodeConfig, owned: Record<string, number>): StatChange[] {
  const now = computePlayerStats(owned);
  const next = computePlayerStats({ ...owned, [node.id]: (owned[node.id] ?? 0) + 1 });
  const changes: StatChange[] = [];
  for (const key of Object.keys(STAT_LABELS) as StatKey[]) {
    const meta = STAT_LABELS[key]!;
    // Drone damage scales with drill power, but means nothing until a drone is fitted
    if (key === 'droneDps' && next.droneCount === 0) continue;
    const a = now[key] as number;
    const b = next[key] as number;
    const from = meta.fmt(a);
    const to = meta.fmt(b);
    if (from !== to) changes.push({ label: meta.label, from, to });
  }
  return changes;
}

/** Price of the cheapest upgrade the player could buy right now if they had the cash. */
export function cheapestAvailableCost(save: SaveState): number {
  let best = Infinity;
  for (const node of SKILL_NODES) {
    const ev = evaluateSkillNode(node, save.ownedSkills, save.highestUnlockedPlanet, save.cash);
    if (ev.state === 'AVAILABLE') best = Math.min(best, ev.nextCost);
  }
  return best;
}
