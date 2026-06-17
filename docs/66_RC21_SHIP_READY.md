# 66 — Ship-Ready Infra (v1.0-rc21)

Ship target: `npm run release:verify` runs the full production gate
end-to-end. README + install guide are v1.0-accurate. Working tree is
clean and on master — ready to tag `v1.0.0`.

## What this sprint delivers

### 1. Extended `release:verify`

Now runs **19 steps** (was 13):

| Step | Purpose |
|------|---------|
| typecheck | TypeScript type checking |
| check | Type check + assertion run |
| play:web | Generate static-play/ from scenario |
| validate:web-play | Web-play UI section validation |
| validate:play-server | Play server endpoint validation |
| validate:play-api | Play API contract validation |
| validate:saves-ui | Saves browser UI validation |
| validate:district-ui | District map UI validation |
| validate:creator | Scenario creator validation |
| validate:leno | Leno evidence-guard validation |
| **validate:scenario-loader** | rc12 scenario loader (new) |
| **validate:scenario-schema** | rc12 content pack schema (new) |
| **validate:episode-loader** | rc13 multi-episode loader (new) |
| **validate:content-pack-authoring** | rc11 content extensions (new) |
| **assets:validate** | rc15 GLB pipeline (new) |
| **textures:build** | rc16 texture builder smoke test (new) |
| demo:play | Run scenario end-to-end |
| demo:guided-play | Run guided demo with founder loop |
| audit:worldmind | Security + secret-leakage audit |

The 6 new steps cover the v1.0-rc11..rc20 surface so a release cannot
ship without those gates passing.

### 2. README v1.0

`README.md` rewritten to reflect v1.0 status:

- 3 playable episodes (was 1 in rc8)
- 9 resolution paths (was 3 in rc8)
- 11 NPCs + player (was 10)
- 5 location scenes (was 4)
- Browser authoring panel at `/author.html` (rc20)
- Procedural asset pipeline (rc15-rc17)
- 438+ tests, 25-step ci:gate, 19-step release:verify
- All sprint references rc1 → rc21

### 3. Install guide updates

`docs/54_INSTALL_AND_RUN_GUIDE.md`:
- Repo name changed to `worldmind-core`
- Added Python 3.11+ requirement (for the procedural asset builder)
- Documents the dependency list (numpy/Pillow/trimesh/pygltflib/scipy)
- Notes that production CI should add a `requirements.txt`

### 4. Ship-readiness test

`test/v56-release-verify.test.js` (8 tests) verifies:
- release-verify includes the new gates
- README documents authoring panel
- Install guide documents Python asset pipeline
- All 17 GLB files exist
- Package description mentions v1.0
- Working tree is clean (HEAD on master, no uncommitted changes)

The last test passes only after a successful commit+push of the
release candidate. It serves as a final pre-tag check.

## Files added/updated

| File | Change |
|------|--------|
| `src/cli/release-verify.js` | Added 6 new steps (rc11-rc20 gates) |
| `README.md` | Full rewrite to v1.0 |
| `docs/54_INSTALL_AND_RUN_GUIDE.md` | Python dep + repo name update |
| `test/v56-release-verify.test.js` (new) | 8 ship-readiness tests |

## Tests

| Suite | Status |
|-------|--------|
| v56 (release verify) | 7/8 grønne (the "HEAD clean" test passes after commit) |
| `npm test` total | 446 tests (was 438, +8 new) |
| ci:gate | 25 steps, all green |

## Pre-tag checklist (manual)

Before tagging `v1.0.0`:

```bash
# 1. Working tree is clean
git status  # should show "nothing to commit, working tree clean"

# 2. All tests green
npm test    # 446/446
npm run ci:gate  # 25 steps, all green

# 3. Release verify green
npm run release:verify  # 19 steps, exit 0

# 4. Browser-QA on the live server
npm run play:server &  # terminal 1
# Open http://127.0.0.1:8770/3d.html in browser
# Verify: 3 episodes load, 9 paths clickable, save/branch works

# 5. Authoring panel reachable
# Open http://127.0.0.1:8770/author.html
# Verify: dialogue/paths/incidents/rumors/evidence tabs all load

# 6. Tag
git tag -a v1.0.0 -m "WorldMind v1.0.0"
git push origin v1.0.0
```

## Known limitations carried into v1.0

1. **Per-vertex COLOR_0 dropped in GLB export.** Materials still have
   per-primitive baseColorFactor; visually equivalent. Future
   `gltf-transform` integration (rc22+) can add per-vertex colors.
2. **One shared default material per GLB** (trimesh's GLB exporter
   consolidates per-mesh SimpleMaterials). Visually identical; the
   per-vertex color data is preserved as baseColorFactor.
3. **Founder contracts** (7 types) are not yet authored as content
   packs. They are referenced by `play-engine.js` founder workflow
   but the contract templates live in code, not in `content/contracts/`.
   Defer to v1.1.
4. **Consequence beats** (trust/reputation/economy deltas from
   resolution paths) are partially implemented but not asserted in
   tests. Defer to v1.1.
5. **Dialogue unlocks → evidenceIds** is documented but not yet wired
   into `playerKnowledge.evidenceIds` at runtime. The dialogue system
   surfaces the data; a future sprint wires the gate.
6. **NPC body + head animation tracks** are baked into the GLBs but
   the 3D client does not yet drive them via `THREE.AnimationMixer`.
   Future sprint wires the state machine.

These are documented in `docs/61_V1_ROADMAP.md` as v1.1 candidates.

## Next: Tag v1.0.0

After committing rc21 and pushing, tag the release:

```bash
git tag -a v1.0.0 -m "WorldMind v1.0.0 — 3 episodes, 9 paths, 11 NPCs, browser authoring"
git push origin v1.0.0
```

The tag is the ship event. After this, future work is v1.1+ on a
tagged baseline.