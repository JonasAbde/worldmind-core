# 50 — Asset Integration Review (QA v3 baseline + V4 reviewed overlay)

Branch: `asset/reviewed-pack-v4-overlay` (synced with `origin/master`, includes `docs/51_ASSET_ART_LOCK_LANDING_AND_RUNTIME_PLAN.md`).

## Scope and method

This integration follows a reviewed production flow:

1. Use `worldmind-production-assets-qa-v3-final-placeholders` as full coverage baseline.
2. Overlay `worldmind-reviewed-replacements-v4` to replace visibly weak sliced/cropped assets.
3. Keep runtime contracts stable for the current playable vertical slice.
4. Mark unresolved quality areas as open gaps (not "done").

## What was integrated

- Imported QA v3 baseline folders:
  - `assets/*`
  - `content/*` (episode/dialogue/evidence/incident/quest/rumor bundles)
  - `tools/*` (including `tools/validate-worldmind-assets.mjs`)
- Imported QA metadata/manifests:
  - `ASSET_PRODUCTION_MANIFEST.json`
  - `ASSET_QA_REPORT.json`
  - `ASSET_QA_REPORT.md`
  - `ASSET_CHECKSUMS.sha256`
  - `README_ASSET_PRODUCTION.md`
- Imported V4 reviewed overlay + metadata:
  - `assets/*` overlay replacement pass
  - `ASSET_REVIEW_V4_MANIFEST.json`
  - `ASSET_REVIEW_V4_CHECKSUMS.sha256`
  - `README_ASSET_REVIEW_V4.md`

## Runtime compatibility actions

- Preserved runtime-compatible content contract by keeping `content/worldmind/content-pack-v1.json` in the existing playable format.
  - QA v3 content-pack replacement format was not compatible with `validate-game-foundation`.
- Added alias sidecars for runtime-required player sheet naming:
  - `assets/characters/player/player-sheet.png`
  - `assets/characters/player/player-sheet.webp`
  - Source files were already present as `character-sheet.png/.webp` from the integrated pack.

## Contract verification summary

- `src/play/assets.js` flattened runtime registry paths: **78**
- Missing runtime paths after integration: **0**
- `tools/validate-worldmind-assets.mjs`: **PASS**
  - required: 99
  - missing: 0
  - missingWebp: 0
  - badJson: 0

## Quality review status

### Acceptable for founder demo now

- World/hero/showcase:
  - `assets/hero/*`
  - `assets/showcase/*`
- Core play UI:
  - `assets/ui/hud-memory-permissions.*`
  - `assets/ui/evidence-card.*`
  - `assets/ui/rumor-card.*`
  - `assets/ui/incident-alert.*`
  - `assets/ui/memory-node.*`
  - `assets/ui/relationship-edge.*`
  - `assets/ui/command-button.*`
  - `assets/ui/leno-overlay.*`
- Key locations (visible in current slice):
  - `assets/locations/cafe.*`
  - `assets/locations/market.*`
  - `assets/locations/workshop.*`
  - `assets/locations/district-square.*`
  - cards/icons variants under `assets/locations/cards/*` and `assets/locations/icons/*`
- Map:
  - `assets/maps/new-aarhus-district-map.*`
- Reviewed character replacements (V4 approved set):
  - `player`, `sara`, `malik`, `amina`, `nadia`, `rune`

### Upgraded in V5 (founder-demo acceptable, not final art lock)

- Long-tail character packs regenerated with dedicated portrait/avatar/expression/sheet sets:
  - `omar`, `lina`, `yasin`, `freja`, `elias`
- Reviewed location concepts added (not yet wired as runtime defaults):
  - `assets/locations/apartment-v5-reviewed.*`
  - `assets/locations/harbour-docks-v5-reviewed.*`

### Placeholder-only / not final art lock

- Audio pack is usable for prototype, but explicitly placeholder-generated:
  - `assets/audio/README.md` states generated prototype cues
- Faction logos, item icons, badges: present and registry-valid, but still generic/placeholder-tier per art-lock criteria in `docs/51`.

### Open quality gaps (do not fake closed)

- Final designed audio set (city/rain/harbour ambience, Registry tones, Leno UI sounds)
- Final art lock pass for faction logos, item icons, badges
- Optional promotion of `apartment-v5-reviewed` / `harbour-docks-v5-reviewed` to runtime `assets/locations/*.png` after product sign-off
- Landing site wiring in separate marketing repo (assets prepared under `assets/landing/`)

