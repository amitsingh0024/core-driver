import { ORES } from '../config/ores';
import { GameContext } from '../core/GameContext';
import { TILE_SIZE, WORLD_COLS, METERS_PER_ROW } from '../game/DiveWorld';
import { DiveScreen } from '../screens/DiveScreen';
import { fitCanvasToDisplay, podLayers } from './podView';

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

  public render(): void {
    const { world, pod } = this.dive;
    const pointer = this.dive.pointer();
    const { w, h, dpr } = fitCanvasToDisplay(this.canvas);
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const planet = world.planet;
    const { stratum } = world.getStratumForDepth(pod.depthMeters);

    const worldPixelWidth = WORLD_COLS * TILE_SIZE;
    const { screenShake, reducedMotion } = this.game.save.settings;
    const shakeMult = screenShake && !reducedMotion ? 1 : 0;
    const shakeX = (Math.random() - 0.5) * pod.screenShake * shakeMult;
    const shakeY = (Math.random() - 0.5) * pod.screenShake * shakeMult;
    const camX = Math.round(worldPixelWidth * 0.5 - w * 0.5 + shakeX);
    const camY = Math.round(pod.y - h * 0.38 + shakeY);

    // 1. Background Cavern Wall Fill
    ctx.fillStyle = stratum.palette.bgWall;
    ctx.fillRect(0, 0, w, h);

    // Surface Sky, Horizon Silhouettes, Derrick & Landing Pad above y = 0
    if (camY < 60) {
      const skyH = Math.max(0, -camY + 32);
      const padScreenX = worldPixelWidth * 0.5 - camX;
      this.game.atlas.drawSurfaceScene(ctx, planet, w, skyH, padScreenX, pod.animTime);
    }

    // 2. Visible HD Block Rows & Columns + 4-Bit Autotile Tunnel Edge Rims
    const startGy = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
    const endGy = Math.min(world.totalRows - 1, Math.ceil((camY + h) / TILE_SIZE) + 1);

    for (let gy = startGy; gy <= endGy; gy++) {
      const sy = gy * TILE_SIZE - camY;
      const rowDepth = gy * METERS_PER_ROW;

      if (rowDepth > 0 && rowDepth % 100 === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
        ctx.font = '700 11px "Rajdhani", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${rowDepth}m`, TILE_SIZE - camX + 6, sy - 4);
      }

      for (let gx = 0; gx < WORLD_COLS; gx++) {
        const b = world.getBlock(gx, gy);
        if (!b || b.type === 'empty') continue;

        const sx = gx * TILE_SIZE - camX;

        if (b.type === 'bedrock') {
          ctx.fillStyle = '#080b11';
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#161e2b';
          ctx.strokeRect(sx + 0.5, sy + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
          continue;
        }

        // Draw Smooth HD Stratum Base Rock Tile
        const blockCanvas = this.game.atlas.blockTiles.get(b.stratumId);
        if (blockCanvas) {
          this.game.atlas.drawTile(ctx, blockCanvas, sx, sy);
        }

        // Draw 4-Bit Autotile Tunnel Edge Rim where rock meets dug-out space
        const edgeMask = world.getEmptyNeighborMask(gx, gy);
        if (edgeMask > 0) {
          const bStratum = planet.strata[b.stratumIdx] ?? planet.strata[0];
          this.game.atlas.drawTunnelEdgeRim(ctx, sx, sy, edgeMask, bStratum.palette.bevel);
        }

        if (b.type === 'fuel_cell') {
          this.game.atlas.drawTile(ctx, this.game.atlas.fuelCellTile, sx, sy);
        } else if (b.type === 'beacon') {
          this.game.atlas.drawTile(ctx, this.game.atlas.beaconTile, sx, sy);
        } else if (b.type === 'core') {
          const coreTile = this.game.atlas.coreTiles.get(planet.id);
          if (coreTile) {
            this.game.atlas.drawTile(ctx, coreTile, sx, sy);
          }
          const pulse = 0.2 + Math.sin(pod.animTime * 6 + gx) * 0.12;
          ctx.fillStyle = planet.coreGlowColor;
          ctx.globalAlpha = pulse;
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          ctx.globalAlpha = 1.0;
        } else if (b.type === 'relic') {
          drawRelicCache(ctx, sx, sy, pod.animTime + gx * 0.7);
        } else if (b.oreId) {
          const oreCanvas = this.game.atlas.oreOverlays.get(b.oreId);
          if (oreCanvas) {
            this.game.atlas.drawTile(ctx, oreCanvas, sx, sy);
          }
        }

        if (b.armored) drawArmorPlating(ctx, sx, sy);

        // Draw HD Crack Overlay if block is damaged
        if (b.hp < b.maxHp && b.hp > 0) {
          const dmgRatio = 1 - b.hp / b.maxHp;
          const crackIdx = Math.min(3, Math.floor(dmgRatio * 4));
          const crackCanvas = this.game.atlas.crackTiles[crackIdx];
          if (crackCanvas) {
            this.game.atlas.drawTile(ctx, crackCanvas, sx, sy);
          }
        }
      }
    }

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
      ctx.font = '700 12px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(
        '▼ HOLD [S] / [↓] OR DRAG TOUCH/MOUSE TO DRILL DOWN (IDLE = 0 FUEL) ▼',
        podScreenX,
        podScreenY - 30
      );
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

/** Riveted armor plating over a tile, marking an armored vein. */
function drawArmorPlating(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(176, 190, 197, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x + 2.5, y + 2.5, TILE_SIZE - 5, TILE_SIZE - 5);
  ctx.strokeStyle = 'rgba(38, 50, 56, 0.9)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);
  ctx.fillStyle = '#cfd8dc';
  const r = 2;
  for (const [cx, cy] of [
    [6, 6],
    [TILE_SIZE - 6, 6],
    [6, TILE_SIZE - 6],
    [TILE_SIZE - 6, TILE_SIZE - 6],
  ]) {
    ctx.beginPath();
    ctx.arc(x + cx, y + cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
