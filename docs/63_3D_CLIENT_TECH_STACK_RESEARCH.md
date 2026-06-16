# 63 — 3D Client Tech Stack Research

> **Status:** Research / decision support  
> **Audience:** Core + site + art leads  
> **Related:** `docs/62_3D_PLAY_CLIENT_V1.md`, `docs/PLAY_API_CONTRACT.md`, `docs/52_FULL_FEATURED_GAMEPLAY_EXPANSION_PLAN.md`, `AGENTS.md`

## Formål

Compare realistic 3D client options for WorldMind without moving simulation into the browser. Recommend a phased path from today's **Play API–driven Three.js shell** toward richer presentation while preserving **simulation-first architecture**, **dependency-light core**, and **cozy Nordic cyberpunk** identity.

## Executive summary

| Recommendation | Rationale |
|----------------|-----------|
| **Now (v1–v2):** Stay on **Three.js** (static CDN client + site R3F) | Already wired to `visualCues` v4 + `walkAnimation`; zero core deps; fastest iteration on investigation UI hybrid |
| **Next (v3):** Evaluate **Babylon.js** *or* **Unity WebGL export** if art needs PBR interiors, rigged NPCs, or authored district meshes | Both can remain thin Play API clients; Babylon keeps one web stack; Unity helps if art pipeline is DCC → engine |
| **Optional endgame slice:** **UE5 Pixel Streaming or native** for one **cinematic district** (harbour, Registry plaza) | Marketing / founder demo / trailer district — not the authoritative gameplay loop |
| **Avoid for primary client:** Godot as main stack unless team pivots to Godot-first; Unreal/native as *default* client | Ops cost, build size, and split-brain risk vs Node simulation core |

**North star:** The browser shell is a **renderer + input surface**. Truth stays in `play-engine`, Event Log, and `POST /api/command`.

---

## Arkitektur-krav (non-negotiables)

From `AGENTS.md` and `docs/PLAY_API_CONTRACT.md`:

1. **Simulation core før 3D** — no duplicate rules in client.
2. **Play API is the contract** — `GET /api/state` (`gameShell`, `visualCues`, `districtView`) + `POST /api/command` (`walkAnimation`, refreshed shell).
3. **Clients are dumb renderers** — animate locally, then reconcile from server state.
4. **Core stays dependency-light** — npm deps for 3D live in site/static client only unless there is strong reason.
5. **Redaction & Leno gates** — never leak `hiddenCause`; UI text follows evidence rules.
6. **Hybrid 2D/3D is a feature** — investigation loops (hotspots, case board, dialogue) may stay 2D overlays forever.

Any stack that tempts "just run a bit of quest logic in the client" is a **migration away from**, not toward, WorldMind.

---

## Nuværende baseline (Three.js v1)

| Layer | Stack | Role |
|-------|-------|------|
| Core | `district-3d-layout.js`, `walk-path.js` | Emits `visualCues` v4, `walkAnimation` |
| Static client | `static-play/3d-client.js` + Three.js CDN | Reference implementation, no npm |
| Site | `/play/3d` — R3F + drei | Branded product 3D + `InteriorOverlay` + `DistrictWalkMap` |
| 2D shell | `gameShell` panels | Case board, Leno, progression, hotspots |

**What works:** district diorama, click-to-act, walk path animation, idle NPC bob/turn, interior overlay pattern, validate-play-api gates.

**What v3+ needs:** rigged NPCs, 3D interior rooms, audio cues, day/night, seamless traversal — art-weighted, not simulation-weighted.

---

## Sammenligning: teknologistakke

Scoring key: **●** strong · **◐** workable · **○** weak for WorldMind's current constraints.

### 1. Three.js (current — R3F + static client)

| Dimension | Assessment |
|-----------|------------|
| **Simulation-first fit** | **●** Thin client already proven; `visualCues` maps cleanly to meshes, billboards, lines, fog |
| **Play API contract** | **●** Boot + command flow implemented; `WalkPathAnimator` pattern is the template for all stacks |
| **Cozy Nordic cyberpunk** | **◐** Stylized diorama + 2D scene textures fit art direction (`docs/20_*`); AAA lighting needs custom work |
| **Team velocity** | **●** Same repo patterns as site; minimal toolchain; agents can edit JS directly |
| **Web vs native** | **●** Web-first; static shell needs no build step |
| **When to migrate away** | When art demands engine editor workflow, skeletal animation tooling, or heavy PBR/scene authoring at scale |

