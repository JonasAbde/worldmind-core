# 63 — Animation Tracks (v1.0-rc17)

Ship target: every character GLB ships with 4 glTF animation tracks
(idle, talk, examine, walk). Runtime can drive them via Three.js
AnimationMixer without baking state per frame.

## What this sprint delivers

### Animation track generation in `tools/build-glb-pbr.py`

When `spec_kind == "character"`, the build pipeline now appends 4
animation tracks to the GLB binary buffer:

| Track | Duration | Target node | Path | Effect |
|-------|----------|-------------|------|--------|
| `idle` | 2.0s | head | translation | Y-bob ±0.05 (breathing) |
| `talk` | 1.5s | head | rotation | Quaternion sway on X (micro-expressions) |
| `examine` | 1.0s | body | translation | Forward lean Z+0.2 |
| `walk` | 0.8s | body | translation | 4-frame Y-bob cycle |

The animations target **canonical NPC nodes**:
- `humanoid_body` (or `<npc>_body` for per-character NPCs)
- `humanoid_head` (or `<npc>_head`)

This matches the rc15 node naming convention so runtime can find them
without new metadata.

### glTF 2.0 binary format

Each animation track has:
- One `Animation.samplers` entry with `input` (timestamp SCALAR) +
  `output` (value VEC3 translation/scale or VEC4 rotation quaternion)
- One `Animation.channels` entry with `target: {node: <index>, path: <trs>}`
- `interpolation: LINEAR` (cheapest; good enough for subtle idle motion)

Buffer layout per character GLB:
```
[indices] [positions] [colors] [anim_timestamps] [anim_values]
            ↑              ↑          ↑                  ↑
       accessor 1    accessor 2   accessor 3..N    accessor 3..N+1
       POSITION      COLOR_0
```

## Files updated

| File | Change |
|------|--------|
| `tools/build-glb-pbr.py` | Adds `_add_animation_tracks()` helper + spec_kind dispatch |
| `test/v51-animation-tracks.test.js` | 5 tests (animation count, names, durations, channel paths, per-character) |
| `docs/00_INDEX.md` | Entry for v1.0-rc17 |

## Tests

| Suite | Before | After |
|-------|--------|-------|
| v51 (animation tracks) | new | **5/5 grønne** |
| Total `npm test` (fast) | 407/407 | **412/412 grønne** |
| `npm run test:all` (full) | new | full suite green |
| ci:gate | 25 steps | **25 steps, all green, <2 min** |

## Runtime usage

In `static-play/3d-client.js` (next sprint), the 3D client will:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer, Clock } from 'three';

const loader = new GLTFLoader();
loader.load(modelUrl, (gltf) => {
  const mixer = new AnimationMixer(gltf.scene);
  const idle = mixer.clipAction(gltf.animations.find(a => a.name === 'idle'));
  const walk = mixer.clipAction(gltf.animations.find(a => a.name === 'walk'));
  idle.play();
  // State machine: idle when stopped, walk when moving, etc.
});
```

## Known limitations (deferred to future sprints)

1. **No facial expressions.** `talk` track only sways head rotation;
   it doesn't drive morph targets or eye blinks. rc18+ can add facial
   animation if we add blend shapes to the procedural spec library.
2. **No root-motion walk.** Walk is a vertical bob only — no forward
   translation per step. Adding step-cycle translation requires a
   longer walk loop with per-step offsets.
3. **3D client does not yet consume the animations.** This sprint
   generates them in the GLB. Wiring them to the runtime AnimationMixer
   is a small follow-up (rc17.5 or part of rc18).

## Verification

```bash
npm test                       # 412/412 grønne
node --test --test-skip-pattern="..." test/v51-animation-tracks.test.js  # 5/5
npm run ci:gate                # 25 steps, all green
npm run assets:build           # rebuild all 17 GLBs with animations
```

Browser-side wire-up is deferred to rc18 (when 3D-client gets the
animation mixer state machine).

## Next sprint

- rc17.5: Wire animations into `static-play/3d-client.js` (small follow-up)
- rc18: Founder contracts + 9 resolution paths end-to-end
