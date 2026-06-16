# 50 — Asset Integration Review (QA v3 baseline + V4 reviewed overlay)

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

### Placeholder-only / not final art lock

- Long-tail characters explicitly marked placeholder in pack notes:
  - `omar`, `lina`, `yasin`, `freja`, `elias`
- Audio pack is usable for prototype, but explicitly placeholder-generated:
  - `assets/audio/README.md` states generated prototype cues

### Open quality gaps (do not fake closed)

- Final single-generated art still missing per V4 manifest:
  - characters: `omar`, `lina`, `yasin`, `freja`, `elias`
  - locations: stronger final pass still needed for `apartment` and harbour-docks direction
  - final designed audio set
  - final faction logo pass
  - final item icon pass
  - final badge icon pass

## Category focus checks

- Characters: coverage complete for runtime; 6 reviewed + 5 placeholder tier.
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
