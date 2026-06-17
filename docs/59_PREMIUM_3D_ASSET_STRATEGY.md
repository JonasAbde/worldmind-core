# 59 — Premium 3D Asset Strategy for WorldMind (v1.0-rc14)

> Research + production spec + execution roadmap. **No code yet.**

## Why this document exists

The current 3D assets (`assets/models/characters/humanoid.glb`,
`assets/models/locations/{apartment,cafe,market,workshop,district_square}.glb`,
`assets/characters/<id>/{avatar,portrait,fullbody,character-sheet,expression-*}.{png,webp}`)
are functional placeholders. They:

- ✅ Load with HTTP 200, correct bytes, valid GLB 2.0 binary
- ✅ Are referenced by `visualCues v4` (location modelUrl + agent modelUrl + sceneTexture)
- ✅ Render in the 3D client without JS errors
- ❌ Have no PBR materials, no normal/roughness/AO maps
- ❌ Use a single shared `humanoid.glb` for all 11 NPCs — no per-character silhouette or props
- ❌ Have only 2 location interiors (apartment + cafe), 3 only have exteriors
- ❌ No animations beyond a procedural bob/turn placeholder
- ❌ Audio cues are present but not yet hooked into 3D events

For WorldMind to feel like a *Disco Elysium × Citizen Sleeper × Norco* narrative
investigation experience (the established product target in `docs/52_FULL_FEATURED_GAMEPLAY_EXPANSION_PLAN.md`),
the 3D layer needs to grow. But growing without a plan means wasted effort and
inconsistent art direction.

This document is the plan.

---

## Part 1 — Reference research

### 1.1 What the genre leaders actually do

| Game | Render style | Asset pipeline | What we can steal |
|------|--------------|----------------|-------------------|
| **Disco Elysium** | 2D painterly with 3D depth tricks, real-time painted textures on quad-cards, slow deliberate camera, faces hand-painted in extreme detail | Hand-painted textures on flat-projected cards; selective 3D only for costumes + character bodies; "oil paint" filter post-process | Painterly mood, slow camera, dialogue-first composition. **Skip the 3D bodies** — use 2D billboards with strong silhouettes. |
| **Citizen Sleeper** | 2D top-down with animated portraits, abstract die system, deep neon-noir mood | Hand-illustrated portraits with 5+ expression states each; scene backgrounds painted as composited layers; UI is the soul, not the 3D | **Portrait expression states** (we already have these as `expression-*.png`), composited scenes, low-poly 3D is fine if mood is right |
| **Norco** | 2.5D pixel-art sidescroller, southern US industrial mood | Heavy reliance on pixel-art tiles + parallax layers + atmospheric particles; 3D only used for occasional 3D model inserts | Pixel-art is out for WorldMind (we have 3D pipeline). But **atmospheric particles** (rain, fog, steam) + parallax mood layers are very stealable. |
| **Pentiment** | 2D medieval manuscript style, hand-illustrated, ultra-deliberate | All hand-drawn, no 3D, ultra-cheap to produce but ultra-recognizable | Out of scope for WorldMind. |
| **Paradise Killer** | 3D real-time with custom shader that mimics 2D ink-wash, tropical vaporwave mood | 3D geometry with custom toon-shader, NPR (non-photorealistic) lighting, hand-painted normal maps | **NPR shader** is the sweet spot for WorldMind — keep 3D pipeline but render as if 2D painted. |
| **Disco Elysium's ZA/UM art direction talks** | "Every face is a performance" — extreme close-up portraits carry 80% of the emotional weight | Faces in 3-5 expression states, slow camera movement on dialogue, ambient animation (idle blink, micro-expressions) | Portrait quality >> body quality. Spend art budget on faces, not bodies. |

### 1.2 Genres insights distilled for WorldMind

WorldMind is **3D-billboards-in-a-3D-district** (we already have this). The wins:

1. **Faces are everything.** Our current `expression-{neutral,concerned,focused,worried}.png` is on the right track but lacks intensity and consistency. For premium feel we need 5-7 expressions per NPC: neutral, concerned, focused, angry, hopeful, suspicious, vulnerable.

2. **Slow camera, deliberate composition.** Our 3D client already does slow camera but lacks cinematic blocking — the camera doesn't *frame* dialogue scenes the way Disco Elysium does.

3. **Mood via post-process + atmosphere, not via geometry.** A flat-shaded greybox with the right fog, color grading, ambient soundscape, and slow camera feels 10× more premium than a detailed model with default lighting.

4. **NPCs as still portraits in dialogue.** When the player talks to Sara, the camera should slide into a tight portrait shot of her face. The 3D model becomes a backdrop prop, not the focus.

5. **Buildings are silhouettes, not architecture.** Buildings are identified by their *shape* and *signage*, not by detailed windows/doors. A flat-shaded box with a unique roof profile + neon sign reads better at game distance than a textured model.

