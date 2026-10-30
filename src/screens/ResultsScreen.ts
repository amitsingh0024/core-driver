import { PLANETS, PlanetConfig } from '../config/planets';
import { GameContext } from '../core/GameContext';
import { DivePayout } from '../game/DivePayout';
import { $ } from '../ui/dom';
import { isFirstUpgradePending } from '../ui/Progression';
import { cheapestAvailableCost } from './hangar/upgradeHints';

/** Post-dive sell screen: outcome title, stamps, ore manifest and payout. */
export class ResultsScreen {
  constructor(private game: GameContext) {}

  public show(payout: DivePayout, planet: PlanetConfig): void {
    const save = this.game.save;
    const reason = payout.reason;

    $('results-planet-label').textContent =
      `PLANET ${planet.id}: ${planet.name.toUpperCase()} • DIVE #${save.totalDives}`;

    const outcomeTitle = $('results-outcome-title');
    if (reason === 'core_shattered') {
      outcomeTitle.textContent = `${planet.coreName.toUpperCase()} SHATTERED!`;
      outcomeTitle.dataset.outcome = 'core';
    } else if (reason === 'fuel_out') {
      outcomeTitle.textContent = 'FUEL DEPLETED — EMERGENCY TOW';
      outcomeTitle.dataset.outcome = 'tow';
    } else {
      outcomeTitle.textContent = 'SAFE RETURN';
      outcomeTitle.dataset.outcome = 'safe';
    }

    $('results-depth-line').textContent =
      `Max Depth Reached: ${payout.maxDepth}m / ${planet.maxDepth}m (Best: ${save.deepestByPlanet[planet.id]}m)`;

    const coreCutscene = $('results-core-cutscene');
    coreCutscene.classList.toggle('hidden', reason !== 'core_shattered');
    if (reason === 'core_shattered') {
      $('results-core-title').textContent = `${planet.coreName.toUpperCase()} CRACKED OPEN!`;
      $('results-core-sub').textContent = payout.unlockedNextPlanet
        ? `+$${payout.coreBonus.toLocaleString()} Core Bounty! Planet ${planet.id + 1} (${PLANETS[planet.id].name}) is now unlocked in Planet Map & Deep Grid!`
        : `+$${payout.coreBonus.toLocaleString()} Core Bounty awarded!`;
    }

    this.renderStamps(payout);
    this.renderManifest(payout, planet);

    // Only worth a line once an upgrade has actually raised ore value
    const mult = this.game.stats.oreValueMultiplier;
    $('results-mult-note').textContent = mult > 1.001 ? `Ore value ×${mult.toFixed(2)} from upgrades` : '';
    this.countUpTotal(payout.totalEarned);
    this.renderUpgradeButton();
  }

  private countToken = 0;

  /** Ticks the payout up from $0 with coin sounds, so the sell moment reads as a reward. */
  private countUpTotal(total: number): void {
    const el = $('results-total-payout');
    const token = ++this.countToken;
    const duration = Math.min(1600, 500 + Math.log10(Math.max(10, total)) * 180);
    const start = performance.now() + 250;
    let lastTick = 0;
    el.classList.add('counting');
    el.textContent = '+$0';
    const step = (now: number) => {
      if (token !== this.countToken) return;
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `+$${Math.round(total * eased).toLocaleString()}`;
      if (t > 0 && t < 1 && now - lastTick > 70) {
        lastTick = now;
        this.game.sound.playCoinTick(1 + t * 0.6);
      }
      if (t < 1) requestAnimationFrame(step);
      else el.classList.remove('counting');
    };
    requestAnimationFrame(step);
  }

  /** Names what the payout can buy, and pulses it while the player hasn't bought their first upgrade. */
  private renderUpgradeButton(): void {
    const save = this.game.save;
    const affordable = cheapestAvailableCost(save) <= save.cash;
    $('results-hangar-label').textContent = affordable
      ? `SPEND $${save.cash.toLocaleString()} ON UPGRADES`
      : 'UPGRADE RIG';
    $('btn-results-hangar').classList.toggle('nudge', affordable && isFirstUpgradePending(save));
  }

  /** One stamp: the most notable thing about this dive (the cutscene already covers a cracked core). */
  private renderStamps(payout: DivePayout): void {
    let stamp = '';
    if (payout.reason === 'fuel_out') {
      const lostPct = Math.round((1 - payout.keepRatio) * 100);
      stamp = `<span class="stamp-badge red">CARGO LOST ${lostPct}%</span>`;
    } else if (payout.isNewBestDepth && payout.reason !== 'core_shattered') {
      stamp = `<span class="stamp-badge cyan">NEW BEST DEPTH</span>`;
    } else if (payout.contractCompleted) {
      stamp = `<span class="stamp-badge green">CONTRACT MET</span>`;
    }
    $('results-stamps').innerHTML = stamp;
  }

  private renderManifest(payout: DivePayout, planet: PlanetConfig): void {
    const listBox = $('results-ore-list');
    listBox.innerHTML = '';

    if (payout.rows.length === 0 && payout.bonuses.length === 0) {
      listBox.innerHTML = `
        <div class="manifest-row">
          <span class="manifest-empty">No ores collected during this dive.</span>
          <span>0</span>
          <span>$0</span>
        </div>
      `;
      return;
    }

    payout.rows.forEach((row, idx) => {
      const div = document.createElement('div');
      div.className = 'manifest-row tabular';
      div.style.animationDelay = `${idx * 55}ms`;

      const oreCell = document.createElement('div');
      oreCell.className = 'manifest-ore-cell';
      const oreCanvas = this.game.atlas.oreOverlays.get(row.oreId);
      if (oreCanvas) {
        const thumb = document.createElement('canvas');
        thumb.width = 26;
        thumb.height = 26;
        thumb.className = 'manifest-ore-thumb';
        thumb.getContext('2d')!.drawImage(oreCanvas, 0, 0, 26, 26);
        oreCell.appendChild(thumb);
      }
      const nameSpan = document.createElement('span');
      nameSpan.textContent = row.lost > 0 ? `${row.name} (-${row.lost} lost)` : row.name;
      oreCell.appendChild(nameSpan);

      const qtySpan = document.createElement('span');
      qtySpan.textContent = `×${row.kept}`;
      const subSpan = document.createElement('span');
      subSpan.textContent = `+$${row.subtotal.toLocaleString()}`;

      div.append(oreCell, qtySpan, subSpan);
      listBox.appendChild(div);
    });

    payout.bonuses.forEach((bonus, idx) => {
      const row = document.createElement('div');
      row.className = 'manifest-row tabular bonus-row';
      row.style.animationDelay = `${(payout.rows.length + idx) * 55}ms`;
      row.innerHTML = `
        <div class="manifest-ore-cell">${bonus.label}</div>
        <span>×1</span>
        <span>+$${bonus.amount.toLocaleString()}</span>
      `;
      listBox.appendChild(row);
    });
  }
}
