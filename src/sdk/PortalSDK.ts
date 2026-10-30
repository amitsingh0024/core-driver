const SAVE_KEY = 'core_diver_save_v1';

export interface GameSettings {
  sfxVolume: number;
  musicVolume: number;
  screenShake: boolean;
  haptics: boolean;
  colorblindMode: boolean;
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
  settings: GameSettings;
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
    settings: {
      sfxVolume: 80,
      musicVolume: 60,
      screenShake: true,
      haptics: true,
      colorblindMode: false,
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
