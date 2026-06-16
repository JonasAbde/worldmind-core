import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeScenario, runSimulation } from '../src/simulation/sim.ts';
import { lenoSummarize } from '../src/simulation/leno.ts';
import { ACTIONS } from '../src/simulation/constants.js';
import { executeAction } from '../src/simulation/actions.ts';
import { loadScenarioFile, validateScenarioSchema } from '../src/simulation/scenario-loader.ts';
import { openSqliteWorldStore } from '../src/persistence/sqlite.js';

const canonicalScenarioPath = path.resolve('scenarios/new-aarhus-district-01.json');

test('scenario loader validates and loads the canonical New Aarhus District 01 scenario', () => {
  const scenario = loadScenarioFile(canonicalScenarioPath);
  assert.equal(validateScenarioSchema(scenario).valid, true);
  const world = initializeScenario({ scenarioPath: canonicalScenarioPath });
  assert.equal(world.name, 'New Aarhus District 01');
  assert.equal(Object.keys(world.agents).length, 11);
  assert.equal(Object.keys(world.locations).length, 5);
  assert.ok(Object.values(world.memories).some(m => m.agentId === 'nadia' && m.visibility === 'secret'));
});

test('sqlite persistence can initialize, save a snapshot, restore it, and create a branch', () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'worldmind-sqlite-')), 'worldmind.sqlite');
  const store = openSqliteWorldStore({ dbPath });
  store.init();
  const world = runSimulation({ days: 1, seed: 42 });
  const saved = store.saveSnapshot(world, { branchName: 'main', note: 'canonical save' });
  assert.ok(fs.existsSync(dbPath));
  assert.ok(saved.snapshotId);
  assert.ok(saved.branchId);
  const restored = store.loadSnapshot(saved.snapshotId);
  assert.equal(restored.tick, world.tick);
  assert.equal(restored.day, world.day);
  assert.equal(Object.keys(restored.agents).length, Object.keys(world.agents).length);
  assert.equal(restored.events.length, world.events.length);
  const branch = store.createTimelineBranch({ snapshotId: saved.snapshotId, name: 'alt-path', note: 'what-if' });
  assert.equal(branch.parentSnapshotId, saved.snapshotId);
  assert.equal(branch.name, 'alt-path');
  const branches = store.listTimelineBranches(world.id);
  assert.ok(branches.some(item => item.id === branch.id));
  store.close();
});

test('snapshot restore preserves continuing simulation state and event-log metadata', () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'worldmind-branch-')), 'worldmind.sqlite');
  const store = openSqliteWorldStore({ dbPath });
  store.init();
  const world = runSimulation({ days: 2, seed: 42 });
  const saved = store.saveSnapshot(world, { branchName: 'branch-a', note: 'after two days' });
  const restored = store.loadSnapshot(saved.snapshotId);
  restored.advanceTick();
  restored.addEvent({ type: 'branch_probe', locationId: 'apartment', actorIds: ['player'], description: 'branch probe event', public: true, visibleToAgentIds: ['player'] });
  assert.equal(restored.events.at(-1).branchOriginSnapshotId, saved.snapshotId);
  assert.ok(restored.events.at(-1).branchName);
  store.close();
});

test('evidence unlocks Nadia source tracing but secret content stays hidden', () => {
  const world = runSimulation({ days: 7, seed: 42 });
  const summary = lenoSummarize(world);
  assert.match(summary, /Nadia is a probable source/i);
  assert.doesNotMatch(summary, /I planted the rumor/i);
  assert.doesNotMatch(summary, /secret memory/i);
  assert.ok(world.playerKnowledge.evidenceIds.includes('rune_statement_nadia_workshop'));
  assert.ok(world.playerKnowledge.evidenceIds.includes('rumor_source_nadia'));
});

test('evidence-based unlocks work for trace_rumor and counter_rumor flows', () => {
  const world = runSimulation({ days: 7, seed: 42 });
  const rumorId = Object.keys(world.rumors)[0];
  assert.ok(world.playerKnowledge.evidenceIds.includes('rune_statement_nadia_workshop'));
  assert.ok(world.playerKnowledge.evidenceIds.includes('rumor_source_nadia'));
  const traceRevealed = executeAction(world, { actorId: 'player', actionId: ACTIONS.TRACE_RUMOR, rumorId, evidenceStrength: 80 });
  assert.equal(traceRevealed.payload.sourceRevealed, true);
  const counter = executeAction(world, { actorId: 'player', actionId: ACTIONS.COUNTER_RUMOR, rumorId, counterClaim: 'The rumor was planted.', evidenceStrength: 80 });
  assert.ok(counter.payload.reduction > 0);
  assert.ok(world.rumors[rumorId].truthLevel < 70);
});
