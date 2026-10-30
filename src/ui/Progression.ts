import { PLANETS } from '../config/planets';
import { SaveState } from '../sdk/PortalSDK';

/**
 * Progressive disclosure: which parts of the interface a player has earned.
 * New players start with the bare loop (dive, sell, upgrade) and the rest
 * appears as it becomes useful, so the first few minutes aren't a wall of panels.
 */
export type UiFeature =
  | 'titleMenu' // Hangar and Credits buttons on the title card
  | 'fullHud' // work orders, burn rate, planet text, mute and the controls strip
  | 'planetMap'
  | 'codex'
  | 'garage';

/** Hangar tabs that are gated, in the order their NEW badge should be considered. */
export const GATED_TABS: { feature: UiFeature; tab: 'planets' | 'codex' | 'garage' }[] = [
  { feature: 'planetMap', tab: 'planets' },
  { feature: 'codex', tab: 'codex' },
  { feature: 'garage', tab: 'garage' },
];

/** Dives before the full HUD and work orders switch on. */
export const SIMPLE_HUD_DIVES = 2;

function upgradesBought(save: SaveState): number {
  let total = 0;
  for (const [id, lv] of Object.entries(save.ownedSkills)) if (id !== 'starter_pod') total += lv;
  return total;
}

export function isUnlocked(save: SaveState, feature: UiFeature): boolean {
  switch (feature) {
    case 'titleMenu':
      return save.totalDives >= 1;
    case 'fullHud':
      return save.totalDives >= SIMPLE_HUD_DIVES;
    case 'planetMap': {
      // Show the map once the first core is in sight, or a second world is already open
      const firstDepth = save.deepestByPlanet[1] ?? 0;
      return save.highestUnlockedPlanet > 1 || firstDepth >= PLANETS[0].maxDepth * 0.5;
    }
    case 'codex':
      return Object.values(save.totalOresMined).filter((n) => n > 0).length >= 3;
    case 'garage':
      return upgradesBought(save) >= 5;
  }
}

/** Marks a gated feature as seen; returns true the first time, so callers can show a NEW badge until then. */
export function isNew(save: SaveState, feature: UiFeature): boolean {
  return isUnlocked(save, feature) && !save.seenUnlocks.includes(feature);
}

export function markSeen(save: SaveState, feature: UiFeature): void {
  if (!save.seenUnlocks.includes(feature)) save.seenUnlocks.push(feature);
}

/** True until the player has bought anything beyond the starter rig. */
export function isFirstUpgradePending(save: SaveState): boolean {
  return upgradesBought(save) === 0;
}

/** Toggles `ui-lock-<feature>` classes on #app so CSS can hide anything not yet earned. */
export function applyUiLocks(save: SaveState): void {
  const app = document.getElementById('app');
  if (!app) return;
  for (const f of ['titleMenu', 'fullHud', 'planetMap', 'codex', 'garage'] as UiFeature[]) {
    app.classList.toggle(`ui-lock-${f}`, !isUnlocked(save, f));
  }
  app.classList.toggle('ui-multi-planet', save.highestUnlockedPlanet > 1);
}
