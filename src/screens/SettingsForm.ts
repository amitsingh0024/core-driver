import { GameContext } from '../core/GameContext';
import { SVG_ICONS } from '../ui/svgIcons';
import { $ } from '../ui/dom';

type ToggleKey = 'screenShake' | 'colorblindMode' | 'haptics' | 'reducedMotion';
type SliderKey = 'sfxVolume' | 'musicVolume';

/** Renders the settings form into both the hangar Settings tab and the pause modal. */
export class SettingsForm {
  constructor(private game: GameContext) {
    $('btn-mute').addEventListener('click', () => {
      const s = this.game.save.settings;
      s.muted = !s.muted;
      this.game.persist();
      this.applyToRuntime();
      this.render();
    });
    this.applyToRuntime();
  }

  public applyToRuntime(): void {
    const s = this.game.save.settings;
    this.game.sound.setMuted(s.muted);
    this.game.sound.setVolume(s.sfxVolume / 100);
    this.game.sound.setMusicVolume(s.musicVolume / 100);
    document.body.classList.toggle('reduced-motion', s.reducedMotion);
    const slot = document.getElementById('mute-icon-slot');
    if (slot) slot.innerHTML = this.game.sound.muted ? SVG_ICONS.volumeOff : SVG_ICONS.volumeOn;
  }

  public render(): void {
    const s = this.game.save.settings;
    const toggle = (key: ToggleKey) =>
      `<button class="toggle-btn ${s[key] ? 'on' : ''}" data-toggle="${key}">${s[key] ? 'ON' : 'OFF'}</button>`;

    for (const id of ['hangar-settings-form', 'pause-settings-form']) {
      const container = document.getElementById(id);
      if (!container) continue;
      container.innerHTML = `
        <div class="setting-row">
          <div class="setting-label-group">
            <span class="setting-title">SFX Volume</span>
            <span class="setting-sub">Drill acoustics, ore chimes, and winch audio</span>
          </div>
          <input type="range" min="0" max="100" value="${s.sfxVolume}" data-setting="sfxVolume" />
        </div>
        <div class="setting-row">
          <div class="setting-label-group">
            <span class="setting-title">Music Volume</span>
            <span class="setting-sub">Ambient score that darkens as you dive deeper</span>
          </div>
          <input type="range" min="0" max="100" value="${s.musicVolume}" data-setting="musicVolume" />
        </div>
        <div class="setting-row">
          <div class="setting-label-group">
            <span class="setting-title">Screen Shake</span>
            <span class="setting-sub">Camera shake and hit-stop on hard rock &amp; Core shatter</span>
          </div>
          ${toggle('screenShake')}
        </div>
        <div class="setting-row">
          <div class="setting-label-group">
            <span class="setting-title">Colorblind-Friendly Node Shapes</span>
            <span class="setting-sub">State glyphs on Deep Grid nodes (owned, buyable, locked)</span>
          </div>
          ${toggle('colorblindMode')}
        </div>
        <div class="setting-row">
          <div class="setting-label-group">
            <span class="setting-title">Haptic Feedback</span>
            <span class="setting-sub">Mobile vibration pulse when cracking ores</span>
          </div>
          ${toggle('haptics')}
        </div>
        <div class="setting-row">
          <div class="setting-label-group">
            <span class="setting-title">Reduced Motion</span>
            <span class="setting-sub">Turns off shake and flashes, and shortens screen transitions</span>
          </div>
          ${toggle('reducedMotion')}
        </div>
      `;

      container.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((inp) => {
        // WebKit has no range-progress pseudo element, so the fader fill comes from a variable
        const paintFill = () => inp.style.setProperty('--fill', `${inp.value}%`);
        paintFill();
        inp.addEventListener('input', () => {
          paintFill();
          this.game.save.settings[inp.dataset.setting as SliderKey] = Number(inp.value);
          this.applyToRuntime();
          this.game.persist();
        });
      });
      container.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.toggle as ToggleKey;
          s[key] = !s[key];
          this.game.persist();
          this.applyToRuntime();
          this.render();
        });
      });
    }
  }
}
