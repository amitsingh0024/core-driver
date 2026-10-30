export type SkillBranch = 'core' | 'drill' | 'fuel' | 'cargo' | 'utility' | 'drone';

export type SkillIconType =
  | 'pod'
  | 'drill_dps'
  | 'drill_width'
  | 'hardness_pen'
  | 'core_damage'
  | 'fuel_cap'
  | 'fuel_eff'
  | 'fuel_cell'
  | 'hazard_shield'
  | 'cargo_cap'
  | 'ore_value'
  | 'double_ore'
  | 'thruster'
  | 'winch'
  | 'scanner'
  | 'drone';

export interface SkillEffects {
  drillPowerPct?: number;       // additive % within tier or multiplicative
  drillPowerMult?: number;      // multiplicative boost per level
  drillWidthPx?: number;        // extra drill radius in pixels per level
  hardnessPenetration?: number; // 0..1 reduction in hard-rock speed penalty
  coreDamagePct?: number;       // +% damage against Planet Core tiles
  maxFuelFlat?: number;         // +flat fuel per level
  maxFuelPct?: number;          // +% max fuel per level
  fuelBurnReduction?: number;   // reduces passive & rock fuel burn per level
  fuelCellBonusPct?: number;    // +% fuel restored by cells
  cryoShieldPct?: number;       // reduces Planet 2 cryo fuel penalty (up to 100%)
  voidShieldPct?: number;       // reduces Planet 3 void fuel penalty (up to 100%)
  cargoCapFlat?: number;        // +flat cargo capacity per level
  oreValuePct?: number;         // +% ore sell price at refinery
  doubleOreChance?: number;     // 0..1 chance to get 2x ore per block
  moveSpeedPct?: number;        // +% dive speed & steering response
  winchSpeedPct?: number;       // +% faster Hold-to-Extract winch
  crashSavePct?: number;        // +% cargo saved when fuel hits 0 (base is 50%)
  scannerRangeTiles?: number;   // extra radar detection range for fuel/gems
  droneCount?: number;          // +autonomous mining drones
  dronePowerPct?: number;       // +% drone mining laser DPS
}

export interface SkillNodeConfig {
  id: string;
  name: string;
  branch: SkillBranch;
  icon: SkillIconType;
  gx: number; // grid X coordinate on the tree canvas
  gy: number; // grid Y coordinate on the tree canvas
  maxLevel: number;
  baseCost: number;
  costScale: number;
  minPlanet: number; // 1, 2, or 3 (Stage Lock!)
  // Node is revealed on the map as soon as ANY node in revealFrom has level >= 1
  revealFrom: string[];
  // Lock Condition 1: Single specific skill level requirement
  requiresSkill?: { nodeId: string; minLevel: number };
  // Lock Condition 2: Must own ALL listed nodes (level >= 1) before buying (e.g. "Buy these 3 nodes first")
  requiresNodesAll?: string[];
  // Lock Condition 3: Must own at least N nodes from a group
  requiresNodesCount?: { nodeIds: string[]; count: number; label: string };
  description: string;
  effectsPerLevel: SkillEffects;
}

