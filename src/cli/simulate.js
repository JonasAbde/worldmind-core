#!/usr/bin/env node
import path from 'node:path';
import { runSimulation, evaluateWorld } from '../simulation/sim.ts';
import { generateDashboard } from '../simulation/dashboard.ts';
import { lenoSummarize, lenoSuggestActions } from '../simulation/leno.ts';
import { openSqliteWorldStore } from '../persistence/sqlite.js';
import { diffWorldStates, formatBranchList, formatSnapshotList } from '../simulation/timeline-ux.js';

const args = process.argv.slice(2);
const daysArg = args.indexOf('--days');
const days = daysArg >= 0 ? Number(args[daysArg + 1]) : 7;
const scenarioArg = args.indexOf('--scenario');
const scenarioPath = scenarioArg >= 0 ? args[scenarioArg + 1] : null;
const persist = args.includes('--persist');
const dbArg = args.indexOf('--db');
const dbPath = dbArg >= 0 ? args[dbArg + 1] : undefined;
const loadSnapshotArg = args.indexOf('--load-snapshot');
const loadSnapshotId = loadSnapshotArg >= 0 ? args[loadSnapshotArg + 1] : null;
const continueFromSnapshotArg = args.indexOf('--continue-from-snapshot');
const continueFromSnapshotId = continueFromSnapshotArg >= 0 ? args[continueFromSnapshotArg + 1] : null;
const saveSnapshot = args.includes('--save-snapshot');
const withDashboard = args.includes('--dashboard');
const withAssert = args.includes('--assert');
const listSaves = args.includes('--list-saves');
const listBranches = args.includes('--list-branches');
const compareArg = args.indexOf('--compare-snapshots');
const compareSnapshots = compareArg >= 0 ? [args[compareArg + 1], args[compareArg + 2]].filter(Boolean) : [];
const createBranchArg = args.indexOf('--create-branch');
const createBranchSnapshotId = createBranchArg >= 0 ? args[createBranchArg + 1] : null;
const branchNameArg = args.indexOf('--branch-name');
const branchName = branchNameArg >= 0 ? args[branchNameArg + 1] : null;
const branchNoteArg = args.indexOf('--branch-note');
const branchNote = branchNoteArg >= 0 ? args[branchNoteArg + 1] : '';
const worldIdArg = args.indexOf('--world-id');
const worldId = worldIdArg >= 0 ? args[worldIdArg + 1] : null;

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
  const out = generateDashboard(world, path.resolve('static-dashboard'), { store });
  console.log(`\nDashboard written: ${out.htmlPath}`);
}
if (store && (saveSnapshot || persist || createBranchSnapshotId || activeSnapshotId)) {
  const branchFromSnapshot = createBranchSnapshotId ?? activeSnapshotId;
  const saved = store.saveSnapshot(world, {
    branchName: branchName ?? world.branchName ?? 'main',
    originSnapshotId: branchFromSnapshot ?? world.branchOriginSnapshotId ?? null,
    parentSnapshotId: branchFromSnapshot ?? world.branchParentSnapshotId ?? null,
    note: branchNote || (branchFromSnapshot ? 'continued from snapshot' : 'cli simulation run')
  });
  console.log(`\nSnapshot saved: ${saved.snapshotId} (branch ${saved.branchId})`);
  store.close();
}
if (withAssert && !evalResult.passed) {
  console.error('MVP eval failed.');
  process.exit(1);
}
