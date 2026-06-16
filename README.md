# WorldMind v0.2 foundation

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

## Kør projektet

```bash
npm test
npm run check
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
5. `docs/26_PERSISTENCE_AND_TIMELINES.md`
6. `docs/27_SCENARIO_LOADER.md`
7. Kør `npm test` og `npm run check`
8. Fortsæt med issues i `docs/26_ROADMAP.md`
