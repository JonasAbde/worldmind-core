# Play API Contract v1.0.0

Stable JSON contract between **worldmind-core** (`play-server`) and external clients (`worldmind-site` `/play`, tools, future 3D).

Gameplay logic lives only in `play-engine`. Clients must **never** duplicate simulation rules.

## Base URL

Local: `http://127.0.0.1:8080` (default `npm run play:server`)

Production: configure reverse proxy; site uses `VITE_WORLDMIND_CORE_URL`.

## Versioning

- `GET /api/health` → `apiVersion: "1.0.0"`
- `GET /api/state` → `apiVersion` + `contract: "docs/PLAY_API_CONTRACT.md"`
- Breaking changes bump `PLAY_API_VERSION` in `src/play/play-api-payload.js`

## CORS (site bridge)

Set `WM_CORS_ORIGIN` when starting play-server:

```bash
WM_CORS_ORIGIN=https://worldmind.tekup.dk,http://localhost:5173 npm run play:server
```

`*` is allowed for local dev only.

## Endpoints

### `GET /api/health`

```json
{
  "ok": true,
  "engine": "play-engine",
  "version": "1.0-rc7",
  "apiVersion": "1.0.0",
  "contract": "docs/PLAY_API_CONTRACT.md",
  "dbPath": "..."
}
```

### `GET /api/state` — primary client boot

Returns everything a play portal needs to render without parsing HTML.

```json
{
  "ok": true,
  "apiVersion": "1.0.0",
  "contract": "docs/PLAY_API_CONTRACT.md",
  "worldId": "new_aarhus_district_01",
  "currentSnapshotId": null,
  "branchName": "main",
  "tick": 96,
  "day": 2,
  "time": "00:00",
  "sections": { "...": "summarizeWorld sections" },
  "playerSnapshot": { "money": 150, "reputation": 0, "energy": 90 },
  "playerKnowledge": {
    "evidenceIds": [],
    "knownRumorIds": [],
    "suspectedCauses": [],
    "unresolvedQuestions": []
  },
  "founder": { "unlocked": false, "baseLevel": 0, "contractsCompleted": 0, "activeContract": null },
  "gameShell": { "...": "see gameShell schema below" },
  "districtView": { "nodes": [], "edges": [], "playerLocationId": "cafe" },
  "redaction": {
    "hiddenCause": "never_in_api",
    "agentSecrets": "never_in_api",
    "lenoSourceDefining": "redacted_until_rumor_source_nadia_evidence"
  }
}
```

### `POST /api/command`

Request (either form):

```json
{ "text": "inspect cafe" }
```

```json
{ "command": "inspect", "args": { "target": "cafe" } }
```

Response:

```json
{
  "ok": true,
  "command": "inspect",
  "args": { "target": "cafe" },
  "text": "inspect cafe",
  "result": {
    "ok": true,
    "kind": "inspect",
    "text": "...",
    "dialogue": { "...": "optional" },
    "consequence": { "...": "optional deltas" },
    "consequenceBeat": { "categories": [], "bullets": [], "summary": "..." },
    "walkAnimation": { "...": "present on successful move; null if same location" },
    "leno": { "summary": "...", "suggestions": [] },
    "world": { "id": "...", "day": 2, "time": "...", "tick": 97, "branchName": "main" },
    "playerSnapshot": { "money": 150, "reputation": 0, "energy": 90 },
    "playerKnowledge": { "evidenceIds": [], "knownRumorIds": [] },
    "founder": null,
    "gameShell": { "...": "fresh shell after command" },
    "majorDecisionPrompt": { "id": "...", "label": "...", "command": "...", "branchSuggested": true }
  }
}
```

`majorDecisionPrompt` appears when the command matches authored major decisions (branch suggested before impact).

## `gameShell` schema

Built by `buildGameplayShellModel()` from world state + `content/worldmind/content-pack-v1.json`.

