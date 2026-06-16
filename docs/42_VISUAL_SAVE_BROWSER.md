# 42 — Visual Save Browser & Dashboard (v1.0-rc3)

**Status:** Active (v1.0-rc3)
**Sprint:** v1.0-rc3 — visual save browser + state inspector + incident flow
**Date:** 2026

## Purpose

Build a **founder/QA-friendly visual layer** on top of the save
browser foundation. The v1.0-rc2 CLI gave us `list` / `inspect` /
`restore` / `timeline`; v1.0-rc3 ships the **static dashboard** that
visualises:

- The **save browser table** (snapshot ids, branches, parent/origin, counts)
- The **visual timeline tree** (branches with origin chain, ASCII-art layout)
- The **state inspector** (KPI tiles + recent memories + top rumors)
- The **incident flow** (step-by-step trace of The Missing Delivery)
- The **visual diff panel** (structured diff between two snapshots)

Built on top of the v0.2 persistence foundation, the v1.0-rc1 typed
payload migration, and the v1.0-rc2 save browser CLI.

## What's new in the dashboard

| Section | Type | Purpose |
|---|---|---|
| Save Browser | Table | All snapshots with id, branch, parent, origin, day/time/tick, incident status, counts |
| Visual Timeline Tree | ASCII art | Branches grouped by origin, with parent arrows |
| Timeline Branches (Table) | Table | Per-branch origin / parent / current / day / time / snapshot count / note |
| State Inspector | KPI grid + lists | 8 KPIs (agents, locations, memories, relationships, rumors, incidents, events, tick) + top 3 memories + top 3 rumors |
| Incident Flow — The Missing Delivery | Step timeline | Step 1: incident detected → Step 2: evidence traced → Step 3: counter-rumor → Step 4: delivery restored → Step 5: resolved |
| Visual Diff Panel | Sectioned list | Per-section diff (location, relationships, memories, rumors, economy, incidents) with added/removed/changed colour-coding |
| Snapshot Details (current) | Raw JSON | Full snapshot metadata (backward compat) |
| Timeline Diff (raw) | Raw JSON | Raw timelineDiff payload (backward compat) |
| Branch-aware Event Log | Table | Last 80 events with branch/origin/actor filters |

The **v0.3 backward-compat** is preserved: the legacy `<h2>Snapshot
Details</h2>` and `<h2>Timeline Diff</h2>` sections are now
`<h2>Snapshot Details (current)</h2>` and `<h2>Timeline Diff (raw)</h2>`
which still match the v0.3 regex assertions.

## The new `saves diff` subcommand

```bash
# Diff two snapshots via the saves CLI:
node src/cli/saves.js diff snapshot_a snapshot_b --db=data/test.db
# or
npm run saves:diff -- snapshot_a snapshot_b -- --db=data/test.db
```

The output is a JSON object with:

```json
{
  "ok": true,
  "from": "snapshot_00001",
  "to": "snapshot_00002",
  "fromBranch": "main",
  "toBranch": "experiment",
  "fromWorldId": "new_aarhus_district_01",
  "toWorldId": "new_aarhus_district_01",
  "diff": {
    "agentLocationChanges": [...],
    "relationshipChanges": [...],
    "newMemories": [...],
    "newRumors": [...],
    "economyChanges": [...],
    "incidentChanges": [...],
    "summary": { ... },
    "eventCountDelta": 12,
    "tickDelta": 96,
    "dayDelta": 1,
    "fromTick": 96, "fromDay": 2, "fromTime": "00:00",
    "toTick": 192, "toDay": 3, "toTime": "00:00",
    "fromEventCount": 39, "toEventCount": 51,
    "fromMemoryCount": 81, "toMemoryCount": 111
  }
}
```

The CLI exits non-zero (code 2) when either snapshot id is unknown,
so it can be used in shell pipelines.

## Dashboard generation

The dashboard is regenerated every time `npm start` (or
`node src/cli/simulate.js --days=N --dashboard`) is run. The
`--dashboard-dir=PATH` flag controls the output directory (default
`static-dashboard`). The dashboard is a single self-contained HTML
file plus a `world-state.json` data file. No external assets, no
JavaScript, no React.

## Tests

`test/v12-visual-save-browser.test.js` (11 tests) covers:

- `saves diff` exists and shows help
- `saves diff` returns structured diff between two snapshots
- `saves diff` on the same snapshot is identity (all deltas = 0)
- `saves diff` reports `fromBranch` / `toBranch` between branches
- `saves diff` handles unknown snapshot id with non-zero exit
- Dashboard contains a Save Browser table
- Dashboard contains a Visual Timeline Tree section
- Dashboard contains a State Inspector section
- Dashboard contains an Incident Flow section (Missing Delivery)
- Dashboard contains a Visual Diff Panel section
- Deterministic restore is still byte-identical across calls

## Migration impact

| Metric | v1.0-rc2 | v1.0-rc3 |
|---|---:|---:|
| Tests grønne | 126 | **137** |
| Dashboard sections | 16 | **20** |
| Save browser subcommands | 4 | **5** (added `diff`) |
| `npm run saves:*` scripts | 3 | **4** (added `saves:diff`) |
| Incident flow visual | — | **5-step timeline** |
| State inspector | — | **8 KPIs + top-3 lists** |

## Backward compatibility

- v0.3 `<h2>Snapshot Details</h2>` and `<h2>Timeline Diff</h2>` regex
  assertions still match (the new sections add "(current)" / "(raw)"
  suffix).
- v1.0-rc2 `saves list/inspect/restore/timeline` subcommands unchanged.
- The 8 new dashboard sections are additive; existing consumers
  (e.g. `npm run ci:gate` → `validate.js dashboard`) still pass.

## Non-goals (deferred)

- **Interactive state inspector** (click to expand agent details) — v2.0
- **Live dashboard updates** (no rebuild) — v2.0
- **Multi-world diff** (diff between two `worldId`s) — v2.0
- **Real-time WebSocket feed** — v2.0
