/**
 * Clean 2-color vector SVG icon library & Core Diver Logo Wordmark
 * Replaces all emoji across Dive HUD, Hangar Hub, Deep Grid, Results, and Modals.
 */
export const SVG_ICONS: Record<string, string> = {
  fuel: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 2C7.5 7.5 5 11.2 5 14.8C5 18.8 8.1 22 12 22C15.9 22 19 18.8 19 14.8C19 11.2 16.5 7.5 12 2Z" fill="#00e676" stroke="#0b1f14" stroke-width="1.8"/><path d="M12.5 8L9 14H12L11 18.5L15 12.5H12L12.5 8Z" fill="#b9f6ca"/></svg>`,

  cargo: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M3 7L12 3L21 7V17L12 21L3 17V7Z" fill="#ab47bc" stroke="#e1bee7" stroke-width="1.6"/><path d="M3 7L12 11L21 7M12 11V21" stroke="#e1bee7" stroke-width="1.5"/></svg>`,

  credits: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="12" r="9" fill="#f5a623" stroke="#fff3e0" stroke-width="1.6"/><path d="M12 6.5V17.5M14.5 9.5C14.5 8.4 13.4 7.8 12 7.8C10.5 7.8 9.5 8.5 9.5 9.6C9.5 11.8 14.5 11.2 14.5 13.8C14.5 15 13.5 15.8 12 15.8C10.4 15.8 9.3 15 9.3 13.8" stroke="#1b1204" stroke-width="2" stroke-linecap="round"/></svg>`,

  depth: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 3V21M12 21L7 16M12 21L17 16M6 3H18" stroke="#00e5ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  extract: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M12 19V5M12 5L6 11M12 5L18 11" stroke="#00e5ff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 20H19" stroke="#e0f7fa" stroke-width="2.2" stroke-linecap="round"/></svg>`,

  pause: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="#eceff1"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="#eceff1"/></svg>`,

  settings: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5A3.5 3.5 0 1 0 12 15.5Z" stroke="#eceff1" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="#90a4ae" stroke-width="1.7"/></svg>`,

  sound_on: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M11 5L6 9H2V15H6L11 19V5Z" fill="#eceff1"/><path d="M15.5 8.5C16.8 9.8 16.8 14.2 15.5 15.5M18.5 5.5C21.5 8.5 21.5 15.5 18.5 18.5" stroke="#00e5ff" stroke-width="2" stroke-linecap="round"/></svg>`,

  sound_off: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M11 5L6 9H2V15H6L11 19V5Z" fill="#90a4ae"/><path d="M22 9L16 15M16 9L22 15" stroke="#ff5252" stroke-width="2.2" stroke-linecap="round"/></svg>`,

  lock: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" fill="#ff5252"/><path d="M8 11V7A4 4 0 0 1 16 7V11" stroke="#ff8a80" stroke-width="2.2" stroke-linecap="round"/></svg>`,

  planet_lock: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><circle cx="12" cy="12" r="7" fill="#00b0ff"/><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-22 12 12)" stroke="#00e5ff" stroke-width="2"/></svg>`,

  check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M5 12.5L10 17.5L19 6.5" stroke="#00e676" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  close: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="#eceff1" stroke-width="2.4" stroke-linecap="round"/></svg>`,

  warning: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 3L2 20H22L12 3Z" fill="#ff5252" stroke="#ff8a80" stroke-width="1.5"/><path d="M12 9V14M12 17.5V18" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/></svg>`,

  launch: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M7 4H17L19 10L12 21L5 10L7 4Z" fill="#041b0c" stroke="#041b0c" stroke-width="1.5"/><path d="M9 10L15 10M10 14L14 14" stroke="#00e676" stroke-width="2" stroke-linecap="round"/></svg>`,

  tree: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="5" r="3" fill="#f5a623"/><circle cx="6" cy="17" r="3" fill="#00e5ff"/><circle cx="18" cy="17" r="3" fill="#00e676"/><path d="M12 8V12M12 12L6 14M12 12L18 14" stroke="#90a4ae" stroke-width="2"/></svg>`,

  garage: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M4 9L12 4L20 9V20H4V9Z" stroke="#f5a623" stroke-width="2"/><circle cx="12" cy="13" r="3.5" fill="#00e5ff"/></svg>`,

  planet_map: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="12" r="6" fill="#00e5ff"/><ellipse cx="12" cy="12" rx="10.5" ry="4" transform="rotate(-25 12 12)" stroke="#eceff1" stroke-width="1.8"/></svg>`,

  codex: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 3L19 9L12 21L5 9L12 3Z" fill="#d500f9" stroke="#f3e5f5" stroke-width="1.6"/></svg>`,

  target: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><circle cx="12" cy="12" r="7" stroke="#00e5ff" stroke-width="2"/><path d="M12 2V6M12 18V22M2 12H6M18 12H22" stroke="#eceff1" stroke-width="2" stroke-linecap="round"/></svg>`,

  play: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg>`,

  grid: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="5" r="3" fill="#f5a623"/><circle cx="6" cy="17" r="3" fill="#00e5ff"/><circle cx="18" cy="17" r="3" fill="#00e676"/><path d="M12 8V12M12 12L6 14M12 12L18 14" stroke="#90a4ae" stroke-width="2"/></svg>`,

  info: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="12" r="9" stroke="#00e5ff" stroke-width="2"/><path d="M12 11V17M12 7.5V8" stroke="#eceff1" stroke-width="2.2" stroke-linecap="round"/></svg>`,

  coin: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="12" r="9" fill="#f5a623" stroke="#fff3e0" stroke-width="1.6"/><path d="M12 6.5V17.5M14.5 9.5C14.5 8.4 13.4 7.8 12 7.8C10.5 7.8 9.5 8.5 9.5 9.6C9.5 11.8 14.5 11.2 14.5 13.8C14.5 15 13.5 15.8 12 15.8C10.4 15.8 9.3 15 9.3 13.8" stroke="#1b1204" stroke-width="2" stroke-linecap="round"/></svg>`,

  volumeOn: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M11 5L6 9H2V15H6L11 19V5Z" fill="#eceff1"/><path d="M15.5 8.5C16.8 9.8 16.8 14.2 15.5 15.5M18.5 5.5C21.5 8.5 21.5 15.5 18.5 18.5" stroke="#00e5ff" stroke-width="2" stroke-linecap="round"/></svg>`,

  volumeOff: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M11 5L6 9H2V15H6L11 19V5Z" fill="#90a4ae"/><path d="M22 9L16 15M16 9L22 15" stroke="#ff5252" stroke-width="2.2" stroke-linecap="round"/></svg>`,

  core: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="12" r="6" fill="#ff6d00" stroke="#ffd54f" stroke-width="1.8"/><path d="M12 2V5M12 19V22M2 12H5M19 12H22M4.9 4.9L7.1 7.1M16.9 16.9L19.1 19.1M19.1 4.9L16.9 7.1M7.1 16.9L4.9 19.1" stroke="#ffd54f" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  rocket: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M7 4H17L19 10L12 21L5 10L7 4Z" fill="currentColor"/><path d="M9 10L15 10M10 14L14 14" stroke="#00e676" stroke-width="2" stroke-linecap="round"/></svg>`,

  drill: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M6 3H18L16 10H8L6 3Z" fill="currentColor"/><polygon points="7,10 17,10 12,22" fill="currentColor"/></svg>`,

  planet: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="12" r="6" fill="#00e5ff"/><ellipse cx="12" cy="12" rx="10.5" ry="4" transform="rotate(-25 12 12)" stroke="#eceff1" stroke-width="1.8"/></svg>`,

  compass: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><circle cx="12" cy="12" r="7" stroke="#00e5ff" stroke-width="2"/><path d="M12 2V6M12 18V22M2 12H6M18 12H22" stroke="#eceff1" stroke-width="2" stroke-linecap="round"/></svg>`,

  drill_power: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><polygon points="6,3 18,3 12,21" fill="#ff7043"/><path d="M8 8L16 11M9.5 13L14.5 15" stroke="#fff3e0" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  bore_width: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M3 12H21M3 12L7 8M3 12L7 16M21 12L17 8M21 12L17 16" stroke="#ffca28" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  refinery: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><polygon points="12,2 20,9 12,22 4,9" fill="#ffd54f" stroke="#fff8e1" stroke-width="1.5"/></svg>`,

  scanner: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><circle cx="12" cy="12" r="8" stroke="#00e5ff" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#00e5ff"/></svg>`,

  music: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M9 18V5L20 3V16" stroke="#00e5ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="#eceff1"/><circle cx="17" cy="16" r="3" fill="#eceff1"/></svg>`,

  haptics: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><rect x="7" y="4" width="10" height="16" rx="2" stroke="#eceff1" stroke-width="2"/><path d="M3 8L1 12L3 16M21 8L23 12L21 16" stroke="#00e5ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  globe: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><circle cx="12" cy="12" r="9" stroke="#00e5ff" stroke-width="2"/><path d="M3 12H21M12 3C14.5 6 14.5 18 12 21C9.5 18 9.5 6 12 3Z" stroke="#eceff1" stroke-width="1.6"/></svg>`,
};

