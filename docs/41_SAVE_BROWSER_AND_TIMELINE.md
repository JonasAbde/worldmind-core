# 41 — Save Browser & Timeline UX (v1.0-rc2)

**Status:** Active (v1.0-rc2)
**Sprint:** v1.0-rc2 — save browser + timeline UX
**Date:** 2026

## Purpose

Make snapshots, branches, and restore operations **visible and usable**
for founder/QA. The v0.3 save browser was foundation-only; v1.0-rc2
ships a real CLI that lists saves, inspects snapshots without
restoring, restores deterministically, and shows the branch/origin
timeline. Built on top of the v0.2 persistence foundation and the
v1.0-rc1 typed-payload migration.

## The new `saves` CLI

```bash
# List all snapshots (filter by branch)
npm run saves:list -- --db=data/worldmind.sqlite
npm run saves:list -- --db=data/worldmind.sqlite --branch=experiment

# Inspect a snapshot (does NOT modify state)
node src/cli/saves.js inspect snapshot_00001 --db=data/worldmind.sqlite

# Restore a snapshot (deterministic via RNG state, logged)
node src/cli/saves.js restore snapshot_00001 --db=data/worldmind.sqlite \
  --out=state.json --actor=qa --reason=regression-investigation

# Show the branch timeline with origin chain
npm run saves:timeline -- --db=data/worldmind.sqlite
```

### Subcommands

| Subcommand | Purpose | Output |
|---|---|---|
| `list` | List all snapshots (filter with `--branch`) | JSON + human-readable table |
| `inspect <id>` | Show full snapshot state (no restore) | JSON with `state`, `branchName`, `originSnapshotId` |
| `restore <id>` | Restore snapshot to file (deterministic) | JSON with `logEntry` (action, snapshotId, actor, reason, restoredAtTick) |
| `timeline` | Show branches + origin chain | JSON + human-readable branch tree |

### Common flags

| Flag | Description |
|---|---|
| `--db=PATH` | SQLite database path (default: `data/worldmind.sqlite`) |
| `--branch=NAME` | Filter `list` to a single branch |
| `--actor=NAME` | Who is performing the restore (for the log) |
| `--reason=TEXT` | Why the action is being performed (for the log) |
| `--out=PATH` | Where to write the restored state (default: stdout JSON) |
| `--json` | Output JSON only (no human-readable text) |

## Argument-parser fix

The v0.x `simulate.js` CLI only understood `--key value` (space).
v1.0-rc2 adds support for `--key=value` (equals) across all flags,
plus correct multi-value handling for `--compare-snapshots a b`. The
saves CLI uses equals-form throughout for shell-predictable behavior.

## Deterministic restore

Restore is byte-for-byte deterministic. Two consecutive
`node src/cli/saves.js restore snapshot_NNNNN --out=X.json` invocations
produce identical files. This is guaranteed by:

1. The snapshot stores the RNG state (`state.rngState.state`) alongside
   the world state. `serializeWorldState` captures it in v0.2.
2. `loadSnapshot` rebuilds the world from the stored state (no RNG
   advancement during load).
3. The restore writes the deserialized world directly — no second
   simulation pass.

## Restore log

Every `restore` invocation produces a `logEntry` JSON object:

```json
{
  "action": "restore",
  "snapshotId": "snapshot_00001",
  "worldId": "new_aarhus_district_01",
  "branchName": "main",
  "restoredAtTick": 96,
  "restoredAtDay": 2,
  "restoredAtTime": "00:00",
  "actor": "qa",
  "reason": "regression-investigation",
  "restoredAt": "2026-06-16T10:33:00.000Z"
}
```

This makes restore actions **auditable** — founder/QA can see who
restored what, when, and why.

## Tests

`test/v11-save-browser.test.js` (10 tests) covers:

- CLI exposes `list` / `inspect` / `restore` / `timeline` subcommands
- `list` returns empty on fresh DB
- `list` shows a newly persisted snapshot with the expected fields
- `inspect` returns snapshot details without modifying state
- `restore` is byte-for-byte deterministic across invocations
- `restore` produces a log entry with actor + reason
- `timeline` returns branches and origin chain
- `inspect` handles unknown id with a non-zero exit code
- `restore` works with or without `--out`
- `list --branch=NAME` filters by branch

## Migration impact

| Metric | v1.0-rc1 | v1.0-rc2 | v1.0-rc3 |
|---|---:|---:|---:|
| Tests grønne | 116 | **126** | **137** |
| Save browser CLI | — | **`saves`** (4 subcommands) | **`saves`** (5 subcommands, +`diff`) |
| Restore determinism | implicit (RNG state) | **explicit (byte-identical)** | **unchanged (still byte-identical)** |
| Restore audit | none | **`logEntry` JSON** | **unchanged** |
| Argument-parser | space-only | **space + equals** | **space + equals** |
| Branch timeline | hidden in JSON | **`timeline` subcommand** | **+ Visual Timeline Tree i dashboard** |
| Visual dashboard | — | — | **20 sektioner** (Save Browser, Visual Timeline Tree, State Inspector, Incident Flow, Visual Diff Panel) |
| Incident flow | — | — | **5-trins trace (Missing Delivery)** |
| State inspector | — | — | **8 KPI tiles + top-3 memories/rumors** |
| Diff CLI | — | — | **`saves diff <a> <b>` med deltas** |

## Backward compatibility

- `simulate.js` continues to support the old `--key value` form.
- New `--key=value` form is purely additive.
- The `saves` CLI is a new top-level entry point — no existing
  scripts are renamed or moved.

## Non-goals (deferred to later sprints)

- **Visual dashboard for saves/timeline** (HTML, React) — v1.0-rc3+
- **Restore-undo** (replay events from log) — v2.0
- **Branch diff visualisation** — v1.0-rc3
- **Multi-user audit log** (auth, who can restore) — v2.0
