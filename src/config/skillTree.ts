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
  /** 1 = first card in its track on that planet, 3 = the late card. */
  tier: number;
  maxLevel: number;
  baseCost: number;
  costScale: number;
  minPlanet: number; // planet that must be unlocked (1, 2 or 3)
  /** Best depth needed on minPlanet before the card can be bought. */
  unlockDepth: number;
  description: string;
  /** One-line summary of a single level, shown on the card ("+12 fuel"). */
  perLevel: string;
  effectsPerLevel: SkillEffects;
}

/** The four upgrade tracks. Each opens once the player first reaches its depth on Terra-Vein. */
export interface UpgradeTrack {
  branch: SkillBranch;
  name: string;
  opensAtDepth: number;
  blurb: string;
}

export const UPGRADE_TRACKS: UpgradeTrack[] = [
  { branch: 'fuel', name: 'Fuel', opensAtDepth: 0, blurb: 'How long a dive lasts' },
  { branch: 'cargo', name: 'Cargo', opensAtDepth: 50, blurb: 'How much ore you bring back' },
  { branch: 'drill', name: 'Drill', opensAtDepth: 120, blurb: 'How fast you cut hard rock' },
  { branch: 'utility', name: 'Systems', opensAtDepth: 200, blurb: 'Steering, winch, scanner, drones' },
];

export const PLANET_NAMES: Record<number, string> = { 1: 'Terra-Vein', 2: 'Cryo-Vex', 3: 'Pyra-Void' };

