# Hermes Handoff — WorldMind v0.2 foundation

## Status

WorldMind is still a **simulation-first foundation**. The engine is now beyond the initial MVP baseline and has an optional persistence/snapshot/scenario layer on top of the in-memory sim.

## What is built

- `src/simulation/world.js`: world state + event log + branch-aware events.
- `src/simulation/state.js`: world serialization + scenario normalization.
- `src/simulation/scenario-loader.js`: JSON scenario validation/loading.
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
- `src/persistence/sqlite.js`: optional SQLite persistence + snapshots + branches.
- `src/simulation/dashboard.js`: static dashboard output.
- `test/core.test.js`: MVP acceptance tests.
- `test/v02-foundation.test.js`: persistence/scenario/snapshot/evidence regressions.

## Runbook

```bash
npm test
npm run check
npm start
```

Optional foundation flows:

```bash
node src/cli/simulate.js --days 7 --dashboard --persist --db data/worldmind.sqlite
node src/cli/simulate.js --scenario scenarios/new-aarhus-district-01.json --days 7
node src/cli/simulate.js --load-snapshot snapshot_00001 --days 7 --persist
```

Expected:

- Tests pass.
- Eval passes.
- Dashboard generated at `static-dashboard/index.html`.
- SQLite database initializes cleanly when requested.
- Snapshot save/load round-trips.
- Timeline branch metadata is visible in event log and save view.

## Next engineering tasks

1. Expand persistence from foundation to full save browser / timeline UI.
2. Add incremental event replay / diff-based saves.
3. Add richer scenario authoring tooling.
4. Add explicit TypeScript types or migrate to TS.
5. Add dashboard React app.
6. Add local model/provider router abstraction.
7. Add deterministic eval snapshots for more scenarios.
8. Add creator mode prototype.

## Non-negotiables

- Do not leak hidden truth to Leno/player without evidence.
- Do not allow agents to self-grant permissions.
- Do not allow tool execution without validation.
- Keep Event Log as source of truth.
- Add tests for every new core mechanic.
