# 58 — Multi-Episode Play (v1.0-rc13)

Ship target: make all 3 authored episodes playable end-to-end.

## Status before this sprint

- 3 episodes authored on disk (`the-missing-delivery`, `noise-along-the-quay`, `ownership-dispute`)
- 3 incidents in `content/incidents/incidents-pack.json`
- 7 evidence + 5 dialogue entries + 9 resolution paths
- 1 episode (`the-missing-delivery`) playable via canonical scenario + `seedPlayableMissingDelivery` in play-engine

The other 2 episodes were dead content — authored but unreachable.

## What this sprint delivers

### Multi-episode support in the engine

`bootstrapWorld({ episode })` now picks an episode-specific seed
function. Each seed:

- Sets the player location to the episode's entry point.
- Creates an unresolved question appropriate for the episode.
- Seeds the episode's incident with linked evidence + involved agents.
- Spawns a rumor with an actor that has `influence` permission.
- Records an `incident_detected` event.
- Tags the world with `_episode` for downstream consumers.

Backward-compatible: omitting `episode` still calls
`seedPlayableMissingDelivery` and tags the world as
`the-missing-delivery`. All 419 pre-existing tests still pass.

### Episode loader module

`src/play/episode-loader.js` exposes:

- `EPISODE_SCENARIO_MAP` — canonical mapping per episode (scenario, incident, core agents, required evidence, description).
- `listPlayableEpisodes()` / `isEpisodePlayable()` / `episodeMetadata()`.
- `getEpisodeScenarioPath()` / `getEpisodeEntryIncident()` / `getEpisodeCoreAgents()` / `getEpisodeRequiredEvidence()`.

### Play-server endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/episodes` | GET | Lists 3 playable episodes with metadata + current episode |
| `/api/episode/switch` | POST | Body `{episode}` — bootstraps a fresh world with the chosen episode, persists, returns new state |
| `/api/state` | GET | Now includes `currentEpisode` field |

`setWorld()` helper added to the server so the episode-switch handler
can replace the in-memory world safely.

### Episode selector UI

`src/play/episode-selector.js` provides:

- `renderEpisodeSelector()` — the selector HTML shell.
- `episodeSelectorAssets()` — CSS + client-side JS.
- `injectEpisodeSelectorInto(html)` — injects the selector into a
  generated page exactly once (dedup-safe).

The selector shows all 3 episodes with title + description + entry
incident + "Switch to this episode" button. Click → POST
`/api/episode/switch` → reload page. The active episode gets an
orange highlight via `data-active="true"`.

## Modules added (zero new dependencies)

| Module | Purpose |
| --- | --- |
| `src/play/episode-loader.js` | Episode ↔ scenario mapping + read accessors |
| `src/play/episode-selector.js` | HTML/CSS/JS for the in-page episode chooser |
| `src/cli/validate-episode-loader.js` | 23 structural checks |

## Modules updated

| File | Change |
| --- | --- |
| `src/play/play-engine.js` | `bootstrapWorld({ episode })` + 2 new seed functions (`seedPlayableNoiseComplaint`, `seedPlayableOwnershipDispute`) |
| `src/cli/play-server.js` | New endpoints + `setWorld()` helper + state endpoint returns `currentEpisode` |
| `src/cli/play-web.js` | `injectEpisodeSelectorInto()` called on the generated HTML |
| `package.json` | Adds `validate:episode-loader` script + ci:gate step. Description bumped to v1.0-rc13 |

## Tests

4 new test files:

- `v45-episode-loader.test.js` — 11 tests
- `v46-episode-bootstrap.test.js` — 8 tests
- `v47-episode-server-endpoint.test.js` — 2 tests (live server)
- `v48-episode-selector-ui.test.js` — 5 tests

Total: **445/445** (up from 419, +26 new tests).

## Browser QA

Live `play-server` on port 8765 + browser navigation:

- Episode selector visible at top with all 3 episodes
- `/api/episodes` returns 3 episodes with full metadata
- POST `/api/episode/switch {"episode":"ownership-dispute"}` returns `ok:true` and persists `ownership_dispute_5562` in SQLite
- Browser-side JS posts the switch + reloads the page
- No JS console errors except generic browser-extension noise
- All 3 episodes discoverable in `/api/episodes` after restart

## Verification

```bash
npm test                       # 445/445
npm run typecheck              # clean
npm run ci:gate                # 24 steps, all green
npm run validate:episode-loader  # 23 structural checks
npm run validate:web-play      # still green (selector integrated cleanly)
node src/cli/play-server.js --port=8765  # live with episode switch
```

## What was deliberately NOT done

- **No per-episode scenarios** — all 3 episodes currently use the
  canonical `new-aarhus-district-01.json`. Future per-episode
  scenarios will plug into `EPISODE_SCENARIO_MAP` without engine changes.
- **No server-side live state push** — the static page still renders
  canonical scenario data. Episode-switch reloads the page and the
  next `play:web` regeneration will use the active episode. (Live-mode
  banner remains in place.)
- **No resolution-path bindings** — episode 2 + 3 still resolve through
  the canonical 3 paths. Each episode will get its own resolution
  paths in a future sprint.