export const SKILL_NODES: SkillNodeConfig[] = [
  // ==========================================
  // PLANET 1: TERRA-VEIN
  // ==========================================
  {
    id: 'fuel_tank',
    name: 'Fuel Tank',
    branch: 'fuel',
    icon: 'fuel_cap',
    tier: 1,
    maxLevel: 8,
    baseCost: 90,
    costScale: 1.45,
    minPlanet: 1,
    unlockDepth: 0,
    description: 'Bolts reserve fuel canisters onto the hull. Every level makes the next dive a little longer.',
    perLevel: '+20 max fuel',
    effectsPerLevel: { maxFuelFlat: 20 },
  },
  {
    id: 'fuel_injector',
    name: 'Fuel Injector',
    branch: 'fuel',
    icon: 'fuel_eff',
    tier: 2,
    maxLevel: 5,
    baseCost: 900,
    costScale: 1.45,
    minPlanet: 1,
    unlockDepth: 280,
    description: 'Meters fuel into the thrusters so less is wasted while moving and drilling.',
    perLevel: '-7% fuel burn',
    effectsPerLevel: { fuelBurnReduction: 0.07 },
  },
  {
    id: 'cell_siphon',
    name: 'Cell Siphon',
    branch: 'fuel',
    icon: 'fuel_cell',
    tier: 3,
    maxLevel: 4,
    baseCost: 3200,
    costScale: 1.5,
    minPlanet: 1,
    unlockDepth: 380,
    description: 'Draws more out of every fuel cell you drill and adds a small reserve tank.',
    perLevel: '+20% fuel from cells, +15 max fuel',
    effectsPerLevel: { fuelCellBonusPct: 20, maxFuelFlat: 15 },
  },
  {
    id: 'cargo_bay',
    name: 'Cargo Bay',
    branch: 'cargo',
    icon: 'cargo_cap',
    tier: 1,
    maxLevel: 6,
    baseCost: 110,
    costScale: 1.45,
    minPlanet: 1,
    unlockDepth: 0,
    description: 'Expands the ore hopper so a dive can bring more back.',
    perLevel: '+4 cargo',
    effectsPerLevel: { cargoCapFlat: 4 },
  },
  {
    id: 'refinery',
    name: 'Refinery',
    branch: 'cargo',
    icon: 'ore_value',
    tier: 2,
    maxLevel: 4,
    baseCost: 1100,
    costScale: 1.5,
    minPlanet: 1,
    unlockDepth: 280,
    description: 'Cleans ore on board so the outpost pays more for it.',
    perLevel: '+10% ore value',
    effectsPerLevel: { oreValuePct: 10 },
  },
  {
    id: 'vein_splitter',
    name: 'Vein Splitter',
    branch: 'cargo',
    icon: 'double_ore',
    tier: 3,
    maxLevel: 4,
    baseCost: 3800,
    costScale: 1.55,
    minPlanet: 1,
    unlockDepth: 480,
    description: 'Splits rich ore blocks along their grain, sometimes giving two ores for one.',
    perLevel: '+6% double ore chance',
    effectsPerLevel: { doubleOreChance: 0.06 },
  },
  {
    id: 'drill_power',
    name: 'Drill Power',
    branch: 'drill',
    icon: 'drill_dps',
    tier: 1,
    maxLevel: 8,
    baseCost: 200,
    costScale: 1.42,
    minPlanet: 1,
    unlockDepth: 0,
    description: 'More torque on the bit. Hard rock gives way faster and costs less fuel to cut.',
    perLevel: '+50% drill power',
    effectsPerLevel: { drillPowerPct: 50 },
  },
  {
    id: 'drill_width',
    name: 'Drill Width',
    branch: 'drill',
    icon: 'drill_width',
    tier: 2,
    maxLevel: 4,
    baseCost: 1400,
    costScale: 1.6,
    minPlanet: 1,
    unlockDepth: 280,
    description: 'A wider cutting head clears more rock per pass and catches more ore.',
    perLevel: 'Wider bore, +20% drill power',
    effectsPerLevel: { drillWidthPx: 4, drillPowerPct: 20 },
  },
  {
    id: 'rock_penetrator',
    name: 'Rock Penetrator',
    branch: 'drill',
    icon: 'hardness_pen',
    tier: 2,
    maxLevel: 4,
    baseCost: 1000,
    costScale: 1.55,
    minPlanet: 1,
    unlockDepth: 280,
    description: 'Hardened teeth stop the pod bogging down in dense rock.',
    perLevel: '-12% hard rock slowdown',
    effectsPerLevel: { hardnessPenetration: 0.12, drillPowerPct: 10 },
  },
  {
    id: 'core_breaker',
    name: 'Core-Breaker',
    branch: 'drill',
    icon: 'core_damage',
    tier: 3,
    maxLevel: 3,
    baseCost: 4500,
    costScale: 1.6,
    minPlanet: 1,
    unlockDepth: 480,
    description: 'A resonance charge tuned to planet cores. Needed to crack the Terra-Vein core in good time.',
    perLevel: '+80% core damage, +40% drill power',
    effectsPerLevel: { coreDamagePct: 80, drillPowerPct: 40 },
  },
  {
    id: 'thrusters',
    name: 'Thrusters',
    branch: 'utility',
    icon: 'thruster',
    tier: 1,
    maxLevel: 4,
    baseCost: 500,
    costScale: 1.45,
    minPlanet: 1,
    unlockDepth: 0,
    description: 'Vectoring jets for faster dives and tighter steering into veins.',
    perLevel: '+10% speed and steering',
    effectsPerLevel: { moveSpeedPct: 10 },
  },
  {
    id: 'winch',
    name: 'Winch & Blackbox',
    branch: 'utility',
    icon: 'winch',
    tier: 2,
    maxLevel: 3,
    baseCost: 850,
    costScale: 1.5,
    minPlanet: 1,
    unlockDepth: 280,
    description: 'A faster extract winch, and a blackbox that saves more cargo when you run dry.',
    perLevel: '+25% winch speed, +8% cargo kept on tow',
    effectsPerLevel: { winchSpeedPct: 25, crashSavePct: 8 },
  },
  {
    id: 'scanner',
    name: 'Scanner',
    branch: 'utility',
    icon: 'scanner',
    tier: 2,
    maxLevel: 3,
    baseCost: 1200,
    costScale: 1.5,
    minPlanet: 1,
    unlockDepth: 380,
    description: 'Seismic radar that marks ore veins and fuel cells further away.',
    perLevel: '+3 tiles radar range',
    effectsPerLevel: { scannerRangeTiles: 3 },
  },
  {
    id: 'drone_bay',
    name: 'Mining Drone',
    branch: 'utility',
    icon: 'drone',
    tier: 3,
    maxLevel: 1,
    baseCost: 6000,
    costScale: 1,
    minPlanet: 1,
    unlockDepth: 480,
    description: 'An orbiting laser drone that mines ore near the pod without using fuel.',
    perLevel: '+1 drone',
    effectsPerLevel: { droneCount: 1 },
  },

  // ==========================================
  // PLANET 2: CRYO-VEX
  // ==========================================
  {
    id: 'cryo_heater',
    name: 'Thermal Heater',
    branch: 'fuel',
    icon: 'hazard_shield',
    tier: 1,
    maxLevel: 4,
    baseCost: 15000,
    costScale: 1.5,
    minPlanet: 2,
    unlockDepth: 0,
    description: 'Keeps the fuel lines warm. Cancels the Cryo-Vex cold fuel penalty.',
    perLevel: '-25% cold penalty, +25 max fuel',
    effectsPerLevel: { cryoShieldPct: 25, maxFuelFlat: 25 },
  },
  {
    id: 'cryo_tank',
    name: 'Cryo Tank',
    branch: 'fuel',
    icon: 'fuel_cap',
    tier: 2,
    maxLevel: 6,
    baseCost: 70000,
    costScale: 1.45,
    minPlanet: 2,
    unlockDepth: 180,
    description: 'Compressed cryo fuel cells. A much larger tank for the deep ice.',
    perLevel: '+40 max fuel, +5% tank',
    effectsPerLevel: { maxFuelFlat: 40, maxFuelPct: 5 },
  },
  {
    id: 'friction_shield',
    name: 'Friction Shield',
    branch: 'fuel',
    icon: 'fuel_eff',
    tier: 3,
    maxLevel: 4,
    baseCost: 250000,
    costScale: 1.55,
    minPlanet: 2,
    unlockDepth: 400,
    description: 'A zero-friction coating that cuts fuel burn and helps through dense ice.',
    perLevel: '-10% fuel burn, -5% hard rock slowdown',
    effectsPerLevel: { fuelBurnReduction: 0.1, hardnessPenetration: 0.05 },
  },
  {
    id: 'cargo_matrix',
    name: 'Cargo Matrix',
    branch: 'cargo',
    icon: 'cargo_cap',
    tier: 1,
    maxLevel: 6,
    baseCost: 18000,
    costScale: 1.45,
    minPlanet: 2,
    unlockDepth: 0,
    description: 'Sub-zero compression racks for a much bigger hold.',
    perLevel: '+6 cargo',
    effectsPerLevel: { cargoCapFlat: 6 },
  },
  {
    id: 'crystal_refinery',
    name: 'Crystal Refinery',
    branch: 'cargo',
    icon: 'ore_value',
    tier: 2,
    maxLevel: 5,
    baseCost: 90000,
    costScale: 1.5,
    minPlanet: 2,
    unlockDepth: 180,
    description: 'Grades cryo crystals before sale for a better price.',
    perLevel: '+15% ore value',
    effectsPerLevel: { oreValuePct: 15 },
  },
  {
    id: 'cryo_auger',
    name: 'Cryo Auger',
    branch: 'drill',
    icon: 'drill_dps',
    tier: 1,
    maxLevel: 5,
    baseCost: 20000,
    costScale: 1.5,
    minPlanet: 2,
    unlockDepth: 0,
    description: 'A diamond auger built for ice harder than Terra-Vein bedrock.',
    perLevel: 'x1.3 drill power',
    effectsPerLevel: { drillPowerMult: 1.3 },
  },
  {
    id: 'glacier_bore',
    name: 'Glacier Bore',
    branch: 'drill',
    icon: 'drill_width',
    tier: 2,
    maxLevel: 3,
    baseCost: 300000,
    costScale: 1.6,
    minPlanet: 2,
    unlockDepth: 400,
    description: 'A tri-cone head that cuts a wider shaft through the glacier.',
    perLevel: 'Wider bore, x1.15 drill power',
    effectsPerLevel: { drillWidthPx: 4, drillPowerMult: 1.15 },
  },
  {
    id: 'core_shatterer',
    name: 'Core Shatterer',
    branch: 'drill',
    icon: 'core_damage',
    tier: 3,
    maxLevel: 3,
    baseCost: 900000,
    costScale: 1.6,
    minPlanet: 2,
    unlockDepth: 680,
    description: 'Harmonic charges for the Absolute-Zero core.',
    perLevel: '+100% core damage, x1.15 drill power',
    effectsPerLevel: { coreDamagePct: 100, drillPowerMult: 1.15 },
  },
  {
    id: 'deep_sonar',
    name: 'Deep Sonar',
    branch: 'utility',
    icon: 'scanner',
    tier: 1,
    maxLevel: 3,
    baseCost: 60000,
    costScale: 1.5,
    minPlanet: 2,
    unlockDepth: 180,
    description: 'Sub-glacial sonar with longer range, plus faster thrusters.',
    perLevel: '+3 tiles radar range, +8% speed',
    effectsPerLevel: { scannerRangeTiles: 3, moveSpeedPct: 8 },
  },
  {
    id: 'twin_drones',
    name: 'Twin Drones',
    branch: 'utility',
    icon: 'drone',
    tier: 3,
    maxLevel: 1,
    baseCost: 1200000,
    costScale: 1,
    minPlanet: 2,
    unlockDepth: 680,
    description: 'A second mining drone, and stronger lasers for both.',
    perLevel: '+1 drone, +100% drone power',
    effectsPerLevel: { droneCount: 1, dronePowerPct: 100 },
  },

  // ==========================================
  // PLANET 3: PYRA-VOID
  // ==========================================
  {
    id: 'void_jacket',
    name: 'Void Cooling Jacket',
    branch: 'fuel',
    icon: 'hazard_shield',
    tier: 1,
    maxLevel: 4,
    baseCost: 5_000_000,
    costScale: 1.5,
    minPlanet: 3,
    unlockDepth: 0,
    description: 'Plasma cooling that cancels the Pyra-Void heat penalty.',
    perLevel: '-25% heat penalty, +60 max fuel',
    effectsPerLevel: { voidShieldPct: 25, maxFuelFlat: 60 },
  },
  {
    id: 'fusion_tank',
    name: 'Fusion Tank',
    branch: 'fuel',
    icon: 'fuel_cap',
    tier: 2,
    maxLevel: 6,
    baseCost: 24_000_000,
    costScale: 1.45,
    minPlanet: 3,
    unlockDepth: 250,
    description: 'A micro-fusion core feeding the thrusters.',
    perLevel: '+60 max fuel, +5% tank',
    effectsPerLevel: { maxFuelFlat: 60, maxFuelPct: 5 },
  },
  {
    id: 'void_hold',
    name: 'Void Hold',
    branch: 'cargo',
    icon: 'cargo_cap',
    tier: 1,
    maxLevel: 6,
    baseCost: 6_000_000,
    costScale: 1.45,
    minPlanet: 3,
    unlockDepth: 0,
    description: 'Folded-space cargo racks.',
    perLevel: '+8 cargo',
    effectsPerLevel: { cargoCapFlat: 8 },
  },
  {
    id: 'ore_transmuter',
    name: 'Ore Transmuter',
    branch: 'cargo',
    icon: 'double_ore',
    tier: 2,
    maxLevel: 5,
    baseCost: 30_000_000,
    costScale: 1.5,
    minPlanet: 3,
    unlockDepth: 250,
    description: 'Transmutes slag into sellable ore and raises its grade.',
    perLevel: '+20% ore value, +4% double ore',
    effectsPerLevel: { oreValuePct: 20, doubleOreChance: 0.04 },
  },
  {
    id: 'singularity_lance',
    name: 'Singularity Lance',
    branch: 'drill',
    icon: 'drill_dps',
    tier: 1,
    maxLevel: 5,
    baseCost: 7_000_000,
    costScale: 1.5,
    minPlanet: 3,
    unlockDepth: 0,
    description: 'A lance drill that cuts obsidian and brimstone.',
    perLevel: 'x1.45 drill power',
    effectsPerLevel: { drillPowerMult: 1.45 },
  },
  {
    id: 'planet_eater',
    name: 'Planet-Eater Bore',
    branch: 'drill',
    icon: 'drill_width',
    tier: 2,
    maxLevel: 3,
    baseCost: 80_000_000,
    costScale: 1.6,
    minPlanet: 3,
    unlockDepth: 580,
    description: 'The widest cutting head the outpost can build.',
    perLevel: 'Wider bore, x1.2 drill power',
    effectsPerLevel: { drillWidthPx: 5, drillPowerMult: 1.2 },
  },
  {
    id: 'omega_breaker',
    name: 'Omega Core Breaker',
    branch: 'drill',
    icon: 'core_damage',
    tier: 3,
    maxLevel: 3,
    baseCost: 240_000_000,
    costScale: 1.6,
    minPlanet: 3,
    unlockDepth: 950,
    description: 'The charge that cracks the Singularity Core.',
    perLevel: '+200% core damage, x1.25 drill power',
    effectsPerLevel: { coreDamagePct: 200, drillPowerMult: 1.25 },
  },
  {
    id: 'void_drones',
    name: 'Void Drone',
    branch: 'utility',
    icon: 'drone',
    tier: 3,
    maxLevel: 1,
    baseCost: 100_000_000,
    costScale: 1,
    minPlanet: 3,
    unlockDepth: 580,
    description: 'A third drone with void lasers.',
    perLevel: '+1 drone, +150% drone power',
    effectsPerLevel: { droneCount: 1, dronePowerPct: 150 },
  },
];

export const SKILL_NODE_MAP: Record<string, SkillNodeConfig> = Object.fromEntries(
  SKILL_NODES.map((n) => [n.id, n])
);

export function trackFor(branch: SkillBranch): UpgradeTrack | undefined {
  return UPGRADE_TRACKS.find((t) => t.branch === branch);
}

/** A track is open once the player has reached its depth on Terra-Vein (or left Terra-Vein). */
export function isTrackOpen(
  track: UpgradeTrack,
  highestUnlockedPlanet: number,
  deepestByPlanet: Record<number, number>
): boolean {
  return highestUnlockedPlanet > 1 || (deepestByPlanet[1] ?? 0) >= track.opensAtDepth;
}

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

/**
 * Card state. Cards on a closed track or a locked planet are HIDDEN, cards waiting on a depth
 * are LOCKED_VISIBLE with a "Reach 280 m" reason.
 */
export function evaluateSkillNode(
  node: SkillNodeConfig,
  ownedLevels: Record<string, number>,
  highestUnlockedPlanet: number,
  currentCash: number,
  deepestByPlanet: Record<number, number>
): NodeEvaluation {
  const level = ownedLevels[node.id] ?? 0;
  const nextCost = getNodeNextCost(node, level);
  const base = { level, maxLevel: node.maxLevel, nextCost };

  const track = trackFor(node.branch);
  if (track && !isTrackOpen(track, highestUnlockedPlanet, deepestByPlanet) && level === 0) {
    return { ...base, state: 'HIDDEN', canAfford: false, lockReasons: [`Reach ${track.opensAtDepth} m to open ${track.name}`] };
  }
  if (highestUnlockedPlanet < node.minPlanet) {
    return { ...base, state: 'HIDDEN', canAfford: false, lockReasons: [`Unlock ${PLANET_NAMES[node.minPlanet]} first`] };
  }
  if (level >= node.maxLevel) {
    return { ...base, nextCost: 0, state: 'MAXED', canAfford: false, lockReasons: [] };
  }
  const canAfford = currentCash >= nextCost;
  if ((deepestByPlanet[node.minPlanet] ?? 0) < node.unlockDepth) {
    const where = node.minPlanet > 1 ? ` on ${PLANET_NAMES[node.minPlanet]}` : '';
    return { ...base, state: 'LOCKED_VISIBLE', canAfford, lockReasons: [`Reach ${node.unlockDepth} m${where}`] };
  }
  return { ...base, state: 'AVAILABLE', canAfford, lockReasons: [] };
}

