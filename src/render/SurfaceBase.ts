import { PlanetConfig } from '../config/planets';
import { mix, rgba } from '../assets/neonArt';

/**
 * The outpost on the surface: the safe zone every dive starts from, drawn as a synthwave night.
 * Gradient sky with stars, a striped retro sun, two parallax bands of wireframe mountains, then
 * the outpost around the drill pad: HQ tower, fuel station, neon derrick, ore refinery, hangar,
 * light poles, and a few drones drifting between buildings.
 *
 * Everything is drawn in screen space. `padX` is the screen x of the pad centre and
 * `groundY` the screen y of ground level, so the outpost scrolls with the dive camera.
 */

interface SurfaceTheme {
  skyTop: string;
  skyMid: string;
  horizon: string;
  sunTop: string;
  sunBottom: string;
  mountain: string;
  ridge: string; // mountain wireframe colour
  ground: string; // neon line along the ground
  sign: string; // second neon colour for signs and windows
}

const THEMES: Record<number, SurfaceTheme> = {
  1: {
    skyTop: '#07021a',
    skyMid: '#2a0b4a',
    horizon: '#ff3d7f',
    sunTop: '#ffd23f',
    sunBottom: '#ff2e88',
    mountain: '#12062a',
    ridge: '#ff4fd8',
    ground: '#ff2e88',
    sign: '#00f0ff',
  },
  2: {
    skyTop: '#010818',
    skyMid: '#06204a',
    horizon: '#2ee6ff',
    sunTop: '#e6ffff',
    sunBottom: '#2b8cff',
    mountain: '#04112b',
    ridge: '#4dd9ff',
    ground: '#00f0ff',
    sign: '#ff6ad5',
  },
  3: {
    skyTop: '#050010',
    skyMid: '#26063d',
    horizon: '#b967ff',
    sunTop: '#ff66ff',
    sunBottom: '#5b0fbf',
    mountain: '#0d0420',
    ridge: '#00ffc8',
    ground: '#b967ff',
    sign: '#00ffc8',
  },
};

export function surfaceTheme(planetId: number): SurfaceTheme {
  return THEMES[planetId] ?? THEMES[1];
}

/** Neon stroke: a wide faint pass under a thin bright one, cheaper than shadowBlur every frame. */
function neonStroke(ctx: CanvasRenderingContext2D, path: Path2D, color: string, width = 2.5): void {
  ctx.strokeStyle = rgba(color, 0.22);
  ctx.lineWidth = width * 3.2;
  ctx.stroke(path);
  ctx.strokeStyle = mix(color, '#ffffff', 0.25);
  ctx.lineWidth = width;
  ctx.stroke(path);
}

function rectPath(x: number, y: number, w: number, h: number): Path2D {
  const p = new Path2D();
  p.rect(x, y, w, h);
  return p;
}

