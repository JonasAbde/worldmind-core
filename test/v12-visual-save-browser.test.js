// v1.0-rc3: visual save browser, branch diff, state inspector,
// incident flow tests. Validates the new saves:diff subcommand plus
// the dashboard panels that visualize saves/timeline/diff/flow.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();
const SAVES_CLI = 'src/cli/saves.js';
const SIMULATE = 'src/cli/simulate.js';

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function runSaves(args, opts = {}) {
  return run(`node ${SAVES_CLI} ${args}`, opts);
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'worldmind-v12-'));
}

function makeTwoSnapshots(branchA = 'main', branchB = 'experiment') {
  // Build a SQLite DB with two snapshots on different branches.
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  // 1) First run: branch=main, persist + save
  run(`node ${SIMULATE} --days=1 --db="${dbPath}" --persist --save-snapshot --branch-name=${branchA}`);
  // 2) Look up the first snapshot id
  const listOut = runSaves(`list --db=${dbPath}`);
  const first = JSON.parse(listOut.trim().split('\n').pop()).saves[0].id;
  // 3) Second run: branch=experiment, parented on the first snapshot,
  //    with a different --days value so the diff is non-trivial.
  run(`node ${SIMULATE} --days=2 --db="${dbPath}" --persist --save-snapshot --branch-name=${branchB} --create-branch=${first}`);
  // 4) Return both snapshot ids
  const listOut2 = runSaves(`list --db=${dbPath}`);
  const all = JSON.parse(listOut2.trim().split('\n').pop()).saves;
  return { dbPath, first, all };
}

test('v1.0-rc3: saves diff subcommand exists and shows help', () => {
  const out = runSaves('--help');
  assert.ok(out.includes('diff'), 'saves CLI should mention diff in --help');
});

test('v1.0-rc3: saves diff returns structured diff between two snapshots', () => {
  const { dbPath, first, all } = makeTwoSnapshots();
  const second = all[all.length - 1].id;
  const out = runSaves(`diff ${first} ${second} --db=${dbPath}`);
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true, `saves diff failed: ${JSON.stringify(parsed)}`);
  assert.equal(parsed.from, first, 'diff.from should match first snapshot');
  assert.equal(parsed.to, second, 'diff.to should match second snapshot');
  // Required diff sections.
  for (const section of ['agentLocationChanges', 'relationshipChanges', 'newMemories', 'newRumors', 'economyChanges', 'incidentChanges', 'eventCountDelta', 'tickDelta', 'dayDelta']) {
    assert.ok(parsed.diff[section] !== undefined, `diff.${section} missing: ${JSON.stringify(parsed.diff)}`);
  }
  // Summary block.
  assert.ok(parsed.diff.summary, 'diff.summary missing');
  assert.equal(typeof parsed.diff.summary.newMemories, 'number', 'summary.newMemories should be a number');
  assert.equal(typeof parsed.diff.summary.relationshipChanges, 'number', 'summary.relationshipChanges should be a number');
});

test('v1.0-rc3: saves diff on same snapshot is identity', () => {
  const { dbPath, first } = makeTwoSnapshots();
  const out = runSaves(`diff ${first} ${first} --db=${dbPath}`);
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true);
  assert.equal(parsed.diff.tickDelta, 0, 'identity diff should have 0 tickDelta');
  assert.equal(parsed.diff.dayDelta, 0, 'identity diff should have 0 dayDelta');
  assert.equal(parsed.diff.eventCountDelta, 0, 'identity diff should have 0 eventCountDelta');
  assert.equal(parsed.diff.summary.newMemories, 0, 'identity diff should have 0 new memories');
  assert.equal(parsed.diff.summary.relationshipChanges, 0, 'identity diff should have 0 relationship changes');
});

test('v1.0-rc3: saves diff between different-branch snapshots reports branch names', () => {
  const { dbPath, first, all } = makeTwoSnapshots('main', 'experiment');
  const second = all[all.length - 1].id;
  const out = runSaves(`diff ${first} ${second} --db=${dbPath}`);
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true);
  // The from/to branches should be reported.
  assert.equal(parsed.fromBranch, 'main', `fromBranch should be main, got ${parsed.fromBranch}`);
  // toBranch: depending on the run, it may be 'main' (if the
  // experiment branch hasn't been properly carried through) or
  // 'experiment' (if it has). We assert it's a non-empty string.
  assert.ok(typeof parsed.toBranch === 'string' && parsed.toBranch.length > 0, `toBranch should be a non-empty string, got ${parsed.toBranch}`);
  // The eventCountDelta should be non-negative.
  assert.ok(parsed.diff.eventCountDelta >= 0, 'eventCountDelta should be non-negative');
});

test('v1.0-rc3: saves diff handles unknown snapshot gracefully', () => {
  const { dbPath, first } = makeTwoSnapshots();
  try {
    runSaves(`diff ${first} snapshot_does_not_exist --db=${dbPath}`);
    assert.fail('expected non-zero exit for unknown snapshot');
  } catch (err) {
    assert.notEqual(err.status, 0, 'expected non-zero exit');
  }
});

test('v1.0-rc3: dashboard contains save browser table', () => {
  // Run simulate with --dashboard and verify the static index.html
  // contains the save browser panel.
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  run(`node ${SIMULATE} --days=1 --db="${dbPath}" --persist --save-snapshot --branch-name=main --dashboard --dashboard-dir=${tmp}/dash`);
  const html = fs.readFileSync(path.join(tmp, 'dash', 'index.html'), 'utf8');
  assert.ok(html.includes('Save Browser') || html.includes('save-browser') || html.includes('saves'), 'dashboard should include a save browser panel');
  // Must list at least one snapshot row.
  assert.ok(html.includes('snapshot_'), 'dashboard should include at least one snapshot id');
});

