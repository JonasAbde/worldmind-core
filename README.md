# WorldMind v1.0-rc2 save browser

WorldMind er en living AI-world simulation prototype. Projektet modellerer en lille near-future bydel, hvor agents har mål, memory, relationer, permissions, actions, rygter, økonomi og emergent incidents.

Arbejdstitler:

- **WorldMind**: spillet/platformen.
- **HermesWorld Core**: agent-runtime/simulation engine.
- **Leno Core**: spillerens companion-agent/UI-brain.
- **New Aarhus District 01**: første world/setting.

Kernen er ikke “NPC chatbot”. Kernen er en simulation-first engine, hvor Event Log er sandheden, memory er agentens fortolkning, og hidden truth altid kræver evidence.

## Hvad der er inkluderet

- 10 NPC-agents + player.
- 4 locations.
- Action/tool system med validation.
- Memory system.
- Relationship math.
- Rumor propagation rules v0.1.
- Economy rules v0.1.
- Incident detector / emergent quest logic.
- Dialogue system v0.1.
- Leno prompt/model policy.
- Static dashboard generator.
- Optional SQLite persistence foundation.
- World snapshots + timeline branches.
- Canonical JSON scenario loader.
- Deterministic regression tests.
- Eval/test suite.
- Dokumentation til Hermes.
- **v0.4** data contracts + scenario/snapshot/diff/branch validators.
- **v0.5** TypeScript runtime migration foundation + `tsc --noEmit` gate.
- **v0.6** authoritative `.ts` runtime for contracts + simulator + dashboard.
- **v0.7** all 9 simulation modules migrated to `.ts` with `strict: true` default.
- **v0.8** `strictNullChecks: true` + `utils.ts` + `validate:risk` + `validate:event-log` + `diff:event-log` (10-step `ci:gate`, 89/89 tests).
- **v0.9** per-event-type payload validators + `validate:state` + `validate:risk --strict` (12-step `ci:gate`, 100/100 tests).
- **v1.0-rc1** all 9 event-emitters migrated to typed `payload` fields; `validate:event-log` flipped to **strict mode** as default; canonical 7-day run: **0 violations / 123 events** (var 108 i v0.9); Leno `lenoTickPayload` carries explicit `includeHiddenCause` evidence gate; 116/116 tests grønne.
- **v1.0-rc2** ny `worldmind saves` CLI med `list` / `inspect` / `restore` / `timeline` subcommands; deterministisk restore (byte-identical); auditerbar restore-log (actor/reason); branch/origin-kæde synlig; 126/126 tests grønne.

## Kør projektet

```bash
npm test
npm run typecheck
npm run check
npm run ci:gate
npm start
```

Valgfri flags:

```bash
node src/cli/simulate.js --days 7 --dashboard --persist --db data/worldmind.sqlite
node src/cli/simulate.js --scenario scenarios/new-aarhus-district-01.json --days 7
node src/cli/simulate.js --load-snapshot snapshot_00001 --days 7 --persist
```

Efter `npm start` kan dashboard åbnes her:

```txt
static-dashboard/index.html
```

## Validators (v0.8)

```bash
npm run validate:scenario     # canonical scenario JSON
npm run validate:branch       # canonical branch JSON
npm run validate:dashboard    # dashboard HTML har alle 15 sektioner
npm run validate:action       # action payload mod canonical world
npm run validate:risk         # Risk 4/5 actions er forbudt i MVP
npm run validate:risk:strict   # + permission audit (actionId ↔ PERMISSIONS.X)
npm run validate:state         # 19-key WorldState shape check
npm run validate:event-log    # event-log invariants på 7-dages sim
npm run validate:event-log:strict  # + per-event-type payload check (strict)
npm run diff:canonical        # scenario vs runtime drift-check
npm run diff:event-log        # deterministisk event-log dobbeltkørsel
```

`ci:gate` kører alle ovenstående i sekvens og fejler på første regression.

## Foundation-succeskriterier

Efter 7 simulated days skal systemet kunne vise:

- 10 agents aktive.
- 4 locations ændrer state.
- 20+ memories.
- 10+ relationship changes.
- 5+ rumors spread.
- 3+ economy changes.
- 1 emergent incident.
- 3+ possible quest resolutions.
- 1 agent ændrer adfærd/relation pga. memory.
- Leno afslører ikke hidden truth uden evidence.
- Snapshot kan gemmes og loades igen.
- Branch metadata kan vises i event log og timeline-view.

## Startpunkt for Hermes

Læs i denne rækkefølge:

1. `HERMES_HANDOFF.md`
2. `AGENTS.md`
3. `docs/00_INDEX.md`
4. `docs/24_MVP_BUILD_PLAN.md`
8. `docs/35_STRICT_NULL_CHECKS.md` (v0.8)
9. `docs/36_EVENT_LOG_INVARIANTS.md` (v0.8)
10. `docs/37_RISK_VALIDATION.md` (v0.8)
11. `docs/38_PER_EVENT_TYPE_SCHEMAS.md` (v0.9)
12. `docs/39_STATE_VALIDATOR_AND_RISK_AUDIT.md` (v0.9)
13. `docs/40_TYPED_PAYLOAD_MIGRATION.md` (v1.0-rc1)
14. `docs/41_SAVE_BROWSER_AND_TIMELINE.md` (v1.0-rc2)
13. Kør `npm run ci:gate`
9. Fortsæt med issues i `docs/26_ROADMAP.md`