/** Sky, stars, sun and mountains. Fills from the top of the screen down to `groundY`. */
export function drawSurfaceSky(
  ctx: CanvasRenderingContext2D,
  planet: PlanetConfig,
  w: number,
  groundY: number,
  camX: number,
  time: number
): void {
  if (groundY <= 0) return;
  const theme = surfaceTheme(planet.id);
  ctx.save();

  const sky = ctx.createLinearGradient(0, groundY - 560, 0, groundY);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(0.65, theme.skyMid);
  sky.addColorStop(1, mix(theme.horizon, theme.skyMid, 0.35));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, groundY);

  // Stars, twinkling, thinning toward the horizon
  for (let i = 0; i < 90; i++) {
    const sx = (((i * 9301 + 49297) % 233280) / 233280) * (w + 200) - ((camX * 0.02) % 200);
    const sy = groundY - 140 - (((i * 4271 + 1103) % 9973) / 9973) * Math.max(0, groundY - 140);
    if (sy < 0) continue;
    const tw = 0.35 + 0.35 * Math.sin(time * (1 + (i % 5) * 0.4) + i);
    ctx.fillStyle = `rgba(255, 255, 255, ${tw.toFixed(2)})`;
    ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1.2, i % 7 === 0 ? 2 : 1.2);
  }

  // Retro sun: vertical gradient disc cut by horizontal bands that thicken toward the bottom
  const sunX = w * 0.72 - camX * 0.03;
  const sunR = 110;
  const sunY = groundY - 120;
  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, sunR * 2.2);
  halo.addColorStop(0, rgba(theme.sunBottom, 0.35));
  halo.addColorStop(1, rgba(theme.sunBottom, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - sunR * 2.2, sunY - sunR * 2.2, sunR * 4.4, sunR * 4.4);
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sunGrad.addColorStop(0, theme.sunTop);
  sunGrad.addColorStop(1, theme.sunBottom);
  ctx.fillStyle = sunGrad;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.globalCompositeOperation = 'destination-out';
  const drift = (time * 6) % 14;
  for (let k = 0; k < 9; k++) {
    const y = sunY + 4 + k * 14 + drift;
    const thick = 1 + k * 0.9;
    ctx.fillRect(sunX - sunR, y, sunR * 2, thick);
  }
  ctx.restore();

  drawMountains(ctx, w, groundY, camX * 0.12, theme, 150, 0.0036, 7, 0.55);
  drawMountains(ctx, w, groundY, camX * 0.3, theme, 85, 0.0068, 23, 1);

  // Distant sky birds (Planet 1) or high-altitude courier drones (Planets 2 & 3), on their own parallax layer
  for (let b = 0; b < 4; b++) {
    const span = w + 300;
    const bx = ((((b * 280 + time * (22 + b * 4) - camX * 0.12) % span) + span) % span) - 150;
    const by = groundY - 250 - (b % 3) * 38 + Math.sin(time * 2.2 + b) * 6;
    if (by < 0) continue;
    if (planet.id === 1) {
      const flap = Math.sin(time * 9 + b * 1.7) * 3.5;
      ctx.strokeStyle = rgba(theme.ridge, 0.6);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx - 6, by - flap);
      ctx.quadraticCurveTo(bx - 2, by - 2, bx, by);
      ctx.quadraticCurveTo(bx + 2, by - 2, bx + 6, by - flap);
      ctx.stroke();
    } else {
      ctx.fillStyle = mix(theme.sign, '#ffffff', 0.4);
      ctx.fillRect(bx - 4, by - 1.5, 8, 3);
      ctx.fillStyle = rgba(theme.ground, 0.5);
      ctx.fillRect(bx - 10, by - 0.8, 6, 1.6);
    }
  }

  ctx.restore();
}

/** A mountain band: dark silhouette with a glowing ridge line and faint wireframe struts. */
function drawMountains(
  ctx: CanvasRenderingContext2D,
  w: number,
  groundY: number,
  offset: number,
  theme: SurfaceTheme,
  height: number,
  freq: number,
  seed: number,
  alpha: number
): void {
  const ridge = new Path2D();
  const pts: Array<[number, number]> = [];
  for (let x = -24; x <= w + 24; x += 24) {
    const wx = x + offset;
    const n = Math.abs(Math.sin(wx * freq + seed)) * 0.6 + Math.abs(Math.sin(wx * freq * 2.3 + seed * 3)) * 0.4;
    const y = groundY - height * n;
    pts.push([x, y]);
    if (x === -24) ridge.moveTo(x, y);
    else ridge.lineTo(x, y);
  }
  const body = new Path2D(ridge);
  body.lineTo(w + 24, groundY);
  body.lineTo(-24, groundY);
  body.closePath();
  ctx.fillStyle = theme.mountain;
  ctx.fill(body);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = rgba(theme.ridge, 0.16);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [x, y] of pts) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + (x % 48 === 0 ? 14 : -14), groundY);
  }
  ctx.stroke();
  neonStroke(ctx, ridge, theme.ridge, 1.6);
  ctx.restore();
}

