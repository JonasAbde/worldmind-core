# Roadmap

## Completed sprints

### v0.1 — Simulation MVP
- 10 NPC-agents + player, 4 locations, 7-day canonical sim.
- Actions, memory, relationships, rumors, economy, incidents, dialogue v0.1.
- Leno policy + static dashboard generator.
- The Missing Delivery as emergent quest.
- Tests via `node:test`, eval in `simulate.js --assert`.

### v0.2 — Persistence + scenario foundation
- SQLite (better-sqlite3) snapshot store.
- JSON scenario loader with validation.
- Timeline branches with origin/parent metadata.
- Deterministic seed-based world construction.

### v0.3 — Save browser + timeline UX
- Visible save/snapshot listing with branch metadata.
- Timeline UX with origin-chain and fork-point metadata.
- Restore flow with deterministic RNG-state resume.
- Scenario/snapshot hygiene (required-field validation).

### v0.4 — Data contracts and validation
- Canonical `ScenarioContract`, `WorldState`, `SnapshotMetadata`, `BranchMetadata`, `DiffContract`, `LenoContext` types in `src/contracts/types.ts`.
- Runtime validators in `src/contracts/validators.js`.
- Zod-lite parse wrappers in `src/contracts/parse.js`.
- CLI gates: `validate:scenario`, `validate:branch`, `validate:diff`, `validate:dashboard`.

### v0.5 — TypeScript migration foundation
- `tsc --noEmit` gate via `npm run typecheck`.
- TypeScript façades for the four core simulation files (`state`, `scenario-loader`, `world`, `sim`).
- `.js` re-export shims for backward compatibility.
- Type information flows into the dashboard and Leno summary paths.

### v0.6 — Authoritative TypeScript runtime
- Full `.ts` bodies for the four façade files; `.js` shims removed.
- `strict: true` enabled by default in `tsconfig.json` (with `strictNullChecks: false` for that sprint).
- `runtime.d.ts` bridge between JS and TS callers.
- `diff-checker.js` with `--scenario` for scenario-vs-runtime drift detection.

### v0.7 — Strict TypeScript default
- All 9 remaining simulation modules migrated to `.ts`: `memory`, `rumors`, `actions`, `relationships`, `economy`, `incidents`, `dashboard`, `dialogue`, `leno`.
- `runtime.d.ts` and `utils.d.ts` bridges removed.
- `validate:action` CLI gate.
- 75/75 tests grøn; `ci:gate` expanded to 6 steps.

### v0.8 — Strict invariants + risk gates
- `strictNullChecks: true` flipped on. 26 nullable-access sites fixed with explicit `?? 0` / `?? ''` / `?? []` defaults.
- `src/simulation/utils.js` → `src/simulation/utils.ts` (last simulation JS file migrated).
- `validate:risk` CLI: source-parses `actions.ts` and enforces that no action has `risk > ACTION_RISK_LIMIT_MVP = 3`.
- `validate:event-log` CLI: enforces 8 invariants on the 7-day canonical sim (1 world_started, world tick = 672, ≥1 daily_checkpoint, no invalid actor/location refs, valid incidentIds, etc.).
- `diff:event-log` subcommand: runs the canonical sim twice and asserts deterministic event logs.
- 89/89 tests grøn; `ci:gate` expanded to 10 steps.
- Source-reading regression test for Leno evidence-guard (no `hiddenCause.match` string-leak fallback).

### v0.9 — Per-event-type schema + state validator + risk audit  *(current)*
- `validateEventPayloadByType` in `src/contracts/validators.js`: per-type payload schema for 9 event categories (rumor, incident, relationship, daily_checkpoint, leno_summary_tick, economy_pressure, delivery_*).
- `validate:event-log:strict` mode that fails the gate on any per-type payload violation. Soft mode is the default and reports the tally without blocking.
- `validate:state` CLI: asserts the 19-key canonical `WorldState` shape against a JSON file.
- `validate:risk --strict` mode that audits actionId ↔ `PERMISSIONS.X` mapping.
- 100/100 tests grøn; `ci:gate` expanded to 12 steps.