### 1.3 Technical pipeline insights

Current pipeline:

```
content/worldmind/content-pack-v1.json (canonical scenario)
  ↓
src/play/play-engine.js (deterministic simulation)
  ↓
src/play/district-3d-layout.js (build3DVisualCues)
  ↓
GET /api/state → visualCues v4
  ↓
static-play/3d-client.js (Three.js renderer)
```

GLB pipeline status:

```
assets/models/locations/{5 locations}.glb   ✓ valid GLB 2.0, no animations, no textures
assets/models/characters/humanoid.glb        ✓ shared by all 11 NPCs
```

The pipeline is sound; the issue is content quality. Specifically:

- **No animation tracks.** We have a procedural bob/turn placeholder but no real walk/idle/talk/examine cycles. Adding GLTF animations would require animation tracks in the GLB.
- **No textures.** Models are flat color. PBR (metalness/roughness/normal) would add depth.
- **No LOD.** For 3D-mobile later, we'd need level-of-detail variants.
- **No compression.** GLB files are uncompressed JSON+binary. Draco or meshopt compression would cut size 5-10×.

### 1.4 What "premium" actually costs in time/money

Honest estimates (single 3D artist, mid-senior level):

| Deliverable | Hours | USD ($80/h) |
|------------|-------|-------------|
| 1 location building (architecture + textures + props + lighting) | 40-80h | $3,200-6,400 |
| 1 unique NPC character (model + 7 expressions + 4 animations) | 16-32h | $1,280-2,560 |
| Full district (5 locations + 11 NPCs + props + atmosphere) | 350-600h | $28,000-48,000 |

For comparison, the **programmatic Three.js approach** (geometry generated in code, baked to GLB on export):

| Deliverable | Hours | USD |
|------------|-------|-----|
| 1 location building (code-generated geometry, no textures) | 2-4h | $160-320 |
| 1 character (code-generated capsule with props) | 1-2h | $80-160 |
| Full district | 30-50h | $2,400-4,000 |

The programmatic approach is **10× cheaper but 5× less premium-feeling**. The hybrid is best:
- Programmatic base geometry for *all* 16 assets (cheap, deterministic, perfect for LLM/agent authoring)
- Premium textures + animations + atmosphere as the next polish layer

---

## Part 2 — Visual + technical spec

### 2.1 Art direction (locked)

From `docs/20_VISUAL_ART_DIRECTION_MOODBOARD.md` and `docs/52_*.md`:

- **Setting:** Nordic near-future (2030-ish), Aarhus harbour district.
- **Genre:** Cozy cyberpunk noir. Not Blade Runner; closer to *Mirror's Edge* × *Kentucky Route Zero* × *Disco Elysium*.
- **Mood keywords:** warm-against-cold, wet pavement, neon-reflected-in-rain, intimate interior, civic vulnerability.
- **Color palette (locked):**
  - Cold: `#0d1117`, `#161b22`, `#21262d` (district exteriors, dusk/night)
  - Warm: `#c97b3d`, `#f0883e`, `#78350f` (café interior, amber lights)
  - Neon: `#58a6ff`, `#14b8a6`, `#4ade80` (signage, faction markers)
  - Skin: `#f4e4c1`, `#d4a574`, `#8b5a3c` (NPC faces — warm undertones)
  - Avoid: pure black, pure white, oversaturated primaries, anime cel-shading.

### 2.2 Asset taxonomy

Per-episode asset budget (one episode = The Missing Delivery as template):

| Category | Count | Per-asset specs |
|----------|-------|----------------|
| **Location buildings** | 5 | cafe, apartment, market, workshop, district_square. Each is a unique silhouette with at least 1 distinct prop (sign, awning, antenna, vending machine). |
| **Location interiors** | 5 | One per location. ~80% of the time the player is indoors. Interior = 1 room, 2-3 hotspots, 2-4 NPCs visible at once. |
| **NPC portraits** | 11 characters × 7 expressions | neutral, concerned, focused, angry, hopeful, suspicious, vulnerable. Total: 77 portrait variants. |
| **NPC fullbody sprites** | 11 | Used for HUD cards, conversation drawer. |
| **NPC 3D bodies** | 11 (unique) | Currently shared humanoid.glb. Goal: 11 unique silhouettes via props (badge, hat, backpack, cane, headset). |
| **NPC animations** | 4 per character | idle (subtle breathing + blink), talk (jaw + head micro-movements), examine (lean forward), walk (4-frame walk cycle). Total: 44 animation tracks. |
| **Props** | ~30 | Delivery crate, rumor board, repair bench, registry kiosk, audio anomaly recorder, workshop charter, corporate deed, vending machine, neon signs, street furniture. |
| **Atmosphere layers** | 5 | Rain particle system, fog, ground reflections, neon-bloom, ambient occlusion (or fake AO via vertex colors). |
| **Audio cues** | 15-20 | 5 ambient location loops, 5 NPC voice-barks (1 per NPC), 5 SFX (investigate, talk, move, save, switch episode). |

