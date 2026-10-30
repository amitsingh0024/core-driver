import { PLANETS, PlanetConfig } from '../config/planets';
import { GameContext } from '../core/GameContext';
import { DivePayout } from '../game/DivePayout';
import { milestoneUnlocks, nextGoal } from '../config/milestones';
import { podLayers } from '../render/podView';
import { $ } from '../ui/dom';
import { isFirstUpgradePending } from '../ui/Progression';
import { cheapestAvailableCost } from './hangar/upgradeHints';

/** Post-dive sell screen: outcome title, stamps, ore manifest, pod-to-counter animation, and payout. */
export class ResultsScreen {
  private countToken = 0;

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

    this.renderMilestoneBanner(payout, planet);

    $('results-depth-line').textContent =
      `Max Depth Reached: ${payout.maxDepth}m / ${planet.maxDepth}m (Best: ${save.deepestByPlanet[planet.id]}m)`;

    const coreCutscene = $('results-core-cutscene');
    coreCutscene.classList.toggle('hidden', reason !== 'core_shattered');
    if (reason === 'core_shattered') {
      $('results-core-title').textContent = `${planet.coreName.toUpperCase()} CRACKED OPEN!`;
      $('results-core-sub').textContent = payout.unlockedNextPlanet
        ? `+$${payout.coreBonus.toLocaleString()} Core Bounty! Planet ${planet.id + 1} (${PLANETS[planet.id].name}) is now unlocked, with new upgrades!`
        : `+$${payout.coreBonus.toLocaleString()} Core Bounty awarded!`;
    }

    this.renderStamps(payout);
    this.renderManifest(payout, planet);

