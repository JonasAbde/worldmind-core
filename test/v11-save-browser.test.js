// v1.0-rc2: save browser + timeline UX tests.
// Validates the new worldmind saves CLI subcommands: list, inspect,
// restore, and timeline. All tests use the in-memory or temp-file
// path so they don't depend on existing SQLite state.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();
const SAVES_CLI = 'src/cli/saves.js';

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function runSaves(args, opts = {}) {
  return run(`node ${SAVES_CLI} ${args}`, opts);
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'worldmind-saves-test-'));
}

test('v1.0-rc2: saves CLI exists and lists subcommands', () => {
  const out = runSaves('--help');
  // The CLI should expose list/inspect/restore/timeline subcommands.
  assert.ok(out.includes('list'), 'saves CLI missing list subcommand');
  assert.ok(out.includes('inspect'), 'saves CLI missing inspect subcommand');
  assert.ok(out.includes('restore'), 'saves CLI missing restore subcommand');
  assert.ok(out.includes('timeline'), 'saves CLI missing timeline subcommand');
});

test('v1.0-rc2: saves list returns empty when DB is fresh', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  const out = runSaves(`list --db=${dbPath}`);
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true);
  assert.equal(parsed.saves.length, 0, 'fresh DB should have zero saves');
});

test('v1.0-rc2: saves list shows a newly persisted snapshot', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  // simulate.js uses --db PATH (space), saves.js supports --db=PATH
  // (equals). We use the equals form here because execSync treats
  // shell-escaped args more predictably that way.
  const simOut = run(`node src/cli/simulate.js --days 1 --db "${dbPath}" --persist --save-snapshot`);
  assert.ok(simOut.includes('"passed":true') || simOut.includes('WorldMind simulation complete') || simOut.includes('Snapshot saved'), `simulate failed: ${simOut.slice(-500)}`);
  // List saves.
  const out = runSaves(`list --db=${dbPath}`);
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true, `saves list failed: ${JSON.stringify(parsed)}`);
  assert.ok(parsed.saves.length >= 1, `expected at least one save after simulate, got ${JSON.stringify(parsed)}`);
  const save = parsed.saves[0];
  assert.ok(save.id, `save has no id: ${JSON.stringify(save)}`);
  assert.ok(save.branchName, `save has no branchName: ${JSON.stringify(save)}`);
  assert.equal(save.worldId, 'new_aarhus_district_01', `worldId mismatch: ${save.worldId}`);
  assert.ok(typeof save.tick === 'number', 'save.tick should be a number');
  assert.ok(typeof save.day === 'number', 'save.day should be a number');
  assert.ok(save.eventCount >= 1, 'save.eventCount should be >= 1');
});

test('v1.0-rc2: saves inspect returns snapshot details without restoring', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  run(`node src/cli/simulate.js --days 1 --db=${dbPath} --persist --save-snapshot --branch-name=test_branch`);
  const listOut = runSaves(`list --db=${dbPath}`);
  const { saves } = JSON.parse(listOut.trim().split('\n').pop());
  assert.ok(saves.length >= 1, 'no saves found');
  const id = saves[0].id;
  const out = runSaves(`inspect ${id} --db=${dbPath}`);
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true, `inspect failed: ${JSON.stringify(parsed)}`);
  assert.equal(parsed.save.id, id, 'inspect returned wrong save');
  assert.ok(parsed.save.state, 'inspect did not return state');
  assert.ok(parsed.save.state.agents, 'inspect state has no agents');
  assert.equal(parsed.save.state.worldId, 'new_aarhus_district_01', 'inspect worldId mismatch');
  assert.ok(Array.isArray(parsed.save.state.events), 'inspect state.events should be an array');
  assert.equal(parsed.save.branchName, 'test_branch', 'inspect branchName mismatch');
});

test('v1.0-rc2: saves restore produces a deterministic world state', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  run(`node src/cli/simulate.js --days 1 --db="${dbPath}" --persist --save-snapshot --branch-name=restore_test`);
  const listOut = runSaves(`list --db=${dbPath}`);
  const { saves } = JSON.parse(listOut.trim().split('\n').pop());
  const id = saves[0].id;
  // First restore.
  const out1 = runSaves(`restore ${id} --db=${dbPath} --out=${path.join(tmp, 'r1.json')}`);
  const r1 = JSON.parse(out1.trim().split('\n').pop());
  assert.equal(r1.ok, true, `restore failed: ${JSON.stringify(r1)}`);
  // Second restore to the same output path.
  const out2 = runSaves(`restore ${id} --db=${dbPath} --out=${path.join(tmp, 'r2.json')}`);
  const r2 = JSON.parse(out2.trim().split('\n').pop());
  assert.equal(r2.ok, true, `second restore failed: ${JSON.stringify(r2)}`);
  // Both should be byte-identical (deterministic restore).
  const s1 = fs.readFileSync(path.join(tmp, 'r1.json'), 'utf8');
  const s2 = fs.readFileSync(path.join(tmp, 'r2.json'), 'utf8');
  assert.equal(s1, s2, 'restore is not deterministic');
  // The restored state should have the same event count as the snapshot.
  const state = JSON.parse(s1);
  assert.ok(state.events.length >= 1, 'restored state should have events');
  assert.equal(state.worldId, 'new_aarhus_district_01', 'restored worldId mismatch');
});