export const CORE_DIVER_LOGO_SVG = `
<svg viewBox="0 0 760 220" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="logoMetal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="48%" stop-color="#cfd8dc"/>
      <stop offset="52%" stop-color="#78909c"/>
      <stop offset="100%" stop-color="#eceff1"/>
    </linearGradient>
    <linearGradient id="logoAmber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffe082"/>
      <stop offset="55%" stop-color="#f5a623"/>
      <stop offset="100%" stop-color="#e65100"/>
    </linearGradient>
    <filter id="logoGlow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.85"/>
    </filter>
  </defs>
  <g filter="url(#logoGlow)">
    <!-- Beveled Backing Shield -->
    <polygon points="40,34 720,34 742,56 742,164 720,186 40,186 18,164 18,56" fill="#0d131f" stroke="#f5a623" stroke-width="4"/>
    <!-- Hazard Stripe Accent Bar -->
    <rect x="34" y="46" width="692" height="10" fill="#f5a623" opacity="0.85"/>
    <!-- Central Drill Icon Emblem on Left -->
    <g transform="translate(95, 115)">
      <circle cx="0" cy="-16" r="32" fill="#f5a623" stroke="#18202c" stroke-width="5"/>
      <circle cx="0" cy="-18" r="16" fill="#00e5ff" stroke="#18202c" stroke-width="4"/>
      <polygon points="-28,12 28,12 0,62" fill="url(#logoMetal)" stroke="#18202c" stroke-width="5"/>
      <line x1="-18" y1="24" x2="18" y2="32" stroke="#18202c" stroke-width="4"/>
      <line x1="-10" y1="40" x2="10" y2="46" stroke="#18202c" stroke-width="4"/>
    </g>
    <!-- Wordmark Text -->
    <text x="155" y="128" font-family="'Chakra Petch', 'Rajdhani', sans-serif" font-weight="900" font-size="76" letter-spacing="4" fill="url(#logoAmber)" stroke="#090d16" stroke-width="8" paint-order="stroke">CORE</text>
    <text x="392" y="128" font-family="'Chakra Petch', 'Rajdhani', sans-serif" font-weight="900" font-size="76" letter-spacing="4" fill="url(#logoMetal)" stroke="#090d16" stroke-width="8" paint-order="stroke">DIVER</text>
    <text x="160" y="164" font-family="'Rajdhani', 'Inter', sans-serif" font-weight="700" font-size="18" letter-spacing="7" fill="#00e5ff">PLANETARY EXCAVATION CONTRACTORS</text>
  </g>
</svg>
`;
