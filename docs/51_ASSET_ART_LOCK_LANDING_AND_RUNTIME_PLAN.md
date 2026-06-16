# 51 — Asset Art Lock, Landing Integration and Runtime Plan

## Status

WorldMind has reached asset coverage for a founder demo, but not final public art lock.

Current repo truth:

- `src/play/assets.js` defines stable runtime asset paths.
- `docs/49_ASSET_QA_V3_FINAL_PLACEHOLDERS.md` documents QA v3 as `PASS_WITH_NOTES_FINAL_PLACEHOLDERS`.
- QA v3 is marked `SHIP FOR FOUNDER DEMO / VERTICAL SLICE`, but `NOT FINAL ART LOCK`.
- A Cursor/local integration review indicates a planned `docs/50_ASSET_INTEGRATION_REVIEW.md`, but this file is not present on `master` at the time of this plan.

## Product goal

WorldMind is not an NPC chatbot. It is a simulation-first AI game where:

- Event Log is the source of truth.
- Memory is agent interpretation.
- Rumor is social spread.
- Hidden truth requires evidence.
- Leno is the player companion/UI-brain, not an omniscient spoiler.

The first demo target remains `The Missing Delivery` in New Aarhus District 01.

## Visual target

Use the established art direction:

- Nordic near-future / cozy cyberpunk.
- Aarhus harbour.
- Rain and wet pavement.
- Concrete housing blocks.
- Warm café light.
- Cold Registry kiosks.
- Neon agent-tech.
- Underground repair shops.
- Scandinavian minimal UI.
- Premium dark cinematic product identity.

Avoid:

- generic cyberpunk city clichés.
- anime/cartoon styling.
- fake readable UI text.
- one huge collage that later gets sliced into weak assets.
- calling placeholder assets final.

## Required asset strategy

Use two asset lanes, not one mixed folder:

1. Runtime/game assets
   - Used by `src/play/assets.js` and web-play UI.
   - Must preserve exact filenames and paths.
   - Must pass validators.
   - Can include placeholder-tier assets only if marked clearly.

2. Landing/product assets
   - Used by Vite/React/Tailwind marketing site.
   - Should be cinematic, large, responsive, and optimized.
   - Should live separately from gameplay runtime assets.
   - Should not break engine tests.

Recommended structure:

```txt
assets/
  runtime/
  landing/
  characters/
  locations/
  ui/
  audio/
content/
  worldmind/
  episodes/
```

Keep compatibility aliases for existing runtime paths if structure changes.

## Landing assets to integrate

The landing page pack should be treated as product/marketing art, not runtime gameplay sprites.

Expected files:

```txt
assets/landing/worldmind-hero-key-art.png
assets/landing/new-aarhus-district-01.png
assets/landing/missing-delivery-case-board.png
assets/landing/leno-evidence-guard.png
assets/landing/simulation-hud-memory-permissions.png
assets/landing/timeline-branches.png
assets/landing/save-browser-snapshot-diff.png
assets/landing/npc-agent-portrait-set.png
assets/landing/worldmind-og-image.png
assets/landing/worldmind-app-icon.png
```

Recommended derivatives:

```txt
assets/landing/generated/webp/*.webp
assets/landing/generated/avif/*.avif
assets/landing/generated/responsive/*-640.webp
assets/landing/generated/responsive/*-1280.webp
assets/landing/generated/responsive/*-1920.webp
assets/landing/generated/responsive/*-2560.webp
```

## Runtime asset gaps that still need final art lock

These are not blockers for founder demo, but should be finished before public launch:

1. Final dedicated character art for long-tail agents:
   - Omar
   - Lina
   - Yasin
   - Freja
   - Elias

2. Final environment art:
   - apartment master
   - harbour docks master

3. Final UI iconography:
   - faction logos
   - item icons
   - badge/achievement icons

4. Final audio:
   - city/rain/harbour ambience
   - café warmth
   - Registry tones
   - underground repair shop layer
   - Leno UI sounds

## Engineering rules

- Do not replace `content/worldmind/content-pack-v1.json` with an incompatible generated content-pack shape.
- Keep `src/play/assets.js` runtime paths valid.
- Preserve PNG masters and add WebP/AVIF derivatives for web usage.
- Do not add heavy dependencies unless they are needed and documented.
- Prefer deterministic scripts for resizing/conversion.
- Keep Git LFS in mind if binary size grows too much.

## Validation gates

Run after integration:

```bash
node tools/validate-worldmind-assets.mjs
node src/cli/validate-game-foundation.js
node --test test/v16-game-foundation.test.js
npm run validate:web-play
npm run validate:saves-ui
```

For landing page integration, also run the site build in the separate landing repo:

```bash
npm run build
```

## Ship criteria

Founder demo can ship when:

- all runtime asset paths exist.
- no corrupt images.
- WebP sidecars exist for heavy PNGs.
- docs honestly label placeholder-tier assets.
- web-play and save UI validators pass.

Public art lock can ship only when:

- long-tail characters are no longer placeholder-tier.
- faction/item/badge icons are intentionally designed, not generic.
- final audio is reviewed.
- landing assets are optimized and integrated into the marketing site.
- Open Graph image and app icon are wired into metadata.

## Recommended next sprint

`v1.0-rc8 — Asset Integration + Landing Visual System`

Scope:

1. Integrate QA v3 baseline into repo if not already present.
2. Overlay reviewed V4 assets.
3. Add landing cinematic pack under `assets/landing/` or the landing-site repo.
4. Generate responsive WebP/AVIF derivatives.
5. Wire landing page sections to the new images.
6. Add `docs/50_ASSET_INTEGRATION_REVIEW.md` from Cursor/local work if valid.
7. Keep a transparent gap list for final art lock.
8. Run all validation gates.

Verdict:

- `SHIP FOR FOUNDER DEMO` after validators pass.
- `DO NOT SHIP FINAL ART LOCK` until the gaps above are closed.