### v0.9 — Per-event-type schema + state validator + risk audit  ✅

### v1.0-rc1 — Typed payload migration  ✅

### v1.0-rc2 — Save browser + timeline UX  *(current)*
- Ny `worldmind saves` CLI: `list` / `inspect` / `restore` / `timeline` subcommands
- Deterministisk restore (byte-identical mellem på hinanden følgende kald)
- Auditerbar restore-log (action, snapshotId, actor, reason, restoredAtTick)
- Branch/origin-kæde synlig i timeline med `parentSnapshotId` chain
- Argument-parser understøtter nu både `--key value` og `--key=value`
### v1.0-rc2 — Save browser + timeline UX  ✅

### v1.0-rc3 — Visual save browser + branch diff + QA inspector  ✅
- Dashboard med 20 sektioner inkl. Save Browser, Visual Timeline Tree, State Inspector, Incident Flow, Visual Diff Panel
- `worldmind saves diff <a> <b>` CLI med structured diff (location, relationships, memories, rumors, economy, incidents + deltas)
- Incident flow viser The Missing Delivery's 5-step trace (detected → evidence → counter → restored → resolved)
- State inspector med 8 KPI tiles + top-3 memories + top-3 rumors
- 137/137 tests grønne, ci:gate 12/12 grønne

### v1.0-rc4 — Playable Vertical Slice Interaction Loop  ✅
- `worldmind play` CLI: 14 player commands (`look`, `move`, `talk`, `ask`, `inspect`, `listen_rumors`, `trace_rumor`, `counter_rumor`, `pay`, `ask_leno`, `status`, `save`, `branch`, `quit`) der alle mapper til autoritative ActionRequests via World Engine.
- Dialogue turn rendering: `<agent> says`, `Revealed facts`, `Evidence collected`, `Player options`.
- Consequence panel: relationship deltas, new memories, rumor changes, money, incident progress.
- Status panel: world, evidence, suspected causes, unresolved questions, known rumors.
- 3 resolution paths som spilleren kan løse *The Missing Delivery* igennem:
  - **Peaceful mediation**: help Sara, ask Amina, pay Malik → `peaceful_mediation`
  - **Investigation & counter-rumor**: ask Rune about Nadia, trace + counter rumor → `investigation_and_counter_rumor` (canonical path)
  - **Founder/business**: pay Malik for alternative delivery, talk to Sara → `founder_negotiation`
- `worldmind demo:play`: deterministisk walkthrough af alle 3 paths med byte-identical output mellem kørsler. Persister en snapshot til `data/demo-play.sqlite`.
- `worldmind validate:leno` (CLI) + `src/contracts/leno-validator.js` (pure API): auditerer Leno-summaries for 3 typer hidden-truth leaks (source-defining Nadia mentions = HARD, hidden cause literal = HARD, plain Nadia mentions = soft warning). Hard leaks kræver `rumor_source_nadia` evidence; uden denne må Leno ikke afsløre kilden.
- `deepClone` gjort cykel-sikker og funktion-sikker (`src/simulation/utils.ts`) så world-state kan serialiseres til SQLite selv med relation-cirkler og runtime-funktioner.
- 153/153 tests grønne, ci:gate 13 steps grønne (inkl. `validate:leno` og `demo:play`).
- Event Log invariants stadig intakte: 0 violations / 123 events.
- Risk 4/5 actions stadig gated (max risk = 3 i MVP).
- Leno evidence guard stadig aktiv — intet hidden truth lækket.

