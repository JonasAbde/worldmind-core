# 62 — 3D Play Client v1

> **Track:** `master` (core) + `main` (site)  
> **PR #3 deleted** — full 3D built on default branches, Play API as single source of truth.

## What shipped in v1

### Core (`worldmind-core`)

| Piece | Purpose |
|-------|---------|
| `src/play/district-3d-layout.js` | `build3DVisualCues(world)` — district buildings, agents, hotspots, camera, **visualCues v4** |
| `src/play/walk-path.js` | BFS over `walkGraph`, arc waypoints, `buildWalkAnimation()` for move commands |
| `src/play/play-api-verify.js` | Shared assertions (`assertVisualCuesV4`, `assertWalkAnimation`) |
| `GET /api/state` → `visualCues` | Boot payload for any 3D client (version **4**) |
| `POST /api/command` move → `walkAnimation` | Client-ready path + follow camera on successful district travel |
| `static-play/3d.html` + `3d-client.js` | Standalone Three.js client (CDN, no core npm deps) |
| `src/cli/validate-play-api.js` | Spins play-server; checks health, state, visualCues v4, move + walkAnimation |
| `test/v28-play-3d-visual-cues.test.js` | visualCues v4 contract (walkGraph, interior, idleAnimation) |
| `test/v30-walk-animation.test.js` | Walk path + move payload |

### Site (`worldmind-site`)

| Piece | Purpose |
|-------|---------|
| `/play/3d` | React Three Fiber district — branded product 3D |
| `Play3DCanvas` + `LocationBuildings` | WebGL district; agent **idle bob/turn** from `agent.idleAnimation` |
| `InteriorOverlay` | 2D interior scene + hotspot commands from `visualCues.interior` |
| `DistrictWalkMap` | SVG **district mini-map** — route highlight + animated player dot during walk |
| `PlayBrandFrame` + `PlayBrandedHeader` | Vignette frame + topbar chrome (shared with `/play` 2D portal) |
| `ProgressionPanel` | Reads `gameShell.progression` overlay (md+ breakpoints) |
| `three` + `@react-three/fiber` + `@react-three/drei` | Rendering stack (site only) |

## Play flow (3D)

```txt
GET /api/health → GET /api/state (visualCues v4 + gameShell + districtView)
→ render district in WebGL (scene billboards, world hotspots, idle NPCs, player marker)
→ click building / agent / hotspot OR type command
→ POST /api/command
→ on move: animate result.walkAnimation.waypoints locally, then apply refreshed visualCues
→ optional (site): Enter location → InteriorOverlay from visualCues.interior
→ merge gameShell + consequenceBeat into HUD panels
```

**No simulation in browser.** Same rule as 2D.

## Movement model

WorldMind 3D movement is **simulation-first** and **click-to-travel** — not an FPS or third-person action game with local physics.

| Principle | Meaning |
|-----------|---------|
| **Command changes truth** | `POST /api/command` with `move <location>` updates authoritative world state in `play-engine` (player location, unlocked hotspots, shell panels). The client does not predict or commit travel locally. |
| **`walkAnimation` is presentation** | On success, the server returns a client-ready path + camera hint. The browser animates the player marker along that path; when animation completes, the client reconciles from a fresh `GET /api/state`. |
| **Click-to-travel, not WASD** | Player intent is expressed by clicking a building, agent, hotspot, or typing a move command — same as 2D `/play`. No continuous locomotion, sprint, or collision-driven avatar control. Pattern aligns with **Citizen Sleeper** (board/map as spatial metaphor) and **Kentucky Route Zero** (scene transitions with walk as glue). See `docs/63_3D_CLIENT_TECH_STACK_RESEARCH.md` § *Citizen Sleeper* and § *Kentucky Route Zero*. |
| **Third-person follow camera** | During travel, the camera follows behind the player anchor (offset from `walkAnimation.camera` or location `interiorCamera`). At rest, **OrbitControls** orbit a player/world anchor — inspect the diorama, not free-fly an FPS rig. Site v2 adds orbit/walk camera toggle; both modes stay anchored to district nodes, not arbitrary world coords. |
| **Path along `walkGraph`** | Routes are BFS over `visualCues.walkGraph.edges` between location nodes (`walk-path.js`). Waypoints arc through world space for visual polish; the graph is the logical path. Site `DistrictWalkMap` and core `3d-client.js` highlight the same edge sequence during animation. |

