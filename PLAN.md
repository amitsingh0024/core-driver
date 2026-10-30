# Core Diver — Game Design & Implementation Plan

## Core Direction
- **Pure Mining Incremental Arcade:** No enemies or combat. All tension comes from **block hardness**, **continuous steering**, **cargo greed**, and **a single Fuel bar**.
- **Continuous Steering:** Smoothly angle the drill pod left/right while chewing downward through a destructible block grid.
- **Option A Surfacing (Winch Extract):** Hold **Extract** (or hit an Extraction Beacon) anytime before Fuel hits `0` to haul 100% of your cargo to the surface. If Fuel hits `0`, emergency tow recovers your pod but **drops 50% of cargo**.
- **Stage-Based Planets:** Each stage is an alien planet with 5 distinct depth strata ending in a massive **Planet Core**. Cracking the Core unlocks the next planet.
- **Fog-of-War Upgrade Tree:** A sprawling node graph where buying a node reveals neighboring nodes, gated by **single prerequisites**, **multi-node gates** (*"Buy 3 prerequisites first"*), and **Planet locks** (*"Unlock Planet 2 first"*).

## 1. Planets & Strata (3 Worlds × 5 Layers)
1. **Planet 1: Terra-Vein** (`0m – 800m`)
   - Strata: Topsoil Loam, Sedimentary Sandstone, Granite Mantle, Basalt Magma Crust, Iron-Nickel Core.
   - Ores: Bituminous Coal (`$5`), Native Copper (`$14`), Hematite Iron (`$35`), Argentite Silver (`$90`), Pyro-Gold (`$240`).
2. **Planet 2: Cryo-Vex** (`0m – 1,150m`)
   - Strata: Rime Snowpack, Permafrost Shale, Glacial Quartzite, Abyssal Cryo-Glass, Absolute-Zero Core.
   - Stage Hazard: Sub-zero cryo-chill increases fuel drain by `+35%` until **Thermal Core Heater** nodes are unlocked.
   - Ores: Frost Cobalt (`$600`), Glacial Platinum (`$1,500`), Cryo-Beryl (`$3,800`), Rime Titanium (`$9,500`), Zero-Kelvin Diamond (`$25,000`).
3. **Planet 3: Pyra-Void** (`0m – 1,600m`)
   - Strata: Ashen Slag, Obsidian Plate, Sulfuric Brimstone, Void-Cursed Mantle, Singularity Core.
   - Stage Hazard: Superheated high-gravity mantle requires **Void Cooling Jacket** & **Singularity Bore** nodes.
   - Ores: Brimstone Uranium (`$65,000`), Magma Ruby (`$160,000`), Astral Mythril (`$420,000`), Abyssal Painite (`$1,100,000`), Singularity Matter (`$3,000,000`).

## 2. Hidden Skill Tree ("The Deep Grid")
- **5 Branches:**
  1. Drill Power & Head Geometry (DPS, Hardness Penetration, Drill Width Tiers, Core-Breaker)
  2. Fuel Systems & Thermal Shielding (Max Fuel, Passive Burn Efficiency, Friction Lube, Fuel Cell Yield, Planet Hazard Shields)
  3. Cargo Hold & Ore Refinery (Cargo Capacity, Ore Compression, Refinery Value Multipliers, Double-Ore Chance)
  4. Thrusters, Winch & Deep Scanner (Dive Speed, Steering Agility, Winch Speed, Blackbox Loss Reduction, Fuel Radar)
  5. Autonomous Mining Drones (Unlockable mid-tree branch spawning orbiting laser mining drones)
- **Lock Types:**
  - Single prerequisite (`requires: [nodeId]`)
  - Multi-node prerequisite (`requiresAll: [id1, id2, id3]` or `requiresCount: { nodes: [...], count: 3 }`)
  - Planet stage lock (`minPlanet: 2` or `minPlanet: 3`)

## 3. Gameplay Pass (Oct 2026)
Goal: every dive should feel chunky, have a target, and hold one surprise. Based on the miner-game research doc.

- **Game feel:** hit-stop freeze on block breaks (ore 50 ms, armored/relic 90 ms, core 150 ms), a white tile flash, tiered screen shake, ore chunks that fly into the pod, haptic pulses on phones, and a counting-up payout with coin ticks on the Results screen. All of it respects the Screen Shake and Haptics settings.
- **Combo pays out:** the same-ore combo (x2 to x4) now adds +15% per step as real credits, shown as its own line on the Results screen. Combo credits are part of the cargo and are halved on a fuel-out tow like ore.
- **Dive Contracts:** each dive rolls one goal shown under the fuel bar: reach a depth, mine N of an ore, or bring back a haul worth $X. Targets scale from your best depth on the planet. Completing it pays a bonus on the Results screen, even on a tow.
- **Relic Caches:** rare buried chests (about 1 in 500 tiles below 60 m). Cracking one banks a credit bounty immediately (safe from fuel-out loss), worth roughly 4 to 7 of the best ore in that stratum.
- **Armored Veins:** from stratum 2 down, about 4% of rock is riveted armor with 3x HP that always holds the rarest ore of that stratum. A slow, fuel-costly grind with a guaranteed payoff.
- **Extraction Beacons charge instead of ending the dive:** drilling a beacon stores an instant-extract charge (the Extract button glows); the next Extract press surfaces immediately with no winch wait. Before, drilling one by accident ended the dive.
- **Settings that work:** SFX volume is a real master gain; Colorblind mode draws state glyphs on Deep Grid nodes; Haptics vibrates on ore, relic and core breaks.

## 4. Code Structure (Oct 2026)
`main.ts` is now a 5-line bootstrap. `core/Game.ts` routes between screens; `core/GameContext.ts` holds the save, stats, sprites, sound and particles; `core/Input.ts` owns keyboard and pointer state. Each screen lives in `screens/` (`TitleScreen`, `DiveScreen`, `ResultsScreen`, `SettingsForm`, `hangar/*Tab`), dive drawing is in `render/DiveRenderer.ts`, and dive settlement is a pure function in `game/DivePayout.ts`. New dive features go in `game/` (`DiveContract.ts`, `GameFeel.ts`).
