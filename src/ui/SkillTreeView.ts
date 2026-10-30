import {
  SKILL_NODES,
  SKILL_NODE_MAP,
  SkillNodeConfig,
  SkillBranch,
  evaluateSkillNode,
  NodeEvaluation,
} from '../config/skillTree';
import { SpriteAtlas } from '../assets/spriteGenerator';
import { SaveState } from '../sdk/PortalSDK';

export const BRANCH_COLORS: Record<
  SkillBranch,
  { main: string; glow: string; bg: string; label: string; shapeName: string }
> = {
  core: {
    main: '#f5a623',
    glow: 'rgba(245, 166, 35, 0.45)',
    bg: '#2b1f0d',
    label: 'CORE RIG',
    shapeName: 'Octagon',
  },
  drill: {
    main: '#ff7043',
    glow: 'rgba(255, 112, 67, 0.45)',
    bg: '#2e1610',
    label: 'EXCAVATION & DRILL',
    shapeName: 'Shield',
  },
  fuel: {
    main: '#00e676',
    glow: 'rgba(0, 230, 118, 0.45)',
    bg: '#0c2919',
    label: 'FUEL & THERMAL',
    shapeName: 'Hexagon',
  },
  cargo: {
    main: '#ab47bc',
    glow: 'rgba(171, 71, 188, 0.45)',
    bg: '#241029',
    label: 'CARGO & REFINERY',
    shapeName: 'Beveled Crate',
  },
  utility: {
    main: '#29b6f6',
    glow: 'rgba(41, 182, 246, 0.45)',
    bg: '#0d2230',
    label: 'THRUSTERS & RADAR',
    shapeName: 'Diamond',
  },
  drone: {
    main: '#00e5ff',
    glow: 'rgba(0, 229, 255, 0.5)',
    bg: '#08262b',
    label: 'AUTONOMOUS DRONES',
    shapeName: 'Orbital Ring',
  },
};