export const SKILL_NODES: SkillNodeConfig[] = [
  // ==========================================
  // CENTER ROOT NODE
  // ==========================================
  {
    id: 'starter_pod',
    name: 'MK-I Pioneer Drill Rig',
    branch: 'core',
    icon: 'pod',
    gx: 0,
    gy: 0,
    maxLevel: 1,
    baseCost: 0,
    costScale: 1,
    minPlanet: 1,
    revealFrom: [],
    description: 'Standard-issue planetary core excavation pod. Upgrade connected nodes to uncover the Deep Grid.',
    effectsPerLevel: {},
  },

  // ==========================================
  // PLANET 1: TERRA-VEIN — INNER RING (4 NODES)
  // ==========================================
  {
    id: 'drill_torque_1',
    name: 'Drill Torque I',
    branch: 'drill',
    icon: 'drill_dps',
    gx: 0,
    gy: -1,
    maxLevel: 5,
    baseCost: 18,
    costScale: 1.65,
    minPlanet: 1,
    revealFrom: ['starter_pod'],
    description: 'Increases rotational drill bit torque. +45% Drill Power per level.',
    effectsPerLevel: { drillPowerPct: 45 },
  },
  {
    id: 'fuel_tank_1',
    name: 'Aux Fuel Tank I',
    branch: 'fuel',
    icon: 'fuel_cap',
    gx: 1,
    gy: 0,
    maxLevel: 5,
    baseCost: 18,
    costScale: 1.6,
    minPlanet: 1,
    revealFrom: ['starter_pod'],
    description: 'Bolts reserve fuel canisters onto the hull. +35 Max Fuel per level.',
    effectsPerLevel: { maxFuelFlat: 35 },
  },
  {
    id: 'cargo_rack_1',
    name: 'Cargo Bay I',
    branch: 'cargo',
    icon: 'cargo_cap',
    gx: 0,
    gy: 1,
    maxLevel: 5,
    baseCost: 16,
    costScale: 1.6,
    minPlanet: 1,
    revealFrom: ['starter_pod'],
    description: 'Expands the internal ore hopper. +8 Cargo Capacity per level.',
    effectsPerLevel: { cargoCapFlat: 8 },
  },
  {
    id: 'thruster_1',
    name: 'Vector Thrusters I',
    branch: 'utility',
    icon: 'thruster',
    gx: -1,
    gy: 0,
    maxLevel: 4,
    baseCost: 20,
    costScale: 1.65,
    minPlanet: 1,
    revealFrom: ['starter_pod'],
    description: 'Sharpens continuous steering angle response and downward thrust. +15% Speed & Agility per level.',
    effectsPerLevel: { moveSpeedPct: 15 },
  },

  // ==========================================
  // PLANET 1: MID-RING & MULTI-NODE GATES
  // ==========================================
  {
    id: 'twin_bore_1',
    name: 'Twin-Bore Excavator',
    branch: 'drill',
    icon: 'drill_width',
    gx: 1,
    gy: -1,
    maxLevel: 3,
    baseCost: 95,
    costScale: 2.1,
    minPlanet: 1,
    revealFrom: ['drill_torque_1', 'fuel_tank_1'],
    requiresNodesAll: ['drill_torque_1', 'fuel_tank_1', 'thruster_1'],
    description: 'Widens the physical drill head to chew through multiple rock columns at once! +4px Drill Radius & +30% Drill Power per level.',
    effectsPerLevel: { drillWidthPx: 4, drillPowerPct: 30 },
  },
  {
    id: 'carbide_teeth',
    name: 'Carbide Drill Teeth',
    branch: 'drill',
    icon: 'drill_dps',
    gx: 0,
    gy: -2,
    maxLevel: 5,
    baseCost: 75,
    costScale: 1.75,
    minPlanet: 1,
    revealFrom: ['drill_torque_1'],
    requiresSkill: { nodeId: 'drill_torque_1', minLevel: 2 },
    description: 'Tungsten-carbide serrated cones shred sandstone and granite. +75% Drill Power per level.',
    effectsPerLevel: { drillPowerPct: 75 },
  },
  {
    id: 'rock_crusher_1',
    name: 'Hardness Penetrator I',
    branch: 'drill',
    icon: 'hardness_pen',
    gx: -1,
    gy: -2,
    maxLevel: 3,
    baseCost: 130,
    costScale: 1.9,
    minPlanet: 1,
    revealFrom: ['carbide_teeth', 'thruster_1'],
    requiresSkill: { nodeId: 'carbide_teeth', minLevel: 2 },
    description: 'Ultrasonic micro-vibrations prevent hard rock from slowing down your drill pod. +18% Hardness Penetration per level.',
    effectsPerLevel: { hardnessPenetration: 0.18, drillPowerPct: 25 },
  },
  {
    id: 'fuel_injector_1',
    name: 'Fuel Injector I',
    branch: 'fuel',
    icon: 'fuel_eff',
    gx: 2,
    gy: 0,
    maxLevel: 4,
    baseCost: 70,
    costScale: 1.75,
    minPlanet: 1,
    revealFrom: ['fuel_tank_1'],
    requiresSkill: { nodeId: 'fuel_tank_1', minLevel: 2 },
    description: 'Optimizes fuel-air mixture under pressure. Reduces all fuel consumption by 9% per level.',
    effectsPerLevel: { fuelBurnReduction: 0.09 },
  },
  {
    id: 'cell_harvester_1',
    name: 'Fuel Cell Siphon I',
    branch: 'fuel',
    icon: 'fuel_cell',
    gx: 2,
    gy: -1,
    maxLevel: 3,
    baseCost: 110,
    costScale: 1.85,
    minPlanet: 1,
    revealFrom: ['fuel_injector_1', 'twin_bore_1'],
    description: 'Extracts every drop from subterranean Fuel Cells. +20% Fuel restored per cell & +20 Max Fuel per level.',
    effectsPerLevel: { fuelCellBonusPct: 20, maxFuelFlat: 20 },
  },
  {
    id: 'smelter_1',
    name: 'Onboard Refinery I',
    branch: 'cargo',
    icon: 'ore_value',
    gx: 1,
    gy: 1,
    maxLevel: 5,
    baseCost: 85,
    costScale: 1.8,
    minPlanet: 1,
    revealFrom: ['cargo_rack_1', 'fuel_tank_1'],
    requiresNodesAll: ['drill_torque_1', 'fuel_tank_1', 'cargo_rack_1'],
    description: 'Purifies raw ore during extraction. +30% Sell Value for all ores per level.',
    effectsPerLevel: { oreValuePct: 30 },
  },
  {
    id: 'deep_cargo_1',
    name: 'Reinforced Hopper II',
    branch: 'cargo',
    icon: 'cargo_cap',
    gx: 0,
    gy: 2,
    maxLevel: 4,
    baseCost: 90,
    costScale: 1.75,
    minPlanet: 1,
    revealFrom: ['cargo_rack_1'],
    requiresSkill: { nodeId: 'cargo_rack_1', minLevel: 2 },
    description: 'Hydraulic ore compaction bay. +14 Cargo Capacity per level.',
    effectsPerLevel: { cargoCapFlat: 14 },
  },
  {
    id: 'vein_splitter_1',
    name: 'Harmonic Vein Splitter',
    branch: 'cargo',
    icon: 'double_ore',
    gx: 1,
    gy: 2,
    maxLevel: 3,
    baseCost: 180,
    costScale: 2.0,
    minPlanet: 1,
    revealFrom: ['smelter_1', 'deep_cargo_1'],
    requiresSkill: { nodeId: 'smelter_1', minLevel: 2 },
    description: 'Splits mineral seams cleanly without waste. +14% chance per level for any mined ore block to yield 2× Ore!',
    effectsPerLevel: { doubleOreChance: 0.14 },
  },
  {
    id: 'winch_spool_1',
    name: 'Rapid Winch & Blackbox',
    branch: 'utility',
    icon: 'winch',
    gx: -1,
    gy: 1,
    maxLevel: 3,
    baseCost: 65,
    costScale: 1.75,
    minPlanet: 1,
    revealFrom: ['thruster_1', 'cargo_rack_1'],
    description: 'Speeds up Hold-to-Extract winch by +25% per level and saves +10% more cargo if Fuel hits 0.',
    effectsPerLevel: { winchSpeedPct: 25, crashSavePct: 10 },
  },
  {
    id: 'deep_radar_1',
    name: 'Seismic Vein Scanner I',
    branch: 'utility',
    icon: 'scanner',
    gx: -2,
    gy: 0,
    maxLevel: 3,
    baseCost: 80,
    costScale: 1.8,
    minPlanet: 1,
    revealFrom: ['thruster_1'],
    description: 'Displays HUD directional indicators pointing to nearby Fuel Cells and high-value ore pockets.',
    effectsPerLevel: { scannerRangeTiles: 5 },
  },
  {
    id: 'drone_bay_1',
    name: 'Autonomous Laser Drone I',
    branch: 'drone',
    icon: 'drone',
    gx: -1,
    gy: 2,
    maxLevel: 1,
    baseCost: 320,
    costScale: 1,
    minPlanet: 1,
    revealFrom: ['winch_spool_1', 'deep_cargo_1', 'deep_radar_1'],
    requiresNodesAll: ['winch_spool_1', 'deep_cargo_1', 'deep_radar_1'],
    description: 'Deploys an autonomous orbiting laser drone that automatically mines adjacent rock and ore tiles alongside your pod!',
    effectsPerLevel: { droneCount: 1 },
  },
  {
    id: 'core_breaker_1',
    name: 'Core-Breaker Resonance I',
    branch: 'drill',
    icon: 'core_damage',
    gx: 0,
    gy: -3,
    maxLevel: 3,
    baseCost: 260,
    costScale: 2.0,
    minPlanet: 1,
    revealFrom: ['carbide_teeth', 'twin_bore_1', 'rock_crusher_1'],
    requiresSkill: { nodeId: 'carbide_teeth', minLevel: 3 },
    description: 'Tunes drill frequency to shatter dense planetary cores. +85% Core Damage & +50% Drill Power per level.',
    effectsPerLevel: { coreDamagePct: 85, drillPowerPct: 50 },
  },

  // ==========================================
  // PLANET 2: CRYO-VEX — STAGE-LOCKED TIER (minPlanet: 2)
  // ==========================================
  {
    id: 'cryo_heater_1',
    name: 'Thermal Core Heater',
    branch: 'fuel',
    icon: 'hazard_shield',
    gx: 2,
    gy: -2,
    maxLevel: 3,
    baseCost: 1400,
    costScale: 1.9,
    minPlanet: 2,
    revealFrom: ['cell_harvester_1', 'twin_bore_1', 'core_breaker_1'],
    description: 'Insulates fuel lines against Cryo-Vex sub-zero temperatures. Neutralizes 35% of Cryo-Chill fuel drain & +110 Max Fuel per level.',
    effectsPerLevel: { cryoShieldPct: 35, maxFuelFlat: 110 },
  },
  {
    id: 'diamond_auger_1',
    name: 'Cryo-Diamond Auger',
    branch: 'drill',
    icon: 'drill_dps',
    gx: 0,
    gy: -4,
    maxLevel: 5,
    baseCost: 1800,
    costScale: 1.85,
    minPlanet: 2,
    revealFrom: ['core_breaker_1'],
    description: 'Industrial diamond cutter built for glacial quartzite and cryo-glass. ×1.55 Multiplicative Drill Power per level!',
    effectsPerLevel: { drillPowerMult: 1.55, drillPowerPct: 120 },
  },
  {
    id: 'glacier_bore_2',
    name: 'Tri-Cone Glacier Bore',
    branch: 'drill',
    icon: 'drill_width',
    gx: 1,
    gy: -3,
    maxLevel: 3,
    baseCost: 3600,
    costScale: 2.1,
    minPlanet: 2,
    revealFrom: ['twin_bore_1', 'core_breaker_1', 'diamond_auger_1'],
    requiresNodesAll: ['twin_bore_1', 'diamond_auger_1', 'cryo_heater_1'],
    description: 'Massive 3-cone rotary head that carves wide caverns through permafrost. +4px Drill Radius & ×1.35 Drill Power per level.',
    effectsPerLevel: { drillWidthPx: 4, drillPowerMult: 1.35 },
  },
  {
    id: 'cryo_tank_2',
    name: 'Cryo-Compressed Fuel Cell',
    branch: 'fuel',
    icon: 'fuel_cap',
    gx: 3,
    gy: 0,
    maxLevel: 5,
    baseCost: 1600,
    costScale: 1.8,
    minPlanet: 2,
    revealFrom: ['fuel_injector_1', 'cell_harvester_1'],
    description: 'Stores liquid hydrogen at cryogenic density. +140 Max Fuel & +12% Max Fuel Multiplier per level.',
    effectsPerLevel: { maxFuelFlat: 140, maxFuelPct: 12 },
  },
  {
    id: 'superconductor_lube',
    name: 'Zero-K Friction Shield',
    branch: 'fuel',
    icon: 'fuel_eff',
    gx: 3,
    gy: -1,
    maxLevel: 4,
    baseCost: 2800,
    costScale: 1.9,
    minPlanet: 2,
    revealFrom: ['cryo_tank_2', 'cell_harvester_1'],
    requiresSkill: { nodeId: 'cryo_tank_2', minLevel: 2 },
    description: 'Magnetic bearing suspension cuts rock-drilling fuel burn by 14% per level.',
    effectsPerLevel: { fuelBurnReduction: 0.14, hardnessPenetration: 0.12 },
  },
  {
    id: 'plasma_refinery_2',
    name: 'Cryo-Crystal Refinery',
    branch: 'cargo',
    icon: 'ore_value',
    gx: 2,
    gy: 1,
    maxLevel: 5,
    baseCost: 1900,
    costScale: 1.85,
    minPlanet: 2,
    revealFrom: ['smelter_1', 'fuel_injector_1', 'vein_splitter_1'],
    description: 'Laser-cuts raw gems before surfacing. +65% Ore Sell Value per level.',
    effectsPerLevel: { oreValuePct: 65 },
  },
  {
    id: 'quantum_cargo_2',
    name: 'Sub-Zero Cargo Matrix',
    branch: 'cargo',
    icon: 'cargo_cap',
    gx: 0,
    gy: 3,
    maxLevel: 5,
    baseCost: 1700,
    costScale: 1.8,
    minPlanet: 2,
    revealFrom: ['deep_cargo_1', 'vein_splitter_1', 'drone_bay_1'],
    description: 'High-density magnetic ore stacking bay. +28 Cargo Capacity per level.',
    effectsPerLevel: { cargoCapFlat: 28 },
  },
  {
    id: 'deep_radar_2',
    name: 'Sub-Glacial Deep Sonar',
    branch: 'utility',
    icon: 'scanner',
    gx: -3,
    gy: 0,
    maxLevel: 3,
    baseCost: 1650,
    costScale: 1.85,
    minPlanet: 2,
    revealFrom: ['deep_radar_1', 'winch_spool_1'],
    description: 'Long-range ice-penetrating radar & high-output thrusters. +6 Radar Range & +15% Dive Speed per level.',
    effectsPerLevel: { scannerRangeTiles: 6, moveSpeedPct: 15 },
  },
  {
    id: 'drone_bay_2',
    name: 'Twin Cryo-Laser Drones',
    branch: 'drone',
    icon: 'drone',
    gx: -1,
    gy: 3,
    maxLevel: 1,
    baseCost: 6500,
    costScale: 1,
    minPlanet: 2,
    revealFrom: ['drone_bay_1', 'quantum_cargo_2'],
    requiresNodesAll: ['drone_bay_1', 'quantum_cargo_2', 'deep_radar_2'],
    description: 'Launches a 2nd autonomous mining drone and increases all drone laser damage by +100%!',
    effectsPerLevel: { droneCount: 1, dronePowerPct: 100 },
  },
  {
    id: 'core_breaker_2',
    name: 'Harmonic Core Shatterer',
    branch: 'drill',
    icon: 'core_damage',
    gx: -1,
    gy: -4,
    maxLevel: 3,
    baseCost: 5200,
    costScale: 2.0,
    minPlanet: 2,
    revealFrom: ['diamond_auger_1', 'rock_crusher_1', 'core_breaker_1'],
    requiresSkill: { nodeId: 'diamond_auger_1', minLevel: 2 },
    description: 'Resonates with crystalline cores. +140% Core Damage & ×1.35 Drill Power per level.',
    effectsPerLevel: { coreDamagePct: 140, drillPowerMult: 1.35 },
  },

  // ==========================================
  // PLANET 3: PYRA-VOID — STAGE-LOCKED TIER (minPlanet: 3)
  // ==========================================
  {
    id: 'void_cooling_3',
    name: 'Void-Plasma Cooling Jacket',
    branch: 'fuel',
    icon: 'hazard_shield',
    gx: 3,
    gy: -2,
    maxLevel: 3,
    baseCost: 48000,
    costScale: 1.95,
    minPlanet: 3,
    revealFrom: ['cryo_heater_1', 'superconductor_lube', 'glacier_bore_2'],
    description: 'Shields the pod against Pyra-Void gravity & plasma vents. Neutralizes 35% of Void-Heat fuel drain & +450 Max Fuel per level.',
    effectsPerLevel: { voidShieldPct: 35, maxFuelFlat: 450 },
  },
  {
    id: 'singularity_drill_3',
    name: 'Singularity Lance Drill',
    branch: 'drill',
    icon: 'drill_dps',
    gx: 0,
    gy: -5,
    maxLevel: 5,
    baseCost: 60000,
    costScale: 1.9,
    minPlanet: 3,
    revealFrom: ['diamond_auger_1', 'core_breaker_2', 'glacier_bore_2'],
    description: 'Projects a focused micro-singularity beam at the drill tip. ×1.75 Multiplicative Drill Power per level!',
    effectsPerLevel: { drillPowerMult: 1.75 },
  },
  {
    id: 'titan_excavator_3',
    name: 'Planet-Eater Wide Bore',
    branch: 'drill',
    icon: 'drill_width',
    gx: 1,
    gy: -5,
    maxLevel: 3,
    baseCost: 140000,
    costScale: 2.1,
    minPlanet: 3,
    revealFrom: ['glacier_bore_2', 'singularity_drill_3'],
    requiresNodesAll: ['glacier_bore_2', 'singularity_drill_3', 'void_cooling_3'],
    description: 'Engulfs entire ore veins in a single pass. +5px Drill Radius & ×1.5 Drill Power per level.',
    effectsPerLevel: { drillWidthPx: 5, drillPowerMult: 1.5 },
  },
  {
    id: 'reactor_tank_3',
    name: 'Micro-Fusion Fuel Core',
    branch: 'fuel',
    icon: 'fuel_cap',
    gx: 4,
    gy: 0,
    maxLevel: 5,
    baseCost: 55000,
    costScale: 1.85,
    minPlanet: 3,
    revealFrom: ['cryo_tank_2', 'superconductor_lube'],
    description: 'Tokamak fusion cell providing massive endurance. +500 Max Fuel & +20% Max Fuel Multiplier per level.',
    effectsPerLevel: { maxFuelFlat: 500, maxFuelPct: 20 },
  },
  {
    id: 'matter_transmuter_3',
    name: 'Singularity Ore Transmuter',
    branch: 'cargo',
    icon: 'ore_value',
    gx: 3,
    gy: 1,
    maxLevel: 5,
    baseCost: 65000,
    costScale: 1.9,
    minPlanet: 3,
    revealFrom: ['plasma_refinery_2', 'cryo_tank_2'],
    description: 'Enriches exotic matter at the atomic level. +120% Ore Sell Value & +8% Double-Ore Chance per level.',
    effectsPerLevel: { oreValuePct: 120, doubleOreChance: 0.08 },
  },
  {
    id: 'drone_swarm_3',
    name: 'Void Drone Squadron (3×)',
    branch: 'drone',
    icon: 'drone',
    gx: -1,
    gy: 4,
    maxLevel: 1,
    baseCost: 220000,
    costScale: 1,
    minPlanet: 3,
    revealFrom: ['drone_bay_2', 'quantum_cargo_2'],
    requiresNodesAll: ['drone_bay_2', 'matter_transmuter_3'],
    description: 'Completes the 3-drone orbital mining squadron and triples drone beam output!',
    effectsPerLevel: { droneCount: 1, dronePowerPct: 150 },
  },
  {
    id: 'omega_core_breaker',
    name: 'Omega Core Annihilator',
    branch: 'drill',
    icon: 'core_damage',
    gx: 0,
    gy: -6,
    maxLevel: 3,
    baseCost: 250000,
    costScale: 2.1,
    minPlanet: 3,
    revealFrom: ['singularity_drill_3', 'core_breaker_2', 'titan_excavator_3'],
    requiresSkill: { nodeId: 'singularity_drill_3', minLevel: 2 },
    description: 'Ultimate core-cracking resonance. +250% Core Damage & ×1.65 Drill Power per level.',
    effectsPerLevel: { coreDamagePct: 250, drillPowerMult: 1.65 },
  },
];