    // Only worth a line once an upgrade has actually raised ore value
    const mult = this.game.stats.oreValueMultiplier;
    $('results-mult-note').textContent = mult > 1.001 ? `Ore value ×${mult.toFixed(2)} from upgrades` : '';
    const token = ++this.countToken;
    this.countUpTotal(payout.totalEarned, token);
    this.animateLandingAndSellScene(payout, planet, token);
    this.renderUpgradeButton();
  }

  /** Milestone banner under the outcome title: what was reached, what it opened, and the next goal. */
  private renderMilestoneBanner(payout: DivePayout, planet: PlanetConfig): void {
    let banner = document.getElementById('results-milestone');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'results-milestone';
      banner.className = 'results-milestone';
      $('results-outcome-title').insertAdjacentElement('afterend', banner);
    }
    const reached = payout.milestones.at(-1);
    const goal = nextGoal(planet.id, this.game.save.deepestByPlanet[planet.id] ?? 0);
    if (reached) {
      const opened = payout.milestones.flatMap((m) => milestoneUnlocks(m));
      banner.innerHTML =
        `<div class="results-milestone-title">Milestone reached: ${reached.depth} m</div>` +
        (opened.length > 0 ? `<div class="results-milestone-sub">Opened ${opened.join(', ')}</div>` : '') +
        `<div class="results-milestone-next">Next goal: ${goal.label}</div>`;
      banner.dataset.kind = 'reached';
    } else {
      banner.innerHTML = `<div class="results-milestone-next">Next goal: ${goal.label} <span>${goal.detail}</span></div>`;
      banner.dataset.kind = 'next';
    }
  }

  /** Ticks the payout up from $0 with coin sounds, so the sell moment reads as a reward. */
  private countUpTotal(total: number, token: number): void {
    const el = $('results-total-payout');
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

  /**
   * Page 12: Pod lands on the pad; ore chunks fly from the cargo into a sell counter,
   * then coins burst into the payout vault.
   */
  private animateLandingAndSellScene(payout: DivePayout, planet: PlanetConfig, token: number): void {
    const canvas = document.getElementById('results-scene-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    const startTime = performance.now();

    // Build flying ore projectiles from collected ores
    const orePackets: Array<{ oreId: string; color: string; delay: number }> = [];
    for (const row of payout.rows) {
      const count = Math.min(6, Math.max(1, row.kept));
      for (let i = 0; i < count; i++) {
        orePackets.push({
          oreId: row.oreId,
          color: row.color,
          delay: 0.35 + orePackets.length * 0.07,
        });
      }
    }

    const drawFrame = (now: number) => {
      if (token !== this.countToken) return;
      const elapsed = (now - startTime) / 1000;

      ctx.save();
      ctx.clearRect(0, 0, w, h);

      // 1. Planet Sky & Landing Pad Strip
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, planet.skyColorTop);
      sky.addColorStop(1, planet.skyColorBottom);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const groundY = h - 20;
      ctx.fillStyle = '#141c28';
      ctx.fillRect(0, groundY, w, 20);
      ctx.fillStyle = planet.accentColor;
      ctx.fillRect(0, groundY, w, 2);

      // 2. Left: Landing Pad & Descending Drill Pod
      const padX = 115;
      ctx.fillStyle = '#263238';
      ctx.fillRect(padX - 54, groundY - 6, 108, 8);
      ctx.fillStyle = '#f5a623';
      for (let hx = padX - 48; hx < padX + 46; hx += 16) {
        ctx.fillRect(hx, groundY - 4, 8, 4);
      }

      const landT = Math.min(1, elapsed / 0.45);
      const easeLand = 1 - Math.pow(1 - landT, 3);
      const podY = -20 + (groundY - 34 + 20) * easeLand;

      ctx.save();
      ctx.translate(padX, podY);
      this.game.atlas.drawLayeredDrillPod(
        ctx,
        podLayers(this.game.stats, elapsed, {
          isMoving: landT < 1,
          extractProgress: payout.reason === 'extracted' && landT < 1 ? 1 - landT : 0,
        }),
        0.78
      );
      ctx.restore();

      // 3. Center: Ore Refinery Hopper / Sell Counter
      const hopperX = 345;
      const hopperY = groundY - 46;
      ctx.fillStyle = '#1b2636';
      ctx.strokeStyle = '#ab47bc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hopperX - 44, hopperY);
      ctx.lineTo(hopperX + 44, hopperY);
      ctx.lineTo(hopperX + 32, groundY);
      ctx.lineTo(hopperX - 32, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#eceff1';
      ctx.font = '800 10px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ORE SELL COUNTER', hopperX, hopperY + 20);
      ctx.fillStyle = '#69f0ae';
      ctx.font = '700 11px "Rajdhani", sans-serif';
      ctx.fillText(`${payout.oreUnitsKept} ORES REFINED`, hopperX, hopperY + 35);

      // 4. Right: Credit Payout Vault
      const vaultX = 565;
      const vaultY = groundY - 48;
      ctx.fillStyle = '#1b2636';
      ctx.strokeStyle = '#f5a623';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(vaultX - 58, vaultY, 116, 48, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffd54f';
      ctx.font = '800 10px "Chakra Petch", sans-serif';
      ctx.fillText('CREDIT VAULT', vaultX, vaultY + 18);
      ctx.fillStyle = '#69f0ae';
      ctx.font = '800 13px "Rajdhani", sans-serif';
      const coinT = Math.max(0, Math.min(1, (elapsed - 0.35) / 1.3));
      ctx.fillText(`+$${Math.round(payout.totalEarned * coinT).toLocaleString()}`, vaultX, vaultY + 36);

      // 5. Flying Ore Chunks from Pod -> Sell Counter
      for (const pkt of orePackets) {
        const pt = (elapsed - pkt.delay) / 0.52;
        if (pt <= 0 || pt >= 1) continue;
        const ox = padX + (hopperX - padX) * pt;
        const oy = (groundY - 38) - Math.sin(pt * Math.PI) * 44;
        const oreTex = this.game.atlas.oreOverlays.get(pkt.oreId);
        if (oreTex) {
          ctx.drawImage(oreTex, ox - 11, oy - 11, 22, 22);
        } else {
          ctx.fillStyle = pkt.color;
          ctx.beginPath();
          ctx.arc(ox, oy, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 6. Spinning Coin Bursts from Sell Counter -> Credit Vault
      const coinCount = payout.totalEarned > 0 ? 10 : 0;
      for (let c = 0; c < coinCount; c++) {
        const ct = (elapsed - (0.55 + c * 0.09)) / 0.48;
        if (ct <= 0 || ct >= 1) continue;
        const cx = hopperX + (vaultX - hopperX) * ct;
        const cy = (groundY - 32) - Math.sin(ct * Math.PI) * 36;
        const spinW = Math.max(2, Math.abs(Math.cos(elapsed * 14 + c)) * 7);
        ctx.fillStyle = '#ffd54f';
        ctx.strokeStyle = '#ff8f00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, spinW, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      if (elapsed < 2.6) {
        requestAnimationFrame(drawFrame);
      }
    };

    requestAnimationFrame(drawFrame);
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
      stamp = `<span class="stamp-badge green">ORDER DONE: ${payout.contractReward ?? ''}</span>`;
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