| Field | Purpose |
|-------|---------|
| `topbar` | worldName, day, time, money, reputation, energy, branchName, lenoStatus |
| `location` | `id`, `name`, `mood`, `scene` (asset path), `hotspots[]` |
| `npcCards[]` | id, name, role, avatar, portrait, trust/suspicion/fear, `actions[]`, topics |
| `caseBoard` | evidenceCards, rumorCards, suspectCards, links, unresolvedQuestions |
| `rumorTrail[]` | id, claim, truthLevel, traceCommand, counterCommand |
| `questProgress` | questId, title, objective, paths[], incidentStatus |
| `founder` | unlocked, baseLevel, tierLabel, contracts[], contractsCompleted, activeContract, reputation, money, unlockText |
| `progression` | level, title, xp, nextLevelAt, xpToNext, capabilities[], badges[], districtInfluence, nextUnlock |
| `assets` | UI icon paths for case board and Leno overlay (see below) |
| `leno` | summary, suggestions[] |
| `majorDecisions[]` | id, label, command, branchSuggested, requiredEvidence[] |

### Hotspot object

```json
{
  "id": "cafe_delivery_crate",
  "label": "Delivery crate",
  "command": "inspect cafe",
  "preview": "...",
  "risk": 1
}
```

Visual shell branch adds `description`, `possibleEvidence[]`, `icon`, `overlayPosition`.

### `gameShell.assets` (UI icons)

Stable paths from `WORLD_ASSETS.ui` in `src/play/assets.js`. Site portals resolve via `assetUrl()`; static shell may omit until present.

```json
"assets": {
  "lenoOverlay": "assets/ui/leno-overlay.png",
  "evidenceIcon": "assets/ui/evidence-card.png",
  "rumorIcon": "assets/ui/rumor-card.png",
  "incidentIcon": "assets/ui/incident-alert.png"
}
```

Used by worldmind-site `CaseBoardPanel` and `RumorTrailPanel` beside card labels. See `docs/59_VISUAL_GAMEPLAY_SHELL_V1.md`.

### `gameShell.progression`

Derived from `world.progression` via `summarizeProgression()` / `getNextUnlock()` in `src/play/progression.js`.

```json
"progression": {
  "level": 1,
  "title": "Observer",
  "xp": 24,
  "nextLevelAt": 50,
  "xpToNext": 26,
  "districtInfluence": 0,
  "badges": [],
  "capabilities": [{ "id": "counter_rumor", "label": "Counter rumor", "unlocked": false }],
  "nextUnlock": { "type": "level", "level": 2, "title": "Street Listener", "xpRequired": 26 }
}
```

Command results may include a `progression` delta envelope on `result.consequence`; the refreshed `gameShell.progression` is authoritative for UI.

### NPC card action

```json
{ "label": "Talk", "command": "talk sara" }
```

## Redaction rules (mandatory)

1. **`hiddenCause`** — never in API or static HTML state.
2. **`agent.secrets`** — never exposed; empty or omitted.
3. **Leno source-defining Nadia** — UI text redacted until `rumor_source_nadia` in `playerKnowledge.evidenceIds`.
4. **Case board links** — `reveals_source` redacted until same evidence.
5. **Private memories** — redacted in save inspect (`_redacted: true`).

## Client integration (worldmind-site)

```txt
1. VITE_WORLDMIND_CORE_URL=https://core.example.com
2. On /play mount: GET /api/health → GET /api/state
3. Render from state.gameShell (not from embedded static HTML)
4. User actions: POST /api/command { text }
5. Merge result.gameShell + result.playerSnapshot into UI
6. Fallback: link to static demo or "start local server" if health fails
```

Do **not** embed `play-engine` in site. Do **not** mutate world in browser.

## `visualCues` (3D clients — v1.0.0+)

Implemented in `src/play/district-3d-layout.js` + `src/play/walk-path.js`. Returned on `GET /api/state` as `visualCues`.

**Version 4** (current) adds `walkGraph`, `interior`, world-space `hotspots`, per-location `interiorCamera` / `walkAnchor`, agent `idleAnimation`, and **building collision** (`footprint`, `buildingStyle`, `collision`).

**3D mesh assets (v39+):** locations, agents, and player include `renderMode: "mesh3d"` and optional `modelUrl` (glTF/GLB under `assets/models/`). See `docs/64_3D_PROCEDURAL_ASSET_KIT.md`. `sceneTexture` / `figureTexture` remain as hologram accents; gameplay geometry is 3D.

