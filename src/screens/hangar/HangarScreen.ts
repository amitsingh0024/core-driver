import {
  SKILL_NODES,
  SKILL_NODE_MAP,
  SkillBranch,
  SkillNodeConfig,
  PLANET_NAMES,
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
import { cheapestAvailableCost, nextLevelChanges } from './upgradeHints';
import { GATED_TABS, applyUiLocks, isFirstUpgradePending, isNew, isUnlocked, markSeen } from '../../ui/Progression';

export type HangarTab = 'grid' | 'garage' | 'planets' | 'codex' | 'settings';

/** Hangar hub: header, tab rail (tabs unlock as the player progresses), the four upgrade tracks with their inspector, and the other tabs. */
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
    const gate = GATED_TABS.find((g) => g.tab === tab);
    if (gate) {
      if (!isUnlocked(this.game.save, gate.feature)) tab = 'grid';
      else if (isNew(this.game.save, gate.feature)) {
        markSeen(this.game.save, gate.feature);
        this.game.persist();
      }
    }
    this.activeTab = tab;
    $('btn-hangar-settings').classList.toggle('active', tab === 'settings');
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
    const ev = evaluateSkillNode(node, save.ownedSkills, save.highestUnlockedPlanet, save.cash, save.deepestByPlanet);
    if (ev.state === 'AVAILABLE' && ev.canAfford) this.tryPurchaseNode(node);
  }

  private tryPurchaseNode(node: SkillNodeConfig): void {
    const save = this.game.save;
    const ev = evaluateSkillNode(node, save.ownedSkills, save.highestUnlockedPlanet, save.cash, save.deepestByPlanet);
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
    this.renderGuidance();

    if (this.activeTab === 'garage') this.garage.populate();
    else if (this.activeTab === 'planets') this.planets.populate();
    else if (this.activeTab === 'codex') this.codex.populate();
    else if (this.activeTab === 'settings') this.settings.render();
  }

  private renderInspector(): void {
    const node = SKILL_NODE_MAP[this.skillTreeView.selectedNodeId] ?? SKILL_NODES[0];
    const ev = evaluateSkillNode(node, this.game.save.ownedSkills, this.game.save.highestUnlockedPlanet, this.game.save.cash, this.game.save.deepestByPlanet);
    const branchMeta = BRANCH_COLORS[node.branch];

    const branchEl = document.getElementById('insp-branch')!;
    branchEl.textContent = `${branchMeta.label} TRACK`;
    branchEl.style.color = branchMeta.main;

    document.getElementById('insp-planet-tag')!.textContent = `${PLANET_NAMES[node.minPlanet].toUpperCase()} · TIER ${node.tier}`;
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
    this.renderStatDelta(node, ev.state === 'MAXED');

    const locksBox = document.getElementById('insp-locks')!;
    locksBox.innerHTML = '';

    for (const reason of ev.lockReasons) {
      const div = document.createElement('div');
      div.className = 'lock-pill';
      div.innerHTML = `${SVG_ICONS.lock} <span>LOCKED: ${reason}</span>`;
      locksBox.appendChild(div);
    }

    const buyBtn = document.getElementById('btn-buy-node') as HTMLButtonElement;
    if (ev.state === 'MAXED') {
      buyBtn.disabled = true;
      buyBtn.textContent = 'MAXED OUT';
    } else if (ev.state === 'LOCKED_VISIBLE') {
      buyBtn.disabled = true;
      buyBtn.textContent = `LOCKED • $${ev.nextCost.toLocaleString()}`;
    } else if (!ev.canAfford) {
      buyBtn.disabled = true;
      buyBtn.textContent = `NEED $${ev.nextCost.toLocaleString()} CREDITS`;
    } else {
      buyBtn.disabled = false;
      buyBtn.textContent = `UPGRADE • $${ev.nextCost.toLocaleString()}`;
    }
  }

  /** "Drill Power 26 → 38": what the next level actually changes, instead of a full stat sheet. */
  private renderStatDelta(node: SkillNodeConfig, maxed: boolean): void {
    const box = $('insp-delta');
    const changes = maxed ? [] : nextLevelChanges(node, this.game.save.ownedSkills);
    box.innerHTML = changes
      .slice(0, 3)
      .map((c) => `<div>${c.label} &nbsp;${c.from} → <b>${c.to}</b></div>`)
      .join('');
  }

  /** NEW badges on freshly unlocked tabs, plus Foreman hints that walk a new player to their first upgrade. */
  private renderGuidance(): void {
    const save = this.game.save;
    // A purchase can unlock a tab while the hangar is open
    applyUiLocks(save);
    for (const { feature, tab } of GATED_TABS) {
      document
        .querySelector(`#hangar-nav-rail .hangar-nav-btn[data-tab='${tab}']`)
        ?.classList.toggle('has-new', isNew(save, feature));
    }

    const canAfford = cheapestAvailableCost(save) <= save.cash;
    const firstBuy = isFirstUpgradePending(save);
    let hint = '';
    if (firstBuy && canAfford) hint = 'Tap a glowing card, then UPGRADE, to buy your first upgrade.';
    else if (save.totalDives <= 2 && !canAfford) hint = 'Launch a dive to earn credits for your next upgrade.';

    const coach = $('hangar-coach');
    $('hangar-coach-text').textContent = hint;
    coach.classList.toggle('show', hint !== '' && this.activeTab === 'grid');
    $('btn-launch-dive').classList.toggle('nudge', save.totalDives <= 2 && !canAfford);
  }
}
