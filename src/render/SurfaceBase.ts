import { PlanetConfig } from '../config/planets';

/**
 * The company yard on the surface: the safe zone every dive starts from.
 * Sky, drifting clouds, two parallax hill bands, then the base itself laid out
 * around the drill pad: office, fuel pump, derrick, ore depot with conveyor, garage,
 * plus trees, lamps and a few workers walking between buildings.
 *
 * Everything is drawn in screen space. `padX` is the screen x of the pad centre and
 * `groundY` the screen y of ground level, so the yard scrolls with the dive camera.
 */

interface SurfaceTheme {
  skyTop: string;
  skyBottom: string;
  grass: string;
  grassDark: string;
  hillNear: string;
  hillFar: string;
  cloud: string;
  foliage: string;
  foliageDark: string;
  trunk: string;
}

const THEMES: Record<number, SurfaceTheme> = {
  1: {
    skyTop: '#5fa8e0',
    skyBottom: '#d6ecf3',
    grass: '#6cbf3f',
    grassDark: '#3f8a2a',
    hillNear: '#4d6b34',
    hillFar: '#7a6a52',
    cloud: 'rgba(255, 244, 230, 0.85)',
    foliage: '#4f9a35',
    foliageDark: '#2f6a24',
    trunk: '#5b3a22',
  },
  2: {
    skyTop: '#7fb2d9',
    skyBottom: '#eef8ff',
    grass: '#e6f4fb',
    grassDark: '#a9cfe2',
    hillNear: '#6d8fae',
    hillFar: '#9db6cc',
    cloud: 'rgba(235, 248, 255, 0.8)',
    foliage: '#3f6f73',
    foliageDark: '#28494d',
    trunk: '#4a3a33',
  },
  3: {
    skyTop: '#240c33',
    skyBottom: '#8a2f5c',
    grass: '#5a3f5e',
    grassDark: '#36223a',
    hillNear: '#2c1830',
    hillFar: '#4a2142',
    cloud: 'rgba(255, 150, 190, 0.35)',
    foliage: '#7a2f4f',
    foliageDark: '#4d1a33',
    trunk: '#2a1a22',
  },
};

const OUTLINE = '#15110d';

export function surfaceTheme(planetId: number): SurfaceTheme {
  return THEMES[planetId] ?? THEMES[1];
}

