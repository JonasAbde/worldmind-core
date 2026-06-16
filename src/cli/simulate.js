#!/usr/bin/env node
import path from 'node:path';
import { runSimulation, evaluateWorld } from '../simulation/sim.ts';
import { generateDashboard } from '../simulation/dashboard.ts';
import { lenoSummarize, lenoSuggestActions } from '../simulation/leno.ts';
import { openSqliteWorldStore } from '../persistence/sqlite.js';
import { diffWorldStates, formatBranchList, formatSnapshotList } from '../simulation/timeline-ux.js';

const args = process.argv.slice(2);

// Robust argument parser: supports both `--key value` (space) and
// `--key=value` (equals). The v0.x CLI used the space form only;
// v1.0-rc2 makes both forms work so the saves CLI can use equals.
function getArg(name) {
  const withEquals = `--${name}=`;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === `--${name}`) {
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) return next;
      return '';
    }
    if (arg.startsWith(withEquals)) return arg.slice(withEquals.length);
  }
  return undefined;
}

function getArgs(name, count = 1) {
  const result = [];
  const withEquals = `--${name}=`;
  for (let i = 0; i < args.length && result.length < count; i += 1) {
    const arg = args[i];
    if (arg === `--${name}`) {
      // Consume up to `count - result.length` consecutive non-flag args.
      const remaining = count - result.length;
      let consumed = 0;
      while (consumed < remaining && i + 1 < args.length) {
        const next = args[i + 1];
        if (next === undefined || next.startsWith('--')) break;
        result.push(next);
        i += 1;
        consumed += 1;
      }
      if (consumed === 0) {
        // --key with no value: treat as boolean (push empty string for
        // compatibility with non-boolean args).
        result.push('');
      }
    } else if (arg.startsWith(withEquals)) {
      result.push(arg.slice(withEquals.length));
    }
  }
  return result;
}

const days = (() => { const v = getArg('days'); return v !== undefined ? Number(v) : 7; })();
const scenarioPath = getArg('scenario') ?? null;
const persist = args.includes('--persist');
const dbPath = getArg('db') ?? undefined;
const loadSnapshotId = getArg('load-snapshot') ?? null;
const continueFromSnapshotId = getArg('continue-from-snapshot') ?? null;
const saveSnapshot = args.includes('--save-snapshot');
const withDashboard = args.includes('--dashboard');
const dashboardDir = getArg('dashboard-dir') ?? 'static-dashboard';
const withAssert = args.includes('--assert');
const listSaves = args.includes('--list-saves');
const listBranches = args.includes('--list-branches');
const [cmpA, cmpB] = getArgs('compare-snapshots', 2);
const compareSnapshots = [cmpA, cmpB].filter(Boolean);
const createBranchSnapshotId = getArg('create-branch') ?? null;
const branchName = getArg('branch-name') ?? null;
const branchNote = getArg('branch-note') ?? '';
const worldId = getArg('world-id') ?? null;

const storeRequired = persist || loadSnapshotId || continueFromSnapshotId || listSaves || listBranches || compareSnapshots.length === 2 || Boolean(createBranchSnapshotId);
const store = storeRequired ? openSqliteWorldStore({ dbPath }).init() : null;

if (listSaves || listBranches || compareSnapshots.length === 2 || createBranchSnapshotId) {
  if (!store) throw new Error('SQLite store required for this command');

  if (createBranchSnapshotId) {
    const branch = store.createTimelineBranch({ snapshotId: createBranchSnapshotId, name: branchName ?? 'branch', note: branchNote });
    console.log('Timeline branch created.');
    console.log(JSON.stringify(branch, null, 2));
  }

  if (compareSnapshots.length === 2) {
    const [leftId, rightId] = compareSnapshots;
    const left = store.loadSnapshot(leftId);
    const right = store.loadSnapshot(rightId);
    const diff = diffWorldStates(left, right);
    console.log(`Timeline diff (${leftId} -> ${rightId})`);
    console.log(JSON.stringify(diff, null, 2));
  }

  if (listSaves) {
    const worldIds = worldId ? [worldId] : store.listWorldIds();
    if (!worldIds.length) {
      console.log('No snapshots found.');
    }
    for (const id of worldIds) {
      console.log(`\nWorld ${id} — snapshots`);
      console.log(formatSnapshotList(store.listSnapshots(id)));
    }
  }

  if (listBranches) {
    const worldIds = worldId ? [worldId] : store.listWorldIds();
    if (!worldIds.length) {
      console.log('No branches found.');
    }
    for (const id of worldIds) {
      console.log(`\nWorld ${id} — branches`);
      console.log(formatBranchList(store.listTimelineBranches(id)));
    }
  }

  store.close();
  process.exit(0);
}

const activeSnapshotId = loadSnapshotId ?? continueFromSnapshotId;
const world = activeSnapshotId
  ? runSimulation({ days, world: store.loadSnapshot(activeSnapshotId) })
  : runSimulation({ days, scenarioPath });
const evalResult = evaluateWorld(world);
console.log('WorldMind simulation complete.');
console.log(JSON.stringify(evalResult, null, 2));
console.log('\nLeno summary:\n' + lenoSummarize(world));
console.log('\nLeno suggestions:\n- ' + lenoSuggestActions(world).join('\n- '));
if (withDashboard) {
  const out = generateDashboard(world, path.resolve(dashboardDir), { store });
  console.log(`\nDashboard written: ${out.htmlPath}`);
}
if (store && (saveSnapshot || persist || createBranchSnapshotId || activeSnapshotId)) {
  const branchFromSnapshot = createBranchSnapshotId ?? activeSnapshotId;
  const effectiveBranchName = branchName ?? world.branchName ?? (branchFromSnapshot ? 'experiment' : 'main');
  const saved = store.saveSnapshot(world, {
    branchName: effectiveBranchName,
    originSnapshotId: branchFromSnapshot ?? world.branchOriginSnapshotId ?? null,
    parentSnapshotId: branchFromSnapshot ?? world.branchParentSnapshotId ?? null,
    note: branchNote || (branchFromSnapshot ? `continued from snapshot ${branchFromSnapshot}` : 'cli simulation run')
  });
  console.log(`\nSnapshot saved: ${saved.snapshotId} (branch ${saved.branchId}, name ${saved.branchName})`);
  store.close();
}
if (withAssert && !evalResult.passed) {
  console.error('MVP eval failed.');
  process.exit(1);
}
