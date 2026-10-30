import { ORES } from '../config/ores';
import { GameContext } from '../core/GameContext';
import { TILE_SIZE, WORLD_COLS, METERS_PER_ROW } from '../game/DiveWorld';
import { DiveScreen } from '../screens/DiveScreen';
import { fitCanvasToDisplay, podLayers } from './podView';
import { drawGroundLip, drawSurfaceBase, drawSurfaceSky } from './SurfaceBase';
import { DiveWorld } from '../game/DiveWorld';
import { flatRockTile } from './rockTiles';

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
    const src = this.game.atlas.blockTiles.get(stratumId);
    return src ? flatRockTile(src) : undefined;
  }

  /** Rock texture darkened for dug-out tunnels, cached per source texture. */
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
      c.fillStyle = 'rgba(8, 6, 10, 0.78)';
      c.fillRect(0, 0, tile.width, tile.height);
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

    // Warm lamp tint and drifting dust caught in the light
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const tint = ctx.createRadialGradient(px, py, 10, px, py, lampR * 0.8);
    tint.addColorStop(0, 'rgba(255, 210, 140, 0.10)');
    tint.addColorStop(1, 'rgba(255, 210, 140, 0)');
    ctx.fillStyle = tint;
    ctx.fillRect(px - lampR, py - lampR, lampR * 2, lampR * 2);

    if (pod.depthMeters > 8 && !this.game.save.settings.reducedMotion) {
      const t = pod.animTime;
      for (const d of this.dust) {
        const x = ((d.x * w - camX * 0.25 + Math.sin(t * 0.4 + d.y * 9) * 12) % w + w) % w;
        const y = ((d.y * h - camY * 0.25 - t * d.speed) % h + h) % h;
        const dist = Math.hypot(x - px, y - py);
        if (dist > lampR) continue;
        ctx.fillStyle = `rgba(255, 236, 200, ${0.35 * (1 - dist / lampR)})`;
        ctx.fillRect(x, y, d.size, d.size);
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
      drawSurfaceBase(ctx, planet, padScreenX, groundY, w, pod.animTime);
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
          ctx.fillStyle = '#0b0e14';
          ctx.fillRect(sx, sy, T, T);
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(sx + (hash % 20), sy + ((hash >> 5) % 20), 10, 6);
          continue;
        }

        // Jitter the texture's stratum near boundaries so layers blend instead of meeting on a ruled line
        const jitterRows = ((hash >> 8) % 6) - 2.5;
        const texStratum = world.getStratumForDepth(Math.max(0, (gy + jitterRows) * METERS_PER_ROW)).stratum;
        const blockCanvas = this.rockTile(b.type === 'core' ? b.stratumId : texStratum.id);
        if (blockCanvas) this.drawVariant(ctx, blockCanvas, sx, sy, hash, dpr);

        drawRockEdges(ctx, world, gx, gy, sx, sy);

        if (b.type === 'fuel_cell') {
          drawEmbedded(ctx, this.game.atlas.fuelCellTile, sx, sy, hash, 0.86);
        } else if (b.type === 'beacon') {
          drawEmbedded(ctx, this.game.atlas.beaconTile, sx, sy, hash, 0.86);
        } else if (b.type === 'core') {
          const coreTile = this.game.atlas.coreTiles.get(planet.id);
          if (coreTile) this.game.atlas.drawTile(ctx, coreTile, sx, sy);
          const pulse = 0.2 + Math.sin(pod.animTime * 6 + gx) * 0.12;
          ctx.fillStyle = planet.coreGlowColor;
          ctx.globalAlpha = pulse;
          ctx.fillRect(sx, sy, T, T);
          ctx.globalAlpha = 1.0;
        } else if (b.type === 'relic') {
          drawRelicCache(ctx, sx, sy, pod.animTime + gx * 0.7);
        } else if (b.oreId) {
          const oreCanvas = this.game.atlas.oreOverlays.get(b.oreId);
          if (oreCanvas) drawEmbedded(ctx, oreCanvas, sx, sy, hash, b.armored ? 0.8 : 0.74);
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
      const indX = pod.x - camX + Math.cos(angle) * 52;
      const indY = pod.y - camY + Math.sin(angle) * 52;

      ctx.save();
      ctx.translate(indX, indY);
      ctx.rotate(angle);
      ctx.fillStyle = rt.color;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, -5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 5. Draw Autonomous Orbiting Mining Drones & Laser Beams
    for (const beam of pod.droneBeams) {
      ctx.strokeStyle = beam.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(beam.fromX - camX, beam.fromY - camY);
      ctx.lineTo(beam.toX - camX, beam.toY - camY);
      ctx.stroke();
    }

    for (let d = 0; d < this.game.stats.droneCount; d++) {
      const orbitAngle = pod.animTime * 3.2 + (d * Math.PI * 2) / this.game.stats.droneCount;
      const dx = pod.x - camX + Math.cos(orbitAngle) * 28;
      const dy = pod.y - camY + Math.sin(orbitAngle) * 20;

      const droneGrad = ctx.createRadialGradient(dx - 2, dy - 2, 1, dx, dy, 7.5);
      droneGrad.addColorStop(0, '#ffffff');
      droneGrad.addColorStop(0.5, d === 2 ? '#ff4081' : d === 1 ? '#ea80fc' : '#00e5ff');
      droneGrad.addColorStop(1, '#102027');
      ctx.fillStyle = droneGrad;
      ctx.beginPath();
      ctx.arc(dx, dy, 7.5, 0, Math.PI * 2);
      ctx.fill();
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
        extractProgress: pod.extractProgress,
      }),
      1.0
    );
    ctx.restore();

    // 8. Consecutive Ore Combo Badge above Pod (x2, x3, x4)
    if (pod.comboCount > 1 && pod.comboTimer > 0 && pod.comboOreId) {
      const comboOre = ORES[pod.comboOreId];
      ctx.save();
      ctx.font = '700 12px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = comboOre?.highlightColor ?? '#ffd54f';
      ctx.fillText(
        `COMBO ×${pod.comboCount} ${comboOre?.name.toUpperCase() ?? ''}!`,
        podScreenX,
        podScreenY - (pod.isHardGrinding || pod.depthMeters <= 4 ? 46 : 34)
      );
      ctx.restore();
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
      ctx.fillText('DENSE ROCK — UPGRADE DRILL IN DEEP GRID!', podScreenX, podScreenY - 28);
    }

    // 9. Touch / Mouse Steering Drag Ring Indicator
    if (pointer.down) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(podScreenX, podScreenY);
      ctx.lineTo(pointer.x, pointer.y);
      ctx.stroke();
      ctx.restore();
    }

    // 10. Draw Particles & Floating Ore Popups
    this.dive.feel.render(ctx, camX, camY);
    this.game.particles.render(ctx, camX, camY);

    ctx.restore();
  }
}

