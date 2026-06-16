# 43 — Branch Diff & QA Inspector (v1.0-rc3)

**Status:** Active (v1.0-rc3)
**Sprint:** v1.0-rc3 — visual save browser + branch diff + QA inspector
**Date:** 2026

## Purpose

`worldmind saves diff` and the dashboard's **Visual Diff Panel** are
the QA / founder tools for comparing two snapshots at a glance. The
diff is **structured** (not just a JSON dump) and is rendered in
the dashboard with added/removed/changed colour-coding.

## Diff structure

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
    "beforeSnapshotId": "snapshot_00001",
    "afterSnapshotId": "snapshot_00002",
    "agentLocationChanges": [
      { "agentId": "sara", "beforeLocationId": "cafe", "afterLocationId": "market" }
    ],
    "relationshipChanges": [
      { "sourceAgentId": "malik", "targetAgentId": "sara", "before": {...}, "after": {...} }
    ],
    "newMemories": [
      { "id": "mem_...", "content": "...", "createdAtTick": 192 }
    ],
    "newRumors": [...],
    "economyChanges": [
      { "field": "foodScarcity", "before": 50, "after": 75 }
    ],
    "incidentChanges": [
      { "incidentId": "missing_delivery", "beforeStatus": "active", "afterStatus": "resolved", "afterResolutionState": "investigation_and_counter_rumor" }
    ],
    "summary": { ... },
    "eventCountDelta": 12,
    "tickDelta": 96,
    "dayDelta": 1
  }
}
```

## How the diff is computed

The diff reuses the existing `diffSnapshots(before, after)` helper
from `src/persistence/timeline.js` (introduced in v0.3). v1.0-rc3 adds:

- `eventCountDelta` — how many more (or fewer) events `to` has than `from`
- `tickDelta` / `dayDelta` — time-distance between the snapshots
- `fromEventCount` / `toEventCount` — absolute counts
- `fromMemoryCount` / `toMemoryCount` — absolute memory counts
- `fromBranch` / `toBranch` — branch labels for context

The raw `diffSnapshots` output is preserved under `diff.*` for
backward compatibility with v0.3 consumers.

## Visual Diff Panel

The dashboard renders the diff as colour-coded sections:

- **Agent Location Changes** — yellow (`changed`) — `agentId: before → after`
- **Relationship Changes** — yellow (`changed`) — `source → target: trust X → Y`
- **New Memories** — green (`added`) — `+ content`
- **New Rumors** — green (`added`) — `+ claim (truth=N)`
- **Economy Changes** — yellow (`changed`) — `field: before → after`
- **Incident Changes** — green if `resolved`, yellow if status-only change

## When to use it

- **Before merging a branch** — diff main vs experiment to see what
  changed
- **After a sandboxed experiment** — see if the experiment's
  actions altered the world
- **During QA** — verify that a specific action produced the
  expected memory/relationship/event deltas

## Tests

`test/v12-visual-save-browser.test.js` covers the diff CLI:

- Subcommand exists and shows help
- Returns structured diff with all required sections
- Identity diff is all zeros
- Reports branch names between branches
- Handles unknown snapshot id with non-zero exit

## Non-goals (deferred)

- **Three-way diff** (merge-base, ours, theirs) — v2.0
- **Semantic conflict detection** (e.g. conflicting relationship
  changes between branches) — v2.0
- **Visual diff of the timeline tree itself** (which branches split
  where) — v1.0-rc4
