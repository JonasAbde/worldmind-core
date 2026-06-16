import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runSimulation } from '../src/simulation/sim.ts';
import { generateDashboard } from '../src/simulation/dashboard.js';
import { buildTimelineUxModel, diffWorldStates, filterWorldEvents, formatSnapshotList, formatBranchList } from '../src/simulation/timeline-ux.js';
import { openSqliteWorldStore } from '../src/persistence/sqlite.js';

function tempDb() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'worldmind-v03-')), 'worldmind.sqlite');
}

test('snapshot browser lists saves with metadata and branch lineage', () => {
  const store = openSqliteWorldStore({ dbPath: tempDb() }).init();
  const world = runSimulation({ days: 1, seed: 42 });
  const first = store.saveSnapshot(world, { branchName: 'main', note: 'baseline' });
  const branch = store.createTimelineBranch({ snapshotId: first.snapshotId, name: 'fork-a', note: 'what if' });
  const continued = store.loadSnapshot(first.snapshotId);
  continued.branchName = branch.name;
  continued.branchOriginSnapshotId = branch.originSnapshotId;
  continued.branchParentSnapshotId = branch.parentSnapshotId;
  continued.advanceTick();
  continued.addEvent({ type: 'branch_probe', locationId: 'apartment', actorIds: ['player'], description: 'branch probe', public: true, visibleToAgentIds: ['player'] });
  const second = store.saveSnapshot(continued, { branchName: branch.name, originSnapshotId: branch.originSnapshotId, parentSnapshotId: branch.parentSnapshotId, note: 'continued on fork' });

  const model = buildTimelineUxModel({ store, world: continued });
  assert.ok(model.snapshots.length >= 2);
  assert.ok(model.branches.some(item => item.name === 'fork-a'));
  assert.ok(model.snapshots.some(item => item.id === second.snapshotId && item.branchName === 'fork-a'));
  assert.equal(model.currentSnapshot.branchName, 'fork-a');
  assert.ok(formatSnapshotList(model.snapshots).includes('fork-a'));
  assert.ok(formatBranchList(model.branches).includes('fork-a'));
  store.close();
});

test('loaded snapshot can continue and preserve branch metadata on new events', () => {
  const dbPath = tempDb();
  const store = openSqliteWorldStore({ dbPath }).init();
  const world = runSimulation({ days: 2, seed: 42 });
  const saved = store.saveSnapshot(world, { branchName: 'main', note: 'baseline' });
  const restored = store.loadSnapshot(saved.snapshotId);
  restored.branchName = 'main';
  restored.branchOriginSnapshotId = saved.snapshotId;
  restored.branchParentSnapshotId = saved.snapshotId;
  restored.advanceTick();
  const event = restored.addEvent({ type: 'resume_probe', locationId: 'apartment', actorIds: ['player'], description: 'resume probe', public: true, visibleToAgentIds: ['player'] });
  assert.equal(event.branchOriginSnapshotId, saved.snapshotId);
  assert.equal(event.branchName, 'main');
  const continued = store.saveSnapshot(restored, { branchName: 'main', originSnapshotId: saved.snapshotId, parentSnapshotId: saved.snapshotId, note: 'continued' });
  const listed = store.listSnapshots(world.id);
  assert.ok(listed.some(item => item.id === continued.snapshotId));
  store.close();
});

test('timeline diff detects changed locations, relationships, memories, rumors, economy, and incidents', () => {
  const before = runSimulation({ days: 1, seed: 42 });
  const after = JSON.parse(JSON.stringify(before));
  after.agents.player.locationId = 'workshop';
  after.agents.player.relationships.sara.suspicion = (after.agents.player.relationships.sara.suspicion ?? 0) + 1;
  after.memories.synthetic_memory = {
    id: 'synthetic_memory',
    agentId: 'player',
    tick: after.tick + 1,
    day: after.day,
    time: after.time,
    category: 'test',
    content: 'Synthetic memory for diff testing.'
  };
  after.rumors.synthetic_rumor = {
    id: 'synthetic_rumor',
    claim: 'Synthetic rumor for diff testing.',
    sourceAgentId: 'nadia',
    truthLevel: 0.5,
    knownByAgentIds: ['player']
  };
  after.economy.foodScarcity += 3;
  after.incidents.missing_delivery.status = 'resolved';
  after.incidents.missing_delivery.resolutionState = 'synthetic_resolution';
  const diff = diffWorldStates(before, after);
  assert.ok(diff.changedAgentLocations.length > 0);
  assert.ok(diff.changedRelationships.length > 0);
  assert.ok(diff.newMemories.length > 0);
  assert.ok(diff.newRumors.length > 0);
  assert.ok(diff.economyChanges.length > 0);
  assert.ok(diff.incidentStatusChanges.length > 0);
});

test('event filtering can scope branch, tick range, actor, and incident', () => {
  const events = [
    { branchName: 'main', tick: 5, actorIds: ['player'], payload: { incidentId: 'missing_delivery' }, description: 'match 1' },
    { branchName: 'main', tick: 50, actorIds: ['player'], payload: { incidentId: 'other_incident' }, description: 'too late' },
    { branchName: 'fork-a', tick: 10, actorIds: ['sara'], payload: { incidentId: 'missing_delivery' }, description: 'wrong actor' }
  ];
  const filtered = filterWorldEvents(events, { branchName: 'main', actorId: 'player', minTick: 0, maxTick: 10, incidentId: 'missing_delivery' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].description, 'match 1');
});

test('dashboard renders save browser and timeline UX sections', () => {
  const dbPath = tempDb();
  const store = openSqliteWorldStore({ dbPath }).init();
  const world = runSimulation({ days: 2, seed: 42 });
  store.saveSnapshot(world, { branchName: 'main', note: 'dashboard baseline' });
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worldmind-dashboard-'));
  const out = generateDashboard(world, outDir, { store });
  const html = fs.readFileSync(out.htmlPath, 'utf8');
  assert.match(html, /Save Browser/i);
  assert.match(html, /Timeline Branches/i);
  assert.match(html, /Snapshot Details/i);
  assert.match(html, /Timeline Diff/i);
  assert.match(html, /Continue from snapshot/i);
  store.close();
});

test('CLI can list snapshots and branches and compare snapshots', () => {
  const dbPath = tempDb();
  const store = openSqliteWorldStore({ dbPath }).init();
  const world = runSimulation({ days: 2, seed: 42 });
  const saved = store.saveSnapshot(world, { branchName: 'main', note: 'cli baseline' });
  store.close();
  const listOutput = execFileSync(process.execPath, ['src/cli/simulate.js', '--list-saves', '--db', dbPath], { cwd: path.resolve('C:/Users/empir/workspace/Project Worldmind'), encoding: 'utf8' });
  assert.match(listOutput, /snapshot/i);
  assert.match(listOutput, /main/i);
  const compareOutput = execFileSync(process.execPath, ['src/cli/simulate.js', '--compare-snapshots', saved.snapshotId, saved.snapshotId, '--db', dbPath], { cwd: path.resolve('C:/Users/empir/workspace/Project Worldmind'), encoding: 'utf8' });
  assert.match(compareOutput, /Timeline diff/i);
});