Total asset count: **~150 distinct assets**.

### 2.3 Technical specs

#### GLB export pipeline

- **Format:** glTF 2.0 binary (`.glb`)
- **Coordinate system:** Y-up, meters as unit. (Three.js convention)
- **Polygon budget:**
  - Location building: ≤3,000 tris
  - NPC body: ≤1,500 tris
  - Prop: ≤500 tris
- **Texture budget:**
  - Location: 1× 2048×2048 basecolor + 1× 2048×2048 normal (optional packed ORM)
  - NPC portrait: 1× 512×512 (PNG, sRGB)
  - NPC fullbody: 1× 1024×1024 (PNG, sRGB)
  - Prop: 1× 512×512 basecolor
- **Compression:** meshopt + Draco where supported, fallback uncompressed.
- **Animations:** glTF `animation` tracks, ≤2s per loop, ≤60 keyframes per track.
- **Skinning:** weights exported as 4 influences per vertex.

#### Per-asset JSON contract

Each asset gets a sidecar JSON that the runtime reads:

```json
// assets/models/locations/cafe.meta.json
{
  "id": "cafe",
  "kind": "location",
  "label": "Sara's Café",
  "scene": {
    "interior": {
      "geometry": "cafe.glb",
      "footprint": { "x": 6.0, "z": 5.5 },
      "spawnPoint": [0, 0, 0],
      "hotspots": [
        { "id": "delivery_crate", "position": [-1.5, 0.4, -1.8], "lookAt": [-1.5, 0.4, -2.5] },
        { "id": "stock_shelf",    "position": [ 2.0, 0.5, -2.0], "lookAt": [ 2.0, 0.5, -2.7] }
      ],
      "ambient": { "loop": "cafe-ambient-loop.ogg", "volume": 0.6 }
    },
    "exterior": {
      "geometry": "cafe-exterior.glb",
      "footprint": { "x": 6.0, "z": 5.5 },
      "signage": "neon 'Sara's Café' sign, warm orange"
    }
  },
  "lighting": {
    "ambient": { "color": "#3a2a1a", "intensity": 0.4 },
    "key":     { "color": "#f0883e", "intensity": 1.2, "position": [3, 4, 2] },
    "fill":    { "color": "#58a6ff", "intensity": 0.3, "position": [-3, 3, -2] }
  }
}
```

This JSON is **authored** (Cursor-friendly) and **runtime-respected** by `visualCues v5+`.

#### Naming convention

- `assets/models/locations/<id>.glb` — interior/exterior geometry
- `assets/models/locations/<id>-exterior.glb` — optional exterior-only model
- `assets/models/characters/<id>.glb` — unique NPC body
- `assets/models/props/<prop-id>.glb` — individual props
- `assets/textures/<category>/<id>/<channel>.webp` — basecolor / normal / orm / emissive
- `assets/audio/ambient/<location>.ogg` — location ambient loops
- `assets/audio/sfx/<action>.ogg` — interaction SFX
- `assets/audio/voice/<character>/<topic>.ogg` — NPC voice barks
- `assets/characters/<id>/expression-<state>.{png,webp}` — portrait variants

### 2.4 Rendering style decision

We have a choice for the 3D client. Recommend:

**Option A: NPR (non-photorealistic) toon-shader.**

- Keep 3D geometry and pipeline.
- Apply a custom toon-shader fragment that quantizes lighting into 3-4 bands.
- Add a subtle "paint stroke" filter in post.
- Pro: Cheaper than fully realistic, more atmospheric, matches genre.
- Con: Custom shader work; harder to debug.

**Option B: Photorealistic PBR with cinematic lighting.**

- Use Three.js MeshStandardMaterial.
- Lean on environment maps, area lights, soft shadows.
- Pro: Free if we use built-in Three.js features.
- Con: Looks like every Unity asset flip; harder to feel unique.

**Option C: Hybrid — photorealistic base + NPR post-process overlay.**

- Standard PBR shading for the world.
- Add a subtle outline pass + quantized color grading.
- Pro: Industry standard + unique look.
- Con: Two pipelines.

**Recommended: Option C, but staged.**

- **v1.0-rc14** (now): ship photorealistic PBR + film grain + color grading. Free quality win, no new code.
- **v1.0-rc15** (later): add toon post-process overlay. Premium visual lift.
- **v1.0-rc16** (later): NPR shader variants per zone (warm-toon for cafe, cold-toon for workshop).

---

## Part 3 — Execution roadmap

### Sprint 59 (this sprint — research + spec only)

