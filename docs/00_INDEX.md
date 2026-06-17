# Documentation Index

## Core docs

1. `01_GAME_DESIGN.md` — samlet spilbeskrivelse.
2. `02_MVP_SCOPE.md` — v0.1 scope.
3. `03_TECHNICAL_ARCHITECTURE.md` — engine/backend/model architecture.
4. `04_DATA_MODEL.md` — samlet schemas/data model.
5. `05_TOOL_ACTION_SYSTEM.md` — actions/tools v0.1.
6. `06_MEMORY_RULES.md` — memory rules v0.1.
7. `07_RELATIONSHIP_MATH.md` — relationship math v0.1.
8. `08_RUMOR_PROPAGATION_RULES.md` — rumor propagation v0.1.
9. `09_ECONOMY_RULES.md` — economy rules v0.1.
10. `10_INCIDENT_QUEST_LOGIC.md` — emergent quest logic.
11. `11_DIALOGUE_SYSTEM.md` — dialogue/chatbot design.
12. `12_LENO_PROMPT_MODEL_POLICY.md` — Leno model policy.
13. `13_DASHBOARD_UI_WIREFRAME.md` — UI wireframe.

## Product expansion docs

14. `14_PLAYER_PROGRESSION.md`
15. `15_INVENTORY_ITEMS.md`
16. `16_COMPANY_BASE_GAMEPLAY.md`
17. `17_FACTION_MECHANICS.md`
18. `18_CREATOR_MODE.md`
19. `19_ACCOUNTS_SAVES_TIMELINES.md`
20. `20_VISUAL_ART_DIRECTION_MOODBOARD.md`
21. `21_AUDIO_VOICE.md`
22. `22_MULTIPLAYER_LATER.md`
23. `23_MONETIZATION_LATER.md`
24. `24_MVP_BUILD_PLAN.md`
25. `25_EVAL_TEST_SUITE.md`
- `26_PERSISTENCE_AND_TIMELINES.md`
- `27_SCENARIO_LOADER.md`
- `28_SAVE_BROWSER_AND_TIMELINE_UX.md`
- `29_TIMELINE_DIFF_AND_REPLAY.md`
- `30_DATA_CONTRACTS_AND_VALIDATION.md`
- `31_TYPESCRIPT_RUNTIME_MIGRATION.md` — v0.5 gradual migration to TypeScript + CLI validation gates.
- `32_AUTHORITATIVE_TYPESCRIPT_RUNTIME.md` — v0.6 authoritative `.ts` runtime + strict gates + `validate:branch` and `validate:dashboard`.
- `33_STRICT_TYPESCRIPT_DEFAULT.md` — v0.7 legacy runtime fully migrated to `.ts`, `strict: true` enabled, `runtime.d.ts` removed, `validate:action` and typed diff-checker.
- `35_STRICT_NULL_CHECKS.md` — v0.8 full strictNullChecks audit, `utils.js` → `utils.ts`, 26 nullable-access fixes with explicit defaults.
- `36_EVENT_LOG_INVARIANTS.md` — v0.8 `validate:event-log` CLI plus `diff:event-log` subcommand. Event log is the canonical truth.
- `37_RISK_VALIDATION.md` — v0.8 `validate:risk` CLI. Risk 4/5 actions forbidden in MVP, source-parsed from `actions.ts`.
- `38_PER_EVENT_TYPE_SCHEMAS.md` — v0.9 per-event-type payload validation (soft + strict modes), 9 event types with typed payload contracts.
- `39_STATE_VALIDATOR_AND_RISK_AUDIT.md` — v0.9 `validate:state` and `validate:risk --strict` (permission audit). 12-step ci:gate.
- `40_TYPED_PAYLOAD_MIGRATION.md` — v1.0-rc1 all 9 event-emitters migrated to typed `payload` fields. `validate:event-log` flipped to **strict mode** as default. Canonical 7-day run: 0 violations / 123 events. Leno `lenoTickPayload` carries explicit `includeHiddenCause` evidence gate. 116/116 tests grønne.
- `41_SAVE_BROWSER_AND_TIMELINE.md` — v1.0-rc2 `worldmind saves` CLI med `list` / `inspect` / `restore` / `timeline` subcommands. Deterministisk restore (byte-identical), auditerbar restore-log (actor/reason), branch/origin-kæde synlig i timeline. 126/126 tests grønne.
- `42_VISUAL_SAVE_BROWSER.md` — v1.0-rc3 visuelt dashboard: Save Browser table, Visual Timeline Tree, State Inspector, Incident Flow (Missing Delivery), Visual Diff Panel. 137/137 tests grønne.
- `43_BRANCH_DIFF_AND_QA_INSPECTOR.md` — v1.0-rc3 `worldmind saves diff` CLI + Visual Diff Panel. Struktureret diff med agent location, relationships, memories, rumors, economy, incidents.
- `44_PLAYABLE_VERTICAL_SLICE.md` — v1.0-rc4 `worldmind play` playable loop (14 commands) + `worldmind demo:play` deterministisk 3-path walkthrough + `validate:leno` evidence-guard auditor. 153/153 tests grønne.
- `45_INTERACTIVE_WEB_PLAY_UI.md` — v1.0-rc5 static web-play UI (`npm run play:web` genererer `static-play/index.html` + `state.json`); shared `src/play/play-engine.js`; web-renderer med Leno evidence-guard; `npm run validate:web-play` CI-gate. 171/171 tests grønne, 15-trins `ci:gate`.
- `47_SAVE_BROWSER_BRANCH_RESTORE.md` — v1.0-rc7 live save browser + branch timeline restore. `npm run play:server`, `/api/saves`, `/api/saves/:id/restore`, `/api/branches`, `/api/saves/diff`; `npm run validate:saves-ui`; private memory redaction; 188/188 tests grønne.
- `48_2D_DISTRICT_VIEW.md` — v1.0-rc8 SVG district view over New Aarhus District 01; 4 locations; agent markers; click-to-move; `npm run validate:district-ui`.
- `55_V1_0_RELEASE_CHECKLIST.md` — v1.0 release pre-flight checklist.
- `56_CONTENT_PACK_AUTHORING.md` — v1.0-rc11 content pack extensions: `npcDialogueTopics[]` on characters, `founderUnlockConditions[]` on quests, `consequenceSummary` + `requiredEvidence[]` on resolution paths. Plan 54 short-term targets shipped. 387/387 tests grønne, 21-trins ci:gate.
- `57_SCENARIO_LOADER.md` — v1.0-rc12 scenario loader + JSON schema. Reads content/{episodes,dialogue,evidence,incidents,quests,rumors,resolution-paths}/ with typed accessors. Lightweight dependency-free JSON Schema validator. 419/419 tests grønne, 23-trins ci:gate. Plan 54 medium-term targets shipped.
- `58_MULTI_EPISODE_PLAY.md` — v1.0-rc13 multi-episode play. All 3 authored episodes (the-missing-delivery, noise-along-the-quay, ownership-dispute) are now bootstrappable via `bootstrapWorld({ episode })`. New `/api/episodes` + `/api/episode/switch` endpoints + in-page episode selector UI. 445/445 tests grønne, 24-trins ci:gate.
- `59_PREMIUM_3D_ASSET_STRATEGY.md` — v1.0-rc14 plan only, no code. Research into Disco Elysium / Citizen Sleeper / Norco / Paradise Killer art direction; GLTF 2.0 pipeline analysis; asset taxonomy (locations, NPCs, props, audio, atmosphere); technical specs (poly budget, texture budget, JSON sidecar contract); execution roadmap (60→61→62→63 sprints); decision matrix A/B/C/D with cost/quality/speed/risk. Recommends Path D (programmatic base + AI polish).
- `60_PROCEDURAL_GLB_PIPELINE.md` — v1.0-rc15 ships procedural GLB pipeline. `tools/build-glb.py` (Python + trimesh + pygltflib) generates 17 deterministic GLBs from JSON specs (5 locations with 14-19 named meshes, 11 unique NPC bodies, humanoid fallback). `tools/wm-assets.js` Node wrapper. `npm run assets:build` + `assets:validate` added to ci:gate (25 steps). 457/457 tests grønne. Per-character silhouettes (sara's apron, malik's wrench, nadia's hood) replace the shared humanoid model — humanoid kept as fallback. Zero new npm deps.
- `61_V1_ROADMAP.md` — Master roadmap from rc15 → v1.0. Six sprints: rc16 materials/textures, rc17 animations+post-process, rc18 founder contracts+9 resolution paths end-to-end, rc19 multi-episode content, rc20 browser authoring panel, rc21 ship-ready infra. Each sprint has explicit tasks + "done when" criteria. Risks + parallelizable side-quests documented.
- `62_RC16_TEXTURES_MATERIALS.md` — v1.0-rc16 procedural textures + PBR materials. `tools/build-textures.py` generates 6 material types (wood/brick/concrete/metal/neon/fabric) via Pillow. `tools/build-glb-pbr.py` writes GLBs via pygltflib (per-mesh PBR materials + named nodes). ci:gate fix: split `npm test` (fast, skips smoke tests) and `test:all` (full). 407/407 fast tests + 461/461 full. 25-step ci:gate green.
- `63_RC17_ANIMATIONS.md` — v1.0-rc17 animation tracks. 4 glTF animation tracks (idle/talk/examine/walk) baked into every character GLB via `_add_animation_tracks()` in build-glb-pbr.py. Targets canonical body+head nodes. Linear interpolation. 412/412 tests grønne. Runtime wire-up to THREE.AnimationMixer deferred to rc17.5/rc18.
- `64_RC19_PER_EPISODE_CONTENT.md` — v1.0-rc19 per-episode content. Dialogue-pack.json extended 5→16 entries (omar, lina, elias, freja, yasin). Episodes 2+3 (noise-along-the-quay, ownership-dispute) have full NPC coverage + GLB models + dialogue trees. Each dialogue entry unlocks an evidence gate. 432/432 tests grønne.
- `65_RC20_AUTHOR_PANEL.md` — v1.0-rc20 browser authoring panel. `/author.html` UI for editing content-pack-v1.json (5 tabs: dialogue/paths/incidents/rumors/evidence). `/api/content` GET+POST endpoints with WM_AUTHOR_KEY auth gate + schema validation + atomic writes + hot-reload via `clearContentPackCache()`. 438/438 tests grønne.
- `66_RC21_SHIP_READY.md` — v1.0-rc21 ship-ready infra. `release:verify` extended to 19 steps (added rc11-rc20 validators + assets:validate + textures:build). README rewritten to v1.0. Install guide documents Python 3.11+ asset pipeline. 446 tests. Pre-tag checklist documented.
- `67_V1_0_RELEASE.md` — WorldMind v1.0.0 release notes. Tag v1.0.0 (commit 6ca50c0) ships 3 episodes, 9 paths, 11 NPCs, browser authoring panel, procedural 3D world. 21 sprints (rc1-rc21). Deferred-to-v1.1 list documented. License: private, all rights reserved.
- `68_FINAL_STATUS_HANDOFF.md` — Leno's handoff to Codex. Documents current git state (HEAD 772b445, tag v1.0.0 pushed, working tree clean), the 3 pre-existing test-isolation issues (not blockers), and the v1.1 backlog (founder contracts, consequence beats, AnimationMixer integration, dialogue unlock gates). Includes verification steps for next session + sprint cadence + communication pattern.

## Roadmap

28. `26_ROADMAP.md`
