import { SKILL_NODE_MAP } from './skillTree';
import { SaveState } from '../sdk/PortalSDK';

/** Base cost and cost growth of every upgrade in the old Deep Grid, for refunds. */
const LEGACY_COSTS: Record<string, [number, number]> = {
  drill_torque_1: [18, 1.65],
  fuel_tank_1: [18, 1.6],
  cargo_rack_1: [16, 1.6],
  thruster_1: [20, 1.65],
  twin_bore_1: [95, 2.1],
  carbide_teeth: [75, 1.75],
  rock_crusher_1: [130, 1.9],
  fuel_injector_1: [70, 1.75],
  cell_harvester_1: [110, 1.85],
  smelter_1: [85, 1.8],
  deep_cargo_1: [90, 1.75],
  vein_splitter_1: [180, 2.0],
  winch_spool_1: [65, 1.75],
  deep_radar_1: [80, 1.8],
  drone_bay_1: [320, 1],
  core_breaker_1: [260, 2.0],
  cryo_heater_1: [1400, 1.9],
  diamond_auger_1: [1800, 1.85],
  glacier_bore_2: [3600, 2.1],
  cryo_tank_2: [1600, 1.8],
  superconductor_lube: [2800, 1.9],
  plasma_refinery_2: [1900, 1.85],
  quantum_cargo_2: [1700, 1.8],
  deep_radar_2: [1650, 1.85],
  drone_bay_2: [6500, 1],
  core_breaker_2: [5200, 2.0],
  void_cooling_3: [48000, 1.95],
  singularity_drill_3: [60000, 1.9],
  titan_excavator_3: [140000, 2.1],
  reactor_tank_3: [55000, 1.85],
  matter_transmuter_3: [65000, 1.9],
  drone_swarm_3: [220000, 1],
  omega_core_breaker: [250000, 2.1],
};

/**
 * Saves from before the four-track rework own Deep Grid nodes that no longer exist. Refunds
 * every credit spent on them and drops them, keeping planets, depths and cash. Returns the refund.
 */
export function refundLegacyUpgrades(save: SaveState): number {
  let refund = 0;
  for (const [id, level] of Object.entries(save.ownedSkills)) {
    const cost = LEGACY_COSTS[id];
    if (!cost || SKILL_NODE_MAP[id]) continue;
    for (let lv = 0; lv < level; lv++) refund += Math.round(cost[0] * Math.pow(cost[1], lv));
    delete save.ownedSkills[id];
  }
  save.cash += refund;
  return refund;
}
