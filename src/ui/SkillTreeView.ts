import { fitCanvasToDisplay } from '../render/podView';
import {
  SKILL_NODES,
  SkillNodeConfig,
  SkillBranch,
  UPGRADE_TRACKS,
  UpgradeTrack,
  evaluateSkillNode,
  isTrackOpen,
  NodeEvaluation,
} from '../config/skillTree';
import { nextGoal } from '../config/milestones';
import { SpriteAtlas } from '../assets/spriteGenerator';
import { SaveState } from '../sdk/PortalSDK';

export const BRANCH_COLORS: Record<SkillBranch, { main: string; glow: string; bg: string; label: string }> = {
  core: { main: '#f5a623', glow: 'rgba(245, 166, 35, 0.45)', bg: '#2b1f0d', label: 'CORE RIG' },
  drill: { main: '#ff7043', glow: 'rgba(255, 112, 67, 0.45)', bg: '#2e1610', label: 'DRILL' },
  fuel: { main: '#00e676', glow: 'rgba(0, 230, 118, 0.45)', bg: '#0c2919', label: 'FUEL' },
  cargo: { main: '#ab47bc', glow: 'rgba(171, 71, 188, 0.45)', bg: '#241029', label: 'CARGO' },
  utility: { main: '#29b6f6', glow: 'rgba(41, 182, 246, 0.45)', bg: '#0d2230', label: 'SYSTEMS' },
  drone: { main: '#00e5ff', glow: 'rgba(0, 229, 255, 0.5)', bg: '#08262b', label: 'DRONES' },
};

const PAD = 14;
const GAP = 12;
const GOAL_H = 46;
const HEAD_H = 46;
const CARD_H = 62;
const MAXED_H = 34;
const CARD_GAP = 8;
/** Room under the last card for the overlay controls. */
const BOTTOM_ROOM = 64;

interface CardRect {
  node: SkillNodeConfig;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The upgrade screen: four track columns (Fuel, Cargo, Drill, Systems), each a short ladder of
 * cards. A track appears once its depth is reached; cards waiting on a depth show "Reach N m".
 * On narrow screens the tracks wrap into two columns. Drag or scroll to move up and down.
 */
export class SkillTreeView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private atlas: SpriteAtlas;
  private scrollY = 0;
  private contentH = 0;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private dragMoved = false;
  private cards: CardRect[] = [];

  public selectedNodeId = 'fuel_tank';
  public hoveredNodeId: string | null = null;
  private celebrations = new Map<string, number>();
  private animTime = 0;

  private onSelectOrBuyCallback: (node: SkillNodeConfig, isSecondTap: boolean) => void;

  constructor(
    canvas: HTMLCanvasElement,
    atlas: SpriteAtlas,
    onSelectOrBuyCallback: (node: SkillNodeConfig, isSecondTap: boolean) => void
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.atlas = atlas;
    this.onSelectOrBuyCallback = onSelectOrBuyCallback;
    this.bindEvents();
  }

  /** Plays a short flash on a card that was just bought. */
  public celebrate(nodeId: string): void {
    this.celebrations.set(nodeId, this.animTime);
  }

  public resetCamera(): void {
    this.scrollY = 0;
  }

