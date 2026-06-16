import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runSimulation } from '../src/simulation/sim.ts';
import { openSqliteWorldStore } from '../src/persistence/sqlite.js';
import { diffSnapshots } from '../src/persistence/timeline.js';
import { generateDashboard } from '../src/simulation/dashboard.ts';

function tempDbPath(prefix) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), prefix)), 'worldmind.sqlite');
}

test('snapshots can be listed with save-browser metadata', () => {
  const dbPath = tempDbPath('worldmind-save-browser-');
  const store = openSqliteWorldStore({ dbPath }).init();
  const firstWorld = runSimulation({ days: 1, seed: 42 });
  const firstSave = store.saveSnapshot(firstWorld, { branchName: 'main', note: 'first save' });
  const secondWorld = runSimulation({ days: 2, seed: 42 });
  store.saveSnapshot(secondWorld, { branchName: 'main', note: 'second save' });

  const snapshots = store.listSnapshots();
  assert.equal(snapshots.length, 2);
  assert.ok(snapshots.every(snapshot => snapshot.memoryCount > 0));
  assert.ok(snapshots.every(snapshot => snapshot.eventCount > 0));
  assert.equal(snapshots[0].branchName, 'main');
  assert.equal(snapshots[0].originSnapshotId, firstSave.snapshotId);
  store.close();
});

test('branch lineage stays readable across continuation snapshots', () => {
  const dbPath = tempDbPath('worldmind-lineage-');
  const store = openSqliteWorldStore({ dbPath }).init();
  const baseWorld = runSimulation({ days: 1, seed: 42 });
  const baseSave = store.saveSnapshot(baseWorld, { branchName: 'main', note: 'base timeline' });

  const branchWorld1 = store.loadSnapshot(baseSave.snapshotId);
  branchWorld1.branchName = 'alt-path';
  branchWorld1.branchOriginSnapshotId = baseSave.snapshotId;
  branchWorld1.branchParentSnapshotId = baseSave.snapshotId;
  const continued1 = runSimulation({ days: 1, world: branchWorld1 });
  assert.equal(continued1.events.at(-1).branchParentSnapshotId, baseSave.snapshotId);
  const branchSave1 = store.saveSnapshot(continued1, { branchName: 'alt-path', originSnapshotId: baseSave.snapshotId, parentSnapshotId: baseSave.snapshotId, note: 'branch step 1' });

  const branchWorld2 = store.loadSnapshot(branchSave1.snapshotId);
  branchWorld2.branchName = 'alt-path';
  branchWorld2.branchOriginSnapshotId = baseSave.snapshotId;
  branchWorld2.branchParentSnapshotId = branchSave1.snapshotId;
  const continued2 = runSimulation({ days: 1, world: branchWorld2 });
  const branchSave2 = store.saveSnapshot(continued2, { branchName: 'alt-path', originSnapshotId: baseSave.snapshotId, parentSnapshotId: branchSave1.snapshotId, note: 'branch step 2' });

  const branches = store.listTimelineBranches();
  const altBranch = branches.find(branch => branch.name === 'alt-path');
  assert.ok(altBranch);
  assert.equal(altBranch.originSnapshotId, baseSave.snapshotId);
  assert.equal(altBranch.currentSnapshotId, branchSave2.snapshotId);
  assert.equal(altBranch.snapshotCount, 2);
  store.close();
});

test('snapshot can be loaded and continued with branch metadata preserved', () => {
  const dbPath = tempDbPath('worldmind-continue-');
  const store = openSqliteWorldStore({ dbPath }).init();
  const initialWorld = runSimulation({ days: 2, seed: 42 });
  const initialSave = store.saveSnapshot(initialWorld, { branchName: 'main', note: 'initial save' });
  const loadedWorld = store.loadSnapshot(initialSave.snapshotId);
  loadedWorld.branchName = 'main';
  loadedWorld.branchOriginSnapshotId = initialSave.snapshotId;
  loadedWorld.branchParentSnapshotId = initialSave.snapshotId;
  const continuedWorld = runSimulation({ days: 1, world: loadedWorld });
  assert.equal(continuedWorld.events.at(-1).branchOriginSnapshotId, initialSave.snapshotId);
  assert.equal(continuedWorld.events.at(-1).branchParentSnapshotId, initialSave.snapshotId);
  const continuationSave = store.saveSnapshot(continuedWorld, { branchName: 'main', originSnapshotId: initialSave.snapshotId, parentSnapshotId: initialSave.snapshotId, note: 'continued run' });
  assert.equal(continuationSave.parentSnapshotId, initialSave.snapshotId);
  store.close();
});

test('timeline diff detects location, relationship, memory, rumor, economy and incident changes', () => {
  const before = runSimulation({ days: 1, seed: 42 });
  const after = JSON.parse(JSON.stringify(runSimulation({ days: 1, seed: 42 })));
  after.agents.player.locationId = 'cafe';
  after.agents.rune.locationId = 'workshop';
  after.agents.player.relationships.sara.trust += 5;
  after.agents.player.relationships.sara.suspicion += 3;
  after.relationshipEvents.push({ id: 'rel_test', sourceAgentId: 'player', targetAgentId: 'sara', delta: { trust: 5 } });
  after.memories.memory_test = { id: 'memory_test', agentId: 'player', visibility: 'public', content: 'new memory' };
  after.rumors.rumor_test = { id: 'rumor_test', sourceAgentId: 'nadia', claim: 'new rumor', truthLevel: 12 };
  after.economy.foodScarcity = (before.economy.foodScarcity ?? 0) + 1;
  after.incidents.missing_delivery.status = 'open';
  const diff = diffSnapshots(before, after);
  assert.ok(diff.agentLocationChanges.length > 0);
  assert.ok(diff.relationshipChanges.length > 0);
  assert.ok(diff.newMemories.length > 0);
  assert.ok(diff.newRumors.length > 0);
  assert.ok(diff.economyChanges.length > 0);
  assert.ok(diff.incidentChanges.length > 0);
});

test('dashboard renders save-browser and timeline sections', () => {
  const dbPath = tempDbPath('worldmind-dashboard-');
  const store = openSqliteWorldStore({ dbPath }).init();
  const firstWorld = runSimulation({ days: 1, seed: 42 });
  const firstSave = store.saveSnapshot(firstWorld, { branchName: 'main', note: 'dashboard base' });
  const branchWorld = store.loadSnapshot(firstSave.snapshotId);
  branchWorld.branchName = 'branch-a';
  branchWorld.branchOriginSnapshotId = firstSave.snapshotId;
  branchWorld.branchParentSnapshotId = firstSave.snapshotId;
  const continued = runSimulation({ days: 1, world: branchWorld });
  const branchSave = store.saveSnapshot(continued, { branchName: 'branch-a', originSnapshotId: firstSave.snapshotId, parentSnapshotId: firstSave.snapshotId, note: 'dashboard branch' });
  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'worldmind-dashboard-out-')), 'dashboard');
  const out = generateDashboard(continued, outDir, { store, compareSnapshotIds: [firstSave.snapshotId, branchSave.snapshotId] });
  const html = fs.readFileSync(out.htmlPath, 'utf8');
  assert.match(html, /Save Browser/i);
  assert.match(html, /Timeline Branches/i);
  assert.match(html, /Snapshot Details/i);
  assert.match(html, /Timeline Diff/i);
  assert.match(html, /Branch-aware Event Log/i);
  assert.match(html, /Continue from snapshot/i);
  store.close();
});