**Deliverable:** This document.

**No code.** The plan is the deliverable.

### Sprint 60 — Asset pipeline tooling

**Goal:** Make it trivial to generate, validate, and ship 3D assets.

**Tasks:**
1. `tools/build-glb.js` — Node.js script that generates procedural GLB models with Three.js (`three` devDependency only in this script, NOT in core). Outputs valid GLB 2.0.
2. `tools/build-location.js` — generates the 5 location GLBs (procedural base geometry with location-specific props).
3. `tools/build-character.js` — generates 11 unique NPC body GLBs by combining the humanoid base with per-character prop lists.
4. `tools/validate-assets.js` — validates every GLB (header, schema, poly count, texture presence, animation count).
5. `tools/build-portrait-pack.js` — takes existing `expression-*.png` and packs them into a single atlas per character.
6. CLI: `npm run assets:build` + `npm run assets:validate` added to `ci:gate`.

**Why:** Without tools, the next 10 sprints will each take days to manually produce one GLB. With tools, an LLM agent can generate new assets in minutes.

### Sprint 61 — Programmatic asset generation (the in-house build)

**Goal:** Generate all 16 in-house 3D assets using the tools from Sprint 60.

**Tasks:**
1. Run `tools/build-location.js` for all 5 locations. Each is a low-poly silhouette building with 2-3 props. Total: 5 GLBs.
2. Run `tools/build-character.js` for all 11 NPCs. Each gets a unique silhouette via prop additions (badge, hat, headset, etc.). Total: 11 GLBs.
3. Validate via `tools/validate-assets.js`.
4. Update `src/play/location-model-assets.js` and `src/play/character-model-assets.js` to prefer the new assets.
5. Browser-QA: navigate 3D client, screenshot every location, every NPC.

**Deliverable:** A clean deterministic in-house asset set that replaces the placeholder bakes. Tests still pass.

**Effort estimate:** 1 sprint (medium).

### Sprint 62 — Atmosphere + audio

**Goal:** Mood via post-process + ambient audio, not via geometry detail.

**Tasks:**
1. Implement post-process color grading in `static-play/3d-client.js` (warm interior / cold exterior LUT).
2. Add fog + rain particle system.
3. Add neon-bloom pass for signage.
4. Implement audio cue system: ambient loops per location, SFX per action, voice barks per NPC topic.
5. Hook audio into the existing `audio-cues.js` module.

### Sprint 63 — Premium polish layer

**Goal:** Add the *premium* layer on top of the programmatic base.

**Tasks (depends on available budget):**
1. **Option C1:** Hire a freelance 3D artist (Fiverr/Upwork, ~$2,000 for 1 location + 3 NPCs). Integrate their output.
2. **Option C2:** Use Higgsfield AI / Meshy AI / Tripo3D to generate base meshes from text prompts, then hand-polish in Blender. Iterate.
3. **Option C3:** Find pre-made Cyberpunk City Kit on Unreal Marketplace / itch.io (CC0 or paid). Convert to GLB.

### Sprint 64+ — Per-episode content

Once the asset pipeline is in place, build per-episode scenes:

- **Noise Along the Quay:** harbor-dock GLB + audio-anomaly prop + signal-interference visualizer
- **Ownership Dispute:** workshop-interior GLB + charter-prop + corporate-deed-prop + registry-kiosk

---

## Part 4 — Decision matrix

If you want premium NOW vs premium LATER:

| Path | Cost | Quality | Speed | Risk |
|------|------|---------|-------|------|
| **A. Programmatic base (rc14-rc15)** | 2 sprints of dev time, $0 | 60% of premium | 2 weeks | Low — deterministic, testable |
| **B. AI-generated (rc14 + iterate)** | 1 sprint + AI tool costs ($50-200/mo) | 75% of premium | 1-2 weeks | Medium — AI output is inconsistent, needs curation |
| **C. Freelance artist (rc14 → rc15)** | $5-10K + 2-4 weeks | 90% of premium | 4-6 weeks | High — schedule risk, revision cycles |
| **D. Hybrid (programmatic + AI polish)** | 1.5 sprints + $50-200/mo | 85% of premium | 2-3 weeks | Medium — best bang for buck |

**Recommendation: Path D.**

Reasoning: programmatic base gives us a working pipeline and full control. AI polish layer adds the "human touch" without committing to a full artist engagement. If the AI output is good enough, ship it. If not, fall back to freelance for the most-seen assets (cafe interior, 3 main NPCs).

---

## Part 5 — Concrete next action

**This week (sprint 60):** Build `tools/build-glb.js` + `tools/build-location.js` + `tools/validate-assets.js`.

This is achievable in one focused sprint and gives us the tooling foundation for everything after. No art budget needed, no external dependencies, all deterministic.

I'll prepare the work breakdown and queue it for approval.