**Pros:** Already shipped (doc 62); smallest diff from 2D shell; easy hybrid (R3F district + HTML/React overlays); core remains Node-only.

**Cons:** No built-in editor; animation/rigging is manual or glTF-pipeline heavy; material/lighting quality ceiling without dedicated tech art.

**Verdict:** **Correct default for v1–v2.** Extend before replacing.

---

### 2. Babylon.js / PlayCanvas

#### Babylon.js

| Dimension | Assessment |
|-----------|------------|
| **Simulation-first fit** | **●** Same thin-client model as Three; scene graph driven from `visualCues` |
| **Play API contract** | **●** JSON-in → scene-out; `@babylonjs/loaders` for glTF districts |
| **Cozy Nordic cyberpunk** | **◐** Strong PBR + IBL + post-process; good for wet harbour nights, neon emissive signage |
| **Team velocity** | **◐** Steeper API than Three; excellent docs; optional **Babylon Editor** for artists |
| **Web vs native** | **●** Web primary; Native/XR paths exist if ever needed |
| **When to migrate** | v3 if interiors need proper 3D rooms + character rigs + one web codebase |

**Pros:** Built-in animation groups, morph targets, physics optional, inspector/debug tools, progressive mesh loading.

**Cons:** New dependency surface; team rewrites R3F components; still not a full game editor like Unity.

#### PlayCanvas

| Dimension | Assessment |
|-----------|------------|
| **Simulation-first fit** | **◐** Cloud editor + runtime; still can be API-driven with discipline |
| **Play API contract** | **◐** Feasible but editor-centric workflows may fight "server authoritative" culture |
| **Cozy Nordic cyberpunk** | **◐** Capable PBR web renderer |
| **Team velocity** | **◐** Fast for artist-led scenes; slower for programmer-first Node team |
| **Web vs native** | **●** Web-first |
| **When to migrate** | If art team owns scene layout in browser editor and exports static bundles consumed by Play API loader |

**Pros:** Collaborative scene editing in browser; good for branded district blockout.

**Cons:** SaaS/hosting angle; less common in indie narrative tooling; risk of logic creep in editor scripts.

**Verdict:** **Babylon.js > PlayCanvas** for WorldMind unless art pipeline explicitly wants PlayCanvas Editor. Babylon is the best **single-web-stack upgrade** from Three.js.

---

### 3. Unity WebGL

| Dimension | Assessment |
|-----------|------------|
| **Simulation-first fit** | **◐** Achievable via strict "Unity = view only" — but Unity tempts C# gameplay scripts |
| **Play API contract** | **◐** `UnityWebRequest` + JSON; must ban local quest state; use same reconcile-after-command pattern |
| **Cozy Nordic cyberpunk** | **●** URP stylized lit, Shader Graph, Timeline for ambient district moments |
| **Team velocity** | **◐** High once artists onboard; split repo (core Node + Unity client); WebGL build/debug friction |
| **Web vs native** | **◐** WebGL builds are large (10–50+ MB), memory-hungry; **native/desktop/mobile** often better Unity target |
| **When to migrate** | v3–v4 when NPC rigs, interior blockouts, and lighting are authored in Unity; or ship **desktop founder demo** alongside web 2D/3D shell |

**Pros:** Mature animation, Timeline, audio, asset store; strong hiring pool; can export WebGL *or* standalone.

**Cons:** WebGL performance and load time; two languages; IL2CPP/build CI; easy to violate "no sim in client" without governance.

**Verdict:** **Best if art outgrows web-native tooling** and team accepts dual-repo workflow. Prefer **desktop Unity companion** over WebGL Unity unless web-only is mandatory.

---

### 4. Unreal Engine — Pixel Streaming / native

#### Pixel Streaming (Web)

| Dimension | Assessment |
|-----------|------------|
| **Simulation-first fit** | **○** GPU farm streams video; input latency; overkill for command-driven investigation |
| **Play API contract** | **◐** UE talks HTTP from C++ / Blueprint — doable, awkward for JSON-first indie team |
| **Cozy Nordic cyberpunk** | **●** Best-in-class mood, rain, neon, volumetric fog for **hero shots** |
| **Team velocity** | **○** Infra (GPU servers, signaling, TURN/STUN), cost, ops |
| **Web vs native** | **◐** "Web" via stream tab; not a lightweight page |
| **When to migrate** | **Never as primary client.** Optional **marketing district** or expo kiosk |