/** Placeholder relic chest until the artist delivers `relic_chest` sprites: a gold-trimmed crate with a pulsing glow. */
function drawRelicCache(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const pad = TILE_SIZE * 0.18;
  const w = TILE_SIZE - pad * 2;
  const h = w * 0.78;
  const top = y + (TILE_SIZE - h) / 2;
  const glow = 0.35 + Math.sin(t * 4) * 0.2;

  ctx.save();
  ctx.shadowColor = '#ffd54f';
  ctx.shadowBlur = 10 * glow + 4;
  ctx.fillStyle = '#5d3a1a';
  ctx.fillRect(x + pad, top, w, h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#7b4f24';
  ctx.fillRect(x + pad, top, w, h * 0.38);
  ctx.strokeStyle = '#ffd54f';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + pad + 1, top + 1, w - 2, h - 2);
  ctx.beginPath();
  ctx.moveTo(x + pad, top + h * 0.38);
  ctx.lineTo(x + pad + w, top + h * 0.38);
  ctx.stroke();
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(x + TILE_SIZE / 2 - 3, top + h * 0.3, 6, 8);
  ctx.globalAlpha = glow;
  ctx.fillStyle = '#fff8e1';
  ctx.fillRect(x + TILE_SIZE / 2 - 1.5, top + h * 0.3 + 2, 3, 3);
  ctx.restore();
}

/** Riveted steel bands across a tile, marking an armored vein. */
function drawArmorPlating(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const T = TILE_SIZE;
  ctx.save();
  for (const by of [y + T * 0.18, y + T * 0.7]) {
    const g = ctx.createLinearGradient(0, by, 0, by + 7);
    g.addColorStop(0, '#cfd8dc');
    g.addColorStop(1, '#607d8b');
    ctx.fillStyle = g;
    ctx.fillRect(x + 1, by, T - 2, 7);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x + 1, by + 7, T - 2, 2);
    ctx.fillStyle = '#eceff1';
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

/** Lit lip on exposed rock tops, darker undersides and sides, so tunnels read as carved. */
function drawRockEdges(
  ctx: CanvasRenderingContext2D,
  world: DiveWorld,
  gx: number,
  gy: number,
  sx: number,
  sy: number
): void {
  const T = TILE_SIZE;
  if (gy > 0 && isOpen(world, gx, gy - 1)) {
    ctx.fillStyle = 'rgba(255, 236, 200, 0.22)';
    ctx.fillRect(sx, sy, T, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(sx, sy + 3, T, 2);
  }
  if (isOpen(world, gx, gy + 1)) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(sx, sy + T - 5, T, 5);
  }
  if (isOpen(world, gx - 1, gy)) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(sx, sy, 3, T);
  }
  if (isOpen(world, gx + 1, gy)) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(sx + T - 3, sy, 3, T);
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