```txt
click target / move command
  → POST /api/command  (world state updates on server)
  → result.walkAnimation { path, waypoints, camera, durationMs }
  → client: disable orbit → lerp player along waypoints
  → on complete: GET /api/state → apply visualCues (authoritative layout)
```

**Explicit non-goals for v1–v2:** WASD/strafe movement, client-side navmesh, physics collisions, or camera detached from player anchor. Any future stack (Three.js, Babylon, Unity) must preserve this contract — see movement/camera checklist in `docs/63_3D_CLIENT_TECH_STACK_RESEARCH.md`.

## Walk animation

Successful `move <location>` returns `result.walkAnimation` (null when already at destination).

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `'worldmind_walk_animation'` | Discriminator |
| `version` | `1` | Bump when breaking |
| `from` / `to` | location id | District nodes |
| `path` | `string[]` | BFS route over `visualCues.walkGraph.edges` |
| `waypoints` | `[x,y,z][]` | World-space path with slight Y arc (`MS_PER_UNIT` 320 ms/unit, clamped 400–8000 ms) |
| `durationMs` | number | Scales with path distance |
| `camera` | `{ eye, target }` | Follow offset behind player at destination |

**Client flow:** disable orbit controls → lerp along `waypoints` → on complete, apply pending `visualCues` from a fresh `GET /api/state` (authoritative layout). Core `3d-client.js` and site `WalkPathAnimator` both follow this pattern.

Boot payload `visualCues.version` is **4** and adds `walkGraph: { nodes, edges }` for path preview. `walkGraph.nodes` is keyed by location id; each node has `walkAnchor` and `position`.

## Idle NPCs

Each agent under `visualCues.locations[].agents[]` includes:

| Field | Values | Client behaviour |
|-------|--------|------------------|
| `idleAnimation` | `'bob'` \| `'turn'` | Vertical bob for both; Y rotation for `'turn'` |
| `position` | `[x,y,z]` | World offset near parent location |
| `portrait` | asset path \| null | Optional billboard texture (site) |
| `commands` | `{ talk, ask, pay, leno }` | Pre-built command strings |

Alternating bob/turn is assigned by agent index in `district-3d-layout.js`. Clients tick idle meshes every frame (`3d-client.js` `tickIdleAgentAnimations`, site `LocationBuildings`).

## Interior overlay (site)

`visualCues.interior` describes the **player's current location** interior (not a separate simulation):

```json
{
  "locationId": "cafe",
  "label": "Café",
  "sceneTexture": "assets/locations/cafe.png",
  "hotspots": [{ "id": "cafe_delivery_crate", "label": "Delivery crate", "command": "inspect cafe", "risk": 1, "preview": "..." }]
}
```

Site `/play/3d` toggles **Enter location** → `InteriorOverlay` (2D scene image + hotspot buttons → `POST /api/command`). Core `3d-client.js` renders world-space hotspot meshes from `visualCues.hotspots` instead; both use the same commands.

Per-location `interiorCamera: { eye, target }` on `locations[]` feeds walk-mode camera defaults.

## District mini-map (site)

During an active walk, site shows `DistrictWalkMap` (compact SVG overlay, top-left):

- Nodes/edges from `districtView` (2D layout coords)
- Active route edges highlighted from `walkAnimation.path`
- Player dot interpolated along the node path via `walkProgress` (0–1)
- Read-only while walking (`disabled`); full map also on `/play` 2D portal sidebar

Requires `districtView` on state payload alongside `visualCues`.

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

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **v1** | District diorama, click-to-act, Play API wired | ✅ |
| **v1.1** | visualCues v4, scene billboards, walk animation, walkGraph, idle NPCs, player marker, world hotspots | ✅ |
| **v2** | Site interior overlay, district route mini-map, progression HUD, branded frame, walk/orbit camera toggle | ✅ (site) |
| **v3** | Full NPC animation rigs, 3D interior rooms, audio | Planned |
| **v4** | Seamless district traversal, day/night, persistent camera saves | Planned |

v1 is **playable 3D** (click, move with animation, talk, inspect, interior overlay on site) — not yet AAA open-world.

## Verification

```bash
npm test                    # includes v28, v30
npm run validate:play-api   # health + state + move/walkAnimation integration
npm run play:server
# open /3d.html or site /play/3d
```

See also `docs/PLAY_API_CONTRACT.md` for full `visualCues` and `gameShell` schemas, and `docs/63_3D_CLIENT_TECH_STACK_RESEARCH.md` for stack evolution, reference-game patterns, and movement/camera non-negotiables.