  /** Selects the first buyable card in a track and scrolls to it. */
  public focusBranch(branch: SkillBranch, save: SaveState): SkillNodeConfig | null {
    const inTrack = SKILL_NODES.filter((n) => n.branch === branch);
    const evalOf = (n: SkillNodeConfig) =>
      evaluateSkillNode(n, save.ownedSkills, save.highestUnlockedPlanet, save.cash, save.deepestByPlanet);
    const target =
      inTrack.find((n) => evalOf(n).state === 'AVAILABLE') ?? inTrack.find((n) => evalOf(n).state !== 'HIDDEN') ?? null;
    if (target) {
      this.selectedNodeId = target.id;
      const rect = this.cards.find((c) => c.node.id === target.id);
      if (rect) this.scrollY = Math.max(0, rect.y - GOAL_H - HEAD_H - PAD);
    }
    return target;
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartY = e.clientY;
      this.dragStartScroll = this.scrollY;
    });

    window.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (this.isDragging) {
        const dy = e.clientY - this.dragStartY;
        if (Math.abs(dy) > 6) this.dragMoved = true;
        this.scrollY = this.clampScroll(this.dragStartScroll - dy);
      } else if (mx >= 0 && my >= 0 && mx <= rect.width && my <= rect.height) {
        const hit = this.findCardAt(mx, my);
        this.hoveredNodeId = hit ? hit.id : null;
        this.canvas.style.cursor = hit ? 'pointer' : 'default';
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (this.dragMoved) return;
      const rect = this.canvas.getBoundingClientRect();
      const hit = this.findCardAt(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) {
        const isSecondTap = this.selectedNodeId === hit.id;
        this.selectedNodeId = hit.id;
        this.onSelectOrBuyCallback(hit, isSecondTap);
      }
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.scrollY = this.clampScroll(this.scrollY + e.deltaY);
      },
      { passive: false }
    );
  }

  private clampScroll(y: number): number {
    return Math.max(0, Math.min(Math.max(0, this.contentH - this.canvas.clientHeight), y));
  }

  private findCardAt(sx: number, sy: number): SkillNodeConfig | null {
    const y = sy + this.scrollY;
    for (const c of this.cards) {
      if (sx >= c.x && sx <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c.node;
    }
    return null;
  }

  public render(dt: number, save: SaveState): void {
    this.animTime += dt;
    const { w, h, dpr } = fitCanvasToDisplay(this.canvas);
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);

    const sheet = ctx.createLinearGradient(0, 0, 0, h);
    sheet.addColorStop(0, '#1a0b3a');
    sheet.addColorStop(1, '#07021a');
    ctx.fillStyle = sheet;
    ctx.fillRect(0, 0, w, h);

    const evals = new Map<string, NodeEvaluation>();
    for (const node of SKILL_NODES) {
      evals.set(
        node.id,
        evaluateSkillNode(node, save.ownedSkills, save.highestUnlockedPlanet, save.cash, save.deepestByPlanet)
      );
    }

    // Layout: four columns on wide screens, two on phones
    const cols = w >= 560 ? 4 : 2;
    const colW = (w - PAD * 2 - GAP * (cols - 1)) / cols;
    const colBottoms = new Array(cols).fill(GOAL_H + PAD);
    this.cards = [];
    const blocks: { track: UpgradeTrack; x: number; y: number; open: boolean; nodes: SkillNodeConfig[] }[] = [];
    UPGRADE_TRACKS.forEach((track, i) => {
      const col = i % cols;
      const x = PAD + col * (colW + GAP);
      const y = colBottoms[col];
      const open = isTrackOpen(track, save.highestUnlockedPlanet, save.deepestByPlanet);
      const nodes = open
        ? SKILL_NODES.filter((n) => n.branch === track.branch && evals.get(n.id)!.state !== 'HIDDEN')
        : [];
      let cy = y + HEAD_H + CARD_GAP;
      for (const node of nodes) {
        const ch = evals.get(node.id)!.state === 'MAXED' ? MAXED_H : CARD_H;
        this.cards.push({ node, x, y: cy, w: colW, h: ch });
        cy += ch + CARD_GAP;
      }
      blocks.push({ track, x, y, open, nodes });
      colBottoms[col] = cy + GAP;
    });
    this.contentH = Math.max(...colBottoms) + BOTTOM_ROOM;
    this.scrollY = this.clampScroll(this.scrollY);

    ctx.translate(0, -this.scrollY);
    this.drawGoal(ctx, w, save);
    for (const b of blocks) this.drawTrackHeader(ctx, b.track, b.x, b.y, colW, b.open);
    for (const c of this.cards) this.drawCard(ctx, c, evals.get(c.node.id)!, save);
    ctx.restore();
  }

  /** "Next goal: Reach 120 m · +$150 · opens Drill track" across the top. */
  private drawGoal(ctx: CanvasRenderingContext2D, w: number, save: SaveState): void {
    const goal = nextGoal(save.currentPlanetId, save.deepestByPlanet[save.currentPlanetId] ?? 0);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, PAD, 8, w - PAD * 2, GOAL_H - 8, 10);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '700 12px "Orbitron", sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('NEXT GOAL', PAD + 12, 8 + (GOAL_H - 8) / 2);
    ctx.font = '700 16px "Rajdhani", system-ui, sans-serif';
    ctx.fillStyle = '#efe6ff';
    const labelX = PAD + 104;
    ctx.fillText(goal.label, labelX, 8 + (GOAL_H - 8) / 2);
    const lw = ctx.measureText(goal.label).width;
    ctx.font = '600 14px "Rajdhani", system-ui, sans-serif';
    ctx.fillStyle = '#ffd23f';
    fitText(ctx, goal.detail, labelX + lw + 10, 8 + (GOAL_H - 8) / 2, w - PAD - 12 - (labelX + lw + 10));
  }

  private drawTrackHeader(ctx: CanvasRenderingContext2D, track: UpgradeTrack, x: number, y: number, w: number, open: boolean): void {
    const col = BRANCH_COLORS[track.branch];
    ctx.fillStyle = open ? col.bg : 'rgba(18, 10, 42, 0.8)';
    ctx.strokeStyle = open ? col.main : 'rgba(125, 107, 196, 0.6)';
    ctx.lineWidth = 2;
    if (!open) ctx.setLineDash([5, 4]);
    roundRect(ctx, x, y, w, HEAD_H, 10);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '800 15px "Orbitron", sans-serif';
    ctx.fillStyle = open ? col.main : '#a99cc9';
    ctx.fillText(track.name.toUpperCase(), x + 12, y + 20);
    ctx.font = '600 13px "Rajdhani", system-ui, sans-serif';
    ctx.fillStyle = open ? '#cfc4ea' : '#ffc24a';
    fitText(ctx, open ? track.blurb : `Reach ${track.opensAtDepth} m to open`, x + 12, y + 37, w - 24);
  }

  private drawCard(ctx: CanvasRenderingContext2D, c: CardRect, ev: NodeEvaluation, save: SaveState): void {
    const { node, x, y, w, h } = c;
    const col = BRANCH_COLORS[node.branch];
    const selected = this.selectedNodeId === node.id;
    const hovered = this.hoveredNodeId === node.id;
    const locked = ev.state === 'LOCKED_VISIBLE';
    const maxed = ev.state === 'MAXED';
    const buyable = ev.state === 'AVAILABLE' && ev.canAfford;

    // Connector up to the card above
    ctx.strokeStyle = locked ? 'rgba(125, 107, 196, 0.4)' : col.main;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 22, y - CARD_GAP);
    ctx.lineTo(x + 22, y);
    ctx.stroke();

    if (buyable) {
      const pulse = 0.35 + Math.sin(this.animTime * 4) * 0.15;
      ctx.shadowColor = '#39ff88';
      ctx.shadowBlur = 14 * pulse * 2;
    }
    ctx.fillStyle = locked ? '#120a2a' : ev.level > 0 ? col.bg : '#1d1240';
    ctx.strokeStyle = selected ? '#ffffff' : maxed ? '#ffd54f' : buyable ? '#39ff88' : locked ? '#5b4a8f' : hovered ? col.main : '#7d6bc4';
    ctx.lineWidth = selected ? 2.5 : 1.8;
    if (locked) ctx.setLineDash([5, 3]);
    roundRect(ctx, x, y, w, h, 9);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.setLineDash([]);

    // Purchase flash
    const boughtAt = this.celebrations.get(node.id);
    if (boughtAt !== undefined) {
      const t = (this.animTime - boughtAt) / 0.5;
      if (t >= 1) this.celebrations.delete(node.id);
      else {
        ctx.globalAlpha = (1 - t) * 0.5;
        ctx.fillStyle = col.main;
        roundRect(ctx, x, y, w, h, 9);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    const icon = this.atlas.skillIcons.get(node.icon);
    const iconSize = maxed ? 20 : 28;
    if (icon) {
      ctx.globalAlpha = locked ? 0.4 : 1;
      ctx.drawImage(icon, x + 8, y + (maxed ? 7 : 8), iconSize, iconSize);
      ctx.globalAlpha = 1;
    }

    const tx = x + 8 + iconSize + 8;
    const textW = w - (tx - x) - 8;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (maxed) {
      ctx.font = '700 13px "Rajdhani", system-ui, sans-serif';
      ctx.fillStyle = '#cfc4ea';
      fitText(ctx, `${node.name} · MAX`, tx, y + 22, textW);
      return;
    }

    ctx.font = '700 15px "Rajdhani", system-ui, sans-serif';
    ctx.fillStyle = locked ? '#a99cc9' : '#efe6ff';
    fitText(ctx, node.name, tx, y + 19, textW - 34);

    // Level read-out on the right of the name row
    ctx.textAlign = 'right';
    ctx.font = '700 12px "Share Tech Mono", monospace';
    ctx.fillStyle = '#39ff88';
    ctx.fillText(`${ev.level}/${ev.maxLevel}`, x + w - 8, y + 18);

    ctx.textAlign = 'left';
    ctx.font = '600 12.5px "Rajdhani", system-ui, sans-serif';
    ctx.fillStyle = '#a99cc9';
    fitText(ctx, locked ? ev.lockReasons[0] ?? '' : node.perLevel, tx, y + 36, textW);

    // Price, coloured by whether it is affordable now
    ctx.font = '700 14px "Rajdhani", system-ui, sans-serif';
    ctx.fillStyle = locked ? '#ff9a8a' : ev.canAfford ? '#9cff7a' : '#ffc24a';
    ctx.fillText(`$${ev.nextCost.toLocaleString()}`, tx, y + 54);

    if (save.settings.colorblindMode) drawStateGlyph(ctx, x + w - 14, y + h - 14, ev.state, ev.level > 0, ev.canAfford);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws text, trimming it with an ellipsis to fit maxW. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number): void {
  if (maxW <= 0) return;
  let t = text;
  if (ctx.measureText(t).width > maxW) {
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
    t = `${t}…`;
  }
  ctx.fillText(t, x, y);
}

/** Shape-only state marker so card state never depends on color: check = owned, plus = buyable, padlock = locked. */
function drawStateGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: string,
  owned: boolean,
  canAfford: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#0b101b';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (state === 'LOCKED_VISIBLE') {
    ctx.rect(-3.5, -0.5, 7, 5);
    ctx.moveTo(-2.2, -0.5);
    ctx.arc(0, -2.2, 2.2, Math.PI, 0);
    ctx.lineTo(2.2, -0.5);
  } else if (owned) {
    ctx.moveTo(-3.5, 0);
    ctx.lineTo(-1, 3);
    ctx.lineTo(4, -3);
  } else if (canAfford) {
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.moveTo(0, -4);
    ctx.lineTo(0, 4);
  } else {
    ctx.moveTo(-3.5, 0);
    ctx.lineTo(3.5, 0);
  }
  ctx.stroke();
  ctx.restore();
}
