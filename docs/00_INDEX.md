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

## Roadmap

28. `26_ROADMAP.md`
