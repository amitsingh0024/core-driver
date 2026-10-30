/**
 * Headless pacing bot: plays whole campaigns with the real DrillPod, DiveWorld and dive
 * settlement, buying upgrades greedily between dives, and reports how long dives last, what
 * they pay and how many upgrades each one buys.
 *
 *   npm run pacing            # 4 seeds, Terra-Vein through Pyra-Void
 *   npm run pacing -- 8 1     # 8 seeds, stop after cracking planet 1
 */
import { PLANETS } from '../src/config/planets';
import { computePlayerStats, buyableUpgrades } from '../src/config/skillTree';
import { DiveWorld, TILE_SIZE } from '../src/game/DiveWorld';
import { DrillPod } from '../src/game/DrillPod';
import { settleDive } from '../src/game/DivePayout';
import { currentWorkOrder } from '../src/game/DiveContract';
import { getDefaultSaveState, SaveState } from '../src/sdk/PortalSDK';
import { ParticleSystem } from '../src/game/ParticleSystem';
import { SoundManager } from '../src/game/SoundManager';

const DT = 1 / 60;
const MAX_DIVE_SECONDS = 900;
/** Time a player spends on results, the hangar and the dive intro between dives. */
const BETWEEN_DIVES_SECONDS = 20;
/** Bot extracts when fuel drops under this share of the tank (a cautious player's margin). */
const EXTRACT_FUEL_SHARE = 0.08;

const noop = () => undefined;
const quiet = new Proxy({}, { get: () => noop }) as unknown as SoundManager & ParticleSystem;

let rngState = 1;
function seededRandom(): number {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 4294967296;
}

interface DiveLog {
  planet: number;
  seconds: number;
  depth: number;
  earned: number;
  bought: number;
  reason: string;
}

/**
 * Points the pod at the most valuable nearby ore or fuel cell below it, else straight down.
 * Like a player, it skips ore until it is close to its best depth, so cargo fills with the
 * richest ore it can reach.
 */
function steer(pod: DrillPod, world: DiveWorld, mineFrom: number): { x: number; y: number } {
  const gx0 = Math.floor(pod.x / TILE_SIZE);
  const gy0 = Math.floor(pod.y / TILE_SIZE);
  const lowFuel = pod.fuel < pod.maxFuel * 0.45;
  let best: { x: number; y: number } | null = null;
  let bestScore = 0;
  for (let gy = gy0; gy <= gy0 + 4; gy++) {
    for (let gx = gx0 - 4; gx <= gx0 + 4; gx++) {
      const b = world.getBlock(gx, gy);
      if (!b || b.type === 'empty' || b.type === 'bedrock') continue;
      const dist = Math.hypot(gx - gx0, gy - gy0) + 0.5;
      let value = 0;
      if (b.type === 'fuel_cell') value = lowFuel ? 400 : 40;
      else if (b.type === 'relic') value = 300;
      else if (b.oreId && pod.cargoUsed < pod.maxCargo && pod.depthMeters >= mineFrom) value = 60 + (b.armored ? 20 : 0);
      if (value <= 0) continue;
      const score = value / (dist * dist);
      if (score > bestScore) {
        bestScore = score;
        best = { x: (gx + 0.5) * TILE_SIZE, y: (gy + 0.5) * TILE_SIZE };
      }
    }
  }
  // Above the mining depth, weave toward the column with the least ore ahead so the hold
  // isn't filled with cheap ore on the way down
  if (!best && pod.depthMeters < mineFrom) {
    let bestCol = gx0;
    let fewest = Infinity;
    for (let gx = gx0 - 2; gx <= gx0 + 2; gx++) {
      let ore = Math.abs(gx - gx0) * 0.3;
      for (let gy = gy0 + 1; gy <= gy0 + 4; gy++) {
        const b = world.getBlock(gx, gy);
        if (!b || b.type === 'bedrock') ore += 99;
        else if (b.oreId) ore += 1;
      }
      if (ore < fewest) {
        fewest = ore;
        bestCol = gx;
      }
    }
    best = { x: (bestCol + 0.5) * TILE_SIZE, y: pod.y + 3 * TILE_SIZE };
  }
  // A target under the pod's nose reads as no input, so aim through it
  if (best && Math.hypot(best.x - pod.x, best.y - pod.y) < 24) best.y += 60;
  return best ?? { x: pod.x + Math.sin(pod.animTime * 0.7) * 30, y: pod.y + 200 };
}

