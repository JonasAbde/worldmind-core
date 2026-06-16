import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runSimulation } from '../src/simulation/sim.js';
import { openSqliteWorldStore } from '../src/persistence/sqlite.js';
import { executeAction } from '../src/simulation/actions.js';
import { ACTIONS } from '../src/simulation/constants.js';
import {
  validateActionRequest,
  validateScenario,
  validateSnapshot,
  validateBranch,
  validateMemory,
  validateRelationship,
  validateRumor,
  validateIncident,
  validateDiff,
  validateLenoContext
} from '../src/contracts/validators.js';
import {
  buildLenoContext,
  diffContracts
} from '../src/contracts/index.js';
import { loadScenarioFile } from '../src/simulation/scenario-loader.js';

function tempDb() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'worldmind-v04-')), 'worldmind.sqlite');
}

test('scenario validator accepts canonical scenario and rejects malformed variants', () => {
  const world = runSimulation({ days: 0, seed: 42 });
  const ok = validateScenario(world);
  assert.equal(ok.valid, true);

  const missingAgents = validateScenario({ ...world, agents: undefined });
  assert.equal(missingAgents.valid, false);
  assert.ok(missingAgents.errors.some(error => error.includes('agents')));

  const wrongId = validateScenario({ ...world, id: 'some_other_world' });
  assert.equal(wrongId.valid, false);
  assert.ok(wrongId.errors.some(error => error.includes('id')));
});

test('action payload validator blocks missing actor, unknown action, and unknown target', () => {
  const world = runSimulation({ days: 0, seed: 42 });
  const baseline = validateActionRequest({ actorId: 'player', actionId: ACTIONS.TALK_TO_AGENT, targetAgentId: 'sara' }, world);
  assert.equal(baseline.valid, true);

  const missingActor = validateActionRequest({ actionId: ACTIONS.TALK_TO_AGENT, targetAgentId: 'sara' }, world);
  assert.equal(missingActor.valid, false);
  assert.ok(missingActor.errors.some(error => error.includes('actorId')));

  const unknownAction = validateActionRequest({ actorId: 'player', actionId: 'launch_missile' }, world);
  assert.equal(unknownAction.valid, false);
  assert.ok(unknownAction.errors.some(error => error.includes('action')));

  const missingTarget = validateActionRequest({ actorId: 'player', actionId: ACTIONS.TALK_TO_AGENT }, world);
  assert.equal(missingTarget.valid, false);
  assert.ok(missingTarget.errors.some(error => error.includes('targetAgentId')));
});

test('executeAction forwards action validator errors as runtime errors', () => {
  const world = runSimulation({ days: 0, seed: 42 });
  assert.throws(() => executeAction(world, { actorId: 'player', actionId: ACTIONS.TALK_TO_AGENT, targetAgentId: 'unknown_agent' }));
});

test('snapshot validator accepts serialized world and rejects snapshots with broken branch metadata', () => {
  const world = runSimulation({ days: 0, seed: 42 });
  const snapshot = {
    ...JSON.parse(JSON.stringify(world)),
    id: 'snapshot_00001',
    worldId: world.id,
    branchName: 'main',
    branchOriginSnapshotId: 'snapshot_00001',
    branchParentSnapshotId: 'snapshot_00001',
    currentSnapshotId: 'snapshot_00001'
  };
  const ok = validateSnapshot(snapshot);
  assert.equal(ok.valid, true, JSON.stringify(ok.errors));

  const corrupted = validateSnapshot({ ...snapshot, events: 'not-an-array' });
  assert.equal(corrupted.valid, false);

  const noBranch = validateSnapshot({ ...snapshot, branchName: '' });
  assert.equal(noBranch.valid, false);
  assert.ok(noBranch.errors.some(error => error.includes('branchName')));
});

test('branch validator requires origin and parent snapshot ids', () => {
  const branch = {
    id: 'branch_main_00001',
    worldId: 'new_aarhus_district_01',
    name: 'main',
    originSnapshotId: 'snapshot_00001',
    parentSnapshotId: 'snapshot_00001',
    createdAt: '2026-01-01T00:00:00.000Z'
  };
  assert.equal(validateBranch(branch).valid, true);
  const missingOrigin = validateBranch({ ...branch, originSnapshotId: null });
  assert.equal(missingOrigin.valid, false);
  const missingParent = validateBranch({ ...branch, parentSnapshotId: '' });
  assert.equal(missingParent.valid, false);
});

test('memory, relationship, rumor and incident validators reject empty or invalid records', () => {
  assert.equal(validateMemory({ id: 'mem_1', agentId: 'player', content: 'hi', createdAtTick: 1 }).valid, true);
  assert.equal(validateMemory({ id: 'mem_1', content: 'hi' }).valid, false);

  assert.equal(validateRelationship({ sourceAgentId: 'player', targetAgentId: 'sara', trust: 0, suspicion: 0, respect: 0, affection: 0, influence: 0 }).valid, true);
  assert.equal(validateRelationship({ sourceAgentId: 'player' }).valid, false);

  assert.equal(validateRumor({ id: 'rumor_1', claim: 'X', sourceAgentId: 'nadia', truthLevel: 30, knownByAgentIds: [] }).valid, true);
  assert.equal(validateRumor({ id: 'rumor_1', claim: '' }).valid, false);

  assert.equal(validateIncident({ id: 'inc_1', title: 'T', status: 'active', involvedAgentIds: ['sara'], knownFacts: [] }).valid, true);
  assert.equal(validateIncident({ id: 'inc_1', title: 'T', status: 'mystery' }).valid, false);
});

test('diff contract detector flags renamed field names', () => {
  const good = diffContracts({ version: 1, sections: ['agentLocationChanges', 'relationshipChanges'] });
  assert.equal(good.valid, true);
  const bad = diffContracts({ version: 1, sections: ['movedAgents'] });
  assert.equal(bad.valid, false);
});

test('Leno context builder never returns hidden cause before evidence and always includes the knownFacts', () => {
  const world = runSimulation({ days: 3, seed: 42 });
  const ctx = buildLenoContext(world, { includeHiddenCause: false });
  assert.equal(validateLenoContext(ctx).valid, true);
  assert.equal(ctx.hiddenCause, null);
  for (const incident of Object.values(world.incidents)) {
    assert.ok(Array.isArray(incident.knownFacts));
    if (incident.status === 'resolved') {
      assert.ok(incident.resolutionState, 'resolved incidents must have resolutionState');
    }
  }
});

test('snapshot round-trip via SQLite keeps branch metadata and validates', () => {
  const dbPath = tempDb();
  const store = openSqliteWorldStore({ dbPath }).init();
  const world = runSimulation({ days: 1, seed: 42 });
  world.branchName = 'main';
  world.branchOriginSnapshotId = 'snapshot_00001';
  world.branchParentSnapshotId = 'snapshot_00001';
  const saved = store.saveSnapshot(world, { branchName: 'main', originSnapshotId: 'snapshot_00001', parentSnapshotId: 'snapshot_00001', note: 'first save' });
  const loaded = store.loadSnapshot(saved.snapshotId);
  const result = validateSnapshot(loaded);
  assert.equal(result.valid, true);
  store.close();
});

test('loadScenarioFile still works through TypeScript-bound validators', () => {
  const scenarioPath = path.resolve('scenarios/new-aarhus-district-01.json');
  const scenario = loadScenarioFile(scenarioPath);
  const result = validateScenario(scenario);
  assert.equal(result.valid, true);
});
