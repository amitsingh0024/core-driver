import { OreConfig } from '../config/ores';

/**
 * Neon synthwave art set, drawn in code: dark faceted rock that lights up along tunnel edges,
 * glowing crystal ores, and outlined pods and pickups. Every texture is generated once at boot.
 */

export interface NeonStratum {
  face: string; // dark rock colour
  glow: string; // neon edge / speck colour
}

/** Per-stratum rock colours. Planet 1 is sunset pink and orange, 2 is ice cyan, 3 is violet and acid. */
export const NEON_STRATA: Record<string, NeonStratum> = {
  p1_loam: { face: '#1c0d2b', glow: '#ff6ad5' },
  p1_sandstone: { face: '#220e26', glow: '#ff8b5e' },
  p1_granite: { face: '#170f2e', glow: '#c774e8' },
  p1_basalt: { face: '#1d0818', glow: '#ff3864' },
  p1_core: { face: '#240c0a', glow: '#ffb000' },
  p2_rime: { face: '#0a1d33', glow: '#7df9ff' },
  p2_shale: { face: '#08182e', glow: '#3fd0ff' },
  p2_quartzite: { face: '#0a1433', glow: '#4d9bff' },
  p2_cryoglass: { face: '#060f29', glow: '#00f0ff' },
  p2_core: { face: '#040b22', glow: '#a8fffd' },
  p3_slag: { face: '#190b22', glow: '#d65bff' },
  p3_obsidian: { face: '#110a26', glow: '#8a5cff' },
  p3_brimstone: { face: '#1d0717', glow: '#ff3fa4' },
  p3_voidmantle: { face: '#05171e', glow: '#00ffc8' },
  p3_core: { face: '#0a0313', glow: '#ff66ff' },
};

const FALLBACK: NeonStratum = { face: '#150c26', glow: '#ff6ad5' };

export function neonStratum(stratumId: string): NeonStratum {
  return NEON_STRATA[stratumId] ?? FALLBACK;
}

/** Pod hull accent per tier: cyan pioneer, hot-pink lancer, violet breaker. */
export const POD_NEON = ['#00f0ff', '#ff2e88', '#b967ff'];

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Mixes two hex colours, t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (r * 0.3 + g * 0.59 + b * 0.11) / 255;
}

