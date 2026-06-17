# 61 — WorldMind v1.0+ Roadmap

> Single source of truth for what we're shipping next. Supersedes the
> older `docs/26_ROADMAP.md` and `docs/55_V1_0_RELEASE_CHECKLIST.md`.

## Current state (2026-06-17)

- **Master HEAD:** `831efcb` (v1.0-rc15) — Leno's procedural GLB pipeline
- **Codex HEAD:** `81845d5` (v1.0-rc.1) — gameplay shell + 3D client + investigation loop
- **Tests:** 457/457 grønne
- **ci:gate:** 25 steps alle grønne
- **Episodes playable:** 3 (the-missing-delivery, noise-along-the-quay, ownership-dispute)
- **Content shipped:** 9 resolution paths, 7 evidence, 5 dialogue, 3 rumors, 7 quests
- **Assets:** 17 procedural GLB'er (5 locations + 11 NPCs + humanoid fallback)

## v1.0 Release Pillars

For WorldMind v1.0 to ship, we need four pillars:

1. **Visual polish** — make the 3D world feel premium (not flat-shaded placeholders)
2. **Gameplay depth** — every action feels consequential; every NPC feels alive
3. **Authorability** — content designers can ship episodes without touching code
4. **Ship-ready infra** — release verification, deploy, monitoring

## Sprint sequence (rc16 → v1.0)

### rc16 — Premium visuals layer 1: Materials + Textures (1 sprint)
**Goal:** Move from flat vertex-color to PBR textures. The procedural GLB
pipeline generates geometry; this sprint adds the surface quality.

**Tasks:**
- Investigate pygltflib for direct GLB assembly (bypassing trimesh's
  material-deduplication limitation that deferred per-mesh materials in rc15).
- Generate procedural textures with Pillow:
  - Brick, wood, concrete, metal noise textures per location material
  - Fabric/weave textures for NPC uniforms
  - Neon-glow gradients for signs and signage
- Build `tools/build-textures.py` that produces `assets/textures/*.webp` from
  the JSON spec library (matching material IDs to texture files).
- Wire `src/play/location-model-assets.js` + `character-model-assets.js` to
  attach textures to GLBs (PBR metallicRoughness + baseColor + normal).
- Extend `validate-assets.js` to assert each location has a normal map.
- New `validate:visual-pipeline` CI gate step.

**Done when:** Each GLB has at least one baseColor + normal texture,
verified via `npm run assets:validate` and visible in browser-QA.

---

### rc17 — Premium visuals layer 2: Animation + Post-process (1 sprint)
**Goal:** NPCs feel alive (animation), world feels atmospheric (post-process).

**Tasks:**
- **Animation tracks:** Add 4 animation tracks to humanoid GLB + per-NPC variants:
  - `idle` (subtle breathing + blink, 2s loop)
  - `talk` (jaw + head micro-movements, 1.5s loop)
  - `examine` (lean forward, 1s)
  - `walk` (4-frame walk cycle, 0.8s loop)
- **Atmosphere particles:** rain particle system + fog (cold exterior) +
  warm interior haze + neon-bloom post-process pass.
- **Color grading:** film LUT (cool teal exterior, warm amber interior).
- **Outline pass:** subtle NPR outline on player + NPCs.
- Browser-side `static-play/3d-client.js` updates: load animations, drive
  per-NPC state machine (idle ↔ talk ↔ walk).
- `audit:visual-quality` CLI that screenshots and reports metrics.

**Done when:** Browser-QA shows animated NPCs + visible rain/fog.

---

### rc18 — Gameplay depth: Founder contracts + Resolution paths end-to-end (2 sprints)
**Goal:** Every authored resolution path is reachable + has consequences.

**Tasks:**
- **Path 1: Wire 9 authored resolution paths into runtime.** Right now only
  3 paths (`peaceful_mediation`, `investigation_and_counter_rumor`,
  `founder_negotiation`) are runnable via `runScriptedPath`. Add 6 more
  (`community_arbitration`, `community_repair`, `executive_leverage`,
  `policy_pressure`, `quiet_investigation`, `silent_investigation`).
- **Path 2: Founder contract loop.** 7 contracts in `content/contracts/`
  (currently empty directory). Create 7 contract specs with triggers,
  costs, rewards, and required evidence.
- **Path 3: Consequence beats.** Each contract produces a `consequence_beat`
  event that ripples through the simulation (trust deltas, faction
  reputation, economy shifts).