function playDive(save: SaveState, seed: number, push: boolean): DiveLog {
  const planet = PLANETS[save.currentPlanetId - 1];
  const stats = computePlayerStats(save.ownedSkills);
  const world = new DiveWorld(planet, seed);
  const pod = new DrillPod(stats);
  const contract = currentWorkOrder(save, planet, stats);

  // A push dive ignores ore and goes for depth (and the core), as a stuck player would
  const mineFrom = push ? Infinity : (save.deepestByPlanet[planet.id] ?? 0) * 0.8;
  let t = 0;
  while (!pod.endReason && t < MAX_DIVE_SECONDS) {
    // With a full hold, richer ore swaps out the cheapest, so keep going once mining has started
    const holdDone = pod.cargoUsed >= pod.maxCargo && pod.depthMeters >= Math.max(mineFrom, 60) && t > 20;
    const wantOut = holdDone || pod.fuel < pod.maxFuel * EXTRACT_FUEL_SHARE;
    const target = wantOut ? null : steer(pod, world, mineFrom);
    pod.update(DT, stats, world, 0, 0, target, wantOut, quiet, quiet);
    t += DT;
  }

  const contractMet = contract?.kind === 'depth' && pod.maxDepthReached >= contract.target;
  const payout = settleDive(
    {
      reason: pod.endReason ?? 'extracted',
      cargoManifest: pod.cargoManifest,
      maxDepthReached: pod.maxDepthReached,
      comboBonusCredits: pod.comboBonusCredits,
      relicCredits: pod.relicCredits,
      relicsFound: pod.relicsFound,
      contract,
      contractMetDuringDive: contractMet,
    },
    planet,
    stats,
    save
  );

  // Greedy shopper: keep buying the cheapest upgrade that is open and affordable
  let bought = 0;
  for (;;) {
    const options = buyableUpgrades(save).filter((o) => o.cost <= save.cash);
    if (options.length === 0) break;
    options.sort((a, b) => a.cost - b.cost);
    const pick = options[0];
    save.cash -= pick.cost;
    save.ownedSkills[pick.id] = (save.ownedSkills[pick.id] ?? 0) + 1;
    bought++;
  }

  // Move on as soon as the next planet opens
  if (payout.unlockedNextPlanet) save.currentPlanetId = save.highestUnlockedPlanet;

  return {
    planet: planet.id,
    seconds: t,
    depth: pod.maxDepthReached,
    earned: payout.totalEarned,
    bought,
    reason: pod.endReason === 'extracted' ? (pod.cargoUsed >= pod.maxCargo ? 'full hold' : 'low fuel') : pod.endReason ?? 'timeout',
  };
}

function campaign(seed: number, lastPlanet: number): DiveLog[] {
  rngState = seed;
  Math.random = seededRandom;
  const save = getDefaultSaveState();
  const logs: DiveLog[] = [];
  while (logs.length < 600) {
    const startPlanet = save.currentPlanetId;
    const recent = logs.filter((d) => d.planet === startPlanet).slice(-3);
    const stalled = recent.length === 3 && recent.every((d) => d.depth < (save.deepestByPlanet[startPlanet] ?? 0));
    // Nothing left to buy here, so the only goal is the core
    const doneShopping = buyableUpgrades(save).length === 0;
    logs.push(playDive(save, seed * 7919 + logs.length, stalled || doneShopping));
    if (startPlanet === lastPlanet && save.highestUnlockedPlanet > lastPlanet) break;
    if (startPlanet === PLANETS.length && logs.at(-1)!.reason === 'core_shattered') break;
  }
  return logs;
}

/** Longest run of dives in a row that bought nothing. */
function longestDrySpell(dives: DiveLog[]): number {
  let best = 0;
  let run = 0;
  for (const d of dives) {
    run = d.bought === 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

const fmtMin = (s: number) => `${(s / 60).toFixed(1)} min`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const seeds = Number(process.argv[2] ?? 4);
const lastPlanet = Number(process.argv[3] ?? PLANETS.length);

const runs = Array.from({ length: seeds }, (_, i) => campaign(1000 + i * 37, lastPlanet));

if (process.env.TRAIL) for (const d of runs[0]) console.log(`  P${d.planet} ${d.seconds.toFixed(0)}s ${d.depth}m $${Math.round(d.earned)} +${d.bought} ${d.reason}`);
console.log(`Pacing bot: ${seeds} seeds, up to planet ${lastPlanet}\n`);
console.log('First 8 dives (seed 1): planet, seconds, depth, earned, upgrades bought, end');
for (const d of runs[0].slice(0, 8)) {
  console.log(`  P${d.planet}  ${d.seconds.toFixed(0).padStart(4)} s  ${String(d.depth).padStart(4)} m  $${String(Math.round(d.earned)).padStart(7)}  ${d.bought} bought  ${d.reason}`);
}

console.log('\nPer planet, averaged over seeds:');
for (const p of PLANETS.slice(0, lastPlanet)) {
  const per = runs.map((r) => r.filter((d) => d.planet === p.id));
  const dives = avg(per.map((r) => r.length));
  const playSec = avg(per.map((r) => r.reduce((s, d) => s + d.seconds + BETWEEN_DIVES_SECONDS, 0)));
  const all = per.flat();
  const early = per.flatMap((r) => r.slice(0, 5));
  console.log(
    `  ${p.name.padEnd(11)} dives ${dives.toFixed(1).padStart(5)}  time ${fmtMin(playSec).padStart(9)}  ` +
      `avg dive ${avg(all.map((d) => d.seconds)).toFixed(0)} s  ` +
      `first 5 dives: ${avg(early.map((d) => d.seconds)).toFixed(0)} s, $${avg(early.map((d) => d.earned)).toFixed(0)}, ` +
      `${avg(early.map((d) => d.bought)).toFixed(1)} upgrades/dive  ` +
      `dry spells ${avg(per.map((r) => longestDrySpell(r)))
        .toFixed(1)} dives  ` +
      `fuel-outs ${((all.filter((d) => d.reason === 'fuel_out').length / Math.max(1, all.length)) * 100).toFixed(0)}%`
  );
}
const total = avg(runs.map((r) => r.reduce((s, d) => s + d.seconds + BETWEEN_DIVES_SECONDS, 0)));
console.log(`\nTotal playtime: ${fmtMin(total)} over ${avg(runs.map((r) => r.length)).toFixed(0)} dives`);
