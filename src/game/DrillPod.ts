import { ComputedPlayerStats } from '../config/skillTree';
import { neonStratum, oreNeon } from '../assets/neonArt';
import { ORES } from '../config/ores';
import { DiveWorld, TILE_SIZE, WORLD_COLS, METERS_PER_ROW, WorldBlock, rarestOre } from './DiveWorld';
import { ParticleSystem } from './ParticleSystem';
import { SoundManager } from './SoundManager';

export type DiveEndReason = 'extracted' | 'fuel_out' | 'core_shattered' | null;

/** Something the dive feedback layer (hit-stop, flash, haptics) should react to. */
export interface DiveEvent {
  kind: 'break' | 'ore' | 'armored' | 'relic' | 'fuel' | 'core' | 'core_shattered';
  x: number;
  y: number;
  color?: string;
}

export interface ActiveDroneBeam {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
}

export class DrillPod {
  public x: number;
  public y: number;
  // Angle in radians where 0 = pointing straight DOWN (+Y), +PI/2 = RIGHT (+X), -PI/2 = LEFT (-X)
  public angle = 0;
  public fuel: number;
  public maxFuel: number;
  public currentFuelBurnRate = 0;
  public cargoUsed = 0;
  public maxCargo: number;
  public cargoManifest: Record<string, number> = {};
  public depthMeters = 0;
  public maxDepthReached = 0;
  public isMoving = false;
  public isDrilling = false;
  public isHardGrinding = false;
  public extractProgress = 0;
  public endReason: DiveEndReason = null;
  public screenShake = 0;
  public animTime = 0;
  public coreBlocksBroken = 0;
  public coreBlocksTarget = 10;
  public droneBeams: ActiveDroneBeam[] = [];
  public comboOreId: string | null = null;
  public comboCount = 0;
  public comboTimer = 0;
  /** Extra credits earned from same-ore combos; carried in cargo, so a tow loses part of it. */
  public comboBonusCredits = 0;
  /** Credits banked from relic caches; paid in full even on a fuel-out tow. */
  public relicCredits = 0;
  public relicsFound = 0;
  /** Charges from drilled Extraction Beacons; holding Extract with one skips the winch wait. */
  public beaconCharges = 0;
  public events: DiveEvent[] = [];

  constructor(stats: ComputedPlayerStats) {
    this.x = (WORLD_COLS / 2) * TILE_SIZE;
    this.y = 20;
    this.maxFuel = stats.maxFuel;
    this.fuel = stats.maxFuel;
    this.maxCargo = stats.maxCargo;
  }