### v1.0-rc5 — Interactive Web Play UI  ✅
- `src/play/play-engine.js` (ny): pure-API shared engine. `bootstrapWorld`, `resolveCommand`, `parseCommandText`, `runScriptedPath`, `getDemoPaths`, `summarizeWorld`, `summarizeStatus`. Bruges af både `src/cli/play.js` (CLI) og `src/cli/play-web.js` (web) så der er **ingen duplicate gameplay logic**.
- `src/play/web-renderer.js` (ny): state → HTML rendering. `renderWebPage`, `renderHeader`, `renderLocation`, `renderAgents`, `renderCommandButtons`, `renderDialogueTurn`, `renderConsequence`, `renderEvidence`, `renderIncident`, `renderLeno`, `renderSaves`, `renderBranches`, `renderDemoPaths`, `escapeHtml`, `applyLenoGuard`.
- `src/cli/play-web.js` (ny): genererer `static-play/index.html` + `static-play/state.json` deterministisk. Quick-action buttons + fri tekst-command input.
- `src/cli/validate-web-play.js` (ny): auditerer den genererede side. Tjekker 11 section labels + 3 runtime markers.
- 171/171 tests grønne. Web UI var read-only i rc5.

### v1.0-rc7 — Live Save Browser UI + Branch Timeline Restore ✅ *(current)*
- `src/cli/play-server.js` (ny): Node HTTP server uden framework. Servicer `static-play/`, `GET /api/health`, `GET /api/state`, `POST /api/command`, `POST /api/save`, `GET /api/events`, `GET /api/saves`, `GET /api/saves/:id`, `POST /api/saves/:id/restore`, `GET /api/branches`, `POST /api/branches`, `GET /api/saves/diff?from=A&to=B`.
- `src/cli/validate-saves-ui.js` (ny): standalone validator der auto-starter en midlertidig play-server hvis nødvendig. Tjekker health/state/saves/command/save/inspect/restore/branches/branch-create/diff/Leno guard/static sections.
- `src/play/web-renderer.js`: Save Browser panel fik `data-saves-list`, search/filter, restore/inspect controls; Branch Timeline tree fik create form; Snapshot Diff panel fik `data-diff-panel`.
- `src/cli/play-web.js`: browser runtime prøver `/api/health`, skifter til live mode, kalder `/api/command`, `/api/saves`, `/api/saves/:id/restore`, `/api/branches`, `/api/saves/diff` uden reload.
- Save/restore/branch/diff genbruger eksisterende persistence (`src/persistence/sqlite.js`) og timeline (`src/persistence/timeline.js`) — ingen duplicate save logic.
- Private memories/secrets redacteres i API/UI, og `hiddenCause` skjules uden evidence. Leno guard og Risk 4/5 gates er stadig aktive.
- 188/188 tests grønne.

### v1.0-rc8 — (næste)
- Polish Live Web Play UX: dedicated snapshot inspect drawer, branch restore confirmation, event feed timeline, and visual branch tree layout.
- Optional SSE/WebSocket stream to replace polling.
- Authoring tools (creator mode v0.1).
- 2D district view.
- Phone UI + Leno overlay.

## Non-goals (until v1.0)

- 3D client.
- Multiplayer.
- Marketplace.
- Real-world connectors.

## Non-negotiables (carried through every sprint)

- Do not leak hidden truth to Leno/player without evidence.
- Do not allow agents to self-grant permissions.
- Do not allow tool execution without validation.
- Keep Event Log as source of truth.
- Add tests for every new core mechanic.
- Risk 4/5 actions are forbidden in MVP (enforced by `validate:risk`).

## Verification gate (every sprint)

```bash
npm test              # 188/188 grønne (v1.0-rc7)
npm run typecheck     # strict + strictNullChecks clean
npm run check         # typecheck + MVP-eval passed
npm run ci:gate       # 16+ steps grønne
npm start             # dashboard regenereret med alle eval-kriterier
npm run play -- --help        # 14 player commands listet
npm run demo:play             # deterministisk 3-path walkthrough
npm run validate:leno         # Leno evidence-guard audit
npm run play:web              # generer static-play/index.html
npm run validate:web-play     # auditer genereret web UI
npm run play:server -- --help # live web server endpoints
npm run validate:saves-ui     # save browser/restore/branch/diff live API gate
npm run saves:list            # save browser
```
