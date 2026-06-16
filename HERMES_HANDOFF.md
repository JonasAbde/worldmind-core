# Hermes Handoff — WorldMind Visual Gameplay Shell v1

## Status (latest sprint)

**Visual Gameplay Shell v1** on branch `feature/visual-gameplay-shell-v1`: three-column game layout (district map + scene / hotspots + dialogue / NPC + Leno + case board + rumor trail + founder), asset-backed location scenes, clickable hotspot cards, NPC portrait cards, case board tabs with suspect/link redaction, rumor trail UI, live consequence ticker, branch-before-decision modal, extended `validate:web-play`. See `docs/59_VISUAL_GAMEPLAY_SHELL_V1.md`.

Parallel runtime work: `feature/runtime-gameplay-core-v1` (Leno) owns action outcomes, founder loop contracts, rumor engine — UI graceful-fallbacks for missing deltas.

---

# Hermes Handoff — WorldMind v1.0-rc8 2D district view + phone/Leno UI

## Status

WorldMind har nu **2D District View + Phone/Leno UI** lagt oven på rc7 foundation. Live web-serveren leverer SVG kort med de 4 MVP-locations, Phone panel med 8 tabs (Messages, Contacts, Rumors, Evidence, Jobs/Incident, Saves, Branches, Leno), Event Feed panel og Leno overlay med suggestions. `private memories` og `hidden truth` forbliver beskyttet mod leak i UI. **200/200 tests grønne**, typecheck clean, `validate:district-ui` grøn.

## What is built (v1.0-rc8)

Building on v1.0-rc7's live save browser:

- **`src/play/web-renderer.js`** (udvidet): `renderDistrictView(view)` producerer SVG-kort med `data-district-map` markers, `data-location-id` hooks for move-on-click. `renderPhoneTabs()` viser 8 tabs med `data-phone-pane` containers. `renderEventFeed(events)` rendererer sidste 12 events i `<ul data-event-feed>`. Leno panel udvides med `hidden truth guard` (ingen Nadia uden evidence).
- **`src/play/district-view.js`** (ny): `buildDistrictView(world)` bygger nodes/edges for de 4 locations + agent markers, SVG-koordinater. Bruges af renderer og kan exporteres til andre moduler.
- **`src/cli/validate-district-ui.js`** (ny): validator for district view + phone UI. Checker SVG map, location labels, phone tabs, Leno overlay, event feed markers, location click hooks, save/restore/branch sektioner stadig til stede.
- **`test/v18-district-phone-ui.test.js`** (ny): 7 tests for district view renderer, phone tabs, event feed, full page integration, static page markers, Leno guard, location click hooks.
- **`docs/48_2D_DISTRICT_VIEW.md`** (ny): spec for SVG district view + location navigation.
- **`docs/49_PHONE_AND_LENO_UI.md`** (ny): spec for Phone UI tabs + event feed + Leno integration.

## What is built (v1.0-rc7) — recapped

Building on v1.0-rc5's static web UI:

- **`src/cli/play-server.js`** (ny): Node HTTP server uden tung framework. Servicer `static-play/` plus JSON API: `/api/health`, `/api/state`, `/api/command`, `/api/save`, `/api/events`, `/api/saves`, `/api/saves/:id`, `/api/saves/:id/restore`, `/api/branches`, `/api/saves/diff`.
- **`src/cli/validate-saves-ui.js`** (ny): standalone validator. Auto-starter temporary play-server hvis nødvendig og tester health/state/saves/command/save/inspect/restore/branches/branch-create/diff/Leno guard/static sections.
- **`src/play/web-renderer.js`** (udvidet): Save Browser panel med `data-saves-list`, search/filter, Save Now; Branch Timeline tree med branch create form; Snapshot Diff panel med `data-diff-panel`.
- **`src/cli/play-web.js`** (udvidet): browser runtime prøver `/api/health`, skifter til live mode, kalder `/api/command`, `/api/saves`, `/api/saves/:id/restore`, `/api/branches`, `/api/saves/diff` uden reload.
- **`test/v17-save-browser-ui.test.js`** (ny): 17 tests for endpoint contract, restore path, branch create, diff, hidden/private memory filtering, static UI sections og validator.
- **`docs/47_SAVE_BROWSER_BRANCH_RESTORE.md`** (ny): API + UI + validation reference.

## What is built (v1.0-rc5) — recapped

Building on v1.0-rc4's playable vertical slice:

- **`src/play/play-engine.js`** (ny): pure-API shared engine. `bootstrapWorld`, `resolveCommand`, `parseCommandText`, `runScriptedPath`, `getDemoPaths`, `summarizeWorld`, `summarizeStatus`. Bruges af både `src/cli/play.js` (CLI) og `src/cli/play-web.js` (web) så der er **ingen duplicate gameplay logic**.
- **`src/play/web-renderer.js`** (ny): state → HTML rendering. `renderWebPage`, `renderHeader`, `renderLocation`, `renderAgents`, `renderCommandButtons`, `renderCommandForm`, `renderDialogueTurn`, `renderConsequence`, `renderEvidence`, `renderIncident`, `renderLeno`, `renderSaves`, `renderBranches`, `renderDemoPaths`, `escapeHtml`, `applyLenoGuard`. Leno evidence-guard er indbygget: source-defining Nadia mentions redakteres til "REDACTED — evidence required" medmindre `rumor_source_nadia` er i `playerKnowledge.evidenceIds`.
- **`src/cli/play-web.js`** (ny): genererer `static-play/index.html` (70KB) + `static-play/state.json` (122KB) deterministisk. Indlejrer CSS, JS runtime, embedded JSON state. Quick-action buttons + fri tekst-command input. 12 button-shortcuts + alle 14 player commands understøttet via tekst.
- **`src/cli/validate-web-play.js`** (ny): auditerer den genererede side. Tjekker 11 section labels + 3 runtime markers. Tilføjet til `ci:gate` som trin 15.
- **`package.json`**: 2 nye scripts (`play:web`, `validate:web-play`). `ci:gate` udvidet fra 13 til 15 steps.
- **`static-play/`** (ny mappe): genereret output (deterministisk, byte-identical mellem kørsler).
- **`test/v15-interactive-web-play.test.js`** (ny): 18 tests der dækker engine API, renderer exports, alle 11 sektioner, Leno evidence-guard (med/uden evidence), text command parser, play:web determinism, validate:web-play, ci:gate wiring.
- **`docs/45_INTERACTIVE_WEB_PLAY_UI.md`** (ny): UI-spec, sektioner, demo paths, Leno evidence-guard, arkitektur, næste sprint.

## What is built (v1.0-rc4) — recapped

Building on v1.0-rc3's visual dashboard foundation:

- **`src/cli/play.js`** (ny): playable CLI med 14 player commands. Hver
  command mapper til en autoritativ `ActionRequest` der sendes gennem
  `validateAction` + `executeAction`. Output: dialogue turn (agent
  says, revealed facts, evidence collected, player options) + consequence
  panel (relationship deltas, memories, rumors, money, incident). Save
  og branch integrerer med eksisterende SQLite persistence.
- **`src/cli/demo-play.js`** (ny): deterministisk 3-path walkthrough
  (`--path=peaceful|investigation|founder|all`) mod canonical scenariet.
  Output er byte-identisk mellem kørsler. Persisterer en snapshot til
  `data/demo-play.sqlite`. Tilføjet til `ci:gate`.