  public update(
    dt: number,
    stats: ComputedPlayerStats,
    world: DiveWorld,
    moveVecX: number, // -1..+1 from keyboard
    moveVecY: number, // -1..+1 from keyboard (+1 = Down, -1 = Up)
    pointerWorldPos: { x: number; y: number } | null, // world (x,y) if holding mouse/touch
    holdingExtract: boolean,
    particles: ParticleSystem,
    sound: SoundManager
  ): void {
    if (this.endReason) return;
    this.animTime += dt;
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 18);
    }
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboOreId = null;
      }
    }

    // 1. Handle Hold-to-Extract Winch (Option A surfacing, 0 fuel cost!)
    if (holdingExtract && this.beaconCharges > 0) {
      this.beaconCharges--;
      this.extractProgress = 1;
      this.endReason = 'extracted';
      sound.playSurfaceExtract(true);
      return;
    }

    if (holdingExtract) {
      this.isMoving = false;
      this.isDrilling = false;
      this.isHardGrinding = false;
      this.currentFuelBurnRate = 0;
      this.extractProgress += dt / stats.winchHoldSeconds;
      if (this.extractProgress >= 1) {
        this.extractProgress = 1;
        this.endReason = 'extracted';
        sound.playSurfaceExtract(true);
      }
      return;
    } else {
      this.extractProgress = Math.max(0, this.extractProgress - dt * 2.2);
    }

    // 2. Determine Active Player Movement Intent (Does NOT auto-drop when idle!)
    let targetDirX = 0;
    let targetDirY = 0;
    let hasMovementInput = false;

    if (pointerWorldPos !== null) {
      const dx = pointerWorldPos.x - this.x;
      const dy = pointerWorldPos.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        targetDirX = dx / dist;
        targetDirY = dy / dist;
        hasMovementInput = true;
      }
    } else if (Math.hypot(moveVecX, moveVecY) > 0.05) {
      const len = Math.hypot(moveVecX, moveVecY);
      targetDirX = moveVecX / len;
      targetDirY = moveVecY / len;
      hasMovementInput = true;
    }

    // Update Autonomous Orbiting Mining Drones (never drains player fuel)
    this.updateDrones(dt, stats, world, particles, sound);

    // If player is IDLE, stop immediately and consume ZERO fuel!
    if (!hasMovementInput) {
      this.isMoving = false;
      this.isDrilling = false;
      this.isHardGrinding = false;
      this.currentFuelBurnRate = 0;
      return;
    }

    this.isMoving = true;

    // Smoothly rotate pod nose toward target direction (0 rad = straight down +Y)
    const desiredAngle = Math.atan2(targetDirX, targetDirY);
    let angleDiff = desiredAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle += angleDiff * Math.min(1, dt * stats.turnSpeedRad * 4.2);

    const dirX = Math.sin(this.angle);
    const dirY = Math.cos(this.angle);

    // 3. Find blocks overlapping the Drill Cone tip while actively thrusting
    const drillTipX = this.x + dirX * 13;
    const drillTipY = this.y + dirY * 13;
    const drillRad = stats.drillRadiusPx;

    const minGx = Math.max(1, Math.floor((drillTipX - drillRad) / TILE_SIZE));
    const maxGx = Math.min(WORLD_COLS - 2, Math.floor((drillTipX + drillRad) / TILE_SIZE));
    const minGy = Math.max(0, Math.floor((drillTipY - drillRad) / TILE_SIZE));
    const maxGy = Math.min(world.totalRows - 1, Math.floor((drillTipY + drillRad) / TILE_SIZE));

    const contactedBlocks: WorldBlock[] = [];
    let blockingNose = false;

    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const b = world.getBlock(gx, gy);
        if (!b || b.type === 'empty' || b.type === 'bedrock') continue;

        const bx = (gx + 0.5) * TILE_SIZE;
        const by = (gy + 0.5) * TILE_SIZE;
        const dist = Math.hypot(bx - drillTipX, by - drillTipY);
        if (dist <= drillRad + TILE_SIZE * 0.44) {
          contactedBlocks.push(b);
          const hullDist = Math.hypot(bx - (this.x + dirX * 11), by - (this.y + dirY * 11));
          if (hullDist < TILE_SIZE * 0.68) {
            blockingNose = true;
          }
        }
      }
    }

    // 4. Apply Continuous Drill Damage to Contacted Blocks
    this.isDrilling = contactedBlocks.length > 0;
    this.isHardGrinding = false;
    let speedMultiplier = 1.0;

    if (contactedBlocks.length > 0) {
      const splitFactor = Math.pow(contactedBlocks.length, 0.35);
      let totalHardnessRatio = 0;

      for (const b of contactedBlocks) {
        const isCore = b.type === 'core';
        const effectiveDps =
          (stats.drillPower * (isCore ? stats.coreDamageMultiplier : 1)) / splitFactor;
        this.damageBlock(b, effectiveDps * dt, stats, world, particles, sound);
        totalHardnessRatio += b.maxHp / Math.max(1, effectiveDps * 0.45);
      }

      const avgHardnessRatio = totalHardnessRatio / contactedBlocks.length;
      const mitigatedRatio = avgHardnessRatio * (1 - stats.hardnessPenetration);
      this.isHardGrinding = mitigatedRatio > 1.3;

      sound.playDrillTick(mitigatedRatio);

      if (Math.random() < 0.55) {
        const sparkCol = this.isHardGrinding ? '#ffab00' : '#ffd54f';
        particles.spawnRockSparks(
          drillTipX + (Math.random() - 0.5) * 14,
          drillTipY + dirY * 6,
          sparkCol,
          this.isHardGrinding ? 3 : 2
        );
      }

      if (blockingNose) {
        speedMultiplier *= Math.min(0.18, 0.35 / (1 + mitigatedRatio));
      } else {
        speedMultiplier *= 1 / (1 + mitigatedRatio * 0.55);
      }
    }

    // 5. Advance Pod Position & Clamp to Shaft Bounds
    const moveStep = stats.moveSpeed * speedMultiplier * dt;
    this.x += dirX * moveStep;
    this.y = Math.max(16, this.y + dirY * moveStep);

    const minWorldX = TILE_SIZE * 1.5;
    const maxWorldX = (WORLD_COLS - 1.5) * TILE_SIZE;
    if (this.x < minWorldX) {
      this.x = minWorldX;
    } else if (this.x > maxWorldX) {
      this.x = maxWorldX;
    }
    // Bedrock floor sits below the core rows; drilling skips it, so clamp here
    const maxWorldY = (world.coreStartRow + 4) * TILE_SIZE - TILE_SIZE * 0.5;
    if (this.y > maxWorldY) this.y = maxWorldY;

    this.depthMeters = Math.max(0, Math.floor((this.y / TILE_SIZE) * METERS_PER_ROW));
    if (this.depthMeters > this.maxDepthReached) {
      this.maxDepthReached = this.depthMeters;
    }

    // 6. Active Fuel Drain (ONLY when moving or drilling!)
    const { stratum } = world.getStratumForDepth(this.depthMeters);
    let hazardMult = 1.0;
    if (world.planet.id === 2) {
      hazardMult = 1.0 + 0.35 * (1 - stats.cryoHazardReduction);
    } else if (world.planet.id === 3) {
      hazardMult = 1.0 + 0.65 * (1 - stats.voidHazardReduction);
    }

    const thrustBurn = 2.0 * stats.fuelBurnMultiplier * hazardMult;
    const drillingBurn = this.isDrilling
      ? stratum.fuelDrainPerSec * stats.fuelBurnMultiplier * hazardMult
      : 0;

    this.currentFuelBurnRate = thrustBurn + drillingBurn;
    this.fuel -= this.currentFuelBurnRate * dt;

    if (this.fuel <= 0) {
      this.fuel = 0;
      this.endReason = 'fuel_out';
      this.screenShake = 10;
      sound.playSurfaceExtract(false);
    }
  }

  private updateDrones(
    dt: number,
    stats: ComputedPlayerStats,
    world: DiveWorld,
    particles: ParticleSystem,
    sound: SoundManager
  ): void {
    this.droneBeams = [];
    if (stats.droneCount <= 0) return;

    const centerGx = Math.floor(this.x / TILE_SIZE);
    const centerGy = Math.floor(this.y / TILE_SIZE);

    for (let d = 0; d < stats.droneCount; d++) {
      const orbitAngle = this.animTime * 3.2 + (d * Math.PI * 2) / stats.droneCount;
      const dx = this.x + Math.cos(orbitAngle) * 28;
      const dy = this.y + Math.sin(orbitAngle) * 20;

      let bestBlock: WorldBlock | null = null;
      let bestScore = Infinity;

      for (
        let gy = Math.max(1, centerGy - 2);
        gy <= Math.min(world.totalRows - 1, centerGy + 3);
        gy++
      ) {
        for (
          let gx = Math.max(1, centerGx - 3);
          gx <= Math.min(WORLD_COLS - 2, centerGx + 3);
          gx++
        ) {
          const b = world.getBlock(gx, gy);
          if (!b || b.type === 'empty' || b.type === 'bedrock') continue;
          const bx = (gx + 0.5) * TILE_SIZE;
          const by = (gy + 0.5) * TILE_SIZE;
          const dist = Math.hypot(bx - dx, by - dy);
          if (dist > 105) continue;
          const priority =
            b.oreId || b.type === 'fuel_cell' || b.type === 'core' ? dist * 0.55 : dist;
          if (priority < bestScore) {
            bestScore = priority;
            bestBlock = b;
          }
        }
      }

      if (bestBlock) {
        const tx = (bestBlock.gx + 0.5) * TILE_SIZE;
        const ty = (bestBlock.gy + 0.5) * TILE_SIZE;
        this.droneBeams.push({
          fromX: dx,
          fromY: dy,
          toX: tx,
          toY: ty,
          color: d === 2 ? '#ff4081' : d === 1 ? '#ea80fc' : '#00e5ff',
        });
        this.damageBlock(bestBlock, stats.droneDps * dt, stats, world, particles, sound);
      }
    }
  }

  private damageBlock(
    b: WorldBlock,
    damage: number,
    stats: ComputedPlayerStats,
    world: DiveWorld,
    particles: ParticleSystem,
    sound: SoundManager
  ): void {
    if (b.type === 'empty' || b.type === 'bedrock') return;

    const prevHp = b.hp;
    b.hp -= damage;

    if (b.type === 'core') {
      const dealt = Math.min(prevHp, damage);
      world.currentCoreHp = Math.max(0, world.currentCoreHp - dealt);
    }

    if (b.hp > 0) return;

    const bx = (b.gx + 0.5) * TILE_SIZE;
    const by = (b.gy + 0.5) * TILE_SIZE;
    const stratum = world.planet.strata[b.stratumIdx] ?? world.planet.strata[0];

    if (b.type === 'fuel_cell') {
      const restoreAmt = Math.round((stats.maxFuel * stats.fuelCellRestorePct) / 100);
      this.fuel = Math.min(this.maxFuel, this.fuel + restoreAmt);
      particles.spawnBlockBurst(bx, by, '#00e676', '#b9f6ca', 14);
      particles.addFloatingText(bx, by - 6, `+${restoreAmt} FUEL`, '#00e676', 1.15);
      sound.playFuelPickup();
      this.events.push({ kind: 'fuel', x: bx, y: by, color: '#00e676' });
      b.type = 'empty';
      b.hp = 0;
      return;
    }

    if (b.type === 'beacon') {
      particles.spawnBlockBurst(bx, by, '#00e5ff', '#ffffff', 18);
      particles.addFloatingText(bx, by - 6, 'BEACON CHARGED!', '#00e5ff', 1.25, 'Extract is now instant');
      sound.playFuelPickup();
      this.events.push({ kind: 'fuel', x: bx, y: by, color: '#00e5ff' });
      b.type = 'empty';
      b.hp = 0;
      this.beaconCharges++;
      return;
    }

    if (b.type === 'relic') {
      const bestOre = ORES[rarestOre(stratum) ?? ''];
      const bounty = Math.round((bestOre?.value ?? 10) * (4 + Math.random() * 3) * stats.oreValueMultiplier);
      this.relicCredits += bounty;
      this.relicsFound++;
      particles.spawnBlockBurst(bx, by, '#ffd54f', '#fff8e1', 22);
      particles.addFloatingText(bx, by - 6, 'RELIC CACHE!', '#ffd54f', 1.3, `+$${bounty.toLocaleString()} banked`);
      sound.playRelicOpen();
      this.events.push({ kind: 'relic', x: bx, y: by, color: '#ffd54f' });
      b.type = 'empty';
      b.hp = 0;
      return;
    }

    if (b.type === 'core') {
      this.coreBlocksBroken++;
      this.screenShake = Math.max(this.screenShake, 7);
      particles.spawnBlockBurst(bx, by, world.planet.coreGlowColor, '#ffffff', 18);
      sound.playBlockBreak(true);
      this.events.push({ kind: 'core', x: bx, y: by, color: world.planet.coreGlowColor });
      b.type = 'empty';
      b.hp = 0;

      if (this.coreBlocksBroken >= this.coreBlocksTarget || world.currentCoreHp <= 0) {
        this.endReason = 'core_shattered';
        this.screenShake = 18;
        sound.playCoreShatter();
        this.events.push({ kind: 'core_shattered', x: bx, y: by, color: world.planet.coreGlowColor });
      }
      return;
    }

    const oreId = b.oreId;
    const oreCfg = oreId ? ORES[oreId] : null;
    particles.spawnBlockBurst(bx, by, neonStratum(stratum.id).glow, oreCfg ? oreNeon(oreCfg) : undefined, oreCfg ? 12 : 7);
    sound.playBlockBreak(false);
    this.events.push({
      kind: b.armored ? 'armored' : oreCfg ? 'ore' : 'break',
      x: bx,
      y: by,
      color: oreCfg?.highlightColor,
    });

    if (oreCfg) {
      if (this.comboOreId === oreCfg.id && this.comboTimer > 0) {
        this.comboCount = Math.min(4, this.comboCount + 1);
      } else {
        this.comboOreId = oreCfg.id;
        this.comboCount = 1;
      }
      this.comboTimer = 4.5;

      if (this.cargoUsed < this.maxCargo) {
        const isDouble = Math.random() < stats.doubleOreChance;
        const spaceLeft = this.maxCargo - this.cargoUsed;
        const qty = Math.min(spaceLeft, isDouble ? 2 : 1);
        this.cargoUsed += qty;
        this.cargoManifest[oreCfg.id] = (this.cargoManifest[oreCfg.id] ?? 0) + qty;

        const comboMult = this.comboCount > 1 ? 1 + (this.comboCount - 1) * 0.15 : 1;
        const baseVal = Math.round(oreCfg.value * stats.oreValueMultiplier);
        const unitVal = Math.round(baseVal * comboMult);
        this.comboBonusCredits += (unitVal - baseVal) * qty;
        // Short value popups keep a fast dig readable; the ore name and combo live in the pod badge
        particles.addFloatingText(
          bx,
          by - 6,
          `+$${(unitVal * qty).toLocaleString()}`,
          oreCfg.highlightColor,
          isDouble || this.comboCount > 1 ? 1.15 : 0.95,
          isDouble ? '2× ORE' : undefined
        );
        sound.playOrePickup(oreCfg.tier, isDouble || this.comboCount > 1);
      } else {
        // Full hold: a richer ore pushes out the cheapest one, so going deeper still pays
        const cheapest = this.cheapestHeldOre();
        if (cheapest && ORES[cheapest].value < oreCfg.value) {
          this.cargoManifest[cheapest]--;
          if (this.cargoManifest[cheapest] <= 0) delete this.cargoManifest[cheapest];
          this.cargoManifest[oreCfg.id] = (this.cargoManifest[oreCfg.id] ?? 0) + 1;
          particles.addFloatingText(bx, by - 6, `SWAP +${oreCfg.name}`, oreCfg.highlightColor, 1.0, `dumped ${ORES[cheapest].name}`);
          sound.playOrePickup(oreCfg.tier, false);
        } else {
          particles.addFloatingText(bx, by - 6, 'CARGO FULL!', '#ff5252', 0.95);
        }
      }
    }

    b.type = 'empty';
    b.oreId = null;
    b.armored = false;
    b.hp = 0;
  }

  private cheapestHeldOre(): string | null {
    let best: string | null = null;
    for (const [oreId, count] of Object.entries(this.cargoManifest)) {
      if (count > 0 && (!best || ORES[oreId].value < ORES[best].value)) best = oreId;
    }
    return best;
  }
}