export const SKILL_NODE_MAP: Record<string, SkillNodeConfig> = Object.fromEntries(
  SKILL_NODES.map((n) => [n.id, n])
);

export type NodeVisibilityState = 'HIDDEN' | 'LOCKED_VISIBLE' | 'AVAILABLE' | 'MAXED';

export interface NodeEvaluation {
  state: NodeVisibilityState;
  level: number;
  maxLevel: number;
  nextCost: number;
  canAfford: boolean;
  lockReasons: string[];
}

export function getNodeNextCost(node: SkillNodeConfig, currentLevel: number): number {
  if (currentLevel >= node.maxLevel) return 0;
  return Math.round(node.baseCost * Math.pow(node.costScale, currentLevel));
}

export function evaluateSkillNode(
  node: SkillNodeConfig,
  ownedLevels: Record<string, number>,
  highestUnlockedPlanet: number,
  currentCash: number
): NodeEvaluation {
  const level = ownedLevels[node.id] ?? 0;
  const nextCost = getNodeNextCost(node, level);

  // Root node is always owned
  if (node.id === 'starter_pod') {
    return {
      state: 'MAXED',
      level: 1,
      maxLevel: 1,
      nextCost: 0,
      canAfford: true,
      lockReasons: [],
    };
  }

  // Check if revealed: must own at least one node in revealFrom (or already have level > 0)
  const isRevealed =
    level > 0 ||
    node.revealFrom.some((parentId) => (ownedLevels[parentId] ?? 0) >= 1);

  if (!isRevealed) {
    return {
      state: 'HIDDEN',
      level,
      maxLevel: node.maxLevel,
      nextCost,
      canAfford: false,
      lockReasons: ['Buy a connected node first to reveal'],
    };
  }

  if (level >= node.maxLevel) {
    return {
      state: 'MAXED',
      level,
      maxLevel: node.maxLevel,
      nextCost: 0,
      canAfford: false,
      lockReasons: [],
    };
  }

  const lockReasons: string[] = [];

  // 1. Stage / Planet lock
  if (highestUnlockedPlanet < node.minPlanet) {
    const planetNames: Record<number, string> = {
      1: 'Planet 1 (Terra-Vein)',
      2: 'Planet 2 (Cryo-Vex)',
      3: 'Planet 3 (Pyra-Void)',
    };
    lockReasons.push(`Stage Locked: Unlock ${planetNames[node.minPlanet]} first`);
  }

  // 2. Single Skill Level Prerequisite
  if (node.requiresSkill) {
    const reqNode = SKILL_NODE_MAP[node.requiresSkill.nodeId];
    const haveLv = ownedLevels[node.requiresSkill.nodeId] ?? 0;
    if (haveLv < node.requiresSkill.minLevel) {
      lockReasons.push(
        `Requires ${reqNode?.name ?? node.requiresSkill.nodeId} Lv ${node.requiresSkill.minLevel} (${haveLv}/${node.requiresSkill.minLevel})`
      );
    }
  }

  // 3. Multi-Node Prerequisite ("Buy these 3 nodes first")
  if (node.requiresNodesAll && node.requiresNodesAll.length > 0) {
    const missingNames: string[] = [];
    let ownedCount = 0;
    for (const reqId of node.requiresNodesAll) {
      if ((ownedLevels[reqId] ?? 0) >= 1) {
        ownedCount++;
      } else {
        missingNames.push(SKILL_NODE_MAP[reqId]?.name ?? reqId);
      }
    }
    if (missingNames.length > 0) {
      lockReasons.push(
        `Buy all ${node.requiresNodesAll.length} prerequisite nodes first (${ownedCount}/${node.requiresNodesAll.length}): ${missingNames.join(', ')}`
      );
    }
  }

  // 4. Count of group Prerequisite
  if (node.requiresNodesCount) {
    let count = 0;
    for (const id of node.requiresNodesCount.nodeIds) {
      if ((ownedLevels[id] ?? 0) >= 1) count++;
    }
    if (count < node.requiresNodesCount.count) {
      lockReasons.push(
        `${node.requiresNodesCount.label} (${count}/${node.requiresNodesCount.count})`
      );
    }
  }

  if (lockReasons.length > 0) {
    return {
      state: 'LOCKED_VISIBLE',
      level,
      maxLevel: node.maxLevel,
      nextCost,
      canAfford: currentCash >= nextCost,
      lockReasons,
    };
  }

  return {
    state: 'AVAILABLE',
    level,
    maxLevel: node.maxLevel,
    nextCost,
    canAfford: currentCash >= nextCost,
    lockReasons: [],
  };
}