#### Native Unreal

| Dimension | Assessment |
|-----------|------------|
| **Simulation-first fit** | **◐** Same thin-client possible; Epic sample projects often embed gameplay locally |
| **Play API contract** | **◐** HTTP plugin or embedded Node sidecar — architectural mismatch with dependency-light core |
| **Cozy Nordic cyberpunk** | **●** Cinematic endgame quality |
| **Team velocity** | **○** Heavy toolchain; C++ / Blueprint; long iteration for narrative UI-heavy game |
| **Web vs native** | **●** Native only (practically) |
| **When to migrate** | Spin-out **"WorldMind: Harbour Walk"** cinematic experience — not MVP |

**Verdict:** **Optional UE5 slice** for one district (harbour, Registry) for trailer/founder pitch. **Do not** wire UE as the authoritative play client for simulation-first MVP.

---

### 5. Godot 4

| Dimension | Assessment |
|-----------|------------|
| **Simulation-first fit** | **◐** GDScript scenes can stay presentational; discipline required |
| **Play API contract** | **◐** `HTTPRequest` + JSON; export to web (WASM) |
| **Cozy Nordic cyberpunk** | **◐** Good 2D/3D hybrid; stylized shaders; smaller than UE |
| **Team velocity** | **◐** Friendly indie editor; **new stack** for current Node+React team |
| **Web vs native** | **◐** HTML5 export improving but behind Three/Babylon polish for complex 3D |
| **When to migrate** | If team **rebases** on Godot as primary game client and treats core as headless server only |

**Pros:** Lightweight, open source, scene-based (see KRZ patterns below), great 2D+3D mix.

**Cons:** Another runtime; web export not the main Godot strength; splits focus from existing R3F investment.

**Verdict:** **Viable for a greenfield client**, not the cheapest path from today's Three.js v1. Consider only if hiring Godot-first developers or open-sourcing a moddable client.

---

## Reference patterns (investigation-forward games)

### Disco Elysium — 2D/3D hybrid investigation

| Pattern | Lesson for WorldMind |
|---------|----------------------|
| Isometric **world map** + **interior paintings** + dialogue UI | Matches `visualCues` district + `interior.sceneTexture` + `gameShell` panels |
| Skill checks & thought cabinet as **UI systems**, not world physics | Leno, case board, progression belong in overlay shell — not engine gameplay code |
| Click world → trigger authored interaction | Same as hotspot/command model; 3D district is navigational theatre |

**WorldMind mapping:** v1–v2 **should not** chase full 3D interiors. Keep **diorama + 2D interior overlay** until art lock proves otherwise.

---

### Citizen Sleeper — UI + world board

| Pattern | Lesson for WorldMind |
|---------|----------------------|
| **Board/map** as primary spatial metaphor | `districtView` SVG mini-map + 3D diorama are dual representations of same graph |
| **Dice/skills** as UI consequence surface | Consequence ticker, relationship deltas, progression — `gameShell` + `consequenceBeat` |
| Text-forward but **spatially anchored** | Commands tie to locations/agents; 3D reinforces place without simulating physics |

**WorldMind mapping:** Double down on **district graph clarity** (walkGraph, route highlight) and **companion UI** (Leno). 3D is optional richness, not the loop.

---

### Kentucky Route Zero — scene-based narrative

| Pattern | Lesson for WorldMind |
|---------|----------------------|
| **Scenes** as authored beats, not open world | District locations = scenes; `move` = scene transition with walk animation as glue |
| Strong art direction over mechanical depth | Nordic cyberpunk identity via lighting, color tokens (`environment` in visualCues), faction palettes |
| Minimal interaction surface per beat | Hotspots + NPC cards + major decision modal align with scene beats |

**WorldMind mapping:** Author **scene beats** in content pack; client swaps atmosphere (fog, emissive) per location zone — already partially in `visualCues.environment` and location colors.

---

## Evolution: v1 → v2 → endgame

### v1 — Playable diorama (shipped)

```txt
Play API → visualCues v4 → Three.js district
         → gameShell → 2D investigation UI (site/static)
         → POST /api/command → walkAnimation + shell refresh
```

