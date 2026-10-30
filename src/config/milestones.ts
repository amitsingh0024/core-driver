import { PLANETS } from './planets';
import { SKILL_NODES, UPGRADE_TRACKS } from './skillTree';

/**
 * Depth goals. Reaching one for the first time pays a one-off bonus and opens upgrades, so a
 * session always has a named next target. Track and card unlocks are read from the tree.
 */
export interface DepthMilestone {
  planet: number;
  depth: number;
  reward: number;
}

export const DEPTH_MILESTONES: DepthMilestone[] = [
  { planet: 1, depth: 50, reward: 40 },
  { planet: 1, depth: 120, reward: 150 },
  { planet: 1, depth: 200, reward: 400 },
  { planet: 1, depth: 280, reward: 900 },
  { planet: 1, depth: 380, reward: 1600 },
  { planet: 1, depth: 480, reward: 3000 },
  { planet: 1, depth: 680, reward: 6000 },
  { planet: 2, depth: 180, reward: 40_000 },
  { planet: 2, depth: 400, reward: 150_000 },
  { planet: 2, depth: 680, reward: 400_000 },
  { planet: 2, depth: 960, reward: 1_000_000 },
  { planet: 3, depth: 250, reward: 4_000_000 },
  { planet: 3, depth: 580, reward: 12_000_000 },
  { planet: 3, depth: 950, reward: 30_000_000 },
  { planet: 3, depth: 1320, reward: 70_000_000 },
];

/** What reaching a milestone opens, e.g. ["Drill track", "Fuel Injector"]. */
export function milestoneUnlocks(m: DepthMilestone): string[] {
  const out: string[] = [];
  if (m.planet === 1) {
    for (const t of UPGRADE_TRACKS) if (t.opensAtDepth === m.depth) out.push(`${t.name} track`);
  }
  for (const n of SKILL_NODES) {
    if (n.minPlanet === m.planet && n.unlockDepth === m.depth) out.push(n.name);
  }
  return out;
}

/** Milestones passed for the first time when the best depth moves from prevBest to newBest. */
export function milestonesCrossed(planet: number, prevBest: number, newBest: number): DepthMilestone[] {
  return DEPTH_MILESTONES.filter((m) => m.planet === planet && m.depth > prevBest && m.depth <= newBest);
}

export interface NextGoal {
  label: string;
  detail: string;
}

/** The next thing to aim for on this planet: the next depth milestone, else the core. */
export function nextGoal(planet: number, bestDepth: number): NextGoal {
  const m = DEPTH_MILESTONES.find((x) => x.planet === planet && x.depth > bestDepth);
  const cfg = PLANETS[planet - 1];
  if (!m) {
    return { label: `Crack the ${cfg.coreName}`, detail: `at ${cfg.maxDepth} m · $${cfg.coreRewardCash.toLocaleString()} bounty` };
  }
  const unlocks = milestoneUnlocks(m);
  const opens = unlocks.length > 0 ? ` · opens ${unlocks.join(', ')}` : '';
  return { label: `Reach ${m.depth} m`, detail: `+$${m.reward.toLocaleString()}${opens}` };
}