export interface ComputedPlayerStats {
  drillPower: number;          // DPS dealt to blocks
  drillRadiusPx: number;       // chewing radius around drill tip
  hardnessPenetration: number; // 0..0.85 reduction in hard block slowdown
  coreDamageMultiplier: number;
  maxFuel: number;
  fuelBurnMultiplier: number;  // lower = better fuel economy
  fuelCellRestorePct: number;  // % of maxFuel restored by a Fuel Cell
  cryoHazardReduction: number; // 0..1
  voidHazardReduction: number; // 0..1
  maxCargo: number;
  oreValueMultiplier: number;
  doubleOreChance: number;
  moveSpeed: number;           // px/sec base downward speed
  turnSpeedRad: number;        // rad/sec steering speed
  winchHoldSeconds: number;    // seconds to hold Extract
  crashCargoKeepRatio: number; // 0.50 .. 0.90 cargo kept on fuel-out
  scannerRangeTiles: number;
  droneCount: number;
  droneDps: number;
  podTier: number;             // 1, 2, or 3 visual chassis tier
  drillVisualTier: number;     // 0..3 visual drill cone tier
  hullPlatingLevel: number;    // 0..2 bolted/heavy armor plates
  cargoPodLevel: number;       // 0..3 external cargo pods
  hasScannerDish: boolean;     // rotating seismic radar dish
}