**Building collision (v40+):** each `locations[]` entry includes `footprint: [w,h,d]`, `buildingStyle`, and `collision: { shape, footprint, halfExtents, radius, currentLocationRadius }` from `src/play/building-footprints.js` (mirrored in site `building-footprints.ts`). Site `/play/3d` uses these for WASD locomotion; static `3d-client.js` uses them for label height only.

| Top-level field | Purpose |
|-----------------|---------|
| `kind` | Always `worldmind_3d_visual_cues` |
| `version` | `4` |
| `playerLocationId` | Current district node id |
| `interior` | Player's current location interior (scene + hotspot commands); `null` if unknown |
| `walkGraph` | `{ nodes: Record<id, { walkAnchor, position }>, edges: [{ from, to }] }` |
| `player` | `{ position, locationId, figureTexture, modelUrl, renderMode }` — ground-level player marker |
| `camera` | Orbit target, distance clamps, `walkEye` / `walkTarget` for follow cam |
| `environment` | fog, ground/grid colours, ambient/sun intensity |
| `locations[]` | District buildings (see below) |
| `hotspots[]` | World-space inspect points near player location |
| `edges[]` | `{ from, to, fromPosition, toPosition }` for line rendering |

### Location object

```json
{
  "id": "cafe",
  "label": "Café",
  "zone": "social",
  "position": [-2.28, 0, 0],
  "mesh": "district_building",
  "scale": [2.38, 2.8, 2.38],
  "color": "#c97b3d",
  "emissive": "#f59e0b",
  "emissiveIntensity": 0.45,
  "command": "move cafe",
  "renderMode": "mesh3d",
  "modelUrl": "assets/models/locations/cafe.glb",
  "sceneTexture": "assets/locations/cafe.png",
  "footprint": [3.6, 2.4, 3.0],
  "buildingStyle": "cafe",
  "collision": {
    "shape": "box",
    "footprint": [3.6, 3.0],
    "halfExtents": [2.15, 1.85],
    "radius": 2.84,
    "currentLocationRadius": 0.85
  },
  "isPlayerHere": true,
  "walkAnchor": [-2.28, 0, 0],
  "interiorCamera": { "eye": [-2.28, 1.65, 4.5], "target": [-2.28, 1.4, 0] },
  "incidentActive": false,
  "agents": [{
    "id": "sara",
    "name": "Sara",
    "role": "café owner",
    "portrait": "assets/characters/sara/portrait.png",
    "figureTexture": "assets/characters/sara/portrait.png",
    "fullBodyTexture": "assets/characters/sara/fullbody.png",
    "modelUrl": "assets/models/characters/humanoid.glb",
    "renderMode": "mesh3d",
    "idleAnimation": "bob",
    "position": [-1.5, 0.9, 3],
    "commands": { "talk": "talk sara", "ask": "ask sara delivery", "pay": "pay sara 5", "leno": "ask_leno" }
  }]
}
```

`idleAnimation` is `'bob'` or `'turn'` (alternating by agent index). `sceneTexture` prefers content-pack location asset, else `sceneTexturePathForLocation(id)`.

### Interior object

Same hotspot commands as `gameShell.location.hotspots`, flattened for 2D overlay clients:

```json
"interior": {
  "locationId": "cafe",
  "label": "Café",
  "sceneTexture": "assets/locations/cafe.png",
  "hotspots": [{ "id": "cafe_delivery_crate", "label": "Delivery crate", "command": "inspect cafe", "risk": 1, "preview": "..." }]
}
```

### World hotspot object

```json
{ "id": "cafe_delivery_crate", "label": "Delivery crate", "command": "inspect cafe", "risk": 1, "icon": null, "position": [0.8, 0.75, 2.1] }
```

### Minimal boot example

