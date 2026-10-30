import { PLANETS } from '../../config/planets';
import { ORE_LIST } from '../../config/ores';
import { GameContext } from '../../core/GameContext';
import { $ } from '../../ui/dom';

/** Ore Codex tab: every ore by planet, with undiscovered ores shown as silhouettes. */
export class CodexTab {
  constructor(private game: GameContext) {}

  public populate(): void {
    const container = $('codex-content');
    container.innerHTML = '';

    let discoveredTotal = 0;
    for (const ore of ORE_LIST) {
      if ((this.game.save.totalOresMined[ore.id] ?? 0) > 0) {
        discoveredTotal++;
      }
    }
    $('codex-discovery-count').textContent =
      `Discovered: ${discoveredTotal} / ${ORE_LIST.length} Ores`;

    for (const planet of PLANETS) {
      const sec = document.createElement('div');
      sec.className = 'codex-planet-section';
      sec.innerHTML = `
        <div class="codex-planet-title" style="color:${planet.accentColor}">
          Planet ${planet.id}: ${planet.name} (${planet.maxDepth}m Core Depth)
        </div>
      `;

      const oresRow = document.createElement('div');
      oresRow.className = 'codex-ores-row';

      const planetOres = ORE_LIST.filter((o) => o.planetId === planet.id);
      for (const ore of planetOres) {
        const minedCount = this.game.save.totalOresMined[ore.id] ?? 0;
        const discovered = minedCount > 0;

        const card = document.createElement('div');
        card.className = `codex-ore-card ${discovered ? '' : 'undiscovered'}`;

        const oreCanvas = this.game.atlas.oreOverlays.get(ore.id);
        if (oreCanvas) {
          const clone = document.createElement('canvas');
          clone.width = 58;
          clone.height = 58;
          const cctx = clone.getContext('2d')!;
          cctx.imageSmoothingEnabled = true;
          cctx.imageSmoothingQuality = 'high';
          if (discovered) {
            const sampleBlock = this.game.atlas.blockTiles.get(planet.strata[1].id);
            if (sampleBlock) cctx.drawImage(sampleBlock, 0, 0, 58, 58);
          }
          cctx.drawImage(oreCanvas, 0, 0, 58, 58);
          card.appendChild(clone);
        }

        const info = document.createElement('div');
        info.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span class="glow-tier-badge ${ore.glowTier}">${ore.glowTier}</span>
            <span style="font-size:10px;color:#90a4ae">${ore.strataFoundIn}</span>
          </div>
          <div style="font-size:13px;font-weight:800;color:${
            discovered ? ore.highlightColor : '#78909c'
          }">
            ${discovered ? ore.name : '??? (Undiscovered)'}
          </div>
          <div class="tabular" style="font-size:11.5px;color:#69f0ae;font-weight:700">
            ${
              discovered
                ? `$${ore.value.toLocaleString()} • Mined: ${minedCount}`
                : 'Excavate in dive to reveal'
            }
          </div>
        `;
        card.appendChild(info);
        oresRow.appendChild(card);
      }

      sec.appendChild(oresRow);
      container.appendChild(sec);
    }
  }
}
