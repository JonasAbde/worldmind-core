# 64 — 3D Procedural + glTF Asset Kit v2

> **Status:** Shipped in site `/play/3d`  
> **Related:** `docs/63_3D_CLIENT_TECH_STACK_RESEARCH.md`, `docs/62_3D_PLAY_CLIENT_V1.md`

## Formål

Deliver **real 3D geometry** in the browser district: baked **glTF/GLB** models served from core `assets/models/`, with live procedural fallback. Characters and buildings are volumetric meshes — 2D art is portrait holograms only, not flat gameplay sprites.

## Asset layers

| Layer | Site module | Description |
|-------|-----------|-------------|
| Buildings | `assets/DistrictBuilding3D.tsx` + `GltfModel.tsx` | glTF when `modelUrl` set; else `ProceduralBuilding.tsx` zone meshes |
| Characters | `assets/EmbodiedCharacter.tsx` | glTF humanoid or procedural `MeshBody`; `HologramPortrait` for face |
| Street props | `DistrictStreetProps.tsx` | Lamps, delivery crate, data pylons |
| Ground | `DistrictGround.tsx` | Wet asphalt + cyan grid |
| Landmarks | `ZoneLandmarks.tsx` | Plaza / harbour geometry |

## Core contract (visualCues v4+)

`district-3d-layout.js` emits:

- `locations[].modelUrl` — `assets/models/locations/{id}.glb` when baked
- `locations[].renderMode` — `mesh3d` (default)
- `locations[].sceneTexture` — hologram sign on procedural buildings only
- `agents[].modelUrl` — shared `assets/models/characters/humanoid.glb`
- `agents[].renderMode` — `mesh3d`
- `agents[].figureTexture` — portrait hologram accent

## Bake pipeline

```bash
cd worldmind-site && npm run bake:3d-models   # writes GLB into ../Project Worldmind/assets/models/
cd worldmind-core && npm test                 # v39 model paths + visualCues
```

## Roadmap

| Phase | Assets |
|-------|--------|
| **v2 (now)** | Baked location GLB + shared humanoid; procedural fallback |
| **v3** | Per-NPC glTF + Mixamo idle/walk clips |
| **v4** | Interior as 3D sub-room glTF |
| **v5** | Optional UE5 cinematic harbour slice |

## Art direction

Nordic cyberpunk diorama: readable 3D silhouettes, emissive trims, portrait holograms, cyan district grid.

## Verification

```bash
cd worldmind-site && npm run build && npm test
cd worldmind-core && npm test   # v39 GLB + v28 visualCues
```

Open `/play/3d` — buildings are glTF volumes; characters are 3D meshes with floating portraits.