## Category focus checks

- Characters: coverage complete for runtime; 6 V4-reviewed + 5 V5-upgraded long-tail packs.
- Locations: all required runtime paths present; most visible locations reviewed by V4 coverage strategy.
- Evidence/Rumor/Incident UI: present and demo-usable through clean template assets.
- Leno overlay: present and integrated (`assets/ui/leno-overlay.*`).
- Faction logos, item icons, badges: present in repo structure, but still flagged as needing final art lock quality pass.
- Audio: present and functional for demo, but not final production sound design.

## Validation and test results

- `node tools/validate-worldmind-assets.mjs` → PASS
- `node src/cli/validate-game-foundation.js` → PASS
- `node src/cli/play-server.js --dry-run` → starts server successfully; current implementation does not self-exit in this environment (manual stop required)
- `node --test test/v16-game-foundation.test.js` → PASS (5/5)
- `npm run validate:web-play` → PASS
- `npm run validate:saves-ui` → PASS

## Ship recommendation

- **Founder demo (current vertical slice): SHIP**
- **Final art lock: DO NOT SHIP YET**

Use this integrated pack as the reviewed prototype baseline, then run one focused "art lock" pass for the remaining open categories before public-facing release.

## Sync with master (docs/51 + docs/52)

Branch was synced with `origin/master` after initial integration. Two new docs arrived from master without conflicts:

- `docs/51_ASSET_ART_LOCK_LANDING_AND_RUNTIME_PLAN.md` — defines landing vs runtime separation and ship criteria.
- `docs/52_FULL_FEATURED_GAMEPLAY_EXPANSION_PLAN.md` — full gameplay expansion plan.

Both are now present in this branch.

Key requirement from docs/51 implemented in this branch:

- `assets/landing/` created as a dedicated product/marketing asset lane, separate from runtime sprites.
- 10 landing PNGs sourced from best available assets.
- WebP and responsive derivatives generated under `assets/landing/generated/`.

## V5 generation follow-up (major improvement pass)

A follow-up generation pass was executed to improve the weakest long-tail placeholders while staying dependency-light and deterministic in-repo.

### Generated now

- Upgraded long-tail character packs (PNG + WebP) for:
  - `assets/characters/omar/*`
  - `assets/characters/lina/*`
  - `assets/characters/yasin/*`
  - `assets/characters/freja/*`
  - `assets/characters/elias/*`
- Added new reviewed location concepts:
  - `assets/locations/apartment-v5-reviewed.png/.webp`
  - `assets/locations/harbour-docks-v5-reviewed.png/.webp`
- Added reproducible generator:
  - `tools/generate-missing-assets-v5.ps1`

### Validation after V5 pass

- `node tools/validate-worldmind-assets.mjs` → PASS
- `node src/cli/validate-game-foundation.js` → PASS
- `npm run validate:web-play` → PASS
- `npm run validate:saves-ui` → PASS

### Remaining open gaps after V5

- Final designed audio set (current audio still prototype-tier)
- Final art lock pass for faction logos, item icons, badges
- Optional replacement of runtime `assets/locations/apartment.png` with a final approved apartment master if product direction decides V5 should become default

## Landing lane (separate from runtime)

Per `docs/51`, marketing/landing art lives under `assets/landing/` and does not replace runtime paths in `src/play/assets.js`.

Prepared landing masters (PNG + WebP):

- `assets/landing/worldmind-hero-key-art.*`
- `assets/landing/new-aarhus-district-01.*`
- `assets/landing/missing-delivery-case-board.*`
- `assets/landing/leno-evidence-guard.*`
- `assets/landing/simulation-hud-memory-permissions.*`
- `assets/landing/timeline-branches.*`
- `assets/landing/save-browser-snapshot-diff.*`
- `assets/landing/npc-agent-portrait-set.*`
- `assets/landing/worldmind-og-image.*`
- `assets/landing/worldmind-app-icon.*`

Total files under `assets/`: **435** (including landing lane; runtime registry paths: **78**, all present).

## Related docs

- `docs/49_ASSET_QA_V3_FINAL_PLACEHOLDERS.md` — QA v3 baseline verdict
- `docs/51_ASSET_ART_LOCK_LANDING_AND_RUNTIME_PLAN.md` — two-lane strategy and art-lock criteria
