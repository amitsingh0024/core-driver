const SAVE_KEY = 'core_diver_save_v1';

export interface GameSettings {
  sfxVolume: number;
  musicVolume: number;
  screenShake: boolean;
  haptics: boolean;
  colorblindMode: boolean;
  /** Mute button state, kept apart from the volume sliders so unmuting restores them. */
  muted: boolean;
  /** Fewer flashes, no shake and shorter transitions. */
  reducedMotion: boolean;
  language: 'EN' | 'ES' | 'FR' | 'DE';
}

export interface SaveState {
  cash: number;
  currentPlanetId: number;
  highestUnlockedPlanet: number;
  ownedSkills: Record<string, number>;
  totalOresMined: Record<string, number>;
  deepestByPlanet: Record<number, number>;
  totalDives: number;
  /** Interface unlocks the player has already opened, so their NEW badge stops showing. */
  seenUnlocks: string[];
  settings: GameSettings;
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function getDefaultSaveState(): SaveState {
  return {
    cash: 0,
    currentPlanetId: 1,
    highestUnlockedPlanet: 1,
    ownedSkills: { starter_pod: 1 },
    totalOresMined: {},
    deepestByPlanet: { 1: 0, 2: 0, 3: 0 },
    totalDives: 0,
    seenUnlocks: [],
    settings: {
      sfxVolume: 80,
      musicVolume: 60,
      screenShake: true,
      haptics: true,
      colorblindMode: false,
      muted: false,
      reducedMotion: prefersReducedMotion(),
      language: 'EN',
    },
  };
}

export class PortalSDK {
  public static loadSave(): SaveState {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return getDefaultSaveState();
      const parsed = JSON.parse(raw) as Partial<SaveState>;
      const def = getDefaultSaveState();
      return {
        cash: typeof parsed.cash === 'number' ? parsed.cash : def.cash,
        currentPlanetId: parsed.currentPlanetId ?? def.currentPlanetId,
        highestUnlockedPlanet: parsed.highestUnlockedPlanet ?? def.highestUnlockedPlanet,
        ownedSkills: { starter_pod: 1, ...(parsed.ownedSkills ?? {}) },
        totalOresMined: parsed.totalOresMined ?? {},
        deepestByPlanet: { ...def.deepestByPlanet, ...(parsed.deepestByPlanet ?? {}) },
        totalDives: parsed.totalDives ?? 0,
        // Saves from before progressive unlocks already know every tab, so skip their NEW badges
        seenUnlocks: Array.isArray(parsed.seenUnlocks) ? parsed.seenUnlocks : ['planetMap', 'codex', 'garage'],
        settings: { ...def.settings, ...(parsed.settings ?? {}) },
      };
    } catch {
      return getDefaultSaveState();
    }
  }

  public static save(state: SaveState): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota / private browsing errors
    }
  }

  public static resetSave(): SaveState {
    const fresh = getDefaultSaveState();
    this.save(fresh);
    return fresh;
  }

  public static gameplayStart(): void {
    try {
      const cg = (window as unknown as { CrazyGames?: { SDK?: { game?: { gameplayStart?: () => void } } } }).CrazyGames;
      cg?.SDK?.game?.gameplayStart?.();
    } catch {
      // No-op outside portal
    }
  }

  public static gameplayStop(): void {
    try {
      const cg = (window as unknown as { CrazyGames?: { SDK?: { game?: { gameplayStop?: () => void } } } }).CrazyGames;
      cg?.SDK?.game?.gameplayStop?.();
    } catch {
      // No-op outside portal
    }
  }
}
