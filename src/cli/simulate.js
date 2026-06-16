#!/usr/bin/env node
import path from 'node:path';
import { runSimulation, evaluateWorld } from '../simulation/sim.js';
import { generateDashboard } from '../simulation/dashboard.js';
import { lenoSummarize, lenoSuggestActions } from '../simulation/leno.js';
import { openSqliteWorldStore } from '../persistence/sqlite.js';

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
const saveSnapshot = args.includes('--save-snapshot');
const withDashboard = args.includes('--dashboard');
const withAssert = args.includes('--assert');

const store = (persist || loadSnapshotId) ? openSqliteWorldStore({ dbPath }).init() : null;
const world = loadSnapshotId
  ? runSimulation({ days, world: store.loadSnapshot(loadSnapshotId) })
  : runSimulation({ days, scenarioPath });
const evalResult = evaluateWorld(world);
console.log('WorldMind simulation complete.');
console.log(JSON.stringify(evalResult, null, 2));
console.log('\nLeno summary:\n' + lenoSummarize(world));
console.log('\nLeno suggestions:\n- ' + lenoSuggestActions(world).join('\n- '));
if (withDashboard) {
  const out = generateDashboard(world, path.resolve('static-dashboard'));
  console.log(`\nDashboard written: ${out.htmlPath}`);
}
if (store && (saveSnapshot || persist)) {
  const saved = store.saveSnapshot(world, { branchName: 'main', note: 'cli simulation run' });
  console.log(`\nSnapshot saved: ${saved.snapshotId} (branch ${saved.branchId})`);
  store.close();
}
if (withAssert && !evalResult.passed) {
  console.error('MVP eval failed.');
  process.exit(1);
}
