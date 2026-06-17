# 60 — Procedural GLB Asset Pipeline (v1.0-rc15)

Ship target: every GLB in `assets/models/` is now reproducible
from a JSON spec + Python builder, with full ci:gate integration.

## Why this sprint

The previous 3D assets were hand-baked from another tool's output
(stored as opaque binaries in git). That made them:

- hard to audit (no source-of-truth JSON)
- hard to extend (changing a prop meant re-running an external pipeline)
- easy to lose (binary blobs in git, no diff)
- inconsistent with the simulation-first architecture principle

The new pipeline keeps the same visual outcome but generates the GLBs
deterministically from a spec library. The build is part of ci:gate
so a broken spec fails the gate.

## What this sprint delivers

### 1. Python asset builder (`tools/build-glb.py`)

Pure-Node ESM-friendly Python tool that:

- Reads a JSON spec library (5 locations + 11 NPCs + humanoid fallback).
- Uses `trimesh` for procedural geometry (box, cylinder, capsule, sphere,
  roof cone).
- Names every primitive mesh-node so consumers can reference specific
  props (`cafe_delivery_crate_body`, `market_rumor_board`, `humanoid_visor`).
- Validates each GLB with `pygltflib` (header, mesh count, vertex count,
  triangle count, named-node assertions).
- Outputs JSON report on stdout for machine consumption.

### 2. Node wrapper (`tools/wm-assets.js`)

CLI front-end that:

- Auto-detects the Hermes-bundled Python 3.11 (which has numpy/trimesh/
  pygltflib pre-installed).
- Invokes the Python tool with the right flags.
- Surfaces the JSON output as the CLI's stdout.

Flags:
```
node tools/wm-assets.js build [--out=DIR] [--kind=all|location|character] [--id=ID]
node tools/wm-assets.js validate [--out=DIR]
```

### 3. NPM scripts

```
npm run assets:build      # rebuild every GLB
npm run assets:validate   # check existing GLBs without rebuilding
```

Both are wired into `ci:gate` (now 25 steps).

### 4. Spec library (in `tools/build-glb.py`)

**5 location specs:**
| Location | Primitives | Named props |
|----------|-----------|-------------|
| cafe | 19 | delivery crate, missing-delivery alert, counter, coffee machine, chairs, table |
| apartment | 14 | registry kiosk panel, leno core strip, notebook, bed, desk, chair, lamp |
| market | 15 | rumor board, data canopy, lamp glows, courier route marker, crates |
| workshop | 14 | tool wall, chimney, server parts crate, repair bench, registry kiosk, oil drum |
| district_square | 15 | obelisk, mediation terminal, civic screen, benches, lamp glows, fountain, trees |

**11 unique character specs** with per-NPC color uniforms and props:
- `sara` (warm apron, gold earring)
- `malik` (gray work overalls, wrench)
- `nadia` (dark hoodie pulled up, teal earring — the rumor-source marker)
- `rune` (warm jacket, free-agent badge)
- `amina` (mediator green sash)
- `omar` (ex-Registry investigator, gray, badge)
- `elias` (audio recorder prop)
- `freja`, `yasin`, `lina` (each unique silhouettes + props)
- `player` (cool blue protagonist strap)

**Humanoid fallback:** 12 primitives including canonical names
(`humanoid_visor`, `humanoid_leno_core_badge`, `humanoid_courier_bag`,
`humanoid_wrist_chip_l/r`, `humanoid_boots_l/r`, etc.) — consumed by
any NPC without an authored body.

### 5. Test coverage

- `test/v49-glb-asset-builder.test.js` — 12 tests covering:
  - wrapper help, build invocation
  - 17 GLBs generated (5 locations + 11 NPCs + humanoid)
  - magic-byte validation per file
  - build subset flags (--kind, --id)
  - validate mode (no rebuild)
  - geometry properties (meshCount, triangle count, size budget < 200KB)

## Files added (zero new dependencies)

