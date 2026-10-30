import { PLANETS } from '../../config/planets';
import {
  SKILL_NODES,
  SKILL_NODE_MAP,
  SkillBranch,
  SkillNodeConfig,
  evaluateSkillNode,
} from '../../config/skillTree';
import { GameContext } from '../../core/GameContext';
import { SkillTreeView, BRANCH_COLORS } from '../../ui/SkillTreeView';
import { SVG_ICONS } from '../../ui/svgIcons';
import { $ } from '../../ui/dom';
import { SettingsForm } from '../SettingsForm';
import { GarageTab } from './GarageTab';
import { PlanetMapTab } from './PlanetMapTab';
import { CodexTab } from './CodexTab';

export type HangarTab = 'grid' | 'garage' | 'planets' | 'codex' | 'settings';

/** Hangar hub: header, five-tab rail, Deep Grid skill tree with its inspector, and the other tabs. */
export class HangarScreen {
  public activeTab: HangarTab = 'grid';
  private skillTreeView: SkillTreeView;
  private garage: GarageTab;
  private planets: PlanetMapTab;
  private codex: CodexTab;

  constructor(
    private game: GameContext,
    private settings: SettingsForm
  ) {
    this.skillTreeView = new SkillTreeView($<HTMLCanvasElement>('skill-tree-canvas'), game.atlas, (node, isSecondTap) =>
      this.onSkillNodeClicked(node, isSecondTap)
    );
    this.garage = new GarageTab(game, (branch) => this.jumpToBranch(branch));
    this.planets = new PlanetMapTab(game, () => this.refresh());
    this.codex = new CodexTab(game);

    document.querySelectorAll<HTMLButtonElement>('#hangar-nav-rail .hangar-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.switchTab((btn.dataset.tab as HangarTab) || 'grid'));
    });
    $('btn-quick-switch-planet').addEventListener('click', () => this.switchTab('planets'));
    $('btn-center-tree').addEventListener('click', () => this.skillTreeView.resetCamera());
    $('btn-buy-node').addEventListener('click', () => {
      const node = SKILL_NODE_MAP[this.skillTreeView.selectedNodeId];
      if (node) this.tryPurchaseNode(node);
    });
  }

  public switchTab(tab: HangarTab): void {
    this.activeTab = tab;
    document.querySelectorAll<HTMLButtonElement>('#hangar-nav-rail .hangar-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    for (const t of ['grid', 'garage', 'planets', 'codex', 'settings'] as HangarTab[]) {
      $(`tab-pane-${t}`).classList.toggle('active', tab === t);
    }
    this.refresh();
  }

  public render(dt: number): void {
    if (this.activeTab === 'grid') this.skillTreeView.render(dt, this.game.save);
    else if (this.activeTab === 'garage') this.garage.render();
  }

  private jumpToBranch(branch: SkillBranch): void {
    this.switchTab('grid');
    this.skillTreeView.focusBranch(branch, this.game.save);
    this.refresh();
  }

  private onSkillNodeClicked(node: SkillNodeConfig, isSecondTap: boolean): void {
    this.skillTreeView.selectedNodeId = node.id;
    this.refresh();
    if (!isSecondTap) return;
    const save = this.game.save;
    const ev = evaluateSkillNode(node, save.ownedSkills, save.highestUnlockedPlanet, save.cash);
    if (ev.state === 'AVAILABLE' && ev.canAfford) this.tryPurchaseNode(node);
  }

  private tryPurchaseNode(node: SkillNodeConfig): void {
    const save = this.game.save;
    const ev = evaluateSkillNode(node, save.ownedSkills, save.highestUnlockedPlanet, save.cash);
    if (ev.state !== 'AVAILABLE' || !ev.canAfford) return;

    save.cash -= ev.nextCost;
    save.ownedSkills[node.id] = (save.ownedSkills[node.id] ?? 0) + 1;
    this.game.refreshStats();
    this.game.sound.playUpgradeBuy();
    this.skillTreeView.celebrate(node.id);
    this.game.persist();
    this.refresh();
  }

  public refresh(): void {
    this.game.refreshStats();
    this.game.applyPlanetAccent();

    const planet = this.game.planet();
    document.getElementById('hangar-cash')!.textContent = `$${this.game.save.cash.toLocaleString()}`;
    document.getElementById('hangar-planet-name')!.textContent = `Planet ${planet.id}: ${planet.name}`;
    document.getElementById('hangar-planet-dot')!.style.background = planet.accentColor;
    document.getElementById('hangar-planet-dot')!.style.boxShadow = `0 0 10px ${planet.accentColor}`;

    this.renderInspector();
    this.renderTelemetry();

    if (this.activeTab === 'garage') this.garage.populate();
    else if (this.activeTab === 'planets') this.planets.populate();
    else if (this.activeTab === 'codex') this.codex.populate();
    else if (this.activeTab === 'settings') this.settings.render();
  }

  private renderInspector(): void {
    const node = SKILL_NODE_MAP[this.skillTreeView.selectedNodeId] ?? SKILL_NODES[1];
    const ev = evaluateSkillNode(
      node,
      this.game.save.ownedSkills,
      this.game.save.highestUnlockedPlanet,
      this.game.save.cash
    );
    const branchMeta = BRANCH_COLORS[node.branch];

    const branchEl = document.getElementById('insp-branch')!;
    branchEl.textContent = `${branchMeta.label} (${branchMeta.shapeName.toUpperCase()})`;
    branchEl.style.color = branchMeta.main;

    document.getElementById('insp-planet-tag')!.textContent = `PLANET ${node.minPlanet} TIER`;
    document.getElementById('insp-title')!.textContent = node.name;
    document.getElementById('insp-level')!.textContent =
      ev.state === 'MAXED'
        ? `Level ${ev.level} / ${ev.maxLevel} (MAX)`
        : `Level ${ev.level} / ${ev.maxLevel}`;

    const pipsContainer = document.getElementById('insp-level-pips')!;
    pipsContainer.innerHTML = '';
    for (let i = 0; i < ev.maxLevel; i++) {
      const pip = document.createElement('span');
      pip.className = `level-pip ${i < ev.level ? 'filled' : ''}`;
      pipsContainer.appendChild(pip);
    }

    document.getElementById('insp-desc')!.textContent = node.description;

    const locksBox = document.getElementById('insp-locks')!;
    locksBox.innerHTML = '';

    if (node.minPlanet > 1) {
      const met = this.game.save.highestUnlockedPlanet >= node.minPlanet;
      const div = document.createElement('div');
      div.className = `lock-pill ${met ? 'met' : ''}`;
      div.innerHTML = `${met ? SVG_ICONS.check : SVG_ICONS.planet_lock} <span>Unlock Planet ${node.minPlanet} (${
        PLANETS[node.minPlanet - 1]?.name
      })</span>`;
      locksBox.appendChild(div);
    }

    if (node.requiresSkill) {
      const reqNode = SKILL_NODE_MAP[node.requiresSkill.nodeId];
      const haveLv = this.game.save.ownedSkills[node.requiresSkill.nodeId] ?? 0;
      const met = haveLv >= node.requiresSkill.minLevel;
      const div = document.createElement('div');
      div.className = `lock-pill ${met ? 'met' : ''}`;
      div.innerHTML = `${met ? SVG_ICONS.check : SVG_ICONS.lock} <span>Requires ${reqNode?.name} Lv ${
        node.requiresSkill.minLevel
      } (${haveLv}/${node.requiresSkill.minLevel})</span>`;
      locksBox.appendChild(div);
    }

    if (node.requiresNodesAll && node.requiresNodesAll.length > 0) {
      const ownedCount = node.requiresNodesAll.filter(
        (id) => (this.game.save.ownedSkills[id] ?? 0) >= 1
      ).length;
      const met = ownedCount >= node.requiresNodesAll.length;
      const names = node.requiresNodesAll.map((id) => SKILL_NODE_MAP[id]?.name ?? id).join(' + ');
      const div = document.createElement('div');
      div.className = `lock-pill ${met ? 'met' : ''}`;
      div.innerHTML = `${met ? SVG_ICONS.check : SVG_ICONS.lock} <span>(${ownedCount}/${
        node.requiresNodesAll.length
      }) Buy ${names}</span>`;
      locksBox.appendChild(div);
    }

    const buyBtn = document.getElementById('btn-buy-node') as HTMLButtonElement;
    if (ev.state === 'MAXED') {
      buyBtn.disabled = true;
      buyBtn.textContent = 'NODE MAXED OUT';
    } else if (ev.state === 'LOCKED_VISIBLE') {
      buyBtn.disabled = true;
      buyBtn.textContent = `LOCKED • $${ev.nextCost.toLocaleString()}`;
    } else if (!ev.canAfford) {
      buyBtn.disabled = true;
      buyBtn.textContent = `NEED $${ev.nextCost.toLocaleString()} CREDITS`;
    } else {
      buyBtn.disabled = false;
      buyBtn.textContent = `UPGRADE NODE • $${ev.nextCost.toLocaleString()}`;
    }
  }

  private renderTelemetry(): void {
    const revealedCount = SKILL_NODES.filter(
      (n) =>
        evaluateSkillNode(n, this.game.save.ownedSkills, this.game.save.highestUnlockedPlanet, this.game.save.cash)
          .state !== 'HIDDEN'
    ).length;

    const telGrid = document.getElementById('telemetry-grid')!;
    telGrid.innerHTML = `
      <div class="telemetry-item">
        <div class="telemetry-label">${SVG_ICONS.drill_power} DRILL POWER</div>
        <div class="telemetry-val">${Math.round(this.game.stats.drillPower).toLocaleString()} DPS</div>
      </div>
      <div class="telemetry-item">
        <div class="telemetry-label">${SVG_ICONS.bore_width} BORE DIAMETER</div>
        <div class="telemetry-val">${Math.round(this.game.stats.drillRadiusPx * 2)}px</div>
      </div>
      <div class="telemetry-item">
        <div class="telemetry-label">${SVG_ICONS.fuel} MAX FUEL TANK</div>
        <div class="telemetry-val">${this.game.stats.maxFuel.toLocaleString()} U</div>
      </div>
      <div class="telemetry-item">
        <div class="telemetry-label">${SVG_ICONS.cargo} CARGO HOLD</div>
        <div class="telemetry-val">${this.game.stats.maxCargo} Ores</div>
      </div>
      <div class="telemetry-item">
        <div class="telemetry-label">${SVG_ICONS.refinery} REFINERY MULT</div>
        <div class="telemetry-val">×${this.game.stats.oreValueMultiplier.toFixed(2)}</div>
      </div>
      <div class="telemetry-item">
        <div class="telemetry-label">${SVG_ICONS.scanner} GRID REVEALED</div>
        <div class="telemetry-val">${revealedCount} / ${SKILL_NODES.length}</div>
      </div>
    `;
  }
}
