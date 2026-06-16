# 47 — v1.0-rc7 Save Browser UI + Branch Timeline Restore

WorldMind v1.0-rc7 makes save/restore/branch operations live in the browser UI while preserving the existing CLI/persistence layer as the authoritative source.

## Scope

- No React.
- No 3D.
- No multiplayer.
- No marketplace.
- No real-world connectors.
- No duplicate save or gameplay logic.

## New API endpoints

Served by `npm run play:server` / `src/cli/play-server.js`:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/saves` | List snapshots with metadata. |
| `GET` | `/api/saves/:id` | Inspect snapshot without loading it. |
| `POST` | `/api/saves/:id/restore` | Restore world state from snapshot and update live server state. |
| `GET` | `/api/branches` | List branches with origin/current snapshot metadata. |
| `POST` | `/api/branches` | Create a branch from a snapshot. Alias: `POST /api/branch`. |
| `GET` | `/api/saves/diff?from=A&to=B` | Compare two snapshots using the existing timeline diff logic. |

Existing v1.0-rc6 endpoints remain available: `/api/health`, `/api/state`, `/api/command`, `/api/save`, `/api/events`, `/api/demo/path/:name`, and static file serving.

## Web UI

The static UI now includes live controls for:

- Save Browser panel with search/filter.
- Snapshot inspect via API.
- Restore button per snapshot.
- Branch Timeline tree.
- Branch creation form.
- Snapshot Diff viewer.
- Active snapshot / branch metadata via API state.
- Live state update after restore without page reload.

The page still works as a deterministic static artifact. When opened through `npm run play:server`, it probes `/api/health` and switches into live mode.

## Safety and determinism

- Restore uses the existing SQLite snapshot loader and serialized RNG state.
- Diff uses `src/persistence/timeline.js`.
- Save/branch use `src/persistence/sqlite.js`.
- Command execution continues through `src/play/play-engine.js`.
- API responses redact private memories/secrets and hide `hiddenCause` unless evidence gates allow it.
- Leno guard remains enforced by `npm run validate:leno`.
- Risk 4/5 actions remain gated by existing action/risk validators.

## Validation

New gate:

```bash
npm run validate:saves-ui
```

It validates:

1. health endpoint
2. state endpoint
3. saves endpoint
4. command dispatch
5. save creation
6. snapshot inspect redaction
7. restore updates state
8. branches endpoint
9. branch creation
10. diff endpoint
11. Leno/hidden-cause guard in state
12. static UI sections

It auto-starts a temporary play server if one is not already running.

## Usage

```bash
npm run play:web
npm run play:server
# open http://127.0.0.1:8080
```

Optional custom port:

```bash
npm run play:server -- --port 9090
npm run validate:saves-ui -- --port 9090
```

## Acceptance commands

```bash
npm test
npm run typecheck
npm run check
npm run ci:gate
npm run play:web
npm run validate:web-play
npm run validate:play-server
npm run validate:saves-ui
npm run demo:play
npm run validate:leno
```
