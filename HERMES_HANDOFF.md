# Hermes Handoff — WorldMind MVP v0.1

## Status

Denne mappe indeholder en første bygbar prototype og komplet designpakke for WorldMind.

Kode er ikke en færdig game client. Det er en **simulation-first foundation**, som skal bevise at engine-kernen virker før 3D, Godot/Unreal eller multiplayer.

## Hvad der er bygget

- `src/simulation/world.js`: world state + event log.
- `src/simulation/seed.js`: 10 agents, 4 locations, items, factions.
- `src/simulation/actions.js`: action/tool validation + handlers.
- `src/simulation/memory.js`: memory creation/retrieval/secret handling.
- `src/simulation/relationships.js`: relationship math.
- `src/simulation/rumors.js`: rumor propagation/counter/trace.
- `src/simulation/economy.js`: food scarcity + price pressure.
- `src/simulation/incidents.js`: emergent incident detector.
- `src/simulation/dialogue.js`: relationship/topic-aware dialogue v0.1.
- `src/simulation/leno.js`: Leno prompt/model policy + known-info summaries.
- `src/simulation/sim.js`: scenario runner and evals.
- `src/simulation/dashboard.js`: static dashboard output.
- `test/core.test.js`: MVP acceptance tests.

## Runbook

```bash
npm test
npm run check
npm start
```

Expected:

- Tests pass.
- Eval passes.
- Dashboard generated at `static-dashboard/index.html`.

## Next engineering tasks

1. Split action handlers into individual files.
2. Add persistent SQLite adapter.
3. Add save snapshots/timeline branches.
4. Add richer dialogue prompt packaging.
5. Add explicit TypeScript types or migrate to TS.
6. Add dashboard React app.
7. Add scenario loader from JSON/YAML.
8. Add local model/provider router abstraction.
9. Add deterministic eval snapshots.
10. Add creator mode prototype.

## Non-negotiables

- Do not leak hidden truth to Leno/player without evidence.
- Do not allow agents to self-grant permissions.
- Do not allow tool execution without validation.
- Keep Event Log as source of truth.
- Add tests for every new core mechanic.
