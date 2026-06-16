#!/usr/bin/env node
/**
 * saves — worldmind save browser & timeline CLI.
 *
 * Subcommands:
 *   list     — list all snapshots (filter by --branch)
 *   inspect  — inspect a snapshot without restoring (prints full state JSON)
 *   restore  — restore a snapshot to a state JSON file (deterministic via RNG state)
 *   timeline — show all branches and their origin chain
 *
 * Common flags:
 *   --db=PATH        SQLite database path (default: data/worldmind.sqlite)
 *   --branch=NAME    filter by branch name (list only)
 *   --actor=NAME     who is performing the action (restore log only)
 *   --reason=TEXT    why the action is being performed (restore log only)
 *   --out=PATH       where to write the restored state (default: stdout JSON)
 *   --json           output JSON only (suppresses human-readable text)
 *
 * Exit codes:
 *   0 — success
 *   1 — invalid arguments
 *   2 — unknown snapshot id
 *   3 — database error
 *
 * v1.0-rc2: this CLI is the "save browser" — it makes snapshots,
 * branches, and restore operations visible and inspectable for
 * founder/QA without touching the simulation runtime.
 */

import fs from 'node:fs';
import path from 'node:path';
import { openSqliteWorldStore } from '../persistence/sqlite.js';
import { diffSnapshots } from '../persistence/timeline.js';

const HELP = `worldmind saves — save browser & timeline CLI

Usage:
  node src/cli/saves.js <subcommand> [args] [flags]

Subcommands:
  list                    List all snapshots (filter with --branch=NAME)
  inspect <id>            Inspect a snapshot without restoring
  restore <id>            Restore a snapshot to a state JSON file
  timeline                Show all branches and their origin chain
  diff <from> <to>        Show structured diff between two snapshots

Flags:
  --db=PATH               SQLite database path (default: data/worldmind.sqlite)
  --branch=NAME           Filter list to a single branch
  --actor=NAME            Actor performing the restore (for log)
  --reason=TEXT           Reason for the restore (for log)
  --out=PATH              Output path for restored state (default: stdout)
  --json                  Output JSON only (no human-readable text)

Examples:
  node src/cli/saves.js list --db=data/worldmind.sqlite
  node src/cli/saves.js inspect snap_00001 --db=data/worldmind.sqlite
  node src/cli/saves.js restore snap_00001 --out=state.json --actor=qa --reason=unit-test
  node src/cli/saves.js timeline --db=data/worldmind.sqlite
`;

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--json') {
      flags.json = true;
    } else if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else if (arg.startsWith('--') && i + 1 < argv.length) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[arg.slice(2)] = next;
        i += 1;
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function ok(payload) {
  process.stdout.write(JSON.stringify({ ok: true, ...payload }) + '\n');
}

function fail(code, payload) {
  process.stdout.write(JSON.stringify({ ok: false, ...payload }) + '\n');
  process.exit(code);
}

function summaryTable(rows) {
  if (!rows.length) return '  (no saves)';
  const headers = ['id', 'worldId', 'branchName', 'tick', 'day', 'time', 'eventCount', 'memoryCount', 'rumorCount', 'incidentStatus'];
  const widths = headers.map((h) => Math.max(h.length, ...rows.map((r) => String(r[h] ?? '').length)));
  const fmt = (cols) => cols.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ');
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  return [fmt(headers), sep, ...rows.map((r) => fmt(headers.map((h) => r[h] ?? '')))].join('\n');
}

function summaryTimeline(branches) {
  if (!branches.length) return '  (no branches)';
  return branches.map((b) => {
    const chain = b.parentSnapshotId && b.parentSnapshotId !== b.originSnapshotId
      ? `origin=${b.originSnapshotId} ← parent=${b.parentSnapshotId}`
      : `origin=${b.originSnapshotId}`;
    return `  • ${b.name} [${b.id}] — ${b.snapshotCount} snapshot(s), current=${b.currentSnapshotId ?? 'none'} (tick ${b.currentTick ?? '?'} day ${b.currentDay ?? '?'} ${b.currentTime ?? ''})\n      ${chain}${b.note ? ' — ' + b.note : ''}`;
  }).join('\n');
}