test('v1.0-rc2: saves restore logs the action', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  run(`node src/cli/simulate.js --days 1 --db="${dbPath}" --persist --save-snapshot --branch-name=log_test`);
  const listOut = runSaves(`list --db=${dbPath}`);
  const { saves } = JSON.parse(listOut.trim().split('\n').pop());
  const id = saves[0].id;
  const out = runSaves(`restore ${id} --db=${dbPath} --actor=qa --reason=unit-test --out=${path.join(tmp, 'r.json')}`);
  const r = JSON.parse(out.trim().split('\n').pop());
  assert.equal(r.ok, true);
  // The restore log should be in the output.
  assert.ok(r.logEntry, 'restore did not return a logEntry');
  assert.equal(r.logEntry.action, 'restore');
  assert.equal(r.logEntry.snapshotId, id);
  assert.equal(r.logEntry.actor, 'qa');
  assert.equal(r.logEntry.reason, 'unit-test');
  assert.ok(r.logEntry.restoredAtTick === saves[0].tick, `logEntry tick mismatch: ${r.logEntry.restoredAtTick} vs ${saves[0].tick}`);
});

test('v1.0-rc2: saves timeline returns branches and origin chain', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  // Persist two different branches using --save-snapshot --branch-name.
  run(`node src/cli/simulate.js --days=1 --db="${dbPath}" --persist --save-snapshot --branch-name=main`);
  // Look up the snapshot id we just created in the main branch.
  const listOut1 = runSaves(`list --db=${dbPath}`);
  const list1 = JSON.parse(listOut1.trim().split('\n').pop());
  const mainSnapshotId = list1.saves[0].id;
  // Create an experiment branch from main's first snapshot.
  run(`node src/cli/simulate.js --days=1 --db="${dbPath}" --persist --save-snapshot --branch-name=experiment --create-branch=${mainSnapshotId}`);
  const out = runSaves(`timeline --db=${dbPath}`);
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true, `timeline failed: ${JSON.stringify(parsed)}`);
  assert.ok(Array.isArray(parsed.branches), 'timeline.branches should be an array');
  assert.ok(parsed.branches.length >= 2, `expected at least 2 branches, got ${parsed.branches.length}: ${JSON.stringify(parsed.branches)}`);
  const main = parsed.branches.find((b) => b.name === 'main');
  const exp = parsed.branches.find((b) => b.name === 'experiment');
  assert.ok(main, `main branch missing from timeline: ${JSON.stringify(parsed.branches)}`);
  assert.ok(exp, `experiment branch missing from timeline: ${JSON.stringify(parsed.branches)}`);
  // experiment should declare its origin (parentSnapshotId) so the
  // user can see the origin chain.
  assert.equal(exp.parentSnapshotId, mainSnapshotId, `experiment.parentSnapshotId mismatch: expected ${mainSnapshotId}, got ${exp.parentSnapshotId}`);
  // The origin chain should be present (each branch reports its
  // originSnapshotId pointing to the canonical origin).
  assert.ok(exp.originSnapshotId, 'experiment should have originSnapshotId');
  // Branches should expose snapshotCount and currentTick.
  assert.equal(typeof main.snapshotCount, 'number', 'main.snapshotCount should be a number');
  assert.equal(typeof exp.snapshotCount, 'number', 'exp.snapshotCount should be a number');
});

test('v1.0-rc2: saves inspect handles unknown id gracefully', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  try {
    runSaves(`inspect snap_does_not_exist --db=${dbPath}`);
    assert.fail('expected non-zero exit for unknown id');
  } catch (err) {
    // Non-zero exit is the expected behavior.
    assert.notEqual(err.status, 0, 'expected non-zero exit');
  }
});

test('v1.0-rc2: saves restore requires --out or default path', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  run(`node src/cli/simulate.js --days 1 --db="${dbPath}" --persist --save-snapshot --branch-name=out_test`);
  const listOut = runSaves(`list --db=${dbPath}`);
  const { saves } = JSON.parse(listOut.trim().split('\n').pop());
  const id = saves[0].id;
  // Without --out, restore should still produce a JSON response with
  // a `restored` boolean and a default in-memory summary (no file).
  const out = runSaves(`restore ${id} --db=${dbPath}`);
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true, `restore without --out failed: ${JSON.stringify(parsed)}`);
  assert.ok(parsed.restored, 'parsed.restored should be true');
  assert.ok(parsed.logEntry, 'parsed.logEntry missing');
});

test('v1.0-rc2: saves list filters by branch', () => {
  const tmp = makeTempDir();
  const dbPath = path.join(tmp, 'worldmind.db');
  run(`node src/cli/simulate.js --days 1 --db="${dbPath}" --persist --save-snapshot --branch-name=alpha`);
  run(`node src/cli/simulate.js --days 1 --db="${dbPath}" --persist --save-snapshot --branch-name=beta`);
  const out = runSaves(`list --db=${dbPath} --branch=alpha`);
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true);
  assert.ok(parsed.saves.every((s) => s.branchName === 'alpha'), `list --branch=alpha returned non-alpha saves: ${JSON.stringify(parsed.saves)}`);
});
