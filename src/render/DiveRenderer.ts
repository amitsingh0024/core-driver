import { ORES } from '../config/ores';
import { GameContext } from '../core/GameContext';
import { TILE_SIZE, WORLD_COLS, METERS_PER_ROW } from '../game/DiveWorld';
import { DiveScreen } from '../screens/DiveScreen';
import { fitCanvasToDisplay, podLayers } from './podView';
import { drawGroundLip, drawSurfaceBase, drawSurfaceSky } from './SurfaceBase';
import { DiveWorld } from '../game/DiveWorld';
import { mix, neonStratum, oreNeon, rgba } from '../assets/neonArt';

/** Draws one frame of the dive: tiles, core, radar, drones, pod, effects. */
export class DiveRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(
    private canvas: HTMLCanvasElement,
    private game: GameContext,
    private dive: DiveScreen
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Camera top-left in world pixels; DiveScreen uses it to map pointer input. */
  public camX = 0;
  public camY = 0;
  private camReady = false;
  private lastRenderTime = performance.now();
  private shade = document.createElement('canvas');
  private wallTiles = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
  private dust = Array.from({ length: 46 }, (_, i) => ({
    x: (i * 7919) % 1000 / 1000,
    y: (i * 104729) % 1000 / 1000,
    size: 0.8 + ((i * 31) % 10) / 6,
    speed: 4 + ((i * 17) % 10),
  }));

  /** Snap the camera to the pod on the next frame (new dive). */
  public resetCamera(): void {
    this.camReady = false;
  }

  private updateCamera(w: number, h: number, dt: number): void {
    const { pod } = this.dive;
    const worldW = WORLD_COLS * TILE_SIZE;
    const targetX = worldW <= w ? (worldW - w) / 2 : Math.max(0, Math.min(worldW - w, pod.x - w / 2));
    // Keep more of the yard in view while the pod sits at the surface
    const targetY = pod.y - h * (pod.depthMeters <= 8 ? 0.62 : 0.42);
    if (!this.camReady) {
      this.camX = targetX;
      this.camY = targetY;
      this.camReady = true;
      return;
    }
    const k = 1 - Math.exp(-dt * 7);
    this.camX += (targetX - this.camX) * k;
    this.camY += (targetY - this.camY) * k;
  }

  private rockTile(stratumId: string): HTMLCanvasElement | undefined {
    return this.game.atlas.blockTiles.get(stratumId);
  }

  /** Rock texture darkened for dug-out tunnels with a faint neon grid, cached per source texture. */
  private wallTile(stratumId: string): HTMLCanvasElement | undefined {
    const src = this.rockTile(stratumId);
    if (!src) return undefined;
    let tile = this.wallTiles.get(src);
    if (!tile) {
      tile = document.createElement('canvas');
      tile.width = src.width;
      tile.height = src.height;
      const c = tile.getContext('2d')!;
      c.drawImage(src, 0, 0);
      c.fillStyle = 'rgba(5, 3, 12, 0.84)';
      c.fillRect(0, 0, tile.width, tile.height);
      c.strokeStyle = rgba(neonStratum(stratumId).glow, 0.1);
      c.lineWidth = 2;
      c.strokeRect(0, 0, tile.width, tile.height);
      this.wallTiles.set(src, tile);
    }
    return tile;
  }

  /** Draws a tile texture mirrored on x and/or y by its hash (no rotation, so layered rock keeps its grain). */
  private drawVariant(
    ctx: CanvasRenderingContext2D,
    tex: HTMLCanvasElement,
    sx: number,
    sy: number,
    hash: number,
    dpr: number
  ): void {
    const fx = hash & 1 ? -1 : 1;
    const fy = hash & 2 ? -1 : 1;
    const half = TILE_SIZE / 2;
    // Overdraw by half a pixel so flipped neighbours never show a seam
    ctx.setTransform(dpr * fx, 0, 0, dpr * fy, dpr * (sx + half), dpr * (sy + half));
    ctx.drawImage(tex, -half - 0.5, -half - 0.5, TILE_SIZE + 1, TILE_SIZE + 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Drawn on top of the darkness so the neon still reads in deep rock: glowing lines along every
   * rock edge that faces a tunnel, and a soft halo behind each ore.
   */
  private drawNeonPass(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    startGx: number,
    endGx: number,
    startGy: number,
    endGy: number
  ): void {
    const { world } = this.dive;
    const T = TILE_SIZE;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let gy = Math.max(1, startGy); gy <= endGy; gy++) {
      for (let gx = startGx; gx <= endGx; gx++) {
        const b = world.getBlock(gx, gy);
        if (!b || b.type === 'empty' || b.type === 'bedrock') continue;
        const sx = gx * T - camX;
        const sy = gy * T - camY;
        if (b.oreId) {
          const ore = ORES[b.oreId];
          if (ore) ctx.drawImage(glowSprite(oreNeon(ore)), sx - T * 0.25, sy - T * 0.25, T * 1.5, T * 1.5);
        }
        const up = isOpen(world, gx, gy - 1);
        const down = isOpen(world, gx, gy + 1);
        const left = isOpen(world, gx - 1, gy);
        const right = isOpen(world, gx + 1, gy);
        if (!(up || down || left || right)) continue;
        const glow = neonStratum(b.stratumId).glow;
        ctx.fillStyle = rgba(glow, 0.18);
        if (up) ctx.fillRect(sx, sy - 3, T, 7);
        if (down) ctx.fillRect(sx, sy + T - 4, T, 7);
        if (left) ctx.fillRect(sx - 3, sy, 7, T);
        if (right) ctx.fillRect(sx + T - 4, sy, 7, T);
        ctx.fillStyle = rgba(mix(glow, '#ffffff', 0.35), 0.85);
        if (up) ctx.fillRect(sx, sy, T, 2);
        if (down) ctx.fillRect(sx, sy + T - 2, T, 2);
        if (left) ctx.fillRect(sx, sy, 2, T);
        if (right) ctx.fillRect(sx + T - 2, sy, 2, T);
      }
    }
    ctx.restore();
  }

  private drawLighting(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number,
    camX: number,
    camY: number,
    stratumIndex: number,
    startGx: number,
    endGx: number,
    startGy: number,
    endGy: number
  ): void {
    const { world, pod } = this.dive;
    const shade = this.shade;
    if (shade.width !== Math.floor(w * dpr) || shade.height !== Math.floor(h * dpr)) {
      shade.width = Math.floor(w * dpr);
      shade.height = Math.floor(h * dpr);
    }
    const s = shade.getContext('2d')!;
    s.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, w, h);

    // Daylight reaches a few rows down, then fades to a darkness that grows with each stratum
    const maxDark = Math.min(0.92, 0.74 + stratumIndex * 0.05);
    const lightEnd = TILE_SIZE * 2 - camY;
    const darkStart = TILE_SIZE * 14 - camY;
    if (darkStart > 0) {
      const g = s.createLinearGradient(0, lightEnd, 0, darkStart);
      g.addColorStop(0, 'rgba(4, 3, 8, 0)');
      g.addColorStop(1, `rgba(4, 3, 8, ${maxDark})`);
      s.fillStyle = g;
      s.fillRect(0, Math.max(0, lightEnd), w, h);
    } else {
      s.fillStyle = `rgba(4, 3, 8, ${maxDark})`;
      s.fillRect(0, 0, w, h);
    }
    if (lightEnd > 0) s.clearRect(0, 0, w, lightEnd);

    // Cut-outs: pod lamp, a forward beam, and soft glows from fuel cells, relics, beacons and the core
    s.globalCompositeOperation = 'destination-out';
    const px = pod.x - camX;
    const py = pod.y - camY;
    const lampR = 210 + this.game.stats.scannerRangeTiles * 6;
    const lamp = s.createRadialGradient(px, py, 20, px, py, lampR);
    lamp.addColorStop(0, 'rgba(0,0,0,1)');
    lamp.addColorStop(0.5, 'rgba(0,0,0,0.8)');
    lamp.addColorStop(1, 'rgba(0,0,0,0)');
    s.fillStyle = lamp;
    s.fillRect(px - lampR, py - lampR, lampR * 2, lampR * 2);

    const bx = px + Math.sin(pod.angle) * 120;
    const by = py + Math.cos(pod.angle) * 120;
    const beam = s.createRadialGradient(bx, by, 10, bx, by, 150);
    beam.addColorStop(0, 'rgba(0,0,0,0.75)');
    beam.addColorStop(1, 'rgba(0,0,0,0)');
    s.fillStyle = beam;
    s.fillRect(bx - 150, by - 150, 300, 300);

    for (let gy = startGy; gy <= endGy; gy++) {
      for (let gx = startGx; gx <= endGx; gx++) {
        const b = world.getBlock(gx, gy);
        if (!b) continue;
        const glowing = b.type === 'fuel_cell' || b.type === 'relic' || b.type === 'beacon' || b.type === 'core';
        if (!glowing) continue;
        const cx = (gx + 0.5) * TILE_SIZE - camX;
        const cy = (gy + 0.5) * TILE_SIZE - camY;
        const r = b.type === 'core' ? 90 : 56;
        const glow = s.createRadialGradient(cx, cy, 4, cx, cy, r);
        glow.addColorStop(0, 'rgba(0,0,0,0.85)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        s.fillStyle = glow;
        s.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }

    ctx.drawImage(shade, 0, 0, w, h);

    // Warm lamp tint and biome-specific underground weather caught in the light
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const tint = ctx.createRadialGradient(px, py, 10, px, py, lampR * 0.8);
    const planetId = world.planet.id;
    if (planetId === 2) {
      tint.addColorStop(0, 'rgba(160, 235, 255, 0.11)');
      tint.addColorStop(1, 'rgba(160, 235, 255, 0)');
    } else if (planetId === 3) {
      tint.addColorStop(0, 'rgba(234, 128, 252, 0.11)');
      tint.addColorStop(1, 'rgba(234, 128, 252, 0)');
    } else {
      tint.addColorStop(0, 'rgba(120, 240, 255, 0.10)');
      tint.addColorStop(1, 'rgba(120, 240, 255, 0)');
    }
    ctx.fillStyle = tint;
    ctx.fillRect(px - lampR, py - lampR, lampR * 2, lampR * 2);

    if (pod.depthMeters > 8 && !this.game.save.settings.reducedMotion) {
      const t = pod.animTime;
      for (let i = 0; i < this.dust.length; i++) {
        const d = this.dust[i];
        const driftDir = planetId === 2 ? 1 : -1; // Cryo crystals drift down; spores & magma embers drift up
        const x = ((d.x * w - camX * 0.25 + Math.sin(t * 0.6 + d.y * 11) * 14) % w + w) % w;
        const y = ((d.y * h - camY * 0.25 + driftDir * t * d.speed) % h + h) % h;
        const dist = Math.hypot(x - px, y - py);
        if (dist > lampR) continue;
        const fade = (1 - dist / lampR) * (0.45 + 0.35 * Math.sin(t * 3.5 + i));

        if (planetId === 2) {
          // Sparkling ice crystal glint
          ctx.strokeStyle = `rgba(179, 229, 252, ${fade.toFixed(2)})`;
          ctx.lineWidth = 1;
          const r = d.size * 1.45;
          ctx.beginPath();
          ctx.moveTo(x - r, y);
          ctx.lineTo(x + r, y);
          ctx.moveTo(x, y - r);
          ctx.lineTo(x, y + r);
          ctx.stroke();
        } else if (planetId === 3) {
          // Rising void/magma ember
          ctx.fillStyle = i % 2 === 0 ? `rgba(255, 138, 101, ${fade.toFixed(2)})` : `rgba(234, 128, 252, ${fade.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(x, y, d.size * 0.95, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Bioluminescent spore / warm cavern dust
          ctx.fillStyle = i % 3 === 0 ? `rgba(129, 199, 132, ${fade.toFixed(2)})` : `rgba(255, 236, 200, ${(fade * 0.8).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(x, y, d.size * 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  public render(): void {
    const { world, pod } = this.dive;
    const pointer = this.dive.pointer();
    const { w, h, dpr } = fitCanvasToDisplay(this.canvas);
    const ctx = this.ctx;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastRenderTime) / 1000);
    this.lastRenderTime = now;
    this.updateCamera(w, h, dt);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const planet = world.planet;
    const { stratum, index: stratumIndex } = world.getStratumForDepth(pod.depthMeters);

    const worldPixelWidth = WORLD_COLS * TILE_SIZE;
    const { screenShake, reducedMotion } = this.game.save.settings;
    const shakeMult = screenShake && !reducedMotion ? 1 : 0;
    const shakeX = (Math.random() - 0.5) * pod.screenShake * shakeMult;
    const shakeY = (Math.random() - 0.5) * pod.screenShake * shakeMult;
    const camX = Math.round(this.camX + shakeX);
    const camY = Math.round(this.camY + shakeY);

    // 1. Background: deep wall colour, then sky and the surface yard above ground level
    ctx.fillStyle = stratum.palette.bgWall;
    ctx.fillRect(0, 0, w, h);

    const groundY = -camY;
    const padScreenX = worldPixelWidth * 0.5 - camX;
    if (groundY > 0) {
      drawSurfaceSky(ctx, planet, w, groundY, camX, pod.animTime);
      drawSurfaceBase(ctx, planet, padScreenX, groundY, w, pod.animTime, pod.depthMeters <= 8);
    }

    // 2. Visible tiles: tunnels show a darkened back wall, rock gets flip variants so the grid stops repeating
    const startGy = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
    const endGy = Math.min(world.totalRows - 1, Math.ceil((camY + h) / TILE_SIZE) + 1);
    const startGx = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
    const endGx = Math.min(WORLD_COLS - 1, Math.ceil((camX + w) / TILE_SIZE) + 1);
    const T = TILE_SIZE;

    for (let gy = startGy; gy <= endGy; gy++) {
      const sy = gy * T - camY;

      for (let gx = startGx; gx <= endGx; gx++) {
        const b = world.getBlock(gx, gy);
        if (!b) continue;
        const sx = gx * T - camX;
        const hash = tileHash(gx, gy);

        if (b.type === 'empty') {
          const wall = this.wallTile(b.stratumId);
          if (wall) this.drawVariant(ctx, wall, sx, sy, hash, dpr);
          drawTunnelShadow(ctx, world, gx, gy, sx, sy);
          continue;
        }

        if (b.type === 'bedrock') {
          ctx.fillStyle = '#07050f';
          ctx.fillRect(sx, sy, T, T);
          ctx.strokeStyle = 'rgba(185, 103, 255, 0.12)';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 0.5, sy + 0.5, T - 1, T - 1);
          continue;
        }

        // Jitter the texture's stratum near boundaries so layers blend instead of meeting on a ruled line
        const jitterRows = ((hash >> 8) % 6) - 2.5;
        const texStratum = world.getStratumForDepth(Math.max(0, (gy + jitterRows) * METERS_PER_ROW)).stratum;
        const blockCanvas = this.rockTile(b.type === 'core' ? b.stratumId : texStratum.id);
        if (blockCanvas) this.drawVariant(ctx, blockCanvas, sx, sy, hash, dpr);

        drawRockEdges(ctx, world, gx, gy, sx, sy, hash);

        if (b.type === 'fuel_cell') {
          drawEmbedded(ctx, this.game.atlas.fuelCellTile, sx, sy, hash, 0.86);
          drawFuelCellLiveOverlay(ctx, sx, sy, hash, pod.animTime);
        } else if (b.type === 'beacon') {
          drawEmbedded(ctx, this.game.atlas.beaconTile, sx, sy, hash, 0.86);
          drawBeaconLiveOverlay(ctx, sx, sy, hash, pod.animTime);
        } else if (b.type === 'core') {
          const coreTile = this.game.atlas.coreTiles.get(planet.id);
          if (coreTile) this.game.atlas.drawTile(ctx, coreTile, sx, sy);
          drawCoreLiveOverlay(ctx, sx, sy, gx, gy, planet.coreGlowColor, pod.animTime);
        } else if (b.type === 'relic') {
          drawRelicCache(ctx, this.game.atlas.relicChestTile, sx, sy, pod.animTime + gx * 0.7);
        } else if (b.oreId) {
          const oreCanvas = this.game.atlas.oreOverlays.get(b.oreId);
          if (oreCanvas) {
            drawOreGlowUnderlay(ctx, b.oreId, sx, sy, hash, pod.animTime);
            drawEmbedded(ctx, oreCanvas, sx, sy, hash, b.armored ? 0.8 : 0.74);
            drawOreSparkleOverlay(ctx, b.oreId, sx, sy, hash, pod.animTime);
          }
        }

        if (b.armored) drawArmorPlating(ctx, sx, sy);

        if (b.hp < b.maxHp && b.hp > 0) {
          const dmgRatio = 1 - b.hp / b.maxHp;
          const crackIdx = Math.min(3, Math.floor(dmgRatio * 4));
          const crackCanvas = this.game.atlas.crackTiles[crackIdx];
          if (crackCanvas) this.game.atlas.drawTile(ctx, crackCanvas, sx, sy);
        }
      }

      // Grass lip along the surface row
      if (gy === 0 && groundY > -20) {
        let runStart = -1;
        for (let gx = startGx; gx <= endGx + 1; gx++) {
          const b = gx <= endGx ? world.getBlock(gx, 0) : null;
          const solid = !!b && b.type !== 'empty' && b.type !== 'bedrock';
          if (solid && runStart < 0) runStart = gx;
          if (!solid && runStart >= 0) {
            drawGroundLip(ctx, planet.id, runStart * T - camX, gx * T - camX, groundY);
            runStart = -1;
          }
        }
      }

      const rowDepth = gy * METERS_PER_ROW;
      if (rowDepth > 0 && rowDepth % 100 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '700 11px "Rajdhani", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${rowDepth}m`, Math.max(6, T - camX + 6), sy + 12);
      }
    }

    // 2b. Darkness that deepens with depth, cut open by the pod's lamp and by glowing pickups
    this.drawLighting(ctx, w, h, dpr, camX, camY, stratumIndex, startGx, endGx, startGy, endGy);
    this.drawNeonPass(ctx, camX, camY, startGx, endGx, startGy, endGy);

    // 3. Draw Planet Core Integrity Bar when approaching the Core
    if (pod.depthMeters >= planet.maxDepth - 140) {
      const coreScreenY = world.coreStartRow * TILE_SIZE - camY - 26;
      const coreCenterX = WORLD_COLS * 0.5 * TILE_SIZE - camX;
      const corePct = Math.max(
        0,
        Math.min(
          1,
          (pod.coreBlocksTarget - pod.coreBlocksBroken) / pod.coreBlocksTarget
        )
      );

      ctx.fillStyle = 'rgba(10, 14, 24, 0.92)';
      ctx.fillRect(coreCenterX - 130, coreScreenY - 18, 260, 24);
      ctx.strokeStyle = planet.coreGlowColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(coreCenterX - 130, coreScreenY - 18, 260, 24);

      ctx.fillStyle = planet.coreGlowColor;
      ctx.fillRect(coreCenterX - 126, coreScreenY - 14, 252 * corePct, 16);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${planet.coreName.toUpperCase()} (${Math.ceil(corePct * 100)}%)`,
        coreCenterX,
        coreScreenY - 2
      );
    }

    // 4. Draw Seismic Radar Indicators for nearby Fuel Cells, Beacons & Core
    const radarTargets = world.findNearbyRadarTargets(
      pod.x,
      pod.y,
      this.game.stats.scannerRangeTiles
    );
    for (const rt of radarTargets) {
      const angle = Math.atan2(rt.wy - pod.y, rt.wx - pod.x);
      const pulseDist = 52 + Math.sin(pod.animTime * 7) * 2.5;
      const indX = pod.x - camX + Math.cos(angle) * pulseDist;
      const indY = pod.y - camY + Math.sin(angle) * pulseDist;

      ctx.save();
      ctx.translate(indX, indY);
      ctx.rotate(angle);
      ctx.fillStyle = rt.color;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-5, -5.5);
      ctx.lineTo(-2.5, 0);
      ctx.lineTo(-5, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 5. Draw Autonomous Orbiting Mining Drones & Laser Beams (Page 5)
    for (const beam of pod.droneBeams) {
      const fx = beam.fromX - camX;
      const fy = beam.fromY - camY;
      const tx = beam.toX - camX;
      const ty = beam.toY - camY;
      ctx.save();
      // Outer laser glow
      ctx.strokeStyle = beam.color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Core beam + crackling energy wave
      ctx.globalAlpha = 1;
      ctx.strokeStyle = beam.color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      const midX = (fx + tx) * 0.5 + Math.sin(pod.animTime * 45) * 3.5;
      const midY = (fy + ty) * 0.5 + Math.cos(pod.animTime * 45) * 3.5;
      ctx.quadraticCurveTo(midX, midY, tx, ty);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Muzzle flash at drone & molten impact ring at rock
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(fx, fy, 2.8, 0, Math.PI * 2);
      ctx.fill();

      const hitR = 4 + Math.sin(pod.animTime * 42) * 1.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tx, ty, hitR * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = beam.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tx, ty, hitR * 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const droneTier = Math.min(3, Math.max(1, this.game.stats.podTier + 1));
    const droneSprite = this.game.atlas.droneSprites.get(droneTier);
    for (let d = 0; d < this.game.stats.droneCount; d++) {
      const orbitAngle = pod.animTime * 3.2 + (d * Math.PI * 2) / this.game.stats.droneCount;
      const hoverBob = Math.sin(pod.animTime * 9 + d * 2.1) * 2.5;
      const dx = pod.x - camX + Math.cos(orbitAngle) * 30;
      const dy = pod.y - camY + Math.sin(orbitAngle) * 21 + hoverBob;
      const activeBeam = pod.droneBeams[d];
      const tilt = activeBeam
        ? Math.max(-0.38, Math.min(0.38, (activeBeam.toX - activeBeam.fromX) * 0.006))
        : Math.cos(orbitAngle) * 0.14;

      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(tilt);

      // Thruster underglow beneath drone
      const accentCol = d === 2 ? '#ff4081' : d === 1 ? '#ea80fc' : '#00e5ff';
      ctx.fillStyle = accentCol;
      ctx.globalAlpha = 0.35 + Math.sin(pod.animTime * 28 + d) * 0.15;
      ctx.beginPath();
      ctx.ellipse(0, 9, 4.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (droneSprite) {
        const dSize = 25;
        ctx.drawImage(droneSprite, -dSize / 2, -dSize / 2, dSize, dSize);
      } else {
        const droneGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7.5);
        droneGrad.addColorStop(0, '#ffffff');
        droneGrad.addColorStop(0.5, accentCol);
        droneGrad.addColorStop(1, '#102027');
        ctx.fillStyle = droneGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // High-speed spinning top rotor blur halo
      const rotorW = 8 + Math.abs(Math.sin(pod.animTime * 38 + d * 1.7)) * 6;
      ctx.strokeStyle = 'rgba(224, 247, 250, 0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-rotorW, -10.5);
      ctx.lineTo(rotorW, -10.5);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Draw Winch Tether Cable from surface when Extracting
    if (pod.extractProgress > 0) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(pod.x - camX, 0);
      ctx.lineTo(pod.x - camX, pod.y - camY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 7. Draw 7-Layer Modular Player Drill Pod
    const podScreenX = pod.x - camX;
    const podScreenY = pod.y - camY;
    const isCargoFull = pod.cargoUsed >= pod.maxCargo;
    const isLowFuel = pod.fuel / pod.maxFuel <= 0.25;
    const steeringDir = Math.abs(pod.angle) > 0.05 ? Math.sign(pod.angle) : 0;

    ctx.save();
    ctx.translate(podScreenX, podScreenY);
    ctx.rotate(-pod.angle);
    this.game.atlas.drawLayeredDrillPod(
      ctx,
      podLayers(this.game.stats, pod.animTime, {
        isLowFuel,
        isCargoFull,
        isMoving: pod.isMoving,
        isDrilling: pod.isDrilling,
        isHardGrinding: pod.isHardGrinding,
        extractProgress: pod.extractProgress,
        steeringDir,
        cargoCatchPulse: this.dive.feel.cargoCatchPulse,
      }),
      1.0
    );
    ctx.restore();

    // 8. Consecutive Ore Combo Gem Counter Badge above Pod (Page 7: x2, x3, x4)
    if (pod.comboCount > 1 && pod.comboTimer > 0 && pod.comboOreId) {
      const comboOre = ORES[pod.comboOreId];
      const badgeY = podScreenY - (pod.isHardGrinding || pod.depthMeters <= 4 ? 68 : 58);
      drawComboGemBadge(
        ctx,
        podScreenX,
        badgeY,
        pod.comboCount,
        comboOre?.name.toUpperCase() ?? 'ORE',
        comboOre?.color ?? '#ffd54f',
        comboOre?.highlightColor ?? '#fff8e1'
      );
    }

    // Prompt when stationary at surface (0m) so player knows they control when to drill
    if (!pod.isMoving && pod.depthMeters <= 4) {
      const prompt = '▼ HOLD [S] / [↓] OR DRAG TO DRILL DOWN ▼';
      ctx.font = '700 12px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(prompt).width + 22;
      ctx.fillStyle = 'rgba(7, 10, 18, 0.78)';
      ctx.beginPath();
      ctx.roundRect(podScreenX - tw / 2, podScreenY - 66, tw, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(prompt, podScreenX, podScreenY - 51);
    } else if (pod.isHardGrinding) {
      ctx.font = '700 11px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffab00';
      ctx.fillText('DENSE ROCK — UPGRADE YOUR DRILL!', podScreenX, podScreenY - 28);
    }

    // 9. Touch / Mouse Virtual Stick & Steering Drag Ring Indicator (Page 12)
    if (pointer.down) {
      ctx.save();
      // Outer virtual stick ring around pointer
      ctx.fillStyle = 'rgba(7, 10, 18, 0.35)';
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner thumb puck
      ctx.fillStyle = 'rgba(0, 229, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, 7, 0, Math.PI * 2);
      ctx.fill();

      // Dashed vector line from pod to steering target
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.32)';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(podScreenX, podScreenY);
      ctx.lineTo(pointer.x, pointer.y);
      ctx.stroke();
      ctx.restore();
    }

    // 10. Draw Particles & Floating Ore Popups
    this.dive.feel.render(ctx, camX, camY, this.game.atlas);
    this.game.particles.render(ctx, camX, camY);

    ctx.restore();
  }
}

/** Renders the Ancient Relic Chest using the HD illustrated sprite + pulsing golden halo & rattle (Page 7). */
function drawRelicCache(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement | undefined,
  x: number,
  y: number,
  t: number
): void {
  const glow = 0.35 + Math.sin(t * 4) * 0.2;
  const rattlePhase = t % 3.2;
  const rattleX = rattlePhase < 0.28 ? Math.sin(t * 46) * 1.4 : 0;
  const rattleRot = rattlePhase < 0.28 ? Math.cos(t * 42) * 0.06 : 0;
  const cx = x + TILE_SIZE / 2 + rattleX;
  const cy = y + TILE_SIZE / 2;

  ctx.save();
  const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, TILE_SIZE * 0.54);
  halo.addColorStop(0, `rgba(255, 213, 79, ${(0.5 * glow).toFixed(2)})`);
  halo.addColorStop(1, 'rgba(255, 213, 79, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, TILE_SIZE * 0.54, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, cy);
  ctx.rotate(rattleRot);
  if (sprite) {
    const sz = TILE_SIZE * 0.86;
    ctx.drawImage(sprite, -sz / 2, -sz / 2, sz, sz);
  } else {
    const pad = TILE_SIZE * 0.18;
    const w = TILE_SIZE - pad * 2;
    const h = w * 0.78;
    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
  }

  // Rising golden treasure motes
  for (let i = 0; i < 3; i++) {
    const mPhase = (t * 0.85 + i * 0.33) % 1;
    const mx = (i - 1) * 8 + Math.sin(t * 3 + i) * 2.5;
    const my = 6 - mPhase * 20;
    ctx.fillStyle = `rgba(255, 241, 118, ${(1 - mPhase) * 0.85})`;
    ctx.beginPath();
    ctx.arc(mx, my, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFuelCellLiveOverlay(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  hash: number,
  t: number
): void {
  const cx = sx + TILE_SIZE / 2;
  const cy = sy + TILE_SIZE / 2;
  ctx.save();
  // Rising green plasma bubbles inside the cell window
  for (let i = 0; i < 2; i++) {
    const bPhase = (t * 1.1 + i * 0.5 + (hash % 7) * 0.1) % 1;
    const bx = cx + (i === 0 ? -2 : 2);
    const by = cy + 6 - bPhase * 12;
    ctx.fillStyle = `rgba(185, 246, 202, ${(1 - bPhase) * 0.85})`;
    ctx.beginPath();
    ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pulsing green status LED on top cap
  const blink = 0.45 + 0.55 * Math.sin(t * 6 + (hash % 11));
  ctx.fillStyle = `rgba(0, 230, 118, ${blink.toFixed(2)})`;
  ctx.beginPath();
  ctx.arc(cx, cy - 11, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBeaconLiveOverlay(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  hash: number,
  t: number
): void {
  const cx = sx + TILE_SIZE / 2;
  const cy = sy + TILE_SIZE / 2;
  const sweepAngle = t * 2.8 + (hash % 9);
  ctx.save();
  ctx.translate(cx, cy - 2);
  // Sweeping radar cone
  ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 16, sweepAngle, sweepAngle + 0.65);
  ctx.closePath();
  ctx.fill();

  // Blinking antenna tip LED
  const blink = Math.sin(t * 8 + (hash % 5)) > 0 ? 1 : 0.25;
  ctx.fillStyle = `rgba(0, 229, 255, ${blink})`;
  ctx.beginPath();
  ctx.arc(0, -10, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCoreLiveOverlay(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  gx: number,
  gy: number,
  glowColor: string,
  t: number
): void {
  const T = TILE_SIZE;
  const pulse = 0.18 + Math.sin(t * 6 + gx + gy) * 0.11;
  ctx.save();
  ctx.fillStyle = glowColor;
  ctx.globalAlpha = pulse;
  ctx.fillRect(sx, sy, T, T);

  // Crackling energy arc across the core block
  const cx = sx + T / 2;
  const cy = sy + T / 2;
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.3;
  const a = t * 3.5 + gx * 1.7 + gy * 2.3;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11);
  ctx.lineTo(cx + Math.sin(a * 2.3) * 3, cy + Math.cos(a * 1.9) * 3);
  ctx.lineTo(cx - Math.cos(a) * 11, cy - Math.sin(a) * 11);
  ctx.stroke();
  ctx.restore();
}

/**
 * Ore Glow Tiers (Page 7):
 * - Common (tier 1: coal, copper, iron): static, no glow
 * - Uncommon (tier 2: silver, gold, cobalt, aquamarine): diagonal glint sweep every 2s
 * - Rare (tier 3: platinum, titanium, cryo_diamond, uranium): pulsing glow (0.5 -> 1.0, 1.5s) + 1–2 sparkles
 * - Epic/Mythic (tier 4+: ruby, mythril, painite, voidstone): soft light halo + 3–4 sparkles
 */
function getOreGlowTier(oreId: string): 1 | 2 | 3 | 4 {
  switch (oreId) {
    case 'coal':
    case 'copper':
    case 'iron':
      return 1;
    case 'silver':
    case 'gold':
    case 'cobalt':
    case 'aquamarine':
      return 2;
    case 'platinum':
    case 'titanium':
    case 'cryo_diamond':
    case 'uranium':
      return 3;
    default:
      return 4;
  }
}

function drawOreGlowUnderlay(
  ctx: CanvasRenderingContext2D,
  oreId: string,
  sx: number,
  sy: number,
  hash: number,
  animTime: number
): void {
  const tier = getOreGlowTier(oreId);
  if (tier < 3) return;
  const ore = ORES[oreId];
  if (!ore) return;

  const cx = sx + TILE_SIZE / 2;
  const cy = sy + TILE_SIZE / 2;
  const cycle = Math.sin((animTime * Math.PI * 2) / 1.5 + (hash % 17)) * 0.25 + 0.75; // 0.5 -> 1.0
  const radius = tier === 4 ? TILE_SIZE * 0.54 : TILE_SIZE * 0.42;

  ctx.save();
  ctx.globalAlpha = (tier === 4 ? 0.42 : 0.26) * cycle;
  const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, radius);
  g.addColorStop(0, ore.highlightColor);
  g.addColorStop(0.55, ore.color);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOreSparkleOverlay(
  ctx: CanvasRenderingContext2D,
  oreId: string,
  sx: number,
  sy: number,
  hash: number,
  animTime: number
): void {
  const tier = getOreGlowTier(oreId);
  if (tier === 1) return;
  const ore = ORES[oreId];
  if (!ore) return;

  const cx = sx + TILE_SIZE / 2;
  const cy = sy + TILE_SIZE / 2;

  ctx.save();
  if (tier === 2) {
    // Uncommon: diagonal glint line sweeps across the gem every 2s
    const phase = ((animTime + (hash % 23) * 0.13) % 2.0) / 2.0;
    if (phase < 0.32) {
      const t = phase / 0.32;
      const gx = cx - 10 + t * 20;
      const gy = cy - 10 + t * 20;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx - 5, gy + 5);
      ctx.lineTo(gx + 5, gy - 5);
      ctx.stroke();
    }
  } else {
    // Rare (2 sparkles) or Epic/Mythic (4 sparkles)
    const count = tier === 4 ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const angle = ((hash >> (i * 3)) % 12) * 0.52 + i * 1.57;
      const dist = 8 + ((hash >> (i * 2)) % 6);
      const blink = Math.max(0, Math.sin(animTime * 4.5 + i * 1.9 + (hash % 11)));
      if (blink < 0.2) continue;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist - ((animTime * 4 + i * 3) % 4);
      const r = (tier === 4 ? 2.4 : 1.8) * blink;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Styled Combo Gem Badge over the pod showing x2, x3, x4 (Page 7). */
function drawComboGemBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  comboCount: number,
  oreName: string,
  color: string,
  highlight: string
): void {
  ctx.save();
  ctx.translate(x, y);

  const label = `×${comboCount} ${oreName}`;
  ctx.font = '700 13px "Barlow Condensed", sans-serif';
  const tw = ctx.measureText(label).width;
  const pillW = tw + 34;
  const pillH = 22;

  // Pill backing
  ctx.fillStyle = 'rgba(10, 14, 24, 0.9)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, 11);
  ctx.fill();
  ctx.stroke();

  // Faceted mini gem icon on left of badge
  const gx = -pillW / 2 + 13;
  ctx.fillStyle = color;
  ctx.strokeStyle = highlight;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(gx, -6);
  ctx.lineTo(gx + 6, 0);
  ctx.lineTo(gx, 6);
  ctx.lineTo(gx - 6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = highlight;
  ctx.textAlign = 'left';
  ctx.fillText(label, gx + 10, 4);
  ctx.restore();
}

/** Riveted steel bands across a tile, marking an armored vein. */
function drawArmorPlating(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const T = TILE_SIZE;
  ctx.save();
  for (const by of [y + T * 0.18, y + T * 0.7]) {
    const g = ctx.createLinearGradient(0, by, 0, by + 7);
    g.addColorStop(0, '#3a3f66');
    g.addColorStop(1, '#151730');
    ctx.fillStyle = g;
    ctx.fillRect(x + 1, by, T - 2, 7);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x + 1, by + 7, T - 2, 2);
    ctx.fillStyle = '#00f0ff';
    for (const rx of [x + 6, x + T / 2, x + T - 6]) {
      ctx.beginPath();
      ctx.arc(rx, by + 3.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Stable per-tile pseudo-random bits. */
function tileHash(gx: number, gy: number): number {
  let h = (gx * 73856093) ^ (gy * 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function isOpen(world: DiveWorld, gx: number, gy: number): boolean {
  const b = world.getBlock(gx, gy);
  return !b || b.type === 'empty';
}

/** Soft shadow inside a tunnel tile along every side that touches rock. */
function drawTunnelShadow(
  ctx: CanvasRenderingContext2D,
  world: DiveWorld,
  gx: number,
  gy: number,
  sx: number,
  sy: number
): void {
  const T = TILE_SIZE;
  const d = 12;
  const dark = 'rgba(0, 0, 0, 0.5)';
  const clear = 'rgba(0, 0, 0, 0)';
  if (gy > 0 && !isOpen(world, gx, gy - 1)) {
    const g = ctx.createLinearGradient(0, sy, 0, sy + d);
    g.addColorStop(0, dark);
    g.addColorStop(1, clear);
    ctx.fillStyle = g;
    ctx.fillRect(sx, sy, T, d);
  }
  if (!isOpen(world, gx - 1, gy)) {
    const g = ctx.createLinearGradient(sx, 0, sx + d, 0);
    g.addColorStop(0, dark);
    g.addColorStop(1, clear);
    ctx.fillStyle = g;
    ctx.fillRect(sx, sy, d, T);
  }
  if (!isOpen(world, gx + 1, gy)) {
    const g = ctx.createLinearGradient(sx + T, 0, sx + T - d, 0);
    g.addColorStop(0, dark);
    g.addColorStop(1, clear);
    ctx.fillStyle = g;
    ctx.fillRect(sx + T - d, sy, d, T);
  }
}

/**
 * Dark jagged inner bevel on rock faces that touch a tunnel, with biome stalactites/icicles hanging
 * from ceilings; the glowing line itself is drawn in the neon pass.
 */
function drawRockEdges(
  ctx: CanvasRenderingContext2D,
  world: DiveWorld,
  gx: number,
  gy: number,
  sx: number,
  sy: number,
  hash: number
): void {
  const T = TILE_SIZE;
  const planetId = world.planet.id;

  if (gy > 0 && isOpen(world, gx, gy - 1)) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + T, sy);
    ctx.lineTo(sx + T, sy + 3);
    ctx.lineTo(sx + T * 0.68, sy + 2 + (hash % 3));
    ctx.lineTo(sx + T * 0.34, sy + 4);
    ctx.lineTo(sx, sy + 2.5);
    ctx.closePath();
    ctx.fill();
  }
  if (isOpen(world, gx, gy + 1)) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(sx, sy + T - 5, T, 5);

    // Biome-specific hanging ceiling details protruding into the tunnel below
    const spikeCount = 1 + (hash % 2);
    for (let i = 0; i < spikeCount; i++) {
      const px = sx + 8 + ((hash >> (i * 4)) % (T - 16));
      const hSpike = 4 + ((hash >> (i * 3 + 2)) % 6);
      if (planetId === 2) {
        // Translucent cryo icicle
        ctx.fillStyle = 'rgba(179, 229, 252, 0.68)';
      } else if (planetId === 3) {
        // Dark obsidian/slag drip
        ctx.fillStyle = 'rgba(38, 22, 48, 0.85)';
      } else {
        // Cavern stalactite / root
        ctx.fillStyle = 'rgba(24, 18, 14, 0.78)';
      }
      ctx.beginPath();
      ctx.moveTo(px - 3, sy + T - 1);
      ctx.lineTo(px + 3, sy + T - 1);
      ctx.lineTo(px, sy + T + hSpike);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (isOpen(world, gx - 1, gy)) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 4, sy);
    ctx.lineTo(sx + 2 + (hash % 3), sy + T * 0.5);
    ctx.lineTo(sx + 4, sy + T);
    ctx.lineTo(sx, sy + T);
    ctx.closePath();
    ctx.fill();
  }
  if (isOpen(world, gx + 1, gy)) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.moveTo(sx + T, sy);
    ctx.lineTo(sx + T - 4, sy);
    ctx.lineTo(sx + T - 2 - ((hash >> 3) % 3), sy + T * 0.5);
    ctx.lineTo(sx + T - 4, sy + T);
    ctx.lineTo(sx + T, sy + T);
    ctx.closePath();
    ctx.fill();
  }
}

/** Draws a pickup or ore smaller than the tile with a little offset, sitting in the rock rather than on it. */
function drawEmbedded(
  ctx: CanvasRenderingContext2D,
  tex: HTMLCanvasElement,
  sx: number,
  sy: number,
  hash: number,
  scale: number
): void {
  const size = TILE_SIZE * scale;
  const ox = (((hash >> 12) % 7) - 3) * 0.8;
  const oy = (((hash >> 15) % 7) - 3) * 0.8;
  const cx = sx + TILE_SIZE / 2 + ox;
  const cy = sy + TILE_SIZE / 2 + oy;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx + 1.5, cy + size * 0.32, size * 0.36, size * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(tex, cx - size / 2, cy - size / 2, size, size);
}

const glowSprites = new Map<string, HTMLCanvasElement>();

/** Soft radial glow in one colour, cached so the neon pass never builds gradients per frame. */
function glowSprite(color: string): HTMLCanvasElement {
  let c = glowSprites.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, rgba(color, 0.32));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowSprites.set(color, c);
  }
  return c;
}