/** Neon edge along the top of the ground between two screen x positions. */
export function drawGroundLip(
  ctx: CanvasRenderingContext2D,
  planetId: number,
  x0: number,
  x1: number,
  groundY: number
): void {
  const theme = surfaceTheme(planetId);
  ctx.save();
  ctx.fillStyle = rgba(theme.ground, 0.25);
  ctx.fillRect(x0, groundY - 3, x1 - x0, 9);
  ctx.fillStyle = mix(theme.ground, '#ffffff', 0.3);
  ctx.fillRect(x0, groundY, x1 - x0, 2.5);
  ctx.restore();
}

/** All outpost buildings and props. `padX` is the pad centre on screen. */
export function drawSurfaceBase(
  ctx: CanvasRenderingContext2D,
  planet: PlanetConfig,
  padX: number,
  groundY: number,
  w: number,
  time: number,
  podAtSurface = false
): void {
  const theme = surfaceTheme(planet.id);
  const accent = planet.accentColor;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const visible = (x: number, half: number) => x + half > -60 && x - half < w + 60;

  if (visible(padX - 600, 140)) drawHQ(ctx, padX - 600, groundY, theme, accent, time);
  if (visible(padX - 330, 70)) drawFuelStation(ctx, padX - 330, groundY, theme, time);
  if (visible(padX + 400, 150)) drawRefinery(ctx, padX + 400, groundY, theme, accent, time);
  if (visible(padX + 700, 120)) drawHangar(ctx, padX + 700, groundY, theme, accent, time);
  drawDerrick(ctx, padX, groundY, theme, accent, time);

  for (const ox of [-215, 215, -450, 570, -860, 900]) {
    if (visible(padX + ox, 20)) drawLightPole(ctx, padX + ox, groundY, theme, time + ox);
  }

  // Drones drifting between buildings
  for (let i = 0; i < 3; i++) {
    const span = 520;
    const phase = (time * (30 + i * 9) + i * 211) % (span * 2);
    const dx = phase < span ? phase : span * 2 - phase;
    const x = padX - 480 + i * 330 + dx * 0.6;
    const y = groundY - 150 - i * 40 + Math.sin(time * 2 + i) * 8;
    if (visible(x, 10)) drawSkyDrone(ctx, x, y, i % 2 ? theme.sign : accent, time + i);
  }

  // Yard workers pacing between buildings; the two nearest the pad wave when the pod is up top
  for (let i = 0; i < 4; i++) {
    const [from, to] = i === 0 ? [-470, -380] : i === 1 ? [230, 300] : i === 2 ? [-250, -190] : [540, 600];
    const span = to - from;
    const phase = (time * (22 + i * 6) + i * 97) % (span * 2);
    const forward = phase < span;
    const x = padX + from + (forward ? phase : span * 2 - phase);
    const waving = podAtSurface && (i === 1 || i === 2);
    if (visible(x, 10)) drawWorker(ctx, x, groundY, forward ? 1 : -1, time * 9 + i, i % 2 ? theme.sign : accent, waving);
  }

  ctx.restore();
}

function windowGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cols: number,
  rows: number,
  color: string,
  seed: number,
  time: number
): void {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = (seed * 31 + r * 7 + c * 13) % 11;
      const on = k > 2 || Math.sin(time * 0.7 + k) > 0.6;
      ctx.fillStyle = on ? rgba(color, k > 7 ? 0.9 : 0.55) : 'rgba(255,255,255,0.05)';
      ctx.fillRect(x + c * 16, y + r * 18, 9, 6);
    }
  }
}