- New `validate:resolution-paths` gate step that runs each path end-to-end
  and asserts it terminates cleanly.

**Done when:** `npm run demo:play` runs all 9 paths and each produces a
saved snapshot with valid resolutionState.

---

### rc19 — Multi-episode content (1 sprint)
**Goal:** Episodes 2 + 3 (`noise-along-the-quay`, `ownership-dispute`) have
playable resolution paths and unique NPCs (omar, freja, elias, yasin,
lina) have substantive dialogue.

**Tasks:**
- Author 3 new resolution paths per non-canonical episode (6 new paths
  total).
- Create unique dialogue trees for episode-2 and episode-3 core NPCs.
- Per-episode content packs in `content/episodes/<id>/` with episode.json
  already authored; ensure steps/outcomes are populated.
- `validate:per-episode-content` CLI that runs each episode end-to-end.

**Done when:** All 3 episodes have playable, demo-able paths.

---

### rc20 — Authorability: Browser authoring panel (2 sprints)
**Goal:** Designers can edit episodes + NPC dialogue without code edits.

**Tasks:**
- **Sprint A:** Lightweight in-browser authoring panel at `/author`. Read
  `content/worldmind/content-pack-v1.json` from disk via `/api/content`,
  render JSON-editor view, save via POST `/api/content` (validates against
  the JSON Schema from rc12).
- **Sprint B:** Live preview. Authoring edits are reflected in the running
  simulation without restart (hot-reload). Designer can switch episode
  and see their changes immediately.
- Auth gate (single shared password for now; full per-designer permissions
  is post-v1).

**Done when:** A designer can create a new episode end-to-end without
touching code or restarting the server.

---

### rc21 — Ship-ready infra (1 sprint)
**Goal:** Production deploy pipeline is fully verified.

**Tasks:**
- `npm run release:verify` extended to include all rc16-rc20 gates.
- Smoke-test deploy to `worldmind.tekup.dk` via Worker proxy.
- Browser-QA against production URL.
- `audit:worldmind` extended to check for runtime secret leakage in
  static-play payload (defense-in-depth).
- Update `README.md` + `docs/54_INSTALL_AND_RUN_GUIDE.md` with rc20+
  authoring instructions.

**Done when:** Production URL serves all 3 episodes + authoring panel,
no audit warnings, install guide tested fresh.

---

### v1.0.0 — Tag the release (1 day)
- Tag `831efcb...rc21` as `v1.0.0`
- Release notes (changelog + credits)
- Announce

## Parallelizable side-quests (if sprint time allows)

- **rc22 — Mobile-first read-only viewer.** React Native app that reads
  state.json. No editing. Just for sharing demo builds with stakeholders.
- **rc23 — Replay system.** Record every decision in a run, then play it
  back as a "story so far" recap. Useful for onboarding new players.
- **rc24 — Multiplayer (out of v1.0 per current AGENTS.md).** WebSocket
  co-op for 2 players on same scenario.

## Non-goals (still)

- Real-world connectors (per AGENTS.md principle 10)
- Marketplace for content packs
- Mobile-native editing (read-only viewer OK, but editing is desktop)

## Risks

| Risk | Mitigation |
|------|-----------|
| Per-mesh material pipeline (rc16) hits trimesh limitations | Fall back to direct pygltflib assembly; documented in rc15 |
| Animation tracks add 30-50% to GLB size | Draco compression in rc22+ |
| Authoring panel introduces write API (security risk) | Auth gate + audit; never accept anonymous writes |
| 9 resolution paths end up unbalanced | Smoke-test each; visual diff of consequence beats |
| Codex commits land mid-sprint (already happened twice) | `git fetch origin && git status` before every push; rebase if needed |

## Sprint cadence

- Each rc = ~1 week focused work for Leno (solo)
- Codex works parallel on 3D-side improvements + audio
- Sprint boundaries: rc16 starts after rc15 is verified + pushed
- Use `/sprint-execution` skill for TDD-first delivery per sprint
- Use `/monorepo-doc-sync` skill after every rc to keep docs in sync

## Tracking

Every sprint produces:
- 1 commit with conventional `feat/fix/chore/refactor(scope): ...` format
- 1 `docs/NN_<NAME>.md` ship report
- Updates to `docs/00_INDEX.md` + this roadmap
- Updates to memory if state changes

Current memory snapshot:
- Leno HEAD: `831efcb` (rc15)
- Codex HEAD: `81845d5` (rc.1)
- Tests: 457/457 grønne
- ci:gate: 25 steps