import { ORES } from '../config/ores';
import { PLANETS, PlanetConfig } from '../config/planets';
import { ComputedPlayerStats } from '../config/skillTree';
import { SaveState } from '../sdk/PortalSDK';
import { DiveEndReason } from './DrillPod';
import { DiveContract } from './DiveContract';

export interface BonusRow {
  label: string;
  amount: number;
  color: string;
}

export interface ManifestRow {
  oreId: string;
  name: string;
  color: string;
  kept: number;
  lost: number;
  unitVal: number;
  subtotal: number;
}

export interface DivePayout {
  reason: DiveEndReason;
  keepRatio: number;
  rows: ManifestRow[];
  oreUnitsKept: number;
  coreBonus: number;
  bonuses: BonusRow[];
  contract: DiveContract | null;
  contractCompleted: boolean;
  unlockedNextPlanet: boolean;
  isNewBestDepth: boolean;
  maxDepth: number;
  totalEarned: number;
}

export interface DiveOutcome {
  reason: DiveEndReason;
  cargoManifest: Record<string, number>;
  maxDepthReached: number;
  comboBonusCredits?: number;
  relicCredits?: number;
  relicsFound?: number;
  contract?: DiveContract | null;
  /** Depth and ore contracts are locked in the moment they are met during the dive. */
  contractMetDuringDive?: boolean;
}

/**
 * Settles a finished dive: applies the fuel-out cargo loss, prices the ore, awards the core
 * bounty, and writes the results into the save. Pure apart from mutating `save`.
 */
export function settleDive(
  outcome: DiveOutcome,
  planet: PlanetConfig,
  stats: ComputedPlayerStats,
  save: SaveState
): DivePayout {
  save.totalDives++;

  const prevBest = save.deepestByPlanet[planet.id] ?? 0;
  const isNewBestDepth = outcome.maxDepthReached > prevBest;
  if (isNewBestDepth) save.deepestByPlanet[planet.id] = outcome.maxDepthReached;

  const reason = outcome.reason;
  const keepRatio = reason === 'fuel_out' ? stats.crashCargoKeepRatio : 1.0;

  const rows: ManifestRow[] = [];
  let oreValue = 0;
  let oreUnitsKept = 0;
  for (const [oreId, count] of Object.entries(outcome.cargoManifest)) {
    const ore = ORES[oreId];
    if (!ore || count <= 0) continue;
    const kept = reason === 'fuel_out' ? Math.max(1, Math.floor(count * keepRatio)) : count;
    const unitVal = Math.round(ore.value * stats.oreValueMultiplier);
    const subtotal = kept * unitVal;
    oreUnitsKept += kept;
    oreValue += subtotal;
    save.totalOresMined[oreId] = (save.totalOresMined[oreId] ?? 0) + kept;
    rows.push({ oreId, name: ore.name, color: ore.highlightColor, kept, lost: count - kept, unitVal, subtotal });
  }

  let coreBonus = 0;
  let unlockedNextPlanet = false;
  if (reason === 'core_shattered') {
    coreBonus = planet.coreRewardCash;
    if (planet.id >= save.highestUnlockedPlanet && planet.id < PLANETS.length) {
      save.highestUnlockedPlanet = planet.id + 1;
      unlockedNextPlanet = true;
    }
  }

  const bonuses: BonusRow[] = [];
  const comboKept = Math.round((outcome.comboBonusCredits ?? 0) * keepRatio);
  if (comboKept > 0) bonuses.push({ label: 'Same-ore combo bonus', amount: comboKept, color: '#ffab40' });

  const relicCredits = outcome.relicCredits ?? 0;
  if (relicCredits > 0) {
    const n = outcome.relicsFound ?? 1;
    bonuses.push({ label: `Relic cache${n > 1 ? `s ×${n}` : ''} (banked)`, amount: relicCredits, color: '#ffd54f' });
  }

  const contract = outcome.contract ?? null;
  let contractCompleted = false;
  if (contract) {
    contractCompleted =
      contract.kind === 'haul' ? oreValue + comboKept >= contract.target : !!outcome.contractMetDuringDive;
    if (contractCompleted) {
      bonuses.push({ label: `Contract: ${contract.label}`, amount: contract.reward, color: '#69f0ae' });
    }
  }

  if (coreBonus > 0) bonuses.push({ label: `${planet.coreName} Bounty`, amount: coreBonus, color: '#ffd54f' });

  const totalEarned = oreValue + bonuses.reduce((sum, b) => sum + b.amount, 0);
  save.cash += totalEarned;

  return {
    reason,
    keepRatio,
    rows,
    oreUnitsKept,
    coreBonus,
    bonuses,
    contract,
    contractCompleted,
    unlockedNextPlanet,
    isNewBestDepth,
    maxDepth: outcome.maxDepthReached,
    totalEarned,
  };
}
