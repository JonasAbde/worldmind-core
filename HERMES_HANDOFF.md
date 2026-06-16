# Hermes Handoff — WorldMind v1.0-rc2 save browser

## Status

WorldMind runtime er fuld TypeScript (`strict: true` + `strictNullChecks: true`). Alle 9 event-emitters bruger typed `payload`-felter, `validate:event-log` kører i strict mode (0 violations / 123 events), og **save browser + timeline UX** er nu tilgængeligt via `node src/cli/saves.js`. 126/126 tests grønne, 12-trins `ci:gate`.

## What is built (v1.0-rc2)

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
|| `v10-typed-payload.test.js` | 16 |
|| `v11-save-browser.test.js` | 10 |
|| **Total** | **126** |

## Non-negotiables (bæret fra v0.7)

- Do not leak hidden truth to Leno/player without evidence.
- Do not allow agents to self-grant permissions.
- Do not allow tool execution without validation.
- Keep Event Log as source of truth.
- Add tests for every new core mechanic.
- Risk 4/5 actions are forbidden in MVP (now enforced by `validate:risk`).

## Næste skridt (v1.0-rc3 kandidater)

1. **Visual save browser dashboard** — HTML-side der viser saves + timeline visuelt (træ-layout, origin-pile).
2. **`validate:leno` CLI** — auditerer Leno's prompt/model policy + evidence-guard end-to-end.
3. **Branch diff visualisation** — vis forskelle mellem to branches (location changes, relationship deltas, incident flows).
4. **Tighten `noUncheckedIndexedAccess`** modul-for-modul med eksplicitte lookup-typer.
