# 33. Event-log invariants (v0.8)

## Goal

The event log is the canonical source of truth in WorldMind (see
AGENTS.md principle #3). Every downstream consumer — dashboard,
branch diff, narrative, Leno summary — depends on the log having a
stable, well-formed shape. v0.8 introduces a CLI gate that catches
violations automatically.

## CLI

```bash
npm run validate:event-log
```

Prints a JSON report on success:

```json
{
  "ok": true,
  "kind": "event-log",
  "totalEvents": 123,
  "lastTick": 656,
  "worldTick": 672,
  "worldStartedCount": 1,
  "dailyCheckpointCount": 28,
  "expectedLastTick": 672,
  "invalidActorRefs": 0,
  "invalidLocationRefs": 0
}
```

Exits non-zero if any invariant is violated, with a list of
`validationErrors` describing each violation.

## Invariants enforced

1. **Exactly one `world_started` event** in the run. Two would
   indicate a duplicated `simulate.js` invocation or a botched
   scenario load.
2. **Every event has `id`, `type`, `tick`, `day`, `time`**. Any
   malformed event breaks the dashboard's tabular projection.
3. **World tick advances to `days * TICKS_PER_DAY`** (7 * 96 = 672
   for the canonical 7-day sim). The last *event* tick is allowed
   to be slightly earlier because not every tick produces an event.
4. **At least one `daily_checkpoint` event** is present. These
   anchor the timeline UX and the branch-diff cards.
5. **No event references an unknown actor**. Every `actorIds` entry
   must exist in `world.agents`.
6. **No event references an unknown location**. Every `locationId`
   must exist in `world.locations`.
7. **Every `incident_created` / `incident_resolved` event has a
   valid `incidentId`**. The id must exist in `world.incidents`.
8. **Branch metadata is consistent when present**. If a snapshot
   has `branchOriginSnapshotId`, the referenced snapshot must
   exist.

## Diff-checker subcommand

The diff-checker now also supports an `event-log` subcommand that
runs the canonical simulation twice and asserts the two event logs
are bit-for-bit identical. Any RNG drift, hidden non-determinism,
or accidental tick change is caught immediately.

```bash
npm run diff:event-log
```

```json
{
  "ok": true,
  "kind": "diff-checker",
  "subkind": "event-log",
  "deterministic": true,
  "eventCount": 123,
  "lastTick": 656,
  "worldStartedCount": 1,
  "dailyCheckpointCount": 28,
  "eventTypeHistogram": { ... }
}
```

## Adding a new invariant

The validator is a single file:
`src/cli/validate-event-log.js`. To add an invariant, append a new
check that pushes to `errors` on failure, then add a test in
`test/v08-strict-invariants.test.js` that exercises it.

The validator is wired into `ci:gate` so any regression is caught
before merge.
