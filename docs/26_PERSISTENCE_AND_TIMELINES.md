# Persistence and Timelines

## Goal

Add an optional SQLite-backed foundation without removing the in-memory simulation path.

## What is persisted

- world snapshots
- event log rows
- agents
- memories
- relationships
- rumors
- incidents
- economy snapshots
- timeline branch metadata

## Design rules

- In-memory simulation remains the default.
- Persistence is opt-in via CLI flag or config.
- Event Log is still the source of truth.
- Hidden truth is never stored as a player-facing shortcut.
- Branch metadata must be attached to snapshot events so the timeline origin is visible.

## Current implementation shape

- `src/persistence/sqlite.js` opens the database and runs migrations.
- `saveSnapshot(world, meta)` writes a full world snapshot plus entity tables.
- `loadSnapshot(snapshotId)` rehydrates a world from saved state.
- `createTimelineBranch({ snapshotId, name, note })` stores branch origin metadata.
- World events now carry `branchName`, `branchOriginSnapshotId`, and `branchParentSnapshotId` when available.

## Validation

- `npm test`
- `npm run check`
- a snapshot can be saved and loaded back
- a branch can be created from a saved snapshot

## Future expansion

- incremental event-only writes
- pruning / compaction
- save diff viewer in the dashboard
- save-game browser UI