export class SkillTreeView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private atlas: SpriteAtlas;
  private panX = 0;
  private panY = 30;
  private zoom = 1.0;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragMoved = false;

  public selectedNodeId = 'drill_torque_1';
  public hoveredNodeId: string | null = null;
  private celebrations = new Map<string, number>();
  private animTime = 0;
  private nodeSpacing = 116;

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

  /** Plays a short burst ring on a node that was just bought. */
  public celebrate(nodeId: string): void {
    this.celebrations.set(nodeId, this.animTime);
  }

  public resetCamera(): void {
    this.panX = 0;
    this.panY = 40;
    this.zoom = 1.0;
  }

  public focusBranch(branch: SkillBranch, save: SaveState): SkillNodeConfig | null {
    const candidates = SKILL_NODES.filter((n) => {
      if (n.branch !== branch) return false;
      const ev = evaluateSkillNode(n, save.ownedSkills, save.highestUnlockedPlanet, save.cash);
      return ev.state !== 'HIDDEN';
    });
    const target = candidates[0] ?? SKILL_NODES.find((n) => n.branch === branch) ?? null;
    if (target) {
      this.selectedNodeId = target.id;
      const pos = this.getNodeWorldPos(target);
      this.panX = -pos.x * this.zoom;
      this.panY = -pos.y * this.zoom;
    }
    return target;
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
    });

    window.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.isDragging) {
        const nx = e.clientX - this.dragStartX;
        const ny = e.clientY - this.dragStartY;
        if (Math.hypot(nx - this.panX, ny - this.panY) > 6) {
          this.dragMoved = true;
        }
        this.panX = nx;
        this.panY = ny;
      } else if (mx >= 0 && my >= 0 && mx <= rect.width && my <= rect.height) {
        const hit = this.findNodeAtScreenPos(mx, my);
        this.hoveredNodeId = hit ? hit.id : null;
        this.canvas.style.cursor = hit ? 'pointer' : 'grab';
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      if (!this.dragMoved) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hit = this.findNodeAtScreenPos(mx, my);
        if (hit) {
          const isSecondTap = this.selectedNodeId === hit.id;
          this.selectedNodeId = hit.id;
          this.onSelectOrBuyCallback(hit, isSecondTap);
        }
      }
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1.1 : 0.9;
        this.zoom = Math.max(0.55, Math.min(1.65, this.zoom * delta));
      },
      { passive: false }
    );
  }

  private getNodeWorldPos(node: SkillNodeConfig): { x: number; y: number } {
    return {
      x: node.gx * this.nodeSpacing,
      y: node.gy * this.nodeSpacing,
    };
  }

  private screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    const cx = this.canvas.clientWidth * 0.5 + this.panX;
    const cy = this.canvas.clientHeight * 0.5 + this.panY;
    return {
      wx: (sx - cx) / this.zoom,
      wy: (sy - cy) / this.zoom,
    };
  }

  private findNodeAtScreenPos(sx: number, sy: number): SkillNodeConfig | null {
    const { wx, wy } = this.screenToWorld(sx, sy);
    for (const node of SKILL_NODES) {
      const pos = this.getNodeWorldPos(node);
      if (Math.hypot(wx - pos.x, wy - pos.y) <= 34) {
        return node;
      }
    }
    return null;
  }

  /**
   * Traces the branch-specific frame shape (6 distinct silhouettes for colorblind readability)
   */
  private traceBranchShape(ctx: CanvasRenderingContext2D, branch: SkillBranch, r: number): void {
    ctx.beginPath();
    switch (branch) {
      case 'core': {
        // 8-sided industrial octagon
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + Math.PI / 8;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 'drill': {
        // Pointed Excavation Shield / Chevron
        ctx.moveTo(-r * 0.85, -r * 0.82);
        ctx.lineTo(r * 0.85, -r * 0.82);
        ctx.lineTo(r * 0.95, r * 0.15);
        ctx.lineTo(0, r * 1.08);
        ctx.lineTo(-r * 0.95, r * 0.15);
        ctx.closePath();
        break;
      }
      case 'fuel': {
        // Flat-top Hexagon
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 'cargo': {
        // Chamfered Cargo Crate Square
        const c = r * 0.88;
        const b = r * 0.34;
        ctx.moveTo(-c + b, -c);
        ctx.lineTo(c - b, -c);
        ctx.lineTo(c, -c + b);
        ctx.lineTo(c, c - b);
        ctx.lineTo(c - b, c);
        ctx.lineTo(-c + b, c);
        ctx.lineTo(-c, c - b);
        ctx.lineTo(-c, -c + b);
        ctx.closePath();
        break;
      }
      case 'utility': {
        // Radar Diamond
        const d = r * 1.08;
        ctx.moveTo(0, -d);
        ctx.lineTo(d, 0);
        ctx.lineTo(0, d);
        ctx.lineTo(-d, 0);
        ctx.closePath();
        break;
      }
      case 'drone':
      default: {
        // Orbital Tech Circle
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        break;
      }
    }
  }

  public render(dt: number, save: SaveState): void {
    this.animTime += dt;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Deep Grid Background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5 + this.panX;
    const cy = h * 0.5 + this.panY;

    // Subtle Blueprint Grid Lines
    const gridStep = 58 * this.zoom;
    const offsetX = ((cx % gridStep) + gridStep) % gridStep;
    const offsetY = ((cy % gridStep) + gridStep) % gridStep;
    ctx.strokeStyle = 'rgba(45, 68, 102, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x < w; x += gridStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = offsetY; y < h; y += gridStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    ctx.translate(cx, cy);
    ctx.scale(this.zoom, this.zoom);

    // Evaluate all nodes first
    const evals = new Map<string, NodeEvaluation>();
    for (const node of SKILL_NODES) {
      evals.set(
        node.id,
        evaluateSkillNode(node, save.ownedSkills, save.highestUnlockedPlanet, save.cash)
      );
    }

    // 2. Draw Drifting Fog-of-War Clouds over Unrevealed Nodes
    for (const node of SKILL_NODES) {
      const ev = evals.get(node.id)!;
      if (ev.state !== 'HIDDEN') continue;

      const pos = this.getNodeWorldPos(node);
      const driftX = Math.sin(this.animTime * 0.6 + node.gx * 1.3 + node.gy) * 8;
      const driftY = Math.cos(this.animTime * 0.5 + node.gy * 1.1) * 6;

      const fogGrad = ctx.createRadialGradient(
        pos.x + driftX,
        pos.y + driftY,
        8,
        pos.x + driftX,
        pos.y + driftY,
        74
      );
      fogGrad.addColorStop(0, 'rgba(13, 21, 36, 0.85)');
      fogGrad.addColorStop(0.6, 'rgba(10, 16, 28, 0.45)');
      fogGrad.addColorStop(1, 'rgba(8, 12, 20, 0)');
      ctx.fillStyle = fogGrad;
      ctx.beginPath();
      ctx.arc(pos.x + driftX, pos.y + driftY, 74, 0, Math.PI * 2);
      ctx.fill();

      // Check if any parent is revealed (so this hidden node is on the fog frontier)
      const isFrontier = node.revealFrom.some((pid) => {
        const pev = evals.get(pid);
        return pev && pev.state !== 'HIDDEN';
      });
      if (isFrontier) {
        const pPos = this.getNodeWorldPos(SKILL_NODE_MAP[node.revealFrom[0]]);
        ctx.strokeStyle = 'rgba(84, 110, 122, 0.18)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(pPos.x, pPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(18, 28, 44, 0.8)';
        ctx.strokeStyle = 'rgba(84, 110, 122, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(144, 164, 174, 0.45)';
        ctx.font = '800 13px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', pos.x, pos.y + 5);
      }
    }

    // 3. Draw Connection Lines ONLY to Revealed Nodes (with animated pulse on owned paths)
    for (const node of SKILL_NODES) {
      const ev = evals.get(node.id)!;
      if (ev.state === 'HIDDEN') continue;

      const toPos = this.getNodeWorldPos(node);
      const bCol = BRANCH_COLORS[node.branch];

      const parentIds = new Set<string>([
        ...node.revealFrom,
        ...(node.requiresNodesAll ?? []),
      ]);

      for (const pid of parentIds) {
        const parent = SKILL_NODE_MAP[pid];
        const pev = evals.get(pid);
        if (!parent || !pev || pev.state === 'HIDDEN') continue;

        const fromPos = this.getNodeWorldPos(parent);
        const parentOwned = pev.level >= 1;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(toPos.x, toPos.y);

        if (ev.level > 0 && parentOwned) {
          ctx.strokeStyle = bCol.main;
          ctx.lineWidth = 4;
          ctx.stroke();

          // Animated glowing energy pulse traveling along owned wire
          const t = (this.animTime * 0.75 + (node.gx + node.gy) * 0.17) % 1;
          const px = fromPos.x + (toPos.x - fromPos.x) * t;
          const py = fromPos.y + (toPos.y - fromPos.y) * t;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px, py, 3.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (ev.state === 'AVAILABLE' && parentOwned) {
          ctx.strokeStyle = ev.canAfford ? bCol.main : 'rgba(144, 164, 174, 0.65)';
          ctx.lineWidth = 2.8;
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(120, 144, 156, 0.35)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 4. Draw Revealed Nodes with Branch-Specific Frame Shapes
    for (const node of SKILL_NODES) {
      const ev = evals.get(node.id)!;
      if (ev.state === 'HIDDEN') continue;

      const pos = this.getNodeWorldPos(node);
      const bCol = BRANCH_COLORS[node.branch];
      const isSelected = this.selectedNodeId === node.id;
      const isHovered = this.hoveredNodeId === node.id;
      const radius = node.id === 'starter_pod' ? 32 : 28;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Pulse halo for affordable available nodes or selected node
      if (isSelected || isHovered || (ev.state === 'AVAILABLE' && ev.canAfford)) {
        const pulse = 1 + Math.sin(this.animTime * 5) * 0.08;
        ctx.fillStyle =
          ev.state === 'LOCKED_VISIBLE'
            ? 'rgba(255, 82, 82, 0.22)'
            : bCol.glow;
        this.traceBranchShape(ctx, node.branch, (radius + 9) * pulse);
        ctx.fill();
      }

      // Node Body in Branch Shape
      ctx.fillStyle =
        ev.state === 'LOCKED_VISIBLE'
          ? '#161922'
          : ev.level > 0
          ? bCol.bg
          : '#111722';
      this.traceBranchShape(ctx, node.branch, radius);
      ctx.fill();

      // Node Border
      if (ev.state === 'MAXED') {
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 3.5;
      } else if (ev.state === 'LOCKED_VISIBLE') {
        ctx.strokeStyle = node.minPlanet > save.highestUnlockedPlanet ? '#00e5ff' : '#ff5252';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
      } else if (ev.level > 0) {
        ctx.strokeStyle = bCol.main;
        ctx.lineWidth = 3;
      } else if (ev.canAfford) {
        ctx.strokeStyle = '#69f0ae';
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = '#546e7a';
        ctx.lineWidth = 2;
      }

      this.traceBranchShape(ctx, node.branch, radius);
      ctx.stroke();
      ctx.setLineDash([]);

      // Selection Ring
      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        this.traceBranchShape(ctx, node.branch, radius + 5);
        ctx.stroke();
      }

      // Purchase burst: two expanding rings for 0.6s
      const boughtAt = this.celebrations.get(node.id);
      if (boughtAt !== undefined) {
        const t = (this.animTime - boughtAt) / 0.6;
        if (t >= 1) {
          this.celebrations.delete(node.id);
        } else {
          for (const lag of [0, 0.25]) {
            const k = Math.max(0, t - lag);
            ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
            ctx.strokeStyle = bCol.main;
            ctx.lineWidth = 3;
            this.traceBranchShape(ctx, node.branch, radius + 6 + k * 34);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      // Colorblind mode: state glyph in a badge at the top-right corner
      if (save.settings.colorblindMode && node.id !== 'starter_pod') {
        drawStateGlyph(ctx, radius * 0.78, -radius * 0.78, ev.state, ev.level > 0, ev.canAfford);
      }

      // Draw Icon inside node
      const iconCanvas = this.atlas.skillIcons.get(node.icon);
      if (iconCanvas) {
        ctx.globalAlpha = ev.state === 'LOCKED_VISIBLE' ? 0.45 : 1.0;
        ctx.drawImage(iconCanvas, -14, -16, 28, 28);
        ctx.globalAlpha = 1.0;
      }

      // Lock Badge or Level Pill at bottom of node
      ctx.font = '800 10px "Rajdhani", "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';

      if (ev.state === 'LOCKED_VISIBLE') {
        const isPlanetLock = node.minPlanet > save.highestUnlockedPlanet;
        const badgeText = isPlanetLock ? `PLANET ${node.minPlanet} LOCK` : 'REQ LOCKED';
        ctx.fillStyle = isPlanetLock ? '#006064' : '#4a121b';
        ctx.fillRect(-36, radius - 10, 72, 15);
        ctx.strokeStyle = isPlanetLock ? '#00e5ff' : '#ff5252';
        ctx.lineWidth = 1;
        ctx.strokeRect(-36, radius - 10, 72, 15);
        ctx.fillStyle = isPlanetLock ? '#84ffff' : '#ff8a80';
        ctx.fillText(badgeText, 0, radius + 1);
      } else {
        const pillText =
          node.id === 'starter_pod'
            ? 'ACTIVE'
            : ev.state === 'MAXED'
            ? 'MAX'
            : `${ev.level}/${ev.maxLevel}`;
        ctx.fillStyle = '#0b101b';
        ctx.fillRect(-22, radius - 10, 44, 15);
        ctx.strokeStyle = ev.state === 'MAXED' ? '#ffd54f' : bCol.main;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-22, radius - 10, 44, 15);
        ctx.fillStyle = ev.state === 'MAXED' ? '#ffd54f' : '#ffffff';
        ctx.fillText(pillText, 0, radius + 1);
      }

      // Node Title & Cost below node
      ctx.font = '700 11px "Inter", system-ui, sans-serif';
      ctx.fillStyle = ev.state === 'LOCKED_VISIBLE' ? '#90a4ae' : '#eceff1';
      ctx.fillText(node.name, 0, radius + 18);

      if (ev.state !== 'MAXED') {
        ctx.font = '700 11px "Rajdhani", "Inter", system-ui, sans-serif';
        ctx.fillStyle =
          ev.state === 'LOCKED_VISIBLE'
            ? '#ff8a80'
            : ev.canAfford
            ? '#69f0ae'
            : '#b0bec5';
        ctx.fillText(`$${ev.nextCost.toLocaleString()}`, 0, radius + 31);
      }

      ctx.restore();
    }

    ctx.restore();
  }
}

/** Shape-only state marker so node state never depends on color: check = owned, plus = buyable, padlock = locked. */
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
