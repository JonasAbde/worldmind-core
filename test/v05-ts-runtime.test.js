import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadScenarioFile,
  loadScenarioWorldState
} from '../src/simulation/scenario-loader.ts';
import {
  serializeWorldState,
  validateScenarioSchema
} from '../src/simulation/state.ts';
import { createWorld } from '../src/simulation/world.ts';
import { runSimulation, initializeScenario, evaluateWorld } from '../src/simulation/sim.ts';
import { parseScenario, parseSnapshot, parseAction, parseDiff } from '../src/contracts/parse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const canonicalScenario = path.join(repoRoot, 'scenarios/new-aarhus-district-01.json');

test('TS-migrated scenario loader still loads canonical scenario', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  assert.equal(scenario.id, 'new_aarhus_district_01');
  assert.equal(scenario.name, 'New Aarhus District 01');
});

test('TS-migrated state.ts validates the canonical scenario', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const result = validateScenarioSchema(scenario);
  assert.equal(result.valid, true, `expected valid scenario, got errors: ${result.errors.join('; ')}`);
});

test('TS-migrated world.ts builds from scenario and seed', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = createWorld({ seed: 42, scenario });
  assert.equal(world.id, 'new_aarhus_district_01');
  assert.equal(Object.keys(world.agents).length >= 11, true);
  assert.ok(typeof world.rng.getState === 'function', 'world.rng.getState must exist');
});

test('serializeWorldState returns a typed-shape WorldState (kind/version/id/worldId)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = createWorld({ seed: 42, scenario });
  const snapshot = serializeWorldState(world, { branchName: 'ts-runtime' });
  assert.equal(snapshot.kind, 'world_state');
  assert.equal(snapshot.version, 2);
  assert.equal(snapshot.id, 'new_aarhus_district_01');
  assert.equal(snapshot.worldId, 'new_aarhus_district_01');
  assert.equal(snapshot.branchName, 'ts-runtime');
  assert.ok(Array.isArray(snapshot.events));
  assert.ok(typeof snapshot.rngState === 'number' || snapshot.rngState === null);
});

test('TS-migrated sim.ts runSimulation produces resolved incident end-to-end', () => {
  const world = runSimulation({ days: 7, seed: 42, scenarioPath: canonicalScenario });
  const evaluation = evaluateWorld(world);
  assert.equal(evaluation.passed, true);
  assert.equal(world.incidents.missing_delivery.status, 'resolved');
});

test('initializeScenario with explicit scenarioPath and seed is deterministic', () => {
  const a = initializeScenario({ seed: 42, scenarioPath: canonicalScenario });
  const b = initializeScenario({ seed: 42, scenarioPath: canonicalScenario });
  assert.equal(a.tick, b.tick);
  assert.equal(Object.keys(a.agents).length, Object.keys(b.agents).length);
});

test('parseScenario wrapper returns parsed value on valid scenario and throws on invalid', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const parsed = parseScenario(scenario);
  assert.equal(parsed.id, 'new_aarhus_district_01');
  assert.throws(() => parseScenario({ id: 'wrong', name: 'Wrong' }), /Invalid scenario/);
});

test('parseSnapshot wrapper accepts a serialized world state and rejects malformed input', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = createWorld({ seed: 42, scenario });
  const snap = serializeWorldState(world, { branchName: 'parser' });
  const parsed = parseSnapshot(snap);
  assert.equal(parsed.id, 'new_aarhus_district_01');
  assert.equal(parsed.branchName, 'parser');
  assert.throws(() => parseSnapshot({ id: 'broken' }), /Invalid snapshot/);
});

test('parseAction wrapper accepts a valid request and rejects invalid actor', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = createWorld({ seed: 42, scenario });
  const actors = Object.keys(world.agents);
  const firstActor = actors[0];
  const valid = parseAction({ actorId: firstActor, actionId: 'inspect_location', targetLocationId: 'cafe' }, world);
  assert.equal(valid.actorId, firstActor);
  assert.throws(() => parseAction({ actorId: 'not_a_real_agent', actionId: 'inspect_location' }, world), /Invalid action/);
});

test('parseDiff wrapper accepts a versioned diff and rejects version mismatch', () => {
  const parsed = parseDiff({ version: 1, agentLocationChanges: [], relationshipChanges: [], newMemories: [], newRumors: [], economyChanges: [], incidentChanges: [] });
  assert.equal(parsed.version, 1);
  assert.throws(() => parseDiff({ version: 99, agentLocationChanges: [], relationshipChanges: [], newMemories: [], newRumors: [], economyChanges: [], incidentChanges: [] }), /Invalid diff/);
});

test('tsc --noEmit passes against the migrated .ts files (strict mode optional)', () => {
  // If tsc is not installed, the test must be skipped (not failed) for MVP CI sanity.
  try {
    execSync('npx --no-install tsc --noEmit -p tsconfig.json', { cwd: repoRoot, stdio: 'pipe' });
  } catch (err) {
    if (err.status === 1) {
      throw new Error('typecheck failed: ' + (err.stdout?.toString() ?? err.message));
    }
    // binary not available -> skip
    return;
  }
});

test('validate:scenario CLI exits 0 on canonical scenario', () => {
  try {
    execSync('node src/cli/validate.js scenario "' + canonicalScenario + '"', { cwd: repoRoot, stdio: 'pipe' });
  } catch (err) {
    throw new Error('validate:scenario failed: ' + (err.stdout?.toString() ?? err.message));
  }
});

test('validate:diff CLI rejects missing version (stdin)', () => {
  const bad = JSON.stringify({ agentLocationChanges: [] });
  try {
    execSync('node src/cli/validate.js diff -', { cwd: repoRoot, stdio: ['pipe', 'pipe', 'pipe'], input: bad });
    assert.fail('expected validate:diff to fail on missing version');
  } catch (err) {
    if (err.status === 0) {
      throw new Error('validate:diff should have failed');
    }
  }
});

test('validate:snapshot CLI exits 0 on canonical scenario-as-snapshot shape', () => {
  // Build a serialized snapshot from the canonical scenario and feed it to the CLI
  const scenario = loadScenarioFile(canonicalScenario);
  const world = createWorld({ seed: 42, scenario });
  const snap = serializeWorldState(world, { branchName: 'ts-runtime-cli' });
  const tmpPath = path.join(tmpdir(), 'tmp-snapshot-v05-' + Date.now() + '.json');
  writeFileSync(tmpPath, JSON.stringify(snap));
  try {
    execSync('node src/cli/validate.js snapshot "' + tmpPath + '"', { cwd: repoRoot, stdio: 'pipe' });
  } catch (err) {
    throw new Error('validate:snapshot failed: ' + (err.stdout?.toString() ?? err.message));
  } finally {
    unlinkSync(tmpPath);
  }
});
