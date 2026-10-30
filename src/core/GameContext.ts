import { PLANETS, PlanetConfig } from '../config/planets';
import { computePlayerStats, ComputedPlayerStats } from '../config/skillTree';
import { refundLegacyUpgrades } from '../config/legacyTree';
import { SpriteAtlas } from '../assets/spriteGenerator';
import { ParticleSystem } from '../game/ParticleSystem';
import { SoundManager } from '../game/SoundManager';
import { PortalSDK, SaveState } from '../sdk/PortalSDK';
import { $ } from '../ui/dom';

/**
 * Shared state and services every screen needs: the save file, derived player stats,
 * sprites, audio and particles. Screens receive this instead of reaching into each other.
 */
export class GameContext {
  public save: SaveState;
  public stats: ComputedPlayerStats;
  public readonly atlas = new SpriteAtlas();
  public readonly sound = new SoundManager();
  public readonly particles = new ParticleSystem();
  public animTime = 0;

  constructor() {
    this.save = PortalSDK.loadSave();
    if (refundLegacyUpgrades(this.save) > 0) PortalSDK.save(this.save);
    this.stats = computePlayerStats(this.save.ownedSkills);
  }

  public planet(): PlanetConfig {
    return PLANETS.find((p) => p.id === this.save.currentPlanetId) ?? PLANETS[0];
  }

  public refreshStats(): ComputedPlayerStats {
    this.stats = computePlayerStats(this.save.ownedSkills);
    return this.stats;
  }

  public persist(): void {
    PortalSDK.save(this.save);
  }

  public applyPlanetAccent(): void {
    $('app').style.setProperty('--planet-accent', this.planet().accentColor);
  }

  /** Short vibration on supported phones, respecting the Haptics setting. */
  public haptic(ms: number): void {
    if (!this.save.settings.haptics) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      // Unsupported browser
    }
  }
}