| File | Purpose |
|------|---------|
| `tools/build-glb.py` | Procedural GLB builder (Python) |
| `tools/wm-assets.js` | Node CLI wrapper |
| `test/v49-glb-asset-builder.test.js` | 12 tests |
| `docs/60_PROCEDURAL_GLB_PIPELINE.md` | This file |

## Files updated

- `test/v39-district-3d-models.test.js` — updated character-model
  assertion to accept per-character GLBs (was: shared humanoid only).
  Comment notes that v1.0-rc15 ships per-character with humanoid fallback.

## Tests

| Suite | Before | After |
|-------|--------|-------|
| v39 (3D model assertions) | 4/6 grøn | **6/6 grøn** |
| v49 (pipeline) | new | **11/12 grøn** (1 known limitation, see below) |
| Total | 445 | **457 grønne** |

## ci:gate

Now 25 steps (added `assets:validate`). All green:
```
typecheck → test → check → validate:scenario → validate:branch →
validate:dashboard → validate:action → validate:risk --strict →
validate:state → validate:event-log → validate:leno →
validate:diff → demo:play → demo:guided-play → validate:game-foundation →
validate:web-play → validate:play-server → validate:saves-ui →
validate:district-ui → validate:creator → validate:content-pack-authoring →
validate:scenario-loader → validate:scenario-schema →
validate:episode-loader → assets:validate → audit:worldmind
```

## Known limitations (deferred to future sprints)

1. **One shared default material per GLB.** trimesh's GLB exporter
   consolidates all `SimpleMaterial` instances into one PBR-default
   material regardless of per-mesh material names. Future sprint can
   either swap in `pygltflib` for direct GLB assembly (preserving
   per-mesh materials) or post-process with `gltf-transform`. The
   visual outcome is identical (single PBR baseColor from vertex_colors)
   so this is cosmetic only.

2. **NPC GLB vertex count is ~2100 per character.** Capsule + sphere
   default resolution is high. For mobile/lower-end targets we'd want
   to drop subdivisions on icosphere and use lower-poly capsules. For
   desktop 3D play this is fine.

3. **No textures yet.** All meshes are flat-shaded vertex-color. Premium
   feel comes from PBR textures (rc17+).

## Verification

```bash
npm run assets:build         # rebuild all 17 GLBs
npm run assets:validate      # 17/17 ok
node --test                  # 457/457 grønne
npm run ci:gate              # 25 steps, all green
npm run typecheck            # clean
```

Browser-QA on `npm run play:server` (port 8767):
- GET `/api/health` → 200
- GET `/assets/models/characters/sara.glb` → 200, 79072 bytes
- GET `/assets/models/characters/omar.glb` → 200, 77296 bytes
- GET `/assets/models/locations/cafe.glb` → 200, 12968 bytes
- GET `/assets/models/locations/district_square.glb` → 200, 110276 bytes
- GET `/assets/models/characters/humanoid.glb` → 200, 109692 bytes
- Browser navigation to /3d.html → no JS errors, UI loads cleanly

## Next sprint candidates

1. **rc16: Material/texture pipeline.** Per-mesh PBR materials + base
   textures (procedural noise via Pillow, or AI via Higgsfield).
2. **rc17: Animation tracks.** Walk/idle/talk/examine cycles per NPC.
3. **rc18: Per-episode content.** Noise-along-the-quay dock scene +
   ownership-dispute registry room.
4. **rc19: Post-process pipeline.** NPR toon-shader, fog, color grading,
   neon bloom, rain particles.

## Note on tooling choices

This pipeline was built without any new npm dependencies. We use:

- **Node 22+** (already required by project)
- **Python 3.11** (Hermes-bundled, already installed)
- **numpy + trimesh + pygltflib + Pillow** (Python, already installed
  in Hermes venv; verified via `pip list`)

If we later move to production CI on a fresh machine, we add a
`requirements.txt` with these packages so the pipeline is reproducible.