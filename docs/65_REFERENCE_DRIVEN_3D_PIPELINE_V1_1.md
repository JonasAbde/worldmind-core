# WorldMind 1.1 — reference-driven 3D pipeline

## Decision

The Gemini and Higgsfield files are concept/reference sheets, not calibrated multi-view captures. They are therefore unsuitable as direct photogrammetry input. WorldMind uses them as authored source references for silhouette, proportions, materials and prop families, then produces deterministic GLB assets through the existing Three.js bake pipeline.

This preserves the simulation-first boundary: the World Engine owns placement and interaction through `visualCues`; clients only render and submit the supplied command.

## Implemented pipeline

1. Originals stay unchanged in `assets/higgfield and gemini/`.
2. `npm run prepare:3d-references` in `worldmind-site` deduplicates the useful sheets, records SHA-256 lineage, creates web previews and extracts six material swatches.
3. `npm run bake:3d-models` creates reusable binary glTF props under `assets/models/props/`.
4. Core exposes placements through `visualCues` v5 `props[]` with model URL, transform, command and source reference.
5. Static Three.js and React Three Fiber clients preload, render and make those props interactive.

The initial kit is: street terminal, holo signpost, smart bench, vending unit, public data node and delivery drone.

The second tranche adds autonomous pod, transit shuttle, access control panel, trash compactor, power junction box, smart chair, foldable table, sensor lamp and vertical garden. The source manifest v2 accounts for all 26 supplied files: 22 reference/variant records plus four byte-identical duplicates.

## Why GLB/PBR

glTF 2.0 is the runtime delivery format. Its metallic-roughness material model, scene graph and binary GLB container fit the existing dependency-light web runtime. Reference colors are not treated as physically correct texture maps: production assets still need UVs and dedicated base-color, normal, roughness/metalness and optional emissive maps.

Primary references:

- Khronos glTF 2.0 specification: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- Khronos glTF asset guidelines: https://www.khronos.org/files/gltf20-reference-guide.pdf
- Blender UV unwrapping manual: https://docs.blender.org/manual/en/latest/modeling/meshes/uv/unwrapping/index.html
- Blender glTF exporter manual: https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
- Three.js GLTFLoader: https://threejs.org/docs/#examples/en/loaders/GLTFLoader
- Three.js DRACOLoader: https://threejs.org/docs/#examples/en/loaders/DRACOLoader
- Three.js KTX2Loader: https://threejs.org/docs/#examples/en/loaders/KTX2Loader

## Generative meshing policy

Image-to-3D tools can generate a blockout candidate for isolated props, but they are not authoritative output. Concept sheets contain multiple views, labels and inconsistent perspective, which can create fused geometry and invented backsides. Any generated candidate must pass topology cleanup, scale/orientation normalization, UV/material replacement, collision authoring, licensing review and visual QA before entering `assets/models/`.

Candidate research paths, kept optional to avoid adding runtime dependencies:

- Hunyuan3D 2 official repository: https://github.com/Tencent-Hunyuan/Hunyuan3D-2
- Stable Fast 3D official repository: https://github.com/Stability-AI/stable-fast-3d
- TripoSR official repository: https://github.com/VAST-AI-Research/TripoSR

For buildings, interiors and characters, use reference-driven Blender modeling. For isolated props, a generated blockout may accelerate the first pass, but the checked-in GLB must remain reproducible and reviewed.

## Production optimization gate

The current six props are small procedural GLBs and do not justify a decoder dependency. Introduce mesh compression only after measured transfer or parse cost warrants it. When textures become full PBR sets, prefer KTX2/Basis Universal and keep color-space semantics correct. Every production asset must pass:

- valid GLB load in both clients;
- stable meters, origin and Y-up orientation;
- bounded triangle/material count;
- explicit collision separate from visual geometry;
- no hidden gameplay truth embedded in labels or metadata;
- source lineage in the manifest;
- mobile/WebGL performance measurement.

## Next 1.1 asset tranche

1. Replace flat swatches with authored tileable PBR sets.
2. Model one modular interior kit from `interior-module` and `interior-furniture`.
3. Build the delivery pod as a non-drivable scene prop before vehicle mechanics.
4. Treat character turnarounds as Blender modeling/rigging references; do not auto-convert them directly into production characters.
5. Add glTF Validator and rendered golden-image checks before enabling external asset uploads.
