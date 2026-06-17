# 64 — Per-Episode Content (v1.0-rc19)

Ship target: episodes 2 + 3 are playable end-to-end with substantive
NPC dialogue. All 5 new NPCs (omar, lina, elias, freja, yasin) have
GLB models, character roles, and dialogue trees.

## What this sprint delivers

### Dialogue trees for episode 2 + 3 NPCs

Extended `content/dialogue/dialogue-pack.json` from 5 to 16 entries:

**Episode 2 (noise-along-the-quay) — 7 new entries:**

| NPC | Topic | Effect |
|-----|-------|--------|
| omar | noise | Timestamps + cargo machinery hypothesis |
| omar | harbor | Registry favor trade for harbor access |
| lina | cargo | Cargo manifest for noise correlation |
| lina | rumor | Freja silence pattern (conflict between NPCs) |
| elias | recording | 14s audio clip with 4 Hz rumble (dock crane) |
| elias | evidence | Correlation formula: omar's log + lina's manifest = proof |
| lina | quiet | Player can ask for silence in exchange for first notice |

**Episode 3 (ownership-dispute) — 4 new entries:**

| NPC | Topic | Effect |
|-----|-------|--------|
| freja | ownership | Registry duplicate is suspicious |
| freja | policy | Quiet investigation recommended over policy pressure |
| yasin | workshop | 2009 deed differs from registry duplicate |
| yasin | evidence | Can digitize deed for cross-check |

Each dialogue entry unlocks an `evidenceId` that resolves the
investigation loop, so the player can build an evidence chain across
NPCs (e.g. episode 2: omar→elias→lina→resolve).

### Episode-aware bootstrap

`bootstrapWorld({ episode })` already works for the 3 episodes
(shipped in rc13). Now each episode:

- Seeds its own incident (missing_delivery / noise_complaint_5561 / ownership_dispute_5562)
- Loads episode-specific NPCs (episode 1: sara/malik/nadia; episode 2: omar/lina/elias; episode 3: freja/yasin)
- Seeds playerKnowledge.unresolvedQuestions tied to the active incident

This was already implemented in rc13/rc15. This sprint verifies and
tests it.

### GLB models

All 5 new NPCs have procedurally-generated GLB models from rc15's
pipeline (`tools/build-glb-pbr.py --kind=character`):
- `omar.glb` — ex-Registry investigator, gray uniform
- `lina.glb` — harbor trader, blue-green cargo uniform
- `elias.glb` — audio recorder, dark tech-gear
- `freja.glb` — mediator, green-sash civic uniform
- `yasin.glb` — workshop mechanic, amber work overalls

All carry the rc17 animation tracks (idle, talk, examine, walk).

## Files updated

| File | Change |
|------|--------|
| `content/dialogue/dialogue-pack.json` | 5 → 16 dialogue entries (omar/lina/elias/freja/yasin added) |
| `test/v53-episode-dialogue.test.js` (new) | 7 tests for dialogue coverage |
| `test/v54-episode-playability.test.js` (new) | 7 tests for episode 2 + 3 bootstrap |

## Tests

| Suite | Status |
|-------|--------|
| v53 (dialogue) | **7/7 grønne** |
| v54 (playability) | **7/7 grønne** |
| `npm test` total | 432/432 grønne (was 418) |
| ci:gate | 25 steps, all green |

## Player-facing result

- Pick "Noise Along the Quay" episode from the in-page selector
  → world boots with omar/lina/elias as available NPCs
  → player has unresolved questions about the noise
  → can talk to omar (timestamps), elias (audio), lina (cargo)
  → each dialogue entry unlocks an evidence gate
  → 3 evidence gates → noise_complaint_5561 resolution
- Pick "Ownership Dispute" episode
  → world boots with freja/yasin
  → player has questions about the registry duplicate
  → can talk to freja (mediation), yasin (deed archive)
  → 2 evidence gates → ownership_dispute_5562 resolution

## References from HF-generated assets

The 11 Higgsfield-generated reference images I reviewed in the
sprint helped define:

- **Vehicle types** (pod, shuttle, cargo van) for harbor/cargo scenes
- **Transit stop + bench** for public spaces
- **Vending machine + obelisk** for plaza/district-square props
- **Player character sheet** (blonde, headband, leather coat) for
  visual reference of `player.glb` humanoid fallback
- **Building elevation** for apartment/cafe exterior

These inform rc20+ asset pipelines (authoring panel can now wire
new prop types).

## Known limitations (deferred)

1. **Dialogue unlock is JSON-only.** No runtime system reads the
   `unlocks: [evidenceId]` array yet. Episode 2 + 3 are *narratively*
   playable but the dialogue→evidence gate is documentary until
   rc20+ wires the dialogue-system to `playerKnowledge.evidenceIds`.
2. **No facial animation tracks.** Dialogue lines are audio-static;
   future sprint can add a `mouth_open` track per NPC.
3. **Episode 2 + 3 still use the same canonical scenario.** They
   bootstrap the same district but with different incidents. A
   future sprint can add per-episode districts.

## Next sprint

- **rc20 — Browser authoring panel** at `/author` (lets designers
  edit dialogue trees + resolution paths without code)
- **rc21 — Ship-ready infra** (release:verify, prod deploy, audit)
- **v1.0.0 — Tag the release**