**Focus:** Click-to-act, move animation, idle NPCs, interior overlay (site), case board/rumor/Leno in frame.

---

### v2 — Full investigation shell in 3D context (current site trajectory)

```txt
3D district (orbit/walk camera toggle)
+ branded frame (topbar, progression HUD)
+ interior overlay (2D hotspots)
+ district mini-map during walk
+ audio cues (walk, inspect, rumor, consequence)
+ deeper gameShell binding (NPC drawer, branch modal)
```

**Stack:** Three.js / R3F unchanged.  
**Risk to avoid:** Duplicating hotspot visibility rules client-side — server/content pack remains authoritative.

---

### v3 — Embodied district (planned)

| Deliverable | Stack note |
|-------------|------------|
| Rigged NPC idle/gesture sets | glTF + Three **or** migrate district renderer to Babylon |
| 3D interior rooms (low-poly) | Authored meshes; `interior` expands with room bounds + interactable anchors |
| Audio spatialization (optional) | Web Audio; cues from `audio-cues.js` pattern |
| Day/night from world tick | Client lerps `environment` from API fields — no local time sim |

**Decision gate:** Stay Three.js if ≤5 rigged agents and ≤5 interiors; **pilot Babylon** if PBR + animation blending exceeds Three ergonomics.

---

### v4 — Seamless district presence

| Deliverable | Stack note |
|-------------|------------|
| Continuous walk (no hard scene cut) | Longer waypoint paths; streaming district chunks |
| Persistent camera / accessibility prefs | Client localStorage only — not simulation state |
| Faction district variants | Extra `visualCues` layers from world flags |

**Optional Unity branch:** Desktop "founder edition" with richer harbour slice, still calling Play API.

---

### Endgame — Cinematic Nordic cyberpunk district (optional SKU)

```txt
Headless WorldMind core (Node) — same Event Log, saves, branches
├── Web client (Three/Babylon) — full investigation game
├── Mobile shell (future) — lightweight 2D + map
└── UE5 harbour cinematic — Pixel Stream or native, read-only promenade
    └── Commands via Play API or scripted camera rails for trailer only
```

Simulation remains **one core**. Cinematic district is **content marketing + emotional peak**, not second gameplay truth.

---

## Web vs native — decision matrix

| Factor | Web (Three/Babylon) | Unity WebGL | Unity native | UE Pixel Stream |
|--------|---------------------|-------------|--------------|-----------------|
| Link/share play URL | **●** | **◐** | ○ | **◐** |
| Aligns with site `/play` | **●** | **◐** | ○ | ○ |
| Load time | **●** | ○ | **●** | ○ |
| Investigation UI (DOM/React) | **●** | ○ | ○ | ○ |
| GPU cost to operator | **●** | **●** | **●** | ○ |
| Best graphics ceiling | **◐** | **◐** | **●** | **●** |

**Recommendation:** **Web primary** for MVP and founder demo. **Native Unity** only when targeting Steam/desktop retention. **UE stream** only for flagship visual moments with budget.

---

## Play API compatibility checklist (any new client)

Before adopting a stack, verify:

- [ ] Boots from `GET /api/state` only — no embedded world secrets
- [ ] All actions via `POST /api/command` — no client-side inspect/talk validation
- [ ] After move: play `walkAnimation`, then refresh `visualCues` from server
- [ ] Hotspots/interior commands match `gameShell` / `visualCues.interior`
- [ ] Leno/redaction UI uses same evidence gates as 2D shell
- [ ] `npm run validate:play-api` passes against core with client ignored (contract stays in core)
- [ ] CI does not require proprietary editor headless (prefer glTF + JSON driven scenes)

---

## Anbefalet phased roadmap

### Phase 0 — Now → 6 months (keep Three.js)

| Action | Owner |
|--------|-------|
| Complete v2 site shell (audio, NPC drawer, branch UX in 3D frame) | Site |
| Extend `visualCues` only via core (`district-3d-layout.js`) — version bumps documented | Core |
| Art: glTF building variants, emissive signage, portrait billboards | Art |
| Spike: one rigged NPC in R3F from glTF | Site |

**Exit criteria:** Founder demo playable entirely in browser; validate-play-api green; investigation loop visible without typing commands.

---

### Phase 1 — 6–12 months (enrich or migrate renderer)

