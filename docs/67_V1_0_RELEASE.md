# WorldMind v1.0.0 — Release Notes

> **Tag:** `v1.0.0`
> **Commit:** `6ca50c0`
> **Released:** 2026-06-17
> **Repository:** `JonasAbde/worldmind-core`

---

## What is WorldMind?

WorldMind is a living AI-world simulation prototype. A small near-future
district where agents have goals, memory, relationships, permissions,
actions, rumors, economy, and emergent incidents. The player (Leno)
investigates, negotiates, and resolves issues through dialogue and
choice.

The core is not "NPC chatbot" — it is a simulation-first engine where
the Event Log is the source of truth, memory is the agent's
interpretation, and hidden truth always requires evidence.

---

## v1.0.0 ships

### 3 playable episodes
- **The Missing Delivery** — Sara's café delivery is lost; who sabotaged it?
- **Noise Along the Quay** — Cargo machinery is keeping the harbor awake.
- **Ownership Dispute** — A workshop's original deed vs a registry duplicate.

### 9 resolution paths (all executable)
- peaceful_mediation, investigation_and_counter_rumor, founder_negotiation
- community_arbitration, community_repair, executive_leverage
- policy_pressure, quiet_investigation, silent_investigation

### 11 unique NPC agents + player
- Each NPC has a procedural GLB model with unique color/role props
- 4 animation tracks per character (idle, talk, examine, walk)
- Dialogue trees with evidence-gate unlocks

### 5 location scenes
- Procedural GLB models with PBR materials + named mesh-nodes
- 12+ named props per location (delivery crate, kiosk panel, leno core strip, etc.)

### Browser authoring panel
- `/author.html` for designers to edit dialogue, paths, incidents, rumors, evidence
- `/api/content` GET + POST with `WM_AUTHOR_KEY` auth gate
- Schema-validated writes; atomic file replace; hot-reload

### Procedural asset pipeline
- `tools/build-glb-pbr.py` — 17 GLB files from JSON specs (trimesh + pygltflib)
- `tools/build-textures.py` — 6 material types (wood/brick/concrete/metal/neon/fabric)
- `tools/wm-assets.js` + `tools/wm-textures.js` — Node wrappers

### Ship-ready infra
- 19-step `release:verify` gate
- 25-step `ci:gate` (fast iteration)
- 446 unit tests (fast) + 461 (full)
- TypeScript typecheck clean
- Audit pipeline (security + secret-leakage)

---

## Stack

- **Node.js 22 ESM** — primary runtime
- **Python 3.11+** — asset builder (trimesh, pygltflib, Pillow, numpy, scipy)
- **No cloud dependencies** — runs offline, no API keys required
- **better-sqlite3** — save/branch persistence
- **Three.js** — static-play 3D client

---

## Quick start

```bash
git clone https://github.com/JonasAbde/worldmind-core.git
cd worldmind-core
npm install
npm start                  # 7-day simulation + dashboard
npm run play:server       # live server on :8770
# Open http://127.0.0.1:8770/3d.html in browser
# Open http://127.0.0.1:8770/author.html for authoring
```

Full guide: [`docs/54_INSTALL_AND_RUN_GUIDE.md`](docs/54_INSTALL_AND_RUN_GUIDE.md)

---

## Documentation

See [`docs/00_INDEX.md`](docs/00_INDEX.md) for the full index.

Key entries:
- [Roadmap v1.0+](docs/61_V1_ROADMAP.md) — 6-sprint plan from rc15 to v1.0
- [Install + Run Guide](docs/54_INSTALL_AND_RUN_GUIDE.md)
- [Authoring Panel](docs/65_RC20_AUTHOR_PANEL.md)
- [Per-Episode Content](docs/64_RC19_PER_EPISODE_CONTENT.md)
- [Animations](docs/63_RC17_ANIMATIONS.md)
- [PBR Materials + Textures](docs/62_RC16_TEXTURES_MATERIALS.md)
- [Procedural GLB Pipeline](docs/60_PROCEDURAL_GLB_PIPELINE.md)
- [Premium 3D Asset Strategy](docs/59_PREMIUM_3D_ASSET_STRATEGY.md)
- [Ship Report (rc21)](docs/66_RC21_SHIP_READY.md)

---

## Deferred to v1.1

1. **7 founder contract templates** — currently referenced by `play-engine.js`
   founder workflow but the contract templates live in code, not in
   `content/contracts/`. Authoring these is a high-value v1.1 target.
2. **Consequence beat validation** — each resolution path should produce
   trust/reputation/economy deltas that are tested for correctness.
3. **Dialogue unlocks → evidenceIds** — the dialogue system surfaces
   the unlock data; wiring the gate into `playerKnowledge.evidenceIds`
   is a small follow-up.
4. **THREE.AnimationMixer integration** — character GLBs have animation
   tracks; the 3D client needs a state machine (idle ↔ walk ↔ talk)
   to drive them.
5. **Per-vertex COLOR_0 in GLB export** — currently collapsed by trimesh's
   GLB exporter; per-mesh baseColorFactor is visually equivalent.
6. **Per-mesh material entries** — would require swapping in a different
   GLB writer (gltf-transform or hand-rolled pygltflib).

These are documented in `docs/61_V1_ROADMAP.md` as v1.1 candidates.

---

## Sprint cadence

```
rc1   gameplay shell (MVP)
rc2   actions + state machine
rc3   scenarios + diff
rc4   ...
rc5   interactive web play UI
rc6   TypeScript authoritative
rc7   validate:action + diff-checker
rc8   10-step ci:gate
rc9   13-step ci:gate
rc10  typed payload
rc11  content-pack authoring extensions       ★ content authoring
rc12  scenario loader + JSON schema          ★ plan 54 medium-term
rc13  multi-episode play (3 episodes)         ★ all 3 playable
rc14  premium 3D asset strategy (plan)
rc15  procedural GLB pipeline (17 GLBs)       ★ deterministic assets
rc16  procedural textures + PBR materials    ★ PBR via pygltflib
rc17  glTF animation tracks (4 per character) ★ alive NPCs
rc18  9 resolution paths wired                ★ all 9 executable
rc19  per-episode content (16 dialogue)       ★ episodes 2+3 NPC coverage
rc20  browser authoring panel                 ★ designer workflow
rc21  ship-ready infra                        ★ release:verify 19 steps
```

---

## Team

- **Leno** (MiniMax-M3 / Hermes Agent) — full-stack implementation, content authoring
- **Codex** (`81845d5`) — earlier gameplay shell, 3D client, investigation loop
- **Jonas Abde** — project owner, design direction, content review

---

## License

Private project. All rights reserved.

---

**Shipped: WorldMind v1.0.0** — 21 sprints, 446 tests, 3 episodes, 9 paths, 11 NPCs, browser authoring, procedural 3D world, ship-ready infra.