/** Every upgrade the player could buy right now (ignoring cash), with its next-level price. */
export function buyableUpgrades(save: {
  ownedSkills: Record<string, number>;
  highestUnlockedPlanet: number;
  deepestByPlanet: Record<number, number>;
}): { id: string; cost: number }[] {
  const out: { id: string; cost: number }[] = [];
  for (const node of SKILL_NODES) {
    const ev = evaluateSkillNode(node, save.ownedSkills, save.highestUnlockedPlanet, Infinity, save.deepestByPlanet);
    if (ev.state === 'AVAILABLE') out.push({ id: node.id, cost: ev.nextCost });
  }
  return out;
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

  const baseFuel = 35;
  const maxFuel = Math.round((baseFuel + maxFuelFlat) * (1 + maxFuelPct / 100));
  const fuelBurnMultiplier = Math.max(0.22, Math.pow(0.88, fuelBurnReduction / 0.12));

  let podTier = 1;
  if ((ownedLevels['singularity_lance'] ?? 0) > 0 || (ownedLevels['void_jacket'] ?? 0) > 0) {
    podTier = 3;
  } else if ((ownedLevels['cryo_auger'] ?? 0) > 0 || (ownedLevels['cryo_heater'] ?? 0) > 0) {
    podTier = 2;
  }

  let drillVisualTier = 0;
  if ((ownedLevels['planet_eater'] ?? 0) > 0 || (ownedLevels['singularity_lance'] ?? 0) > 0) {
    drillVisualTier = 3;
  } else if ((ownedLevels['glacier_bore'] ?? 0) > 0 || (ownedLevels['cryo_auger'] ?? 0) > 0) {
    drillVisualTier = 2;
  } else if ((ownedLevels['drill_width'] ?? 0) > 0 || (ownedLevels['drill_power'] ?? 0) >= 3) {
    drillVisualTier = 1;
  }

  let hullPlatingLevel = 0;
  if ((ownedLevels['void_jacket'] ?? 0) > 0 || (ownedLevels['cryo_heater'] ?? 0) > 0) {
    hullPlatingLevel = 2;
  } else if ((ownedLevels['fuel_tank'] ?? 0) >= 3 || (ownedLevels['fuel_injector'] ?? 0) >= 1) {
    hullPlatingLevel = 1;
  }

  let cargoPodLevel = 0;
  if ((ownedLevels['cargo_matrix'] ?? 0) > 0) {
    cargoPodLevel = 3;
  } else if ((ownedLevels['cargo_bay'] ?? 0) >= 5) {
    cargoPodLevel = 2;
  } else if ((ownedLevels['cargo_bay'] ?? 0) > 0) {
    cargoPodLevel = 1;
  }

  const hasScannerDish = (ownedLevels['scanner'] ?? 0) > 0 || (ownedLevels['deep_sonar'] ?? 0) > 0;

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
    maxCargo: 16 + cargoCapFlat,
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