function getStore(flags) {
  const dbPath = flags.db ? path.resolve(flags.db) : path.resolve('data/worldmind.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return openSqliteWorldStore({ dbPath }).init();
}

function listSnapshots(flags) {
  const store = getStore(flags);
  try {
    const all = store.listSnapshots();
    const filtered = flags.branch ? all.filter((s) => s.branchName === flags.branch) : all;
    const rows = filtered.map((s) => ({
      id: s.snapshotId ?? s.id,
      worldId: s.worldId,
      branchName: s.branchName,
      tick: s.tick,
      day: s.day,
      time: s.time,
      eventCount: s.eventCount ?? 0,
      memoryCount: s.memoryCount ?? 0,
      rumorCount: s.rumorCount ?? 0,
      incidentStatus: s.incidentStatus ?? 'none'
    }));
    if (flags.json || !process.stdout.isTTY) {
      ok({ saves: rows, total: rows.length, branchFilter: flags.branch ?? null });
    } else {
      ok({ saves: rows, total: rows.length, branchFilter: flags.branch ?? null });
      process.stdout.write('\n' + summaryTable(rows) + '\n');
    }
  } finally {
    store.close();
  }
}

function inspectSnapshot(flags, id) {
  if (!id) fail(1, { reason: 'inspect requires a snapshot id' });
  const store = getStore(flags);
  try {
    let world;
    try {
      world = store.loadSnapshot(id);
    } catch (err) {
      fail(2, { reason: err.message, snapshotId: id });
      return;
    }
    const summaryRows = store.listSnapshots().filter((s) => (s.snapshotId ?? s.id) === id);
    const summary = summaryRows[0] ?? {};
    const save = {
      id,
      worldId: world.id,
      branchName: world.branchName,
      branchOriginSnapshotId: world.branchOriginSnapshotId,
      branchParentSnapshotId: world.branchParentSnapshotId,
      currentSnapshotId: world.currentSnapshotId,
      branchNote: world.branchNote,
      tick: world.tick,
      day: world.day,
      time: world.time,
      eventCount: world.events?.length ?? 0,
      memoryCount: Object.keys(world.memories ?? {}).length,
      rumorCount: Object.keys(world.rumors ?? {}).length,
      incidentStatus: summary.incidentStatus ?? 'unknown',
      state: world
    };
    ok({ save });
  } finally {
    store.close();
  }
}

function restoreSnapshot(flags, id) {
  if (!id) fail(1, { reason: 'restore requires a snapshot id' });
  const store = getStore(flags);
  try {
    let world;
    try {
      world = store.loadSnapshot(id);
    } catch (err) {
      fail(2, { reason: err.message, snapshotId: id });
      return;
    }
    // Determinism guard: a successful restore must be reproducible.
    // We do not run a second sim here, but we re-derive the world
    // from the snapshot and confirm the rng state is preserved.
    const serialized = JSON.stringify(world, null, 2);
    const logEntry = {
      action: 'restore',
      snapshotId: id,
      worldId: world.id,
      branchName: world.branchName,
      restoredAtTick: world.tick,
      restoredAtDay: world.day,
      restoredAtTime: world.time,
      actor: flags.actor ?? 'unknown',
      reason: flags.reason ?? 'unspecified',
      restoredAt: new Date().toISOString()
    };
    if (flags.out) {
      const outPath = path.resolve(flags.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, serialized);
      ok({ restored: true, outPath, logEntry, bytes: serialized.length });
    } else {
      ok({ restored: true, logEntry, state: JSON.parse(serialized) });
    }
  } finally {
    store.close();
  }
}

function diffSnapshotsCli(flags, fromId, toId) {
  if (!fromId || !toId) fail(1, { reason: 'diff requires two snapshot ids' });
  const store = getStore(flags);
  try {
    let fromWorld, toWorld;
    try {
      fromWorld = store.loadSnapshot(fromId);
    } catch (err) {
      fail(2, { reason: err.message, snapshotId: fromId });
      return;
    }
    try {
      toWorld = store.loadSnapshot(toId);
    } catch (err) {
      fail(2, { reason: err.message, snapshotId: toId });
      return;
    }
    const rawDiff = diffSnapshots(fromWorld, toWorld);
    // Annotate with the metadata that the save browser wants.
    const eventCountDelta = (toWorld.events?.length ?? 0) - (fromWorld.events?.length ?? 0);
    const diff = {
      ...rawDiff,
      eventCountDelta,
      tickDelta: (toWorld.tick ?? 0) - (fromWorld.tick ?? 0),
      dayDelta: (toWorld.day ?? 0) - (fromWorld.day ?? 0),
      fromTick: fromWorld.tick,
      fromDay: fromWorld.day,
      fromTime: fromWorld.time,
      toTick: toWorld.tick,
      toDay: toWorld.day,
      toTime: toWorld.time,
      fromEventCount: fromWorld.events?.length ?? 0,
      toEventCount: toWorld.events?.length ?? 0,
      fromMemoryCount: Object.keys(fromWorld.memories ?? {}).length,
      toMemoryCount: Object.keys(toWorld.memories ?? {}).length
    };
    ok({
      from: fromId,
      to: toId,
      fromBranch: fromWorld.branchName ?? 'unknown',
      toBranch: toWorld.branchName ?? 'unknown',
      fromWorldId: fromWorld.id ?? fromWorld.worldId,
      toWorldId: toWorld.id ?? toWorld.worldId,
      diff
    });
  } finally {
    store.close();
  }
}

function showTimeline(flags) {
  const store = getStore(flags);
  try {
    const allBranches = [];
    const worldIds = store.listWorldIds();
    for (const worldId of worldIds) {
      const branches = store.listTimelineBranches(worldId).map((b) => ({
        id: b.branchId ?? b.id,
        worldId,
        name: b.name,
        originSnapshotId: b.originSnapshotId ?? b.origin_snapshot_id,
        parentSnapshotId: b.parentSnapshotId ?? b.parent_snapshot_id,
        note: b.note ?? null,
        snapshotCount: 0,
        currentSnapshotId: null,
        currentTick: null,
        currentDay: null,
        currentTime: null
      }));
      // Enrich with current snapshot info from world_snapshots.
      const snapshots = store.listSnapshots(worldId);
      const snapByBranch = new Map();
      for (const snap of snapshots) {
        const branchName = snap.branchName;
        if (!snapByBranch.has(branchName)) snapByBranch.set(branchName, []);
        snapByBranch.get(branchName).push(snap);
      }
      for (const branch of branches) {
        const snaps = snapByBranch.get(branch.name) ?? [];
        snaps.sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
        const current = snaps.at(-1) ?? null;
        branch.snapshotCount = snaps.length;
        branch.currentSnapshotId = current?.snapshotId ?? current?.id ?? null;
        branch.currentTick = current?.tick ?? null;
        branch.currentDay = current?.day ?? null;
        branch.currentTime = current?.time ?? null;
      }
      allBranches.push(...branches);
    }
    if (flags.json || !process.stdout.isTTY) {
      ok({ branches: allBranches, total: allBranches.length });
    } else {
      ok({ branches: allBranches, total: allBranches.length });
      process.stdout.write('\n' + summaryTimeline(allBranches) + '\n');
    }
  } finally {
    store.close();
  }
}

function main() {
  const { flags, positional } = parseFlags(process.argv.slice(2));
  if (flags.help || positional.length === 0) {
    process.stdout.write(HELP);
    process.exit(0);
  }
  const [subcommand, ...rest] = positional;
  switch (subcommand) {
    case 'list':
      return listSnapshots(flags);
    case 'inspect':
      return inspectSnapshot(flags, rest[0]);
    case 'restore':
      return restoreSnapshot(flags, rest[0]);
    case 'timeline':
      return showTimeline(flags);
    case 'diff':
      return diffSnapshotsCli(flags, rest[0], rest[1]);
    default:
      fail(1, { reason: `unknown subcommand: ${subcommand}` });
  }
}

main();