| Track A (default) | Track B (if art blocked) |
|-------------------|---------------------------|
| Stay Three.js + glTF pipeline + custom shaders for Nordic rain/neon | Pilot **Babylon.js** district renderer behind feature flag `/play/3d-babylon` |
| Add 3D interior prefabs | Same Play API loader code, different engine |

**Decision input:** rig count, interior count, frame time on mid-tier laptops, artist toolchain preference.

**Do not:** Add Unity yet unless WebGL spike fails perf budget *and* desktop ship is planned.

---

### Phase 2 — 12–18 months (optional Unity desktop)

| Action | Notes |
|--------|-------|
| Unity URP project: district + 3 interiors | C# HTTP client only; zero local quest state |
| Ship **desktop founder build** | Web remains canonical for sharing |
| Shared glTF/addressables from same art source | |

---

### Phase 3 — Endgame optional (UE5 cinematic district)

| Action | Notes |
|--------|-------|
| One harbour/Registry hero environment | Scripted camera + Pixel Stream **or** native walkabout |
| Read-only or limited command set | Promotional / expo / trailer capture |
| Hard separation from save/branches unless explicitly synced via Play API | |

---

## Migration triggers (when to leave Three.js)

| Signal | Response |
|--------|----------|
| >8 rigged agents with stateful gestures | Evaluate Babylon animation or Unity |
| Interiors need walkable collision + furniture density | 3D room meshes; Babylon/Unity authoring |
| WebGL frame time >16ms on target laptop with current art | Optimize Three **first**; then Babylon |
| Art team blocked without visual editor | Babylon Editor or Unity, not more JS layout code |
| Marketing needs broadcast-quality district | UE5 slice — **additive**, not replacement |
| Team doubles with Unity specialists | Unity desktop client becomes realistic |

**Anti-triggers (do not migrate for):**

- "We want AAA" without art assets or perf data
- Multiplayer (doc 22 — later)
- Putting Leno inference client-side
- Duplicating economy/rumor rules for "snappier" feel

---

## Risici ved forkert valg

| Risk | Three stay too long | Unity/UE too early |
|------|---------------------|---------------------|
| Art ceiling | Stylized plateau | — |
| Ops / CI | Low | High |
| Simulation split-brain | Low | **High** if gameplay creeps into C#/BP |
| Founder demo link-in-browser | **Preserved** | WebGL Unity or stream cost |
| Agent/automation velocity | **High** | Lower until toolchain mature |

---

## Konklusion

WorldMind's competitive edge is **simulation-first investigation** with **evidence-gated Leno**, not renderer fidelity. The v1 Three.js + Play API split is architecturally correct.

**Recommended path:**

1. **Browser Three.js shell now** — finish v2 investigation UX in branded 3D frame.  
2. **Richer Babylon or Unity export later** — when rigged interiors and art pipeline demand it; Play API unchanged.  
3. **UE5 cinematic district optional** — emotional peak for Nordic cyberpunk fantasy, not the canonical game loop.

Preserve the Disco/Citizen Sleeper/KRZ pattern: **spatial layer + heavy UI intelligence**, scene transitions, and server-authoritative commands. Fidelity scales; architecture should not pivot.

---

## Appendix — doc cross-links

| Doc | Relevance |
|-----|-----------|
| `docs/62_3D_PLAY_CLIENT_V1.md` | Shipped v1 scope and roadmap table |
| `docs/PLAY_API_CONTRACT.md` | `visualCues`, `walkAnimation`, `gameShell` schemas |
| `docs/52_FULL_FEATURED_GAMEPLAY_EXPANSION_PLAN.md` | Investigation loop pillars |
| `docs/59_VISUAL_GAMEPLAY_SHELL_V1.md` | 2D shell layout to mirror in 3D frame |
| `docs/20_VISUAL_ART_DIRECTION_MOODBOARD.md` | Cozy Nordic cyberpunk keywords |
| `AGENTS.md` | Simulation-first principles |

## Appendix — suggested spikes (no commitment)

| Spike | Timebox | Success metric |
|-------|---------|----------------|
| Babylon district loads same `visualCues` JSON | 2–3 days | Parity with `/play/3d` camera + walk |
| Unity WebGL POST command + shell refresh | 3–5 days | One inspect + one move without local state |
| UE5 Pixel Stream district idle flythrough | 1 week | Trailer clip; not gameplay |

Spikes should live in branches; core contract changes only when schema genuinely needs extension.