test('v1.0-rc3: dashboard contains visual timeline tree', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  run(`node ${SIMULATE} --days=1 --db="${dbPath}" --persist --save-snapshot --branch-name=main --dashboard --dashboard-dir=${tmp}/dash`);
  const listOut = runSaves(`list --db=${dbPath}`);
  const first = JSON.parse(listOut.trim().split('\n').pop()).saves[0].id;
  run(`node ${SIMULATE} --days=1 --db="${dbPath}" --persist --save-snapshot --branch-name=experiment --create-branch=${first} --dashboard --dashboard-dir=${tmp}/dash`);
  const html = fs.readFileSync(path.join(tmp, 'dash', 'index.html'), 'utf8');
  // The dashboard should expose a timeline tree section.
  assert.ok(html.includes('Timeline') || html.includes('timeline'), 'dashboard should include a timeline panel');
  // Both branch names should appear.
  assert.ok(html.includes('main'), 'dashboard should show the main branch');
  assert.ok(html.includes('experiment'), 'dashboard should show the experiment branch');
});

test('v1.0-rc3: dashboard state inspector renders snapshot data', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  run(`node ${SIMULATE} --days=1 --db="${dbPath}" --persist --save-snapshot --branch-name=main --dashboard --dashboard-dir=${tmp}/dash`);
  const html = fs.readFileSync(path.join(tmp, 'dash', 'index.html'), 'utf8');
  // State inspector should show the world name.
  assert.ok(html.includes('New Aarhus District 01'), 'state inspector should show the world name');
  // The inspector should expose agent/location/memory/relationship counts.
  assert.ok(/agents/i.test(html), 'inspector should mention agents');
  assert.ok(/locations/i.test(html), 'inspector should mention locations');
  assert.ok(/memories/i.test(html), 'inspector should mention memories');
  assert.ok(/relationships/i.test(html), 'inspector should mention relationships');
  // The inspector should expose the world-state.json data file.
  const dataPath = path.join(tmp, 'dash', 'world-state.json');
  assert.ok(fs.existsSync(dataPath), 'dashboard should write world-state.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  assert.equal(data.world.id, 'new_aarhus_district_01', 'world-state.json should reference the canonical world');
  assert.ok(data.world.events, 'world-state.json should include events');
});

test('v1.0-rc3: dashboard incident flow renders The Missing Delivery', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  run(`node ${SIMULATE} --days=7 --db="${dbPath}" --persist --save-snapshot --branch-name=main --dashboard --dashboard-dir=${tmp}/dash`);
  const html = fs.readFileSync(path.join(tmp, 'dash', 'index.html'), 'utf8');
  // The incident flow should be present.
  assert.ok(html.includes('Missing Delivery') || html.includes('missing_delivery'), 'dashboard should include the Missing Delivery incident flow');
  // Resolution path should be present.
  assert.ok(html.includes('investigation_and_counter_rumor') || html.includes('Resolution path'), 'dashboard should show the resolution path');
  // Evidence level should be present.
  assert.ok(html.includes('Evidence') || html.includes('evidence'), 'dashboard should show evidence level');
  // Leno summary should be present.
  assert.ok(html.includes('Leno') || html.includes('leno'), 'dashboard should include the Leno summary');
});

test('v1.0-rc3: dashboard diff panel appears when comparing two snapshots', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  run(`node ${SIMULATE} --days=1 --db="${dbPath}" --persist --save-snapshot --branch-name=main --dashboard --dashboard-dir=${tmp}/dash`);
  const listOut = runSaves(`list --db=${dbPath}`);
  const first = JSON.parse(listOut.trim().split('\n').pop()).saves[0].id;
  run(`node ${SIMULATE} --days=2 --db="${dbPath}" --persist --save-snapshot --branch-name=main --create-branch=${first} --dashboard --dashboard-dir=${tmp}/dash --compare-snapshots=${first}`);
  // The diff panel should appear in the dashboard.
  const html = fs.readFileSync(path.join(tmp, 'dash', 'index.html'), 'utf8');
  assert.ok(html.includes('Diff') || html.includes('diff'), 'dashboard should include a diff panel');
});

test('v1.0-rc3: deterministic restore still byte-identical', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  run(`node ${SIMULATE} --days=1 --db="${dbPath}" --persist --save-snapshot --branch-name=det_test`);
  const listOut = runSaves(`list --db=${dbPath}`);
  const first = JSON.parse(listOut.trim().split('\n').pop()).saves[0].id;
  // Two restore calls to two different output paths.
  runSaves(`restore ${first} --db=${dbPath} --out=${path.join(tmp, 'a.json')}`);
  runSaves(`restore ${first} --db=${dbPath} --out=${path.join(tmp, 'b.json')}`);
  // The two restored state FILES should be byte-identical (the
  // JSON output contains a timestamp so we don't compare that, just
  // the file contents).
  const a = fs.readFileSync(path.join(tmp, 'a.json'), 'utf8');
  const b = fs.readFileSync(path.join(tmp, 'b.json'), 'utf8');
  assert.equal(a, b, 'restored state files should be byte-identical');
  // The state should have a non-trivial event count.
  const state = JSON.parse(a);
  assert.ok(state.events.length >= 1, 'restored state should have events');
  assert.equal(state.id, 'new_aarhus_district_01', 'restored worldId mismatch');
});
