# Merged build (Oct 30, 2026)

One tree with every drop applied in order, with git history (one commit per drop):
`src` → `balance` → `polish` → `overhaul` → `webperf` → `ui-theme` → `core-diver-sync/DiveRenderer.ts`.

Before layering, `webperf.patch` and `ui-theme.patch` were both checked against the tree they were made for and apply cleanly, so the drop-in copies didn't lose earlier work.

## Added to make the sync renderer fit
- `SpriteAtlas.droneSprites`: three procedural drone sprites (safety-yellow hull, rotor pads, lens tinted to the pod tier's thruster colour), in the same thick-outline style as the pods.
- `PodLayerState.steeringDir`: when steering, the pod fires a small side-thruster puff on the opposite side.
- The sync renderer also brings ore glow tiers (glint, pulse, sparkles by rarity), the relic chest sprite with halo, drone beams with hit sparks, the combo gem badge (now in the theme's Barlow Condensed font) and the virtual-stick touch ring.

## Not brought in
- `core-diver-sync/style.css`: its new rules are for markup that isn't in any drop (`hud-right-stacked`, `pause-status-strip`, `results-scene-canvas`), and its depth meter `top: 124px` would undo the UI theme's ResizeObserver phone fix. The rules that were used already exist in `style.css`.
- The Results landing-scene canvas and the "Page 12" pause layout only exist in the older playable link, not in any source here.

## Cleanup
- Removed the four never-loaded sprite sheets (`ores_and_cores`, `planet_blocks`, `pods_and_drills`, `skill_icons`, about 108 KB). `npm run generate-sprites` can still rebuild them.
- `node_modules/` and `dist/` are git-ignored.

## Checked
`tsc --noEmit` and `vite build` pass. A headless Chromium run at 1280×800 and 390×844 (title → dive with steering → winch → Results) reached the Results screen with no console errors, with a drone owned so the drone path is exercised.

Run: `npm ci && npm run dev`.