export function computePlayerStats(ownedLevels: Record<string, number>): ComputedPlayerStats {
  let drillPowerPct = 0;
  let drillPowerMult = 1;
  let drillWidthPx = 0;
  let hardnessPen = 0;
  let coreDamagePct = 0;
  let maxFuelFlat = 0;
  let maxFuelPct = 0;
  let fuelBurnReduction = 0;
  let fuelCellBonusPct = 0;
  let cryoShieldPct = 0;
  let voidShieldPct = 0;
  let cargoCapFlat = 0;
  let oreValuePct = 0;
  let doubleOreChance = 0;
  let moveSpeedPct = 0;
  let winchSpeedPct = 0;
  let crashSavePct = 0;
  let scannerRangeTiles = 0;
  let droneCount = 0;
  let dronePowerPct = 0;

  for (const node of SKILL_NODES) {
    const lv = ownedLevels[node.id] ?? 0;
    if (lv <= 0) continue;
    const ef = node.effectsPerLevel;
    if (ef.drillPowerPct) drillPowerPct += ef.drillPowerPct * lv;
    if (ef.drillPowerMult) drillPowerMult *= Math.pow(ef.drillPowerMult, lv);
    if (ef.drillWidthPx) drillWidthPx += ef.drillWidthPx * lv;
    if (ef.hardnessPenetration) hardnessPen += ef.hardnessPenetration * lv;
    if (ef.coreDamagePct) coreDamagePct += ef.coreDamagePct * lv;
    if (ef.maxFuelFlat) maxFuelFlat += ef.maxFuelFlat * lv;
    if (ef.maxFuelPct) maxFuelPct += ef.maxFuelPct * lv;
    if (ef.fuelBurnReduction) fuelBurnReduction += ef.fuelBurnReduction * lv;
    if (ef.fuelCellBonusPct) fuelCellBonusPct += ef.fuelCellBonusPct * lv;
    if (ef.cryoShieldPct) cryoShieldPct += ef.cryoShieldPct * lv;
    if (ef.voidShieldPct) voidShieldPct += ef.voidShieldPct * lv;
    if (ef.cargoCapFlat) cargoCapFlat += ef.cargoCapFlat * lv;
    if (ef.oreValuePct) oreValuePct += ef.oreValuePct * lv;
    if (ef.doubleOreChance) doubleOreChance += ef.doubleOreChance * lv;
    if (ef.moveSpeedPct) moveSpeedPct += ef.moveSpeedPct * lv;
    if (ef.winchSpeedPct) winchSpeedPct += ef.winchSpeedPct * lv;
    if (ef.crashSavePct) crashSavePct += ef.crashSavePct * lv;
    if (ef.scannerRangeTiles) scannerRangeTiles += ef.scannerRangeTiles * lv;
    if (ef.droneCount) droneCount += ef.droneCount * lv;
    if (ef.dronePowerPct) dronePowerPct += ef.dronePowerPct * lv;
  }

  const baseDrillPower = 26;
  const drillPower = baseDrillPower * (1 + drillPowerPct / 100) * drillPowerMult;
  const drillRadiusPx = 21 + drillWidthPx * 1.45; // starts at 21px (~1 tile wide), grows up to 78px!

  const baseFuel = 100;
  const maxFuel = Math.round((baseFuel + maxFuelFlat) * (1 + maxFuelPct / 100));
  const fuelBurnMultiplier = Math.max(0.22, Math.pow(0.88, fuelBurnReduction / 0.12));

  let podTier = 1;
  if ((ownedLevels['singularity_drill_3'] ?? 0) > 0 || (ownedLevels['void_cooling_3'] ?? 0) > 0) {
    podTier = 3;
  } else if ((ownedLevels['diamond_auger_1'] ?? 0) > 0 || (ownedLevels['cryo_heater_1'] ?? 0) > 0) {
    podTier = 2;
  }

  let drillVisualTier = 0;
  if ((ownedLevels['titan_excavator_3'] ?? 0) > 0 || (ownedLevels['singularity_drill_3'] ?? 0) > 0) {
    drillVisualTier = 3;
  } else if ((ownedLevels['glacier_bore_2'] ?? 0) > 0 || (ownedLevels['diamond_auger_1'] ?? 0) > 0) {
    drillVisualTier = 2;
  } else if ((ownedLevels['twin_bore_1'] ?? 0) > 0 || (ownedLevels['carbide_teeth'] ?? 0) > 0) {
    drillVisualTier = 1;
  }

  let hullPlatingLevel = 0;
  if ((ownedLevels['void_cooling_3'] ?? 0) > 0 || (ownedLevels['cryo_heater_1'] ?? 0) > 0) {
    hullPlatingLevel = 2;
  } else if ((ownedLevels['fuel_tank_1'] ?? 0) >= 2 || (ownedLevels['fuel_injector_1'] ?? 0) >= 1) {
    hullPlatingLevel = 1;
  }

  let cargoPodLevel = 0;
  if ((ownedLevels['quantum_cargo_2'] ?? 0) > 0) {
    cargoPodLevel = 3;
  } else if ((ownedLevels['deep_cargo_1'] ?? 0) > 0) {
    cargoPodLevel = 2;
  } else if ((ownedLevels['cargo_rack_1'] ?? 0) > 0) {
    cargoPodLevel = 1;
  }

  const hasScannerDish = (ownedLevels['deep_radar_1'] ?? 0) > 0 || (ownedLevels['deep_radar_2'] ?? 0) > 0;

  return {
    drillPower,
    drillRadiusPx,
    hardnessPenetration: Math.min(0.85, hardnessPen),
    coreDamageMultiplier: 1 + coreDamagePct / 100,
    maxFuel,
    fuelBurnMultiplier,
    fuelCellRestorePct: 18 * (1 + fuelCellBonusPct / 100),
    cryoHazardReduction: Math.min(1, cryoShieldPct / 100),
    voidHazardReduction: Math.min(1, voidShieldPct / 100),
    maxCargo: 18 + cargoCapFlat,
    oreValueMultiplier: 1 + oreValuePct / 100,
    doubleOreChance: Math.min(0.9, doubleOreChance),
    moveSpeed: 185 * (1 + moveSpeedPct / 100),
    turnSpeedRad: 3.2 * (1 + moveSpeedPct / 150),
    winchHoldSeconds: Math.max(0.45, 1.45 / (1 + winchSpeedPct / 100)),
    crashCargoKeepRatio: Math.min(0.9, 0.5 + crashSavePct / 100),
    scannerRangeTiles: 4 + scannerRangeTiles,
    droneCount,
    droneDps: drillPower * 0.42 * (1 + dronePowerPct / 100),
    podTier,
    drillVisualTier,
    hullPlatingLevel,
    cargoPodLevel,
    hasScannerDish,
  };
}