/** Sky, sun or moon, clouds and hills. Fills from the top of the screen down to `groundY`. */
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

  const sky = ctx.createLinearGradient(0, groundY - 520, 0, groundY);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, groundY);

  // Sun / moon / eclipsed star, slight parallax
  const bodyX = w * 0.78 - camX * 0.03;
  const bodyY = groundY - 300;
  const glow = ctx.createRadialGradient(bodyX, bodyY, 10, bodyX, bodyY, 120);
  const glowColor = planet.id === 1 ? '255, 214, 150' : planet.id === 2 ? '200, 240, 255' : '255, 64, 129';
  glow.addColorStop(0, `rgba(${glowColor}, 0.55)`);
  glow.addColorStop(1, `rgba(${glowColor}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(bodyX - 120, bodyY - 120, 240, 240);
  ctx.fillStyle = planet.id === 3 ? '#0a0310' : planet.id === 2 ? '#f2fbff' : '#ffe2a8';
  ctx.beginPath();
  ctx.arc(bodyX, bodyY, planet.id === 3 ? 26 : 34, 0, Math.PI * 2);
  ctx.fill();

  // Drifting clouds (wrap across the screen)
  ctx.fillStyle = theme.cloud;
  for (let i = 0; i < 6; i++) {
    const span = w + 400;
    const x = ((i * 337 + time * (6 + i * 1.5) - camX * 0.08) % span + span) % span - 200;
    const y = groundY - 380 + ((i * 97) % 170);
    drawCloud(ctx, x, y, 0.7 + ((i * 53) % 40) / 60);
  }

  // Distant sky birds (Planet 1) or high-altitude courier drones (Planets 2 & 3)
  for (let b = 0; b < 4; b++) {
    const span = w + 300;
    const bx = ((b * 280 + time * (22 + b * 4) - camX * 0.12) % span + span) % span - 150;
    const by = groundY - 250 - (b % 3) * 38 + Math.sin(time * 2.2 + b) * 6;
    if (planet.id === 1) {
      const flap = Math.sin(time * 9 + b * 1.7) * 3.5;
      ctx.strokeStyle = 'rgba(25, 35, 45, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx - 6, by - flap);
      ctx.quadraticCurveTo(bx - 2, by - 2, bx, by);
      ctx.quadraticCurveTo(bx + 2, by - 2, bx + 6, by - flap);
      ctx.stroke();
    } else {
      ctx.fillStyle = planet.id === 2 ? '#b3e5fc' : '#ff80ab';
      ctx.fillRect(bx - 4, by - 1.5, 8, 3);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
      ctx.fillRect(bx - 10, by - 0.8, 6, 1.6);
    }
  }

  // Far hills
  drawHills(ctx, w, groundY, camX * 0.15, theme.hillFar, 70, 0.0042, 11);
  // Near hills
  drawHills(ctx, w, groundY, camX * 0.35, theme.hillNear, 40, 0.0075, 29);

  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, 46 * s, 16 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 26 * s, y + 4 * s, 28 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 22 * s, y - 8 * s, 30 * s, 16 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills(
  ctx: CanvasRenderingContext2D,
  w: number,
  groundY: number,
  offset: number,
  color: string,
  height: number,
  freq: number,
  seed: number
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0; x <= w + 8; x += 8) {
    const wx = x + offset;
    const y =
      groundY -
      height * (0.55 + 0.3 * Math.sin(wx * freq + seed) + 0.15 * Math.sin(wx * freq * 2.7 + seed * 2));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, groundY);
  ctx.closePath();
  ctx.fill();
}

/** Grass (or snow / ash) lip along the top of the ground between two screen x positions. */
export function drawGroundLip(
  ctx: CanvasRenderingContext2D,
  planetId: number,
  x0: number,
  x1: number,
  groundY: number
): void {
  const theme = surfaceTheme(planetId);
  ctx.save();
  ctx.fillStyle = theme.grassDark;
  ctx.fillRect(x0, groundY, x1 - x0, 9);
  ctx.fillStyle = theme.grass;
  ctx.fillRect(x0, groundY, x1 - x0, 6);
  // Tufts hanging over the edge at a stable pseudo-random spacing
  for (let x = Math.floor(x0 / 7) * 7; x < x1; x += 7) {
    const h = 3 + (((x * 7919) >>> 0) % 5);
    ctx.fillRect(x, groundY - h + 2, 3, h);
  }
  ctx.restore();
}

/** All yard buildings and props. `padX` is the pad centre on screen. */
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

  const visible = (x: number, half: number) => x + half > -40 && x - half < w + 40;

  // Background trees first so buildings overlap them
  for (const [ox, s] of [
    [-760, 1.1],
    [-655, 0.85],
    [-410, 0.95],
    [420, 0.9],
    [700, 1.15],
    [820, 0.8],
    [-900, 1],
    [960, 1],
  ] as const) {
    if (visible(padX + ox, 40)) drawTree(ctx, padX + ox, groundY, s, theme);
  }

  if (visible(padX - 580, 120)) drawOffice(ctx, padX - 580, groundY, accent, time);
  if (visible(padX - 330, 60)) drawFuelPump(ctx, padX - 330, groundY, time);
  if (visible(padX + 380, 140)) drawOreDepot(ctx, padX + 380, groundY, accent, time);
  if (visible(padX + 680, 110)) drawGarage(ctx, padX + 680, groundY, accent, time);
  drawDerrick(ctx, padX, groundY, accent, time);

  // Lamp posts and fence segments
  for (const ox of [-215, 215, -440, 560]) {
    if (visible(padX + ox, 20)) drawLamp(ctx, padX + ox, groundY, time);
  }
  for (const [a, b] of [
    [-880, -640],
    [700, 900],
  ] as const) {
    if (visible(padX + (a + b) / 2, (b - a) / 2)) drawFence(ctx, padX + a, padX + b, groundY);
  }

  // Workers pacing between buildings (wave when pod is at the surface!)
  for (let i = 0; i < 4; i++) {
    const [from, to] = i === 0 ? [-470, -330] : i === 1 ? [230, 420] : i === 2 ? [-250, -120] : [520, 650];
    const speed = 22 + i * 6;
    const span = to - from;
    const phase = (time * speed + i * 97) % (span * 2);
    const forward = phase < span;
    const x = padX + from + (forward ? phase : span * 2 - phase);
    const isNearPad = i === 1 || i === 2;
    if (visible(x, 10)) {
      drawWorker(ctx, x, groundY, forward ? 1 : -1, time * 9 + i, i, podAtSurface && isNearPad);
    }
  }

  ctx.restore();
}

function outlinedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, w, h);
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, groundY: number, s: number, theme: SurfaceTheme): void {
  ctx.fillStyle = theme.trunk;
  ctx.fillRect(x - 4 * s, groundY - 34 * s, 8 * s, 34 * s);
  ctx.fillStyle = theme.foliageDark;
  ctx.beginPath();
  ctx.arc(x, groundY - 50 * s, 26 * s, 0, Math.PI * 2);
  ctx.arc(x - 18 * s, groundY - 36 * s, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 18 * s, groundY - 38 * s, 19 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.foliage;
  ctx.beginPath();
  ctx.arc(x - 5 * s, groundY - 56 * s, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 10 * s, groundY - 44 * s, 12 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawOffice(ctx: CanvasRenderingContext2D, x: number, g: number, accent: string, time: number): void {
  const w = 190;
  const h = 112;
  const left = x - w / 2;
  // Main block
  outlinedRect(ctx, left, g - h, w, h, '#c9b79c');
  ctx.fillStyle = '#b09a7c';
  ctx.fillRect(left + 2, g - h + h * 0.5, w - 4, h * 0.5 - 2);
  // Roof
  ctx.fillStyle = '#5d4037';
  ctx.beginPath();
  ctx.moveTo(left - 12, g - h);
  ctx.lineTo(left + w + 12, g - h);
  ctx.lineTo(left + w - 6, g - h - 18);
  ctx.lineTo(left + 6, g - h - 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Sign board
  outlinedRect(ctx, x - 70, g - h - 44, 140, 26, '#1b2433');
  ctx.fillStyle = accent;
  ctx.font = '700 13px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CORE DIVER CO.', x, g - h - 31);
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(x - 50, g - h - 18);
  ctx.lineTo(x - 50, g - h);
  ctx.moveTo(x + 50, g - h - 18);
  ctx.lineTo(x + 50, g - h);
  ctx.stroke();
  // Windows, a couple lit and flickering gently
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      const wx = left + 18 + c * 44;
      const wy = g - h + 14 + r * 46;
      if (r === 1 && c === 1) continue;
      const lit = (c + r) % 3 === 0 && Math.sin(time * 0.7 + c) > -0.6;
      outlinedRect(ctx, wx, wy, 26, 22, lit ? '#ffe9a8' : '#3c5a75');
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(wx + 3, wy + 3, 6, 16);
    }
  }
  // Door
  outlinedRect(ctx, left + 52, g - 44, 30, 44, '#6d4c41');
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(left + 76, g - 24, 3, 3);
  // Awning stripe
  ctx.fillStyle = accent;
  ctx.fillRect(left + 46, g - 52, 42, 6);
}

function drawFuelPump(ctx: CanvasRenderingContext2D, x: number, g: number, time: number): void {
  // Tank on stilts
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 30, g);
  ctx.lineTo(x - 26, g - 52);
  ctx.moveTo(x + 30, g);
  ctx.lineTo(x + 26, g - 52);
  ctx.stroke();
  ctx.fillStyle = '#2e7d32';
  ctx.beginPath();
  ctx.ellipse(x, g - 70, 42, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#66bb6a';
  ctx.beginPath();
  ctx.ellipse(x - 12, g - 78, 18, 7, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Glowing sight-tube with rising green fuel bubbles
  ctx.fillStyle = '#0d2614';
  ctx.fillRect(x + 24, g - 82, 6, 24);
  const fuelLvl = 15 + Math.sin(time * 2.2) * 4;
  ctx.fillStyle = '#00e676';
  ctx.fillRect(x + 25, g - 58 - fuelLvl, 4, fuelLvl);
  const bY = g - 60 - ((time * 18) % Math.max(4, fuelLvl));
  ctx.fillStyle = '#b9f6ca';
  ctx.fillRect(x + 26, bY, 2, 2);

  ctx.fillStyle = '#e8f5e9';
  ctx.font = '700 11px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FUEL', x - 4, g - 66);
  // Pump box with blinking light & animated meter bar
  outlinedRect(ctx, x + 40, g - 40, 22, 40, '#d84315');
  ctx.fillStyle = '#102027';
  ctx.fillRect(x + 44, g - 35, 14, 10);
  ctx.fillStyle = Math.sin(time * 4) > 0 ? '#69f0ae' : '#00e676';
  const barW = 4 + Math.abs(Math.sin(time * 3.1)) * 8;
  ctx.fillRect(x + 45, g - 32, barW, 4);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 62, g - 26);
  ctx.quadraticCurveTo(x + 78, g - 8, x + 70, g - 2);
  ctx.stroke();
}

/** Drill derrick straddling the shaft mouth: two pad slabs either side of the hole the pod drops through. */
function drawDerrick(ctx: CanvasRenderingContext2D, x: number, g: number, accent: string, time: number): void {
  const h = 176;
  const base = 150;
  const top = 26;
  ctx.strokeStyle = '#3d4a56';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - base, g);
  ctx.lineTo(x - top, g - h);
  ctx.moveTo(x + base, g);
  ctx.lineTo(x + top, g - h);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#56636f';
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    const y0 = g - ((i - 1) * h) / 5;
    const y1 = g - (i * h) / 5;
    const half0 = base - ((base - top) * (i - 1)) / 5;
    const half1 = base - ((base - top) * i) / 5;
    if (i > 1) {
      ctx.moveTo(x - half0, y0);
      ctx.lineTo(x + half1, y1);
      ctx.moveTo(x + half0, y0);
      ctx.lineTo(x - half1, y1);
    }
    ctx.moveTo(x - half1, y1);
    ctx.lineTo(x + half1, y1);
  }
  ctx.stroke();
  // Crown block, spinning sheave and the winch cable down the shaft
  outlinedRect(ctx, x - 30, g - h - 14, 60, 16, '#455a64');
  ctx.strokeStyle = 'rgba(30, 30, 30, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, g - h);
  ctx.lineTo(x, g - 40);
  ctx.stroke();

  // Swaying auxiliary crane hook on right side of derrick
  const sway = Math.sin(time * 1.8) * 5;
  ctx.strokeStyle = '#263238';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 18, g - h + 2);
  ctx.lineTo(x + 18 + sway, g - h + 46);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(x + 18 + sway, g - h + 50, 4, 0, Math.PI * 1.3);
  ctx.stroke();

  ctx.save();
  ctx.translate(x, g - h - 22);
  ctx.rotate(time * 1.5);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.moveTo(-11, 0);
  ctx.lineTo(11, 0);
  ctx.moveTo(0, -11);
  ctx.lineTo(0, 11);
  ctx.stroke();
  ctx.restore();

  // Rotating red warning beacon light cone at derrick peak
  const beaconOn = Math.sin(time * 3.5) > -0.2;
  if (beaconOn) {
    ctx.save();
    ctx.translate(x, g - h - 38);
    const beamDir = Math.sin(time * 3.5);
    ctx.fillStyle = 'rgba(255, 82, 82, 0.22)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(beamDir * 44, -14);
    ctx.lineTo(beamDir * 44, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = beaconOn ? '#ff5252' : '#5d1010';
  ctx.beginPath();
  ctx.arc(x, g - h - 38, 4, 0, Math.PI * 2);
  ctx.fill();

  // Pad slabs with hazard stripes + periodic hydraulic steam vents
  for (const dir of [-1, 1]) {
    const x0 = dir < 0 ? x - 176 : x + 112;
    outlinedRect(ctx, x0, g - 10, 64, 10, '#263238');
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + 2, g - 9, 60, 6);
    ctx.clip();
    ctx.fillStyle = accent;
    for (let sx = x0 - 8; sx < x0 + 70; sx += 16) {
      ctx.beginPath();
      ctx.moveTo(sx, g - 3);
      ctx.lineTo(sx + 8, g - 3);
      ctx.lineTo(sx + 14, g - 9);
      ctx.lineTo(sx + 6, g - 9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Hydraulic pad steam vent puff
    const steamCycle = (time * 0.7 + (dir < 0 ? 0 : 0.5)) % 1;
    if (steamCycle < 0.45) {
      const p = steamCycle / 0.45;
      const vx = dir < 0 ? x - 112 - p * 18 : x + 112 + p * 18;
      const vy = g - 8 - p * 14;
      ctx.fillStyle = `rgba(224, 242, 241, ${(1 - p) * 0.45})`;
      ctx.beginPath();
      ctx.arc(vx, vy, 3.5 + p * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawOreDepot(ctx: CanvasRenderingContext2D, x: number, g: number, accent: string, time: number): void {
  const sx = x + 70;
  // Smokestack chimney behind silo with rising smoke rings
  outlinedRect(ctx, sx + 10, g - 162, 14, 34, '#37474f');
  for (let s = 0; s < 3; s++) {
    const p = (time * 0.45 + s * 0.33) % 1;
    const puffX = sx + 17 + Math.sin(time * 1.5 + s * 2) * 5 + p * 12;
    const puffY = g - 166 - p * 38;
    ctx.fillStyle = `rgba(207, 216, 220, ${(1 - p) * 0.42})`;
    ctx.beginPath();
    ctx.arc(puffX, puffY, 4 + p * 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Silo
  outlinedRect(ctx, sx - 34, g - 120, 68, 120, '#90a4ae');
  ctx.fillStyle = '#78909c';
  for (let i = 0; i < 4; i++) ctx.fillRect(sx - 32, g - 112 + i * 28, 64, 4);

  // Glowing molten smelter furnace window near base of silo
  const furnacePulse = 0.75 + Math.sin(time * 7) * 0.25;
  outlinedRect(ctx, sx - 16, g - 34, 32, 20, '#263238');
  ctx.fillStyle = `rgba(255, 109, 0, ${furnacePulse.toFixed(2)})`;
  ctx.fillRect(sx - 13, g - 31, 26, 14);
  ctx.fillStyle = '#fff59d';
  ctx.fillRect(sx - 8, g - 26, 16, 6);

  ctx.fillStyle = '#546e7a';
  ctx.beginPath();
  ctx.moveTo(sx - 38, g - 120);
  ctx.lineTo(sx, g - 146);
  ctx.lineTo(sx + 38, g - 120);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#263238';
  ctx.font = '700 11px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ORE', sx, g - 70);
  // Conveyor rising from the hopper to the silo
  const x0 = x - 90;
  const y0 = g - 22;
  const x1 = sx - 30;
  const y1 = g - 108;
  ctx.strokeStyle = '#37474f';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0 - 5);
  ctx.lineTo(x1, y1 - 5);
  ctx.moveTo(x0, y0 + 5);
  ctx.lineTo(x1, y1 + 5);
  ctx.stroke();
  // Ore chunks riding the belt
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ores = ['#212121', '#e07a3a', '#212121', '#b0bec5', '#212121', '#ffd54f'];
  for (let i = 0; i < 6; i++) {
    const t = ((time * 32 + i * (len / 6)) % len) / len;
    ctx.fillStyle = ores[i];
    ctx.beginPath();
    ctx.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Supports
  ctx.strokeStyle = '#455a64';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const t of [0.3, 0.65]) {
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    ctx.moveTo(px, py + 5);
    ctx.lineTo(px, g);
  }
  ctx.stroke();
  // Hopper
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(x0 - 34, g - 40);
  ctx.lineTo(x0 + 14, g - 40);
  ctx.lineTo(x0 + 4, g - 12);
  ctx.lineTo(x0 - 24, g - 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  outlinedRect(ctx, x0 - 22, g - 12, 24, 12, '#37474f');
}

function drawGarage(ctx: CanvasRenderingContext2D, x: number, g: number, accent: string, time = 0): void {
  const w = 170;
  const h = 86;
  const left = x - w / 2;
  outlinedRect(ctx, left, g - h, w, h, '#8d6e63');
  // Curved roof
  ctx.fillStyle = '#6d4c41';
  ctx.beginPath();
  ctx.moveTo(left - 8, g - h);
  ctx.quadraticCurveTo(x, g - h - 46, left + w + 8, g - h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Spinning rotary exhaust fan on left wall
  ctx.save();
  ctx.translate(left + 19, g - 52);
  ctx.fillStyle = '#263238';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.rotate(time * 5.5);
  ctx.strokeStyle = '#90a4ae';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(7, 0);
  ctx.moveTo(0, -7);
  ctx.lineTo(0, 7);
  ctx.stroke();
  ctx.restore();

  // Roll-up door (slightly ajar at the bottom showing interior welding sparks)
  outlinedRect(ctx, x - 52, g - 64, 104, 64, '#161b22');
  outlinedRect(ctx, x - 52, g - 64, 104, 54, '#b0bec5');
  ctx.fillStyle = '#90a4ae';
  for (let i = 0; i < 6; i++) ctx.fillRect(x - 50, g - 60 + i * 8, 100, 3);

  // Periodic welding flash & spark inside the open bay gap
  if (Math.sin(time * 13) > 0.35) {
    ctx.fillStyle = 'rgba(0, 229, 255, 0.55)';
    ctx.fillRect(x - 48, g - 10, 96, 9);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + Math.sin(time * 7) * 20, g - 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hazard header
  ctx.fillStyle = accent;
  ctx.fillRect(x - 52, g - 70, 104, 6);
  ctx.fillStyle = '#eceff1';
  ctx.font = '700 11px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GARAGE', x, g - h - 10);
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, g: number, time: number): void {
  ctx.strokeStyle = '#37474f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, g);
  ctx.lineTo(x, g - 62);
  ctx.lineTo(x + 12, g - 62);
  ctx.stroke();
  const flicker = 0.75 + Math.sin(time * 11 + x) * 0.05;
  const glow = ctx.createRadialGradient(x + 12, g - 58, 1, x + 12, g - 58, 34);
  glow.addColorStop(0, `rgba(255, 236, 170, ${0.6 * flicker})`);
  glow.addColorStop(1, 'rgba(255, 236, 170, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 24, g - 94, 72, 72);
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(x + 8, g - 60, 8, 5);
}

function drawFence(ctx: CanvasRenderingContext2D, x0: number, x1: number, g: number): void {
  ctx.strokeStyle = '#6d4c41';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, g - 16);
  ctx.lineTo(x1, g - 16);
  ctx.moveTo(x0, g - 8);
  ctx.lineTo(x1, g - 8);
  for (let x = x0; x <= x1; x += 24) {
    ctx.moveTo(x, g);
    ctx.lineTo(x, g - 22);
  }
  ctx.stroke();
}

function drawWorker(
  ctx: CanvasRenderingContext2D,
  x: number,
  g: number,
  dir: number,
  walk: number,
  variant: number,
  waving = false
): void {
  const step = Math.sin(walk);
  const bob = Math.abs(step) * 1.5;
  ctx.save();
  ctx.translate(x, g - bob);
  ctx.scale(dir, 1);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  // Legs
  ctx.beginPath();
  ctx.moveTo(-2, -12);
  ctx.lineTo(-2 + step * 4, 0);
  ctx.moveTo(2, -12);
  ctx.lineTo(2 - step * 4, 0);
  ctx.stroke();
  // Body (overalls) and head with hard hat
  const suit = ['#1e88e5', '#f57c00', '#43a047', '#8e24aa'][variant % 4];
  ctx.fillStyle = suit;
  ctx.fillRect(-5, -26, 10, 15);
  ctx.lineWidth = 2;
  ctx.strokeRect(-5, -26, 10, 15);
  ctx.fillStyle = '#ffcc80';
  ctx.beginPath();
  ctx.arc(0, -31, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd600';
  ctx.beginPath();
  ctx.arc(0, -33, 6, Math.PI, 0);
  ctx.fill();
  ctx.stroke();
  if (waving) {
    // Wave arm enthusiastically at the pod
    const waveAngle = -0.9 + Math.sin(walk * 2.2) * 0.45;
    ctx.strokeStyle = suit;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, -23);
    ctx.lineTo(4 + Math.cos(waveAngle) * 10, -23 + Math.sin(waveAngle) * 10);
    ctx.stroke();
  } else {
    // Pickaxe over the shoulder
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -16);
    ctx.lineTo(6, -34);
    ctx.stroke();
    ctx.strokeStyle = '#90a4ae';
    ctx.beginPath();
    ctx.moveTo(1, -37);
    ctx.quadraticCurveTo(7, -36, 11, -30);
    ctx.stroke();
  }
  ctx.restore();
}