```json
"visualCues": {
  "kind": "worldmind_3d_visual_cues",
  "version": 4,
  "playerLocationId": "cafe",
  "interior": { "locationId": "cafe", "label": "Café", "sceneTexture": "assets/locations/cafe.png", "hotspots": [] },
  "walkGraph": {
    "nodes": { "cafe": { "walkAnchor": [0, 0, 0], "position": [0, 0, 0] } },
    "edges": [{ "from": "cafe", "to": "market" }]
  },
  "player": { "position": [0, 0.1, 0], "locationId": "cafe" },
  "camera": { "target": [0, 1.5, 0], "distance": 16, "minDistance": 4, "maxDistance": 32, "polarAngle": 0.55, "walkEye": [0, 1.65, 4.5], "walkTarget": [0, 1.4, 0] },
  "environment": { "fogColor": "#0a0e14", "fogNear": 18, "fogFar": 42, "groundColor": "#0d1117", "gridColor": "#1f2937", "ambientIntensity": 0.55, "sunIntensity": 1.1 },
  "locations": [],
  "hotspots": [],
  "edges": [{ "from": "cafe", "to": "market", "fromPosition": [0,0,0], "toPosition": [3,0,2] }]
}
```

### `walkAnimation` on move

Built by `buildWalkAnimation()` in `src/play/walk-path.js`. Successful `POST /api/command` with `move <location>` includes `result.walkAnimation` when the player changes district (`null` for same-location moves or failed moves).

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `'worldmind_walk_animation'` | Discriminator |
| `version` | `1` | |
| `from` / `to` | string | Location ids |
| `path` | `string[]` | BFS node ids over `walkGraph.edges` |
| `waypoints` | `number[][]` | `[x, y, z][]` with arc segments (Y ≈ 0.1 + arc) |
| `durationMs` | number | 400–8000, distance × 320 ms/unit |
| `camera` | `{ eye: number[], target: number[] }` | Final follow camera behind destination |

```json
"walkAnimation": {
  "kind": "worldmind_walk_animation",
  "version": 1,
  "from": "cafe",
  "to": "market",
  "path": ["cafe", "market"],
  "waypoints": [[0, 0.1, 0], [0.5, 0.3, 0.4]],
  "durationMs": 640,
  "camera": { "eye": [0, 1.65, -4], "target": [0, 1.4, 0] }
}
```

**Client contract:** animate locally from `waypoints`, then apply refreshed `visualCues` from `GET /api/state`. Optional legacy fields (`cameraWaypoints`, `lookAt`) are client-side derivations only — server emits `camera` at destination.

Clients: `static-play/3d-client.js`, worldmind-site `/play/3d`. TypeScript types in `worldmind-site/src/lib/play-api.ts`. See `docs/62_3D_PLAY_CLIENT_V1.md`.

## Verification

`npm run validate:play-api` (`src/cli/validate-play-api.js`) asserts:

- `GET /api/health` → `apiVersion` matches `PLAY_API_VERSION`
- `GET /api/state` → `gameShell` (location, npcCards, caseBoard, founder.tierLabel), `playerSnapshot`, `districtView`
- `visualCues` v4 — `walkGraph` (≥4 nodes, ≥3 edges), `interior.locationId`, `interior.hotspots`, world `hotspots`
- `visualCues` mesh3d (v39+) — `renderMode: mesh3d`, `modelUrl` on locations/agents/player when GLB baked
- `visualCues` collision (v40+) — `footprint`, `buildingStyle`, `collision.halfExtents` + `radius` on every location
- Redaction — no `hiddenCause`, agent secrets, or unguarded Nadia source phrase
- `POST /api/command` move → `result.walkAnimation` with ≥2 waypoints, `durationMs` ≥ 400

```bash
npm run validate:play-api
WORLDMIND_CORE_URL=https://core.example.com npm run verify:production-play
npm run play:server -- --port 8080
curl -s http://127.0.0.1:8080/api/state | jq .visualCues.version
```

## Related docs

- `docs/59_VISUAL_GAMEPLAY_SHELL_V1.md` — web UI layout (visual branch)
- `docs/47_SAVE_BROWSER_BRANCH_RESTORE.md` — saves/branches/diff
- `docs/60_WORLDMIND_SITE_PLAY_BRIDGE.md` — site implementation checklist