/** An ore's colour pushed bright enough to glow on near-black rock (coal becomes cold steel-blue). */
export function oreNeon(ore: OreConfig): string {
  if (ore.id === 'coal') return '#8fa3ff';
  let c = ore.highlightColor;
  if (luminance(c) < 0.5) c = mix(c, '#ffffff', 0.35);
  return c;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/**
 * Seamless low-poly rock face. Border vertices sit on a fixed lattice so the tile still
 * matches its neighbours when the renderer mirrors it; only interior vertices are jittered.
 */
export function neonRockTile(stratumId: string, size = 96): HTMLCanvasElement {
  const { face, glow } = neonStratum(stratumId);
  const [c, ctx] = canvas(size, size);
  const rand = seeded(hashString(stratumId));
  const n = 4;
  const step = size / n;
  const pts: Array<Array<[number, number]>> = [];
  for (let j = 0; j <= n; j++) {
    const row: Array<[number, number]> = [];
    for (let i = 0; i <= n; i++) {
      const inner = i > 0 && i < n && j > 0 && j < n;
      const jx = inner ? (rand() - 0.5) * step * 0.7 : 0;
      const jy = inner ? (rand() - 0.5) * step * 0.7 : 0;
      row.push([i * step + jx, j * step + jy]);
    }
    pts.push(row);
  }

  ctx.fillStyle = face;
  ctx.fillRect(0, 0, size, size);
  const tri = (a: [number, number], b: [number, number], d: [number, number]) => {
    const shade = rand();
    ctx.fillStyle = shade < 0.5 ? mix(face, '#000000', 0.45 * (0.5 - shade) * 2) : mix(face, glow, 0.16 * (shade - 0.5) * 2);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const p00 = pts[j][i];
      const p10 = pts[j][i + 1];
      const p01 = pts[j + 1][i];
      const p11 = pts[j + 1][i + 1];
      if ((i + j) % 2 === 0) {
        tri(p00, p10, p11);
        tri(p00, p11, p01);
      } else {
        tri(p00, p10, p01);
        tri(p10, p11, p01);
      }
    }
  }

  // Faint glowing fault lines along a few facet edges
  ctx.strokeStyle = rgba(glow, 0.16);
  ctx.lineWidth = 1;
  for (let k = 0; k < 5; k++) {
    const j = 1 + Math.floor(rand() * (n - 1));
    const i = 1 + Math.floor(rand() * (n - 1));
    const a = pts[j][i];
    const b = rand() < 0.5 ? pts[j][i + 1] : pts[j + 1][i];
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }

  // Tiny bright specks, kept off the border so mirrored tiles never clip one in half
  for (let k = 0; k < 7; k++) {
    const x = 6 + rand() * (size - 12);
    const y = 6 + rand() * (size - 12);
    const r = 0.6 + rand() * 1.1;
    ctx.fillStyle = rgba(glow, 0.25 + rand() * 0.45);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** Glowing ore: crystal ores are a cluster of prisms, metal ores a faceted nugget. */
export function neonOre(ore: OreConfig, size = 128): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const glow = oreNeon(ore);
  const deep = mix(ore.color, '#05030c', 0.45);
  const rand = seeded(hashString(ore.id));
  ctx.translate(size / 2, size / 2);
  ctx.scale(1.3, 1.3);
  ctx.lineJoin = 'round';

  const shard = (x: number, y: number, w: number, h: number, ang: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const path = new Path2D();
    path.moveTo(0, -h);
    path.lineTo(w, -h * 0.55);
    path.lineTo(w, h * 0.6);
    path.lineTo(0, h);
    path.lineTo(-w, h * 0.6);
    path.lineTo(-w, -h * 0.55);
    path.closePath();
    const g = ctx.createLinearGradient(-w, -h, w, h);
    g.addColorStop(0, mix(glow, '#ffffff', 0.45));
    g.addColorStop(0.45, glow);
    g.addColorStop(1, deep);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = g;
    ctx.fill(path);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = mix(glow, '#ffffff', 0.55);
    ctx.lineWidth = 2.4;
    ctx.stroke(path);
    // Centre ridge and a highlight facet
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(0, h);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(-w, -h * 0.55);
    ctx.lineTo(-w, h * 0.1);
    ctx.lineTo(0, -h * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  if (ore.crystal) {
    shard(-16, 10, 10, 26, -0.42);
    shard(17, 12, 9, 22, 0.38);
    shard(0, -2, 13, 36, 0.04);
  } else {
    // Faceted nugget: jittered polygon with a few internal facet lines
    const sides = 7;
    const verts: Array<[number, number]> = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const r = 30 + rand() * 12;
      verts.push([Math.cos(a) * r, Math.sin(a) * r * 0.86]);
    }
    const path = new Path2D();
    verts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();
    const g = ctx.createRadialGradient(-10, -12, 4, 0, 0, 44);
    g.addColorStop(0, mix(glow, '#ffffff', 0.5));
    g.addColorStop(0.5, glow);
    g.addColorStop(1, deep);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 20;
    ctx.fillStyle = g;
    ctx.fill(path);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = mix(glow, '#ffffff', 0.5);
    ctx.lineWidth = 2.6;
    ctx.stroke(path);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.3;
    const core: [number, number] = [-4 + rand() * 8, -4 + rand() * 8];
    for (let i = 0; i < sides; i += 2) {
      ctx.beginPath();
      ctx.moveTo(core[0], core[1]);
      ctx.lineTo(verts[i][0], verts[i][1]);
      ctx.stroke();
    }
  }
  return c;
}

/** Fuel cell: glowing green capsule with a charge bolt. */
export function neonFuelCell(size = 128): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const green = '#39ff88';
  ctx.translate(size / 2, size / 2);
  const body = new Path2D();
  body.roundRect(-22, -38, 44, 76, 16);
  ctx.fillStyle = '#04140c';
  ctx.fill(body);
  const liquid = ctx.createLinearGradient(0, -20, 0, 34);
  liquid.addColorStop(0, rgba(green, 0.35));
  liquid.addColorStop(1, rgba(green, 0.85));
  ctx.fillStyle = liquid;
  ctx.beginPath();
  ctx.roundRect(-16, -18, 32, 50, 10);
  ctx.fill();
  ctx.shadowColor = green;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = green;
  ctx.lineWidth = 3.5;
  ctx.stroke(body);
  ctx.fillStyle = green;
  ctx.fillRect(-9, -46, 18, 8);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(4, -12);
  ctx.lineTo(-9, 6);
  ctx.lineTo(0, 6);
  ctx.lineTo(-4, 24);
  ctx.lineTo(10, 2);
  ctx.lineTo(1, 2);
  ctx.closePath();
  ctx.fill();
  return c;
}

/** Extraction beacon: cyan pylon with a hard glow. */
export function neonBeacon(size = 128): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const cyan = '#00f0ff';
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#071722';
  ctx.beginPath();
  ctx.roundRect(36, 90, 56, 20, 5);
  ctx.fill();
  ctx.strokeStyle = cyan;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const gem = new Path2D('M64 14 L88 52 L76 88 L52 88 L40 52 Z');
  ctx.shadowColor = cyan;
  ctx.shadowBlur = 22;
  const g = ctx.createLinearGradient(40, 14, 88, 88);
  g.addColorStop(0, '#e6ffff');
  g.addColorStop(0.5, cyan);
  g.addColorStop(1, '#00586b');
  ctx.fillStyle = g;
  ctx.fill(gem);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#e6ffff';
  ctx.lineWidth = 2.5;
  ctx.stroke(gem);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(64, 14);
  ctx.lineTo(64, 88);
  ctx.stroke();
  return c;
}

