import { PLANETS, PlanetConfig } from '../../config/planets';
import { GameContext } from '../../core/GameContext';
import { $ } from '../../ui/dom';

/** Planet Map tab: one card per planet with lock state, records and a select button. */
export class PlanetMapTab {
  constructor(
    private game: GameContext,
    private onPlanetChanged: () => void
  ) {}

  public populate(): void {
    const grid = $('planet-cards-grid');
    grid.innerHTML = '';

    for (const p of PLANETS) {
      const unlocked = p.id <= this.game.save.highestUnlockedPlanet;
      const isSelected = p.id === this.game.save.currentPlanetId;
      const best = this.game.save.deepestByPlanet[p.id] ?? 0;
      const pct = Math.min(100, Math.round((best / p.maxDepth) * 100));

      const card = document.createElement('div');
      card.className = `planet-map-card steel-panel ${unlocked ? '' : 'locked'}`;
      card.style.setProperty('--planet-accent', p.accentColor);

      const orbCanvas = document.createElement('canvas');
      orbCanvas.width = 64;
      orbCanvas.height = 64;
      orbCanvas.className = 'planet-orb-preview';
      this.drawPlanetOrb(orbCanvas.getContext('2d')!, p, unlocked);

      const headerDiv = document.createElement('div');
      headerDiv.className = 'planet-card-top';
      headerDiv.appendChild(orbCanvas);

      const titleBox = document.createElement('div');
      titleBox.innerHTML = `
        <div class="planet-card-title" style="color:${p.accentColor}">
          STAGE ${p.id}: ${p.name.toUpperCase()}
        </div>
        <div class="planet-card-sub">${p.tagline} • Core at ${p.maxDepth}m</div>
      `;
      headerDiv.appendChild(titleBox);

      const bodyDiv = document.createElement('div');
      bodyDiv.style.display = 'flex';
      bodyDiv.style.flexDirection = 'column';
      bodyDiv.style.gap = '10px';
      bodyDiv.innerHTML = `
        <div class="hazard-stripe-bar"></div>
      `;
      bodyDiv.appendChild(headerDiv);

      const descP = document.createElement('p');
      descP.style.fontSize = '12.5px';
      descP.style.color = '#cfd8dc';
      descP.textContent = p.description;
      bodyDiv.appendChild(descP);

      const hazDiv = document.createElement('div');
      hazDiv.className = 'planet-hazard-box';
      hazDiv.innerHTML = `<strong>${p.hazardName}:</strong> ${p.hazardDescription}`;
      bodyDiv.appendChild(hazDiv);

      const strataRow = document.createElement('div');
      strataRow.className = 'planet-strata-pills';
      for (const s of p.strata) {
        const sp = document.createElement('span');
        sp.className = 'strata-mini-pill';
        sp.style.borderColor = s.palette.bevel;
        sp.textContent = `${s.name} (${s.startDepth}m)`;
        strataRow.appendChild(sp);
      }
      bodyDiv.appendChild(strataRow);

      const progRow = document.createElement('div');
      progRow.className = 'tabular';
      progRow.style.fontSize = '12px';
      progRow.style.fontWeight = '700';
      progRow.innerHTML = `Deepest Record: <span style="color:${p.accentColor}">${best}m / ${p.maxDepth}m (${pct}%)</span> • Core Bounty: $${p.coreRewardCash.toLocaleString()}`;
      bodyDiv.appendChild(progRow);

      const actionBtn = document.createElement('button');
      actionBtn.className = `btn-primary ${isSelected ? 'btn-green' : 'btn-amber'}`;
      actionBtn.disabled = !unlocked;
      actionBtn.textContent = !unlocked
        ? `LOCKED — SHATTER PLANET ${p.id - 1} CORE FIRST`
        : isSelected
        ? 'ACTIVE DROP ZONE (READY)'
        : `SELECT PLANET ${p.id}`;

      if (unlocked) {
        actionBtn.addEventListener('click', () => {
          this.game.save.currentPlanetId = p.id;
          this.game.persist();
          this.onPlanetChanged();
        });
      }
      bodyDiv.appendChild(actionBtn);
      card.appendChild(bodyDiv);
      grid.appendChild(card);
    }
  }

  private drawPlanetOrb(ctx: CanvasRenderingContext2D, p: PlanetConfig, unlocked: boolean): void {
    ctx.clearRect(0, 0, 64, 64);
    const grad = ctx.createRadialGradient(22, 20, 4, 32, 32, 28);
    if (!unlocked) {
      grad.addColorStop(0, '#37474f');
      grad.addColorStop(1, '#101722');
    } else {
      grad.addColorStop(0, p.accentColor);
      grad.addColorStop(0.6, p.strata[2].palette.base);
      grad.addColorStop(1, p.strata[4].palette.dark);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 27, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = unlocked ? p.accentColor : '#546e7a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
