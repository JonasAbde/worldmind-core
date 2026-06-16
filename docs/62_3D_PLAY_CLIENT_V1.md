# 62 — 3D Play Client v1

> **Track:** `master` (core) + `main` (site)  
> **PR #3 deleted** — full 3D built on default branches, Play API as single source of truth.

## What shipped in v1

### Core (`worldmind-core`)

| Piece | Purpose |
|-------|---------|
| `src/play/district-3d-layout.js` | `build3DVisualCues(world)` — district buildings, agents, hotspots, camera |
| `GET /api/state` → `visualCues` | Boot payload for any 3D client |
| `static-play/3d.html` + `3d-client.js` | Standalone Three.js client (CDN, no core npm deps) |
| `test/v28-play-3d-visual-cues.test.js` | Contract tests |

### Site (`worldmind-site`)

| Piece | Purpose |
|-------|---------|
| `/play/3d` | React Three Fiber district — branded product 3D |
| `three` + `@react-three/fiber` + `@react-three/drei` | Rendering stack (site only) |

## Play flow (3D)

```txt
GET /api/health → GET /api/state (visualCues + gameShell)
→ render district in WebGL
→ click building / agent / hotspot
→ POST /api/command
→ refresh visualCues + consequenceBeat
```

**No simulation in browser.** Same rule as 2D.

## Run locally

```bash
# Terminal 1 — core
WM_CORS_ORIGIN=http://localhost:5173 npm run play:server

# Terminal 2 — site
npm run dev
# http://localhost:5173/play/3d

# Or core-only Three.js:
# http://127.0.0.1:8080/3d.html
```

## Roadmap to *full* 3D (not diorama)

| Phase | Deliverable |
|-------|-------------|
| **v1** ✅ | District diorama, click-to-act, Play API wired |
| **v2** | First-person / walk mode, interior scenes per location |
| **v3** | Animated NPCs, scene art on building faces, audio |
| **v4** | Full district traversal, day/night, persistent camera saves |

v1 is **playable 3D** (click, move, talk, inspect) — not yet AAA open-world.

## Verification

```bash
npm test                    # includes v28
npm run play:server
# open /3d.html or site /play/3d
```
