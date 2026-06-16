# 46 — Game Foundation Pack

## Status

This document tracks the first real game foundation layer on top of the existing playable WorldMind prototype.

The pack adds five development layers:

1. Live browser/server runtime foundation.
2. Asset binding registry for world, UI, locations, characters, and audio.
3. Content authoring helpers and a first JSON content pack.
4. 2D district-view graph foundation.
5. Progression loop with XP, levels, badges, skills, Leno trust, and district influence.

## New implementation files

| File | Purpose |
|---|---|
| `src/cli/play-server.js` | Local server runtime for live browser play |
| `src/play/assets.js` | Stable asset registry and `bindAssets(world)` |
| `src/play/authoring.js` | Content pack validation and summaries |
| `src/play/district-view.js` | 2D district graph and render helpers |
| `src/play/progression.js` | XP, levels, unlocks, badges, influence |
| `src/cli/validate-game-foundation.js` | Foundation validator |
| `content/worldmind/content-pack-v1.json` | First authored content pack |
| `test/v16-game-foundation.test.js` | Test coverage for the new layers |

## Current scope

This pack turns the project into a more game-ready foundation without adding React, 3D, multiplayer, marketplace, or real-world connectors.

The server runtime keeps `src/play/play-engine.js` as the gameplay authority. The asset layer only binds predictable paths. The authoring layer keeps content deterministic. The district view is a 2D graph foundation. The progression layer derives rewards from validated play results.

## Run locally

```bash
node src/cli/play-server.js --dry-run
node src/cli/play-server.js --port=8080
node src/cli/validate-game-foundation.js
node --test test/v16-game-foundation.test.js
```

## Asset contract

The visual layer expects stable paths such as:

```txt
assets/hero/worldmind-cover.png
assets/showcase/worldmind-v2-showcase.png
assets/ui/hud-memory-permissions.png
assets/characters/sara/portrait.png
assets/locations/cafe.png
assets/audio/ui-click.wav
```

The binary files are still handled separately. This pack only makes the runtime aware of the contract.

## Content pack

The first content pack covers `The Missing Delivery` with:

- one episode
- one quest
- three resolution paths
- character entries
- location entries
- rumor entries
- evidence entries
- dialogue beats
- asset bindings

## Next recommended sprint

`v1.0-rc11 — Live DOM + Visual Game UI Polish`

Recommended scope:

- wire the static browser page to the server runtime
- render district map, progression, assets, and content panels in the UI
- add visual cards for locations, characters, evidence, rumors, and incidents
- add browser save/load
- add audio hooks when files exist
