# WorldMind MVP v0.1

WorldMind er en living AI-world simulation prototype. Projektet modellerer en lille near-future bydel, hvor agents har mål, memory, relationer, permissions, actions, rygter, økonomi og emergent incidents.

Arbejdstitler:

- **WorldMind**: spillet/platformen.
- **HermesWorld Core**: agent-runtime/simulation engine.
- **Leno Core**: spillerens companion-agent/UI-brain.
- **New Aarhus District 01**: første world/setting.

Kernen er ikke “NPC chatbot”. Kernen er en database-drevet simulation, hvor hver NPC er en sandboxed agent med `AGENTS.md`, `SKILLS.md`, `MEMORY.md`, `GOALS.md`, `TOOLS.json`, `PERMISSIONS.json`, `RELATIONSHIPS.json` og `MODEL_POLICY.yaml` som konceptuel runtime-standard.

## Hvad er inkluderet

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
- Eval/test suite.
- Dokumentation til Hermes.

## Kør projektet

```bash
npm test
npm run check
npm start
```

Efter `npm start` kan dashboard åbnes her:

```txt
static-dashboard/index.html
```

## MVP-succeskriterie

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

## Startpunkt for Hermes

Læs i denne rækkefølge:

1. `HERMES_HANDOFF.md`
2. `AGENTS.md`
3. `docs/00_INDEX.md`
4. `docs/24_MVP_BUILD_PLAN.md`
5. Kør `npm test` og `npm run check`
6. Fortsæt med issues i `docs/26_ROADMAP.md`
