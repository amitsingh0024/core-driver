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

## 5. Balance Pass (Oct 2026)
Goal: fuel is the dive's clock again, not an afterthought. Measured with a headless bot driving the real `DrillPod` over 6 seeds per rig.
- **Ore share** ~34% → ~26% of tiles: every stratum's `oreDensity` −0.07, vein spread 32% → 25%. Cargo fills deeper, so fuel matters before cargo does.
- **Fuel cells** 2.2% → 1.4% of tiles, base refill 22% → 18% of tank. Cell Siphon +30% → +20% per level.
- **Thrust burn** 1.6/s → 2.0/s. Fuel Injector −12% → −9% per level.
- **Fix:** the pod could slip past the core's sides and fall through the bedrock floor (depth readings of 3000m+). Now clamped to the floor.

| Rig (P1) | Before | After |
|---|---|---|
| Starter | cargo full at 90m with 46% fuel left | runs dry ~130m with ~15/18 cargo; winch timing matters |
| Early (T1 maxed) | cargo full at ~300m, 44% fuel | runs dry ~375m with ~50/58 cargo |
| Late P1 (T1+T2 maxed) | cargo full at ~285m, 95% fuel | cargo full at ~390m, 91% fuel; core runs (~800m) run out of fuel near the core |

On Pyra (P2) a realistic entry rig now gets ~0.8 tanks from cells per dive (was ~1.8) and a mid-P2 rig ends a full-cargo dive with ~59% fuel (was 82%). Fully maxed rigs stay cargo-bound by design.

## 6. Polish Pass (Oct 2026)
- **Boot splash:** logo, load bar and "click or press any key", held until the sprite atlases and fonts are ready (4s cap). The click also unlocks browser audio, so music starts on the title.
- **Music:** `MusicDirector` builds an ambient score from Web Audio oscillators (no audio files). Each planet has its own four-chord loop with plucks and an echo. In a dive the low-pass filter closes with depth, so the deep strata sound muffled. It has its own Music Volume slider, and the mute button now mutes everything without changing the volume sliders.
- **Transitions:** fade-through-black between screens with a whoosh. Title and results cards settle in, and modals pop. A finished dive is settled exactly once, even while the fade keeps frames running.
- **Fuel pressure feedback:** at 25% fuel a red edge pulse, a warning beep and a pulsing Extract button kick in. At 10% they get faster and harsher.
- **Dive callouts:** a "NEW DEPTH RECORD" toast when you pass your previous best, and a "CARGO FULL" toast telling you to winch up.
- **First-dive tips** (first 3 dives): contract, ore only pays at the surface, fuel cells, and an urgent "winch now" tip at 30% fuel.
- **Interface feel:** click and hover sounds on every button, press-down scale, and a keyboard focus ring.
- **Auto-pause** when the tab is hidden or the window loses focus. Audio is suspended while the tab is hidden.
- **Reduced Motion setting:** defaults to the OS preference. It turns off shake, flattens CSS animation and shortens transitions.
- **Page:** favicon, meta description and theme colour.

## 7. Surface Base & Mine Look (Oct 2026)
Reference: Coal LLC, with its readable side-on mine and a company yard on top.
- **Wider mine:** `WORLD_COLS` went from 21 to 45. The camera eases after the pod on both axes and clamps to the world edges, so the screen is all ground with no dark side bars. It frames more of the yard while the pod sits at the surface.
- **Surface yard (`render/SurfaceBase.ts`):** a daylight sky per planet with drifting clouds, sun or moon, and two parallax hill bands. The yard has an office ("CORE DIVER CO."), a fuel tower and pump, a derrick straddling the shaft mouth with a spinning sheave, an ore depot with a running conveyor, a garage, lamps, trees, fences and four workers pacing. There is a grass, snow or ash lip along the ground. The title screen shows the same yard with a slow pan.
- **Seamless rock (`render/rockTiles.ts`):** sheet tiles are cropped inside their baked rim, and each row and column is rescaled to the tile's mean brightness, then mirrored per tile by hash. The rock reads as one face instead of a grid. Strata blend over a few rows with jitter instead of meeting on a ruled line.
- **Tunnels:** dug tiles show a darkened back wall with soft shadows from the rock around them. Rock edges get a lit top lip and darker undersides.
- **Ore in pockets:** ore chance is scaled by smooth value noise (mean of about 1), so ore forms clusters. Ore share is about 24% of tiles. Ore and pickups draw at about 75% size with a small offset and a contact shadow, so they sit in the rock.
- **Lighting:** daylight fades over the first 14 rows into darkness that deepens each stratum. The pod lamp and forward beam cut it open, with a warm tint. Fuel cells, relics, beacons and the core glow through the dark. Dust drifts in the lamp light.
- **Readability:** ore popups are now just "+$value" (plus "2× ORE"), armored veins use riveted steel bands, and the surface drill prompt sits on a pill. On short landscape phones the controls bar hides and the tips take over.

## 6. Art Direction: Neon Grid (Oct 2026)
The painted "company issue" look is replaced by a synthwave neon style, all drawn in code (no sprite sheets).
- **Art set** lives in `assets/neonArt.ts`: low-poly dark rock per stratum (`NEON_STRATA` holds each stratum's face and glow colour), glowing crystal and nugget ores, outlined pods per tier (cyan, hot pink, violet), and neon fuel cells, beacons, relics, cores and drones.
- **Dive view:** rock edges that face a tunnel glow in the stratum colour, and ores get a soft halo. Both are drawn after the darkness pass (`DiveRenderer.drawNeonPass`) so they read at any depth.
- **Surface** (`render/SurfaceBase.ts`): night sky with stars, a striped retro sun, wireframe mountains, and a neon outpost (HQ tower, fuel station, derrick, refinery, hangar).
- **UI:** `neon.css` loads after `theme.css`, re-points its tokens at the neon palette and swaps rivets, hazard stripes and paper slips for glass panels with glowing edges. Fonts are Orbitron (display), Rajdhani (body) and Share Tech Mono (readouts).
