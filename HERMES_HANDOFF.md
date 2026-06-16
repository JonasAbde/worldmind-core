# Hermes Handoff — WorldMind v0.8 strict invariants

## Status

WorldMind runtime er nu fuld TypeScript (`strict: true` + `strictNullChecks: true`) med 89/89 tests grønne og en 10-trins `ci:gate`. Event Log er fortsat sandheden, og vi har nu en automatisk gate der hævder det.

## What is built (v0.8)

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
| **Total** | **89** |

## Non-negotiables (bæret fra v0.7)

- Do not leak hidden truth to Leno/player without evidence.
- Do not allow agents to self-grant permissions.
- Do not allow tool execution without validation.
- Keep Event Log as source of truth.
- Add tests for every new core mechanic.
- Risk 4/5 actions are forbidden in MVP (now enforced by `validate:risk`).

## Næste skridt (v0.9 kandidater)

1. Tighten `noUncheckedIndexedAccess` modul-for-modul med eksplicitte lookup-typer.
2. Tilføj `validate:risk --strict` der også tjekker at alle Risk 1-3 actions har korrekt permission/actor-routing.
3. Tilføj `validate:state` CLI der verificerer canonical state-shape (alle keys fra WorldState er til stede).
4. Udvid `diff:event-log` med tolerance-vindue for stochastic content (e.g. timestamp deltas i dialoog).
5. Tilføj per-event-type schema-validator (`validateEvent('world_started')`, `validateEvent('rumor_spread')`, etc.) i stedet for én generisk.