- **`src/cli/validate-leno.js`** (ny): Leno evidence-guard auditor CLI.
  Læser en summary (fil, stdin, eller canonical scenario's leno output)
  og rapporterer 3 typer leaks: source-defining Nadia mentions (HARD),
  hidden cause literal (HARD), plain Nadia mentions (soft warning).
- **`src/contracts/leno-validator.js`** (ny): pure API version af
  validateLenoSummary så andre CLIs/tests kan importere uden at
  køre CLI'ens main().
- **`src/simulation/utils.ts`** (udvidet): `deepClone` gjort cykel-sikker
  (WeakMap tracking) og funktion-sikker (skipper funktioner). Nødvendig
  fordi world-state indeholder `agent.relationships[otherId]` →
  `otherAgent.relationships[firstId]` cykler som JSON.parse fejlede på.
- **`src/cli/simulate.js`** og **saves.js**: argument-parser forbedringer
  (allerede på plads i v1.0-rc3).
- **`package.json`**: 3 nye scripts — `play`, `demo:play`, `validate:leno`.
  `ci:gate` udvidet til 13 steps.
- **`test/v14-playable-vertical-slice.test.js`** (ny): 16 tests der
  dækker play --help, alle 13 commands, 3 resolution paths, demo:play
  determinism, validate:leno clean/leak/evidence cases, ci:gate wiring.
- **`docs/44_PLAYABLE_VERTICAL_SLICE.md`** (ny): playable loop spec,
  resolution paths, dialogue turn format, Leno evidence guard docs.

## Resolution Paths (3)

| Path | Steps | Resolution |
|---|---|---|
| Peaceful | inspect cafe → talk sara → ask amina mediation → pay malik 5 | `peaceful_mediation` |
| Investigation | inspect cafe → listen market → ask rune "nadia" → trace rumor → counter rumor | `investigation_and_counter_rumor` |
| Founder | inspect workshop → pay malik 15 → talk sara (alt delivery) | `founder_negotiation` |

## What is built (v1.0-rc3) — recapped

Building on v1.0-rc2's save browser CLI:

- **`src/simulation/dashboard.ts`** (udvidet): 4 nye panel-renderere — `renderTimelineTree` (visuelt grentrée med origin-arrows), `renderStateInspector` (8 KPI tiles + top-3 memories + top-3 rumors), `renderIncidentFlow` (5-trins trace af The Missing Delivery), `renderVisualDiff` (struktureret diff med added/removed/changed farver). 20 samlede dashboard-sektioner.
- **`src/cli/saves.js`** (udvidet): nyt `diff <from> <to>` subcommand. Returnerer JSON med `fromBranch` / `toBranch` / `eventCountDelta` / `tickDelta` / `dayDelta` + `agentLocationChanges` / `relationshipChanges` / `newMemories` / `newRumors` / `economyChanges` / `incidentChanges`.
- **`src/cli/simulate.js`** (udvidet): `--dashboard-dir=PATH` flag styrer hvor dashboardet skrives.
- **`src/cli/validate.js`** (udvidet): dashboard kræver nu 4 nye sektioner (`Visual Timeline Tree`, `State Inspector`, `Incident Flow — The Missing Delivery`, `Visual Diff Panel`).
- **`package.json`**: nyt `saves:diff` script.
- **`test/v12-visual-save-browser.test.js`** (ny): 11 tests der dækker diff CLI, alle 5 nye dashboard-paneler, deterministisk restore.
- **`docs/42_VISUAL_SAVE_BROWSER.md`**, **`docs/43_BRANCH_DIFF_AND_QA_INSPECTOR.md`** (ny): spec + use-cases.

## What is built (v1.0-rc2) — recapped

Building on v1.0-rc1's typed payload foundation:

- **`src/cli/saves.js`** (ny): 4-subcommand CLI: `list` / `inspect` / `restore` / `timeline`. Understøtter `--db=PATH`, `--branch=NAME`, `--actor=NAME`, `--reason=TEXT`, `--out=PATH`, `--json`.
- **`src/cli/simulate.js`** (udvidet): robust argument-parser der understøtter både `--key value` (space) og `--key=value` (equals), plus korrekt multi-value handling for `--compare-snapshots a b`. Branch-name propagates nu fra `--branch-name` flag (tidligere hardcoded til `'main'`).
- **`package.json`**: 3 nye scripts — `saves`, `saves:list`, `saves:timeline`.
- **`test/v11-save-browser.test.js`** (ny): 10 tests der dækker alle 4 subcommands + determinism + audit + edge cases.
- **`docs/41_SAVE_BROWSER_AND_TIMELINE.md`** (ny): CLI reference, determinism notes, restore-log schema.

## What is built (v1.0-rc1) — recapped

Building on v0.9's per-event-type schema:

- **`src/simulation/leno.ts`** (udvidet): ny `lenoTickPayload(world, summary)` helper der producerer typed payload for `leno_summary_tick` events. Eksponerer `includeHiddenCause: boolean` (evidence gate) og `hiddenCause: string | null` (nullsafe).
- **`src/simulation/sim.ts`** (udvidet): `daily_checkpoint` payload bruger nu `agentCount`/`memoryCount`/`rumorCount`/`incidentCount` (var `agents`/`memories`/`rumors`/`incidents`); `leno_summary_tick` kalder `lenoTickPayload`; `delivery_restored` får `fromLocationId`/`toLocationId` payload.
- **`src/simulation/economy.ts`** (udvidet): `economy_pressure` emitter sætter `payload.foodPrice` + `scarcity` + `foodPriceIndex` + `stockLevel`.
- **`src/simulation/relationships.ts`** (udvidet): `relationship_changed` emitter sætter `payload.sourceAgentId`/`targetAgentId`/`reason`/`numericImpact`.
- **`src/simulation/incidents.ts`** (udvidet): `incident_resolved` emitter sætter `payload.incidentId`/`resolutionId`/`resolvedAtTick`.
- **`src/cli/validate-event-log.js`** (udvidet): default mode er nu **strict** (v0.9 havde `soft` default). `--soft` flag bevaret som escape hatch.
- **`test/v10-typed-payload.test.js`** (ny): 16 nye tests for alle 9 typed event-emitters + strict mode ci:gate smoke.
- **`docs/40_TYPED_PAYLOAD_MIGRATION.md`** (ny): per-type migration spec, Leno evidence gate dokumentation.

## What is built (v0.9) — recapped

Building on v0.8's strict invariants:

- **`src/contracts/validators.js`** (udvidet): ny `validateEventPayloadByType(event)` der hævder per-event-type payload schema for 9 kategorier (rumor, incident, relationship, daily_checkpoint, leno_summary_tick, economy_pressure, delivery_*). `validateEventRecord` kalder den automatisk efter den generiske shape check.
- **`src/contracts/state-validator.js`** (ny): runtime audit af canonical `WorldState` shape (19 nøgler inkl. `kind`, `version`, alle collections, `playerKnowledge`, `economy`).
- **`src/contracts/risk-validator.js`** (udvidet): `--strict` mode auditerer actionId ↔ `PERMISSIONS.X` mapping og rapporterer `permissionAudit`-array.
- **`src/cli/validate-state.js`** (ny): CLI for `validate:state`.
- **`src/cli/validate.js`** (udvidet): nyt `state` subcommand, `risk` subcommand understøtter `--strict`.
- **`src/cli/validate-event-log.js`** (udvidet): `--strict` mode der failer ved per-type payload violations. Soft mode er default.
- **`test/v09-per-event-schemas.test.js`** (ny): 11 nye tests for per-event-type validators, state shape, risk strict, ci:gate smoke.
- **`docs/38_PER_EVENT_TYPE_SCHEMAS.md`** (ny): per-type schema spec, soft vs strict mode.
- **`docs/39_STATE_VALIDATOR_AND_RISK_AUDIT.md`** (ny): state validator og risk strict docs.

- **`src/simulation/utils.ts`** (ny, migreret fra `utils.js`): deterministisk `makeRng` med `getState` / `setState` / `snapshot`, `tickToDayTime`, `deepClone`, `createId`, `clamp`, `unique`, `average`.
- **`src/contracts/risk-validator.js`** (ny): source-parsing af `actions.ts` for at verificere at ingen MVP-action overskrider `ACTION_RISK_LIMIT_MVP` (= 3).
- **`src/cli/validate-risk.js`** (ny): CLI for `validate:risk`.
- **`src/cli/validate-event-log.js`** (ny): CLI for `validate:event-log`. Verificerer 8 event-log invariants på den 7-dages canonical run.
- **`src/cli/diff-checker.js`** (udvidet): nyt `event-log` subcommand der kører canonical simulation to gange og sammenligner fingerprints.
- **`src/cli/validate.js`** (udvidet): nye `risk` og `event-log` subcommands.
- **`tsconfig.json`**: `strictNullChecks: true` aktiveret som default.
- **`test/v08-strict-invariants.test.js`** (ny): 14 nye tests for utils.ts migration, strictNullChecks, validate:risk, validate:event-log, hidden-truth regression, diff:event-log, ci:gate smoke.
- **`docs/35_STRICT_NULL_CHECKS.md`** (ny): dokumentation af strictNullChecks-audit og nullable-felter.
- **`docs/36_EVENT_LOG_INVARIANTS.md`** (ny): dokumentation af event-log invariants + diff:event-log.
- **`docs/37_RISK_VALIDATION.md`** (ny): dokumentation af risk validator + Risk 4/5 policy.

## Hvad er migreret (v0.7 → v0.8)

| Før | Nu |
|---|---|
| `src/simulation/utils.js` | `src/simulation/utils.ts` (sidste JS-fil i simulation/) |

Det er den **ene** fil der manglede efter v0.7-migrationen.

## strictNullChecks: true

Aktiveret som default. 26 strictNullChecks-fejl fundet og rettet med `?? 0` / `?? ''` / `?? []` defaults i stedet for `!` non-null assertions eller `as any` casts. Berørte filer:

- `actions.ts` (5 fixes: `actor.stats.money`, `target.stats.money`, `sara.stats.stock`, `rel.fear`, `targetAgentId` cast)
- `dialogue.ts` (1 fix: `rel.fear` i Rune trust/fear branch)
- `economy.ts` (2 fixes: `sara.stats.stock`, `sara.stats.stress`)
- `memory.ts` (5 fixes: `memory.emotionalWeight`, `memory.confidence`, `memory.decayRate`, `memory.relatedAgentIds`, `memory.relatedLocationIds`)
- `relationships.ts` (2 fixes: `r.debt`, `rel.debt`)
- `rumors.ts` (6 fixes: `rumor.targetAgentIds[0]`, `rumor.createdAtTick`, `rumor.spreadRate`, `source.personality.warmth`, `source.personality.ambition`)

`noUncheckedIndexedAccess` er bevidst ikke aktiveret — runtime-invarianten er at enhver refereret agent eksisterer, og `validateActionRequest` håndhæver dette ved scenario-load.

## Risk validation

`RISK` enum har værdier 0-5, men `ACTION_RISK_LIMIT_MVP = RISK.RUMOR = 3`. `validate:risk` source-parser `actions.ts` og tjekker:

1. Ingen action har `risk > 3` (ville være en regression).
2. Alle `ACTIONS.X`-konstanter undtagen internal/reflect helpers (`accept_task`, `complete_task`, `create_memory`, `reflect_on_event`, `leno_summarize`, `leno_suggest_actions`) er repræsenteret i registry.

Rapport: `{"ok":true,"kind":"risk","totalActions":19,"maxRisk":3,"disabledGated":0,"mvpLimit":3}`.

## Event-log invariants

`validate:event-log` hævder 8 invariants på canonical 7-dages sim:

1. Præcis 1 `world_started` event
2. Alle events har `id`, `type`, `tick`, `day`, `time`
3. World tick avancerer til `7 * 96 = 672`
4. Mindst 1 `daily_checkpoint` event
5. Ingen event refererer ukendt actor
6. Ingen event refererer ukendt location
7. `incident_*` events har valid `incidentId`
8. Branch metadata er konsistent (når tilstede)

Rapport: `{"ok":true,"kind":"event-log","totalEvents":123,"lastTick":656,"worldTick":672,"worldStartedCount":1,"dailyCheckpointCount":28,...,"invalidActorRefs":0,"invalidLocationRefs":0}`.

`diff:event-log` kører canonical sim to gange og verificerer at event-loggene er identiske (catcher RNG-drift, skjult non-determinisme, utilsigtede tick-ændringer).

## Hidden-truth regression (ekstra)

Den eksisterende `leno.ts` evidence-guard er nu hævdet af en test der læser kildekoden og kræver:

- `evidenceIds.includes('rumor_source_nadia')` for at Nadia-source afsløres.
- Ingen `hiddenCause?.match?.(/Nadia/)` fallback (det var den v0.7-latente bug).

Dermed kan en fremtidig refactor ikke ved et uheld genindføre streng-match-leak.

## Runbook

```bash
npm test
npm run typecheck
npm run check
npm run ci:gate
npm start
npm run validate:risk
npm run validate:event-log
npm run diff:canonical
npm run diff:event-log
```

## Test counts (per fil)

| Fil | Tests |
|---|---|
| `core.test.js` | 18 |
| `v02-foundation.test.js` | 12 |
| `v03-save-browser.test.js` | 8 |
| `v03-timeline-ux.test.js` | 6 |
| `v04-contracts.test.js` | 8 |
| `v05-ts-runtime.test.js` | 4 |
| `v06-authoritative-ts.test.js` | 7 |
| `v07-strict-runtime.test.js` | 12 |
| `v08-strict-invariants.test.js` | 14 |
|| `v09-per-event-schemas.test.js` | 11 |
| `v10-typed-payload.test.js` | 16 |
| `v11-save-browser.test.js` | 10 |
| `v12-visual-save-browser.test.js` | 11 |
| **Total** | **137** |

## Non-negotiables (bæret fra v0.7)

- Do not leak hidden truth to Leno/player without evidence.
- Do not allow agents to self-grant permissions.
- Do not allow tool execution without validation.
- Keep Event Log as source of truth.
- Add tests for every new core mechanic.
- Risk 4/5 actions are forbidden in MVP (now enforced by `validate:risk`).

## Næste skridt (v1.0-rc4 kandidater)

1. **`validate:leno` CLI** — auditerer Leno's prompt/model policy + evidence-guard end-to-end. Tjekker at summary-text aldrig afslører `hiddenCause` uden `evidenceIds`-whitelist.
2. **Interactive state inspector** — klik på en agent i dashboardet for at udvide relations-graph + memory stream.
3. **Visual timeline diff** — vis hvilke branches der splitter hvor på en tidslinje (siblings + origin-pile).
4. **Tighten `noUncheckedIndexedAccess`** modul-for-modul med eksplicitte lookup-typer.
