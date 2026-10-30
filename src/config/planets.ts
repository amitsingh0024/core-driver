export interface StratumConfig {
  id: string;
  name: string;
  subtitle: string;
  startDepth: number; // meters
  endDepth: number;   // meters
  baseHp: number;
  fuelDrainPerSec: number; // extra fuel drain when drilling this rock
  palette: {
    base: string;
    dark: string;
    light: string;
    speck: string;
    bevel: string;
    bgWall: string;
  };
  oreWeights: Record<string, number>;
   oreDensity: number; // 0..1 chance a rock tile contains ore
}

export interface PlanetConfig {
  id: number;
  name: string;
  tagline: string;
  description: string;
  hazardName: string;
  hazardDescription: string;
  ambientFuelMultiplier: number; // e.g. 1.0 on P1, 1.35 on P2, 1.65 on P3
  maxDepth: number; // meters (Core sits at maxDepth)
  coreName: string;
  coreTileHp: number;
  coreRewardCash: number;
  skyColorTop: string;
  skyColorBottom: string;
  accentColor: string;
  coreGlowColor: string;
  strata: StratumConfig[];
}

export const PLANETS: PlanetConfig[] = [
  {
    id: 1,
    name: 'Terra-Vein',
    tagline: 'Iron-Rich Frontier World',
    description: 'A tectonic terrestrial world rich in industrial metals, native gold veins, and a molten iron-nickel core.',
    hazardName: 'Standard Crust Density',
    hazardDescription: 'Normal atmospheric and thermal conditions. Ideal for calibrating your drill rig.',
    ambientFuelMultiplier: 1.0,
    maxDepth: 800,
    coreName: 'Terra-Vein Iron Core',
    coreTileHp: 220,
    coreRewardCash: 2500,
    skyColorTop: '#1a1118',
    skyColorBottom: '#3d231a',
    accentColor: '#f5a623',
    coreGlowColor: '#ff6d00',
    strata: [
      {
        id: 'p1_loam',
        name: 'Topsoil Loam',
        subtitle: '0m – 120m',
        startDepth: 0,
        endDepth: 120,
        baseHp: 12,
        fuelDrainPerSec: 1.4,
        palette: {
          base: '#6b442a',
          dark: '#4e2f1b',
          light: '#88593a',
          speck: '#a16f4c',
          bevel: '#361f10',
          bgWall: '#24150c',
        },
        oreDensity: 0.24,
        oreWeights: { coal: 75, copper: 25 },
      },
      {
        id: 'p1_sandstone',
        name: 'Sedimentary Sandstone',
        subtitle: '120m – 280m',
        startDepth: 120,
        endDepth: 280,
        baseHp: 32,
        fuelDrainPerSec: 2.2,
        palette: {
          base: '#9e6b3b',
          dark: '#7a4f28',
          light: '#bd8550',
          speck: '#d6a16d',
          bevel: '#573619',
          bgWall: '#2e1d0f',
        },
        oreDensity: 0.26,
        oreWeights: { coal: 35, copper: 50, iron: 15 },
      },
      {
        id: 'p1_granite',
        name: 'Granite Mantle',
        subtitle: '280m – 480m',
        startDepth: 280,
        endDepth: 480,
        baseHp: 75,
        fuelDrainPerSec: 3.4,
        palette: {
          base: '#5c636e',
          dark: '#41464f',
          light: '#79818f',
          speck: '#9ba4b5',
          bevel: '#2b2f36',
          bgWall: '#1b1e24',
        },
        oreDensity: 0.28,
        oreWeights: { copper: 25, iron: 55, silver: 20 },
      },
      {
        id: 'p1_basalt',
        name: 'Basalt Magma Crust',
        subtitle: '480m – 680m',
        startDepth: 480,
        endDepth: 680,
        baseHp: 165,
        fuelDrainPerSec: 5.0,
        palette: {
          base: '#3b323d',
          dark: '#261f28',
          light: '#544757',
          speck: '#ff6a2b',
          bevel: '#18131a',
          bgWall: '#140f17',
        },
        oreDensity: 0.30,
        oreWeights: { iron: 30, silver: 50, gold: 20 },
      },
      {
        id: 'p1_core_iron',
        name: 'Inner Iron-Nickel Core',
        subtitle: '680m – 800m',
        startDepth: 680,
        endDepth: 800,
        baseHp: 340,
        fuelDrainPerSec: 7.2,
        palette: {
          base: '#4a251d',
          dark: '#2e140f',
          light: '#78382b',
          speck: '#ffaa33',
          bevel: '#1c0a07',
          bgWall: '#1c0906',
        },
        oreDensity: 0.34,
        oreWeights: { silver: 35, gold: 65 },
      },
    ],
  },
  {
    id: 2,
    name: 'Cryo-Vex',
    tagline: 'Sub-Zero Crystalline Glacial World',
    description: 'An ice-locked exoplanet where compressed permafrost gives way to pure diamond-lattice quartz and a zero-kelvin core.',
    hazardName: 'Cryo-Chill (+35% Fuel Drain)',
    hazardDescription: 'Sub-zero temperatures thicken fuel lines (+35% fuel consumption) until Thermal Core Heater upgrades are installed.',
    ambientFuelMultiplier: 1.35,
    maxDepth: 1150,
    coreName: 'Absolute-Zero Crystalline Core',
    coreTileHp: 2800,
    coreRewardCash: 65000,
    skyColorTop: '#07162c',
    skyColorBottom: '#10375c',
    accentColor: '#00e5ff',
    coreGlowColor: '#00b0ff',
    strata: [
      {
        id: 'p2_snowpack',
        name: 'Compressed Rime Snowpack',
        subtitle: '0m – 180m',
        startDepth: 0,
        endDepth: 180,
        baseHp: 420,
        fuelDrainPerSec: 6.5,
        palette: {
          base: '#6da8c7',
          dark: '#4b7f9c',
          light: '#94cbe8',
          speck: '#dbf3ff',
          bevel: '#335d75',
          bgWall: '#112533',
        },
        oreDensity: 0.25,
        oreWeights: { cobalt: 75, platinum: 25 },
      },
      {
        id: 'p2_permafrost',
        name: 'Permafrost Shale',
        subtitle: '180m – 400m',
        startDepth: 180,
        endDepth: 400,
        baseHp: 850,
        fuelDrainPerSec: 8.5,
        palette: {
          base: '#44789e',
          dark: '#2d5778',
          light: '#629bc4',
          speck: '#99d5ff',
          bevel: '#1d3d57',
          bgWall: '#0d1e2e',
        },
        oreDensity: 0.27,
        oreWeights: { cobalt: 35, platinum: 50, aquamarine: 15 },
      },
      {
        id: 'p2_quartzite',
        name: 'Glacial Quartzite',
        subtitle: '400m – 680m',
        startDepth: 400,
        endDepth: 680,
        baseHp: 1750,
        fuelDrainPerSec: 11.5,
        palette: {
          base: '#2f5280',
          dark: '#1e385c',
          light: '#4874ab',
          speck: '#70e2ff',
          bevel: '#12243d',
          bgWall: '#091526',
        },
        oreDensity: 0.29,
        oreWeights: { platinum: 25, aquamarine: 55, titanium: 20 },
      },
      {
        id: 'p2_cryoglass',
        name: 'Abyssal Cryo-Glass',
        subtitle: '680m – 960m',
        startDepth: 680,
        endDepth: 960,
        baseHp: 3400,
        fuelDrainPerSec: 15.0,
        palette: {
          base: '#1e345e',
          dark: '#122140',
          light: '#32538f',
          speck: '#00f2ff',
          bevel: '#0a1329',
          bgWall: '#060c1c',
        },
        oreDensity: 0.31,
        oreWeights: { aquamarine: 30, titanium: 50, cryo_diamond: 20 },
      },
      {
        id: 'p2_core_zero',
        name: 'Zero-Kelvin Diamond Vault',
        subtitle: '960m – 1150m',
        startDepth: 960,
        endDepth: 1150,
        baseHp: 6200,
        fuelDrainPerSec: 19.5,
        palette: {
          base: '#142242',
          dark: '#0a1226',
          light: '#284580',
          speck: '#7affff',
          bevel: '#050914',
          bgWall: '#040814',
        },
        oreDensity: 0.35,
        oreWeights: { titanium: 35, cryo_diamond: 65 },
      },
    ],
  },
  {
    id: 3,
    name: 'Pyra-Void',
    tagline: 'Singularity-Warped Obsidian World',
    description: 'A crushed volcanic world orbiting a micro-singularity. Its mantle holds radioactive mythril, painite, and pure singularity matter.',
    hazardName: 'Void Gravity & Heat (+65% Fuel Drain)',
    hazardDescription: 'Extreme gravity and plasma vents drain +65% extra fuel unless Void Cooling Jacket nodes are active.',
    ambientFuelMultiplier: 1.65,
    maxDepth: 1600,
    coreName: 'Pyra-Void Singularity Core',
    coreTileHp: 38000,
    coreRewardCash: 2500000,
    skyColorTop: '#12041c',
    skyColorBottom: '#310a38',
    accentColor: '#e040fb',
    coreGlowColor: '#ff4081',
    strata: [
      {
        id: 'p3_slag',
        name: 'Ashen Volcanic Slag',
        subtitle: '0m – 250m',
        startDepth: 0,
        endDepth: 250,
        baseHp: 7500,
        fuelDrainPerSec: 18.0,
        palette: {
          base: '#3d2f38',
          dark: '#291e25',
          light: '#574350',
          speck: '#9e6384',
          bevel: '#171015',
          bgWall: '#140c12',
        },
        oreDensity: 0.26,
        oreWeights: { uranium: 75, ruby: 25 },
      },
      {
        id: 'p3_obsidian',
        name: 'Tectonic Obsidian Plate',
        subtitle: '250m – 580m',
        startDepth: 250,
        endDepth: 580,
        baseHp: 15000,
        fuelDrainPerSec: 23.0,
        palette: {
          base: '#271a38',
          dark: '#180f24',
          light: '#3f2a59',
          speck: '#884dff',
          bevel: '#0e0817',
          bgWall: '#0f081a',
        },
        oreDensity: 0.28,
        oreWeights: { uranium: 35, ruby: 50, mythril: 15 },
      },
      {
        id: 'p3_brimstone',
        name: 'Sulfuric Brimstone Rift',
        subtitle: '580m – 950m',
        startDepth: 580,
        endDepth: 950,
        baseHp: 30000,
        fuelDrainPerSec: 30.0,
        palette: {
          base: '#471d32',
          dark: '#2e101f',
          light: '#6b2c4b',
          speck: '#ff3377',
          bevel: '#1a0710',
          bgWall: '#17060f',
        },
        oreDensity: 0.30,
        oreWeights: { ruby: 25, mythril: 55, painite: 20 },
      },
      {
        id: 'p3_voidmantle',
        name: 'Void-Cursed Mantle',
        subtitle: '950m – 1320m',
        startDepth: 950,
        endDepth: 1320,
        baseHp: 58000,
        fuelDrainPerSec: 38.0,
        palette: {
          base: '#163442',
          dark: '#0b1e28',
          light: '#245266',
          speck: '#00f2ff',
          bevel: '#061117',
          bgWall: '#07131a',
        },
        oreDensity: 0.32,
        oreWeights: { mythril: 30, painite: 50, voidstone: 20 },
      },
      {
        id: 'p3_core_singularity',
        name: 'Singularity Event Horizon',
        subtitle: '1320m – 1600m',
        startDepth: 1320,
        endDepth: 1600,
        baseHp: 95000,
        fuelDrainPerSec: 48.0,
        palette: {
          base: '#120721',
          dark: '#080212',
          light: '#2a124d',
          speck: '#ff66ff',
          bevel: '#04000a',
          bgWall: '#06010d',
        },
        oreDensity: 0.36,
        oreWeights: { painite: 35, voidstone: 65 },
      },
    ],
  },
];