/** Relic cache: dark chest traced in gold neon with a magenta lock gem. */
export function neonRelic(size = 128): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const gold = '#ffd23f';
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#140a1e';
  ctx.beginPath();
  ctx.roundRect(22, 40, 84, 58, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(22, 58);
  ctx.quadraticCurveTo(64, 20, 106, 58);
  ctx.closePath();
  ctx.fillStyle = '#1e0f2c';
  ctx.fill();
  ctx.shadowColor = gold;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(22, 40, 84, 58, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(22, 62);
  ctx.lineTo(106, 62);
  ctx.stroke();
  ctx.shadowColor = '#ff2e88';
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath();
  ctx.moveTo(64, 54);
  ctx.lineTo(72, 64);
  ctx.lineTo(64, 76);
  ctx.lineTo(56, 64);
  ctx.closePath();
  ctx.fill();
  return c;
}

/** Planet core block: hex lattice glowing in the core colour. */
export function neonCore(color: string, size = 128): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = mix(color, '#05020a', 0.82);
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size * 0.7);
  g.addColorStop(0, rgba(color, 0.55));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = rgba(mix(color, '#ffffff', 0.3), 0.75);
  ctx.lineWidth = 2;
  const r = size / 4;
  const hw = r * Math.sqrt(3);
  for (let row = -1; row < 4; row++) {
    for (let col = -1; col < 4; col++) {
      const cx = col * hw + (row % 2 ? hw / 2 : 0);
      const cy = row * r * 1.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  return c;
}

/**
 * Drill pod body, 192x256, laid out to match the renderer's anchors: thruster nozzle at the top,
 * cockpit visor around y=88, hull down to y=160, drill cone below to the tip.
 */
export function neonPod(tier: number): HTMLCanvasElement {
  const [c, ctx] = canvas(192, 256);
  const neon = POD_NEON[tier - 1] ?? POD_NEON[0];
  const cx = 96;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Side fins
  for (const dir of [-1, 1]) {
    const fin = new Path2D();
    fin.moveTo(cx + dir * 46, 70);
    fin.lineTo(cx + dir * (tier >= 2 ? 78 : 70), 118);
    fin.lineTo(cx + dir * (tier >= 2 ? 78 : 70), 150);
    fin.lineTo(cx + dir * 46, 140);
    fin.closePath();
    ctx.fillStyle = '#0c0b1d';
    ctx.fill(fin);
    ctx.shadowColor = neon;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = neon;
    ctx.lineWidth = 3;
    ctx.stroke(fin);
    ctx.shadowBlur = 0;
  }

  // Drill cone with glowing spiral bands
  const coneTop = 150;
  const coneTip = 250;
  const coneW = 44;
  const cone = new Path2D();
  cone.moveTo(cx - coneW, coneTop);
  cone.lineTo(cx + coneW, coneTop);
  cone.lineTo(cx, coneTip);
  cone.closePath();
  const cg = ctx.createLinearGradient(cx - coneW, 0, cx + coneW, 0);
  cg.addColorStop(0, '#1a1c2e');
  cg.addColorStop(0.45, '#5b6182');
  cg.addColorStop(1, '#141526');
  ctx.fillStyle = cg;
  ctx.fill(cone);
  ctx.save();
  ctx.clip(cone);
  ctx.strokeStyle = neon;
  ctx.lineWidth = 4;
  ctx.shadowColor = neon;
  ctx.shadowBlur = 10;
  for (let y = coneTop + 8; y < coneTip; y += 20) {
    ctx.beginPath();
    ctx.moveTo(cx - coneW, y);
    ctx.lineTo(cx + coneW, y + 16);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = mix(neon, '#ffffff', 0.4);
  ctx.lineWidth = 3;
  ctx.stroke(cone);

  // Hull capsule
  const hull = new Path2D();
  hull.roundRect(cx - 50, 40, 100, 118, [34, 34, 16, 16]);
  const hg = ctx.createLinearGradient(cx - 50, 0, cx + 50, 0);
  hg.addColorStop(0, '#0b0a1a');
  hg.addColorStop(0.35, '#22203d');
  hg.addColorStop(1, '#09081500');
  ctx.fillStyle = '#100f24';
  ctx.fill(hull);
  ctx.fillStyle = hg;
  ctx.fill(hull);
  ctx.shadowColor = neon;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = neon;
  ctx.lineWidth = 4;
  ctx.stroke(hull);
  ctx.shadowBlur = 0;

  // Panel seams and running lights
  ctx.strokeStyle = rgba(neon, 0.45);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 44, 124);
  ctx.lineTo(cx + 44, 124);
  ctx.moveTo(cx - 30, 124);
  ctx.lineTo(cx - 30, 154);
  ctx.moveTo(cx + 30, 124);
  ctx.lineTo(cx + 30, 154);
  ctx.stroke();
  ctx.fillStyle = neon;
  ctx.shadowColor = neon;
  ctx.shadowBlur = 10;
  for (const dx of [-38, 38]) {
    ctx.beginPath();
    ctx.arc(cx + dx, 140, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (tier >= 3) {
    ctx.fillStyle = '#ffd23f';
    ctx.shadowColor = '#ffd23f';
    ctx.beginPath();
    ctx.arc(cx, 140, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Thruster nozzle
  ctx.fillStyle = '#1a1930';
  ctx.beginPath();
  ctx.roundRect(cx - 18, 26, 36, 18, 4);
  ctx.fill();
  ctx.strokeStyle = neon;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Cockpit visor
  const visor = new Path2D();
  visor.ellipse(cx, 88, 30, 20, 0, 0, Math.PI * 2);
  const vg = ctx.createLinearGradient(cx, 68, cx, 108);
  vg.addColorStop(0, mix(neon, '#ffffff', 0.6));
  vg.addColorStop(0.5, neon);
  vg.addColorStop(1, mix(neon, '#000000', 0.6));
  ctx.shadowColor = neon;
  ctx.shadowBlur = 24;
  ctx.fillStyle = vg;
  ctx.fill(visor);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke(visor);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.ellipse(cx - 11, 81, 9, 4, -0.35, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Mining drone: dark disc ringed in the tier's neon with a bright lens. */
export function neonDrone(tier: number): HTMLCanvasElement {
  const [c, ctx] = canvas(64, 64);
  const neon = POD_NEON[tier - 1] ?? POD_NEON[0];
  ctx.translate(32, 32);
  ctx.strokeStyle = rgba(neon, 0.7);
  ctx.lineWidth = 2;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 10, 0);
    ctx.lineTo(dir * 22, -4);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(dir * 22, -6, 8, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#0d0c1e';
  ctx.beginPath();
  ctx.arc(0, 0, 11 + tier, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = neon;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = neon;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = neon;
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-1.4, -1.6, 1.4, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