function neonSign(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number, time: number): void {
  const flicker = Math.sin(time * 17) > 0.97 ? 0.45 : 1;
  ctx.save();
  ctx.font = `700 ${size}px "Orbitron", "Rajdhani", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = flicker;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = mix(color, '#ffffff', 0.35);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawHQ(ctx: CanvasRenderingContext2D, x: number, g: number, t: SurfaceTheme, accent: string, time: number): void {
  // Stepped tower: wide base block and a narrow upper block with an antenna
  ctx.fillStyle = '#0b0620';
  ctx.fillRect(x - 120, g - 150, 240, 150);
  ctx.fillRect(x - 60, g - 250, 120, 100);
  neonStroke(ctx, rectPath(x - 120, g - 150, 240, 150), accent, 2);
  neonStroke(ctx, rectPath(x - 60, g - 250, 120, 100), accent, 2);
  windowGrid(ctx, x - 104, g - 120, 13, 5, t.sign, 1, time);
  windowGrid(ctx, x - 44, g - 230, 6, 4, t.sign, 5, time);
  const ant = new Path2D();
  ant.moveTo(x + 40, g - 250);
  ant.lineTo(x + 40, g - 320);
  neonStroke(ctx, ant, accent, 1.6);
  ctx.fillStyle = Math.sin(time * 3) > 0 ? '#ff2e88' : '#3a0a1e';
  ctx.beginPath();
  ctx.arc(x + 40, g - 322, 4, 0, Math.PI * 2);
  ctx.fill();
  neonSign(ctx, 'CORE DIVER', x - 10, g - 272, accent, 20, time);
}

function drawFuelStation(ctx: CanvasRenderingContext2D, x: number, g: number, t: SurfaceTheme, time: number): void {
  const green = '#39ff88';
  ctx.fillStyle = '#071510';
  ctx.fillRect(x - 60, g - 96, 120, 12);
  const canopy = rectPath(x - 60, g - 96, 120, 12);
  neonStroke(ctx, canopy, green, 2);
  for (const dx of [-48, 48]) {
    const post = new Path2D();
    post.moveTo(x + dx, g - 84);
    post.lineTo(x + dx, g);
    neonStroke(ctx, post, green, 1.4);
  }
  ctx.fillStyle = '#081a12';
  ctx.fillRect(x - 14, g - 52, 28, 52);
  neonStroke(ctx, rectPath(x - 14, g - 52, 28, 52), green, 1.8);
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.fillStyle = rgba(green, 0.4 + pulse * 0.5);
  ctx.fillRect(x - 8, g - 44, 16, 10);
  neonSign(ctx, 'FUEL', x, g - 112, green, 16, time);

  // Bubbling fuel sight-tube on the pump column
  ctx.fillStyle = '#04100a';
  ctx.fillRect(x + 22, g - 80, 7, 30);
  neonStroke(ctx, rectPath(x + 22, g - 80, 7, 30), green, 1);
  const fuelLvl = 18 + Math.sin(time * 2.2) * 5;
  ctx.fillStyle = rgba(green, 0.75);
  ctx.fillRect(x + 23, g - 51 - fuelLvl, 5, fuelLvl);
  for (let b = 0; b < 3; b++) {
    const by = g - 52 - ((time * 18 + b * 7) % Math.max(4, fuelLvl));
    ctx.fillStyle = '#d6ffe6';
    ctx.fillRect(x + 24 + (b % 2) * 2, by, 1.6, 1.6);
  }
  void t;
}

function drawDerrick(ctx: CanvasRenderingContext2D, x: number, g: number, t: SurfaceTheme, accent: string, time: number): void {
  const h = 176;
  const base = 150;
  const top = 26;
  const truss = new Path2D();
  truss.moveTo(x - base, g);
  truss.lineTo(x - top, g - h);
  truss.lineTo(x + top, g - h);
  truss.lineTo(x + base, g);
  for (let i = 1; i <= 5; i++) {
    const y0 = g - ((i - 1) * h) / 5;
    const y1 = g - (i * h) / 5;
    const half0 = base - ((base - top) * (i - 1)) / 5;
    const half1 = base - ((base - top) * i) / 5;
    truss.moveTo(x - half0, y0);
    truss.lineTo(x + half1, y1);
    truss.moveTo(x + half0, y0);
    truss.lineTo(x - half1, y1);
    truss.moveTo(x - half1, y1);
    truss.lineTo(x + half1, y1);
  }
  ctx.strokeStyle = rgba(accent, 0.12);
  ctx.lineWidth = 8;
  ctx.stroke(truss);
  ctx.strokeStyle = rgba(mix(accent, '#ffffff', 0.2), 0.8);
  ctx.lineWidth = 1.6;
  ctx.stroke(truss);

  // Winch cable and spinning sheave
  const cable = new Path2D();
  cable.moveTo(x, g - h);
  cable.lineTo(x, g - 40);
  neonStroke(ctx, cable, t.sign, 1);
  ctx.save();
  ctx.translate(x, g - h - 16);
  ctx.rotate(time * 1.5);
  const wheel = new Path2D();
  wheel.arc(0, 0, 12, 0, Math.PI * 2);
  wheel.moveTo(-12, 0);
  wheel.lineTo(12, 0);
  wheel.moveTo(0, -12);
  wheel.lineTo(0, 12);
  neonStroke(ctx, wheel, t.sign, 2);
  ctx.restore();

  // Swaying auxiliary crane hook off the right of the crown
  const sway = Math.sin(time * 1.8) * 5;
  const hookLine = new Path2D();
  hookLine.moveTo(x + 18, g - h + 2);
  hookLine.lineTo(x + 18 + sway, g - h + 46);
  neonStroke(ctx, hookLine, t.ridge, 1);
  const hook = new Path2D();
  hook.arc(x + 18 + sway, g - h + 50, 4, 0, Math.PI * 1.3);
  neonStroke(ctx, hook, accent, 1.6);

  // Rotating red warning beacon with a sweeping light cone
  const beaconY = g - h - 34;
  const beamDir = Math.sin(time * 3.5);
  ctx.save();
  ctx.translate(x, beaconY);
  const cone = ctx.createLinearGradient(0, 0, beamDir * 60, 0);
  cone.addColorStop(0, 'rgba(255, 46, 88, 0.4)');
  cone.addColorStop(1, 'rgba(255, 46, 88, 0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(beamDir * 60, -16 * Math.abs(beamDir) - 4);
  ctx.lineTo(beamDir * 60, 16 * Math.abs(beamDir) + 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = beamDir > -0.2 ? '#ff2e58' : '#4a0a1a';
  ctx.beginPath();
  ctx.arc(x, beaconY, 4, 0, Math.PI * 2);
  ctx.fill();

  // Pad slabs with chevron light strips that chase toward the shaft
  for (const dir of [-1, 1]) {
    const x0 = dir < 0 ? x - 176 : x + 112;
    ctx.fillStyle = '#0b0620';
    ctx.fillRect(x0, g - 10, 64, 10);
    neonStroke(ctx, rectPath(x0, g - 10, 64, 10), accent, 1.4);
    for (let k = 0; k < 4; k++) {
      const lit = Math.floor(time * 6) % 4 === (dir < 0 ? k : 3 - k);
      ctx.fillStyle = lit ? mix(accent, '#ffffff', 0.4) : rgba(accent, 0.35);
      ctx.fillRect(x0 + 6 + k * 15, g - 7, 8, 4);
    }

    // Hydraulic pad steam vent puffs at the shaft edge
    const steamCycle = (time * 0.7 + (dir < 0 ? 0 : 0.5)) % 1;
    if (steamCycle < 0.45) {
      const p = steamCycle / 0.45;
      const vx = dir < 0 ? x - 112 - p * 18 : x + 112 + p * 18;
      ctx.fillStyle = `rgba(230, 220, 255, ${((1 - p) * 0.4).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(vx, g - 12 - p * 14, 3.5 + p * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRefinery(ctx: CanvasRenderingContext2D, x: number, g: number, t: SurfaceTheme, accent: string, time: number): void {
  // Smokestack behind the tall silo, puffing rising smoke rings
  ctx.fillStyle = '#0b0620';
  ctx.fillRect(x + 92, g - 206, 14, 36);
  neonStroke(ctx, rectPath(x + 92, g - 206, 14, 36), accent, 1.4);
  for (let k = 0; k < 3; k++) {
    const p = (time * 0.45 + k * 0.33) % 1;
    const px = x + 99 + Math.sin(time * 1.5 + k * 2) * 5 + p * 12;
    ctx.strokeStyle = `rgba(220, 210, 255, ${((1 - p) * 0.5).toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, g - 210 - p * 40, 4 + p * 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Two silos and a block, joined by a conveyor carrying glowing ore
  ctx.fillStyle = '#0b0620';
  ctx.fillRect(x + 40, g - 170, 70, 170);
  ctx.fillRect(x + 120, g - 130, 50, 130);
  ctx.fillRect(x - 120, g - 70, 110, 70);
  neonStroke(ctx, rectPath(x + 40, g - 170, 70, 170), t.sign, 2);
  neonStroke(ctx, rectPath(x + 120, g - 130, 50, 130), t.sign, 2);
  neonStroke(ctx, rectPath(x - 120, g - 70, 110, 70), t.sign, 2);
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = rgba(t.sign, 0.25 + 0.2 * Math.sin(time * 2 + k));
    ctx.fillRect(x + 50, g - 160 + k * 26, 50, 3);
  }
  windowGrid(ctx, x - 108, g - 56, 6, 2, accent, 3, time);
  const belt = new Path2D();
  belt.moveTo(x - 30, g - 70);
  belt.lineTo(x + 40, g - 150);
  neonStroke(ctx, belt, accent, 1.8);
  for (let k = 0; k < 4; k++) {
    const p = ((time * 0.25 + k / 4) % 1);
    ctx.fillStyle = k % 2 ? '#ffd23f' : '#00f0ff';
    ctx.beginPath();
    ctx.arc(x - 30 + 70 * p, g - 74 - 80 * p, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Glowing molten smelter furnace window at the base of the tall silo
  const furnace = 0.7 + Math.sin(time * 7) * 0.25 + Math.sin(time * 19) * 0.05;
  ctx.fillStyle = '#05030e';
  ctx.fillRect(x + 59, g - 36, 32, 20);
  ctx.fillStyle = `rgba(255, 110, 20, ${furnace.toFixed(2)})`;
  ctx.fillRect(x + 62, g - 33, 26, 14);
  ctx.fillStyle = '#fff3a0';
  ctx.fillRect(x + 67, g - 28, 16, 5);
  neonStroke(ctx, rectPath(x + 59, g - 36, 32, 20), '#ff8a3d', 1.2);

  neonSign(ctx, 'ORE', x + 75, g - 188, t.sign, 16, time);
}

function drawHangar(ctx: CanvasRenderingContext2D, x: number, g: number, t: SurfaceTheme, accent: string, time: number): void {
  const shell = new Path2D();
  shell.moveTo(x - 110, g);
  shell.lineTo(x - 110, g - 70);
  shell.quadraticCurveTo(x, g - 140, x + 110, g - 70);
  shell.lineTo(x + 110, g);
  ctx.fillStyle = '#0b0620';
  ctx.fill(shell);
  neonStroke(ctx, shell, accent, 2);
  ctx.fillStyle = '#05030e';
  ctx.fillRect(x - 70, g - 70, 140, 70);
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = rgba(t.sign, 0.15 + (k % 2) * 0.1);
    ctx.fillRect(x - 66, g - 64 + k * 11, 132, 3);
  }
  neonStroke(ctx, rectPath(x - 70, g - 70, 140, 70), t.sign, 1.4);

  // Welding arc flashes and a skittering spark inside the bay
  if (Math.sin(time * 13) > 0.35) {
    const flash = ctx.createRadialGradient(x + Math.sin(time * 7) * 30, g - 10, 1, x, g - 10, 60);
    flash.addColorStop(0, 'rgba(200, 250, 255, 0.55)');
    flash.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = flash;
    ctx.fillRect(x - 68, g - 68, 136, 68);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + Math.sin(time * 7) * 30, g - 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spinning rotary exhaust fan on the left wall
  ctx.save();
  ctx.translate(x - 90, g - 48);
  const fanRing = new Path2D();
  fanRing.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#05030e';
  ctx.fill(fanRing);
  neonStroke(ctx, fanRing, accent, 1.2);
  ctx.rotate(time * 5.5);
  const blades = new Path2D();
  blades.moveTo(-8, 0);
  blades.lineTo(8, 0);
  blades.moveTo(0, -8);
  blades.lineTo(0, 8);
  neonStroke(ctx, blades, t.sign, 1.4);
  ctx.restore();

  neonSign(ctx, 'HANGAR', x, g - 96, accent, 13, time);
}

function drawLightPole(ctx: CanvasRenderingContext2D, x: number, g: number, t: SurfaceTheme, time: number): void {
  const pole = new Path2D();
  pole.moveTo(x, g);
  pole.lineTo(x, g - 74);
  neonStroke(ctx, pole, t.ridge, 1.2);
  const glow = 0.7 + 0.3 * Math.sin(time * 1.3);
  const halo = ctx.createRadialGradient(x, g - 78, 1, x, g - 78, 26);
  halo.addColorStop(0, rgba(t.sign, 0.6 * glow));
  halo.addColorStop(1, rgba(t.sign, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(x - 26, g - 104, 52, 52);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, g - 78, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawSkyDrone(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, time: number): void {
  const body = new Path2D();
  body.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0620';
  ctx.fill(body);
  neonStroke(ctx, body, color, 1.4);
  const beam = ctx.createLinearGradient(x, y, x, y + 40);
  beam.addColorStop(0, rgba(color, 0.35 + 0.15 * Math.sin(time * 5)));
  beam.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 3);
  ctx.lineTo(x + 3, y + 3);
  ctx.lineTo(x + 12, y + 40);
  ctx.lineTo(x - 12, y + 40);
  ctx.closePath();
  ctx.fill();
}

/** A neon-outlined yard worker in a hard hat; swaps the pickaxe for a wave at the pod. */
function drawWorker(
  ctx: CanvasRenderingContext2D,
  x: number,
  g: number,
  dir: number,
  walk: number,
  color: string,
  waving: boolean
): void {
  const step = waving ? 0 : Math.sin(walk);
  const bob = Math.abs(step) * 1.5;
  ctx.save();
  ctx.translate(x, g - bob);
  ctx.scale(dir, 1);
  const body = new Path2D();
  // Legs
  body.moveTo(0, -14);
  body.lineTo(-3 + step * 3, 0);
  body.moveTo(0, -14);
  body.lineTo(3 - step * 3, 0);
  // Torso
  body.moveTo(0, -14);
  body.lineTo(0, -26);
  // Head
  body.moveTo(4, -30);
  body.arc(0, -30, 4, 0, Math.PI * 2);
  if (waving) {
    const a = -1.1 + Math.sin(walk * 2.2) * 0.45;
    body.moveTo(0, -23);
    body.lineTo(Math.cos(a) * 11, -23 + Math.sin(a) * 11);
  } else {
    // Pickaxe over the shoulder
    body.moveTo(-3, -18);
    body.lineTo(6, -33);
    body.moveTo(1, -36);
    body.quadraticCurveTo(7, -35, 10, -30);
  }
  neonStroke(ctx, body, color, 1.3);
  // Hard hat
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(0, -32, 4.6, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}
