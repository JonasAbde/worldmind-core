# 54 — Gameplay Model Authoring Plan

## Goal

Enable game designers to author gameplay data (hotspots, major decisions, location scenes, NPC roles) in JSON content packs without touching renderer or engine code.

## What was accomplished (this iteration)

- `content/worldmind/content-pack-v1.json` now carries authored hotspot lists and scene paths per location.
- `src/play/game-shell-model.js` reads this data at startup and builds the UI shell model from it.
- Fallbacks are in place if the pack cannot be read.
- Major decision ids are derived from `quests[].resolutionPaths[].id` in the pack.
- All validators pass (`validate-game-foundation`, `v16-game-foundation.test.js`, `validate:web-play`, `validate:saves-ui`).

## Content pack structure added

```json
"locations": [
  {
    "id": "cafe",
    "scene": "assets/locations/cafe.png",
    "hotspots": [
      { "id": "cafe_delivery_crate", "label": "Delivery crate", "command": "inspect cafe", "preview": "...", "risk": 1 }
    ]
  }
]
```

Each hotspot carries:

| Field     | Type   | Description                                    |
|-----------|--------|------------------------------------------------|
| `id`      | string | Stable machine id for event logging            |
| `label`   | string | Display label in hotspot UI                    |
| `command` | string | Command string dispatched to play-engine       |
| `preview` | string | Short action description shown on hover/focus  |
| `risk`    | number | Risk level 1–3; shown as colour cue in UI      |

## Next authoring targets

### Short term
- Add `majorDecisions` array directly to `quests[].resolutionPaths[]` with richer metadata:
  - `branchSuggested: true/false`
  - `consequenceSummary: string`
  - `requiredEvidence: string[]`
- Add `npcDialogueTopics` to characters so NPC action buttons are content-driven.
- Add `founderUnlockConditions` to quests so the founder unlock is not hardcoded to `status === 'resolved'`.

### Medium term
- Introduce a `scenario/` directory alongside `content/` for episode-specific authored data:
  - `scenario/episode_missing_delivery/hotspots.json`
  - `scenario/episode_missing_delivery/decisions.json`
  - `scenario/episode_missing_delivery/consequence_rules.json`
- Add a JSON Schema for content packs so authoring errors are caught at load time.

### Long term
- Ship a lightweight in-browser authoring panel (GameMaster view) allowing content edits during live play sessions.
- Export authored content packs to the same format so Cursor / AI agents can generate scenario data directly.

## Affected files

| File | Role |
|------|------|
| `content/worldmind/content-pack-v1.json` | Authoritative authored game data |
| `src/play/game-shell-model.js` | Reads content pack; builds UI shell model |
| `src/play/web-renderer.js` | Consumes shell model for rendering |
| `src/cli/play-web.js` | Builds shell model and injects into render payload |

## Validation gate

Before any content pack change ships, run:

```
node src/cli/validate-game-foundation.js
node --test test/v16-game-foundation.test.js
npm run validate:web-play
npm run validate:saves-ui
```

All must pass.
