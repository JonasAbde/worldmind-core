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
| `topbar` | day, time, money, lenoStatus |
| `location` | `id`, `scene` (asset path), `hotspots[]` |
| `npcCards[]` | id, name, role, avatar, trust/suspicion/fear, `actions[]` |
| `caseBoard` | evidenceCards, rumorCards, links, unresolvedQuestions |
| `rumorTrail[]` | id, spreadRisk, traceCommand, counterCommand |
| `founder` | unlocked, contracts, activeContract, unlockText |
| `majorDecisions[]` | id, label, command, branchSuggested |

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

Visual shell branch adds `description`, `possibleEvidence[]`, `icon`.

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

## Future: `visualCues` (post-v1.0)

Reserved extension on `gameShell` for 3D/Babylon clients:

```json
"visualCues": {
  "entities": [{ "id": "cafe_delivery_crate", "mesh": "...", "position": [0,0,0] }]
}
```

Not implemented in v1.0.0 — contract slot only.

## Verification

```bash
npm run validate:play-api
npm run play:server -- --port 8080
curl -s http://127.0.0.1:8080/api/state | jq .gameShell.location
```

## Related docs

- `docs/59_VISUAL_GAMEPLAY_SHELL_V1.md` — web UI layout (visual branch)
- `docs/47_SAVE_BROWSER_BRANCH_RESTORE.md` — saves/branches/diff
- `docs/60_WORLDMIND_SITE_PLAY_BRIDGE.md` — site implementation checklist
