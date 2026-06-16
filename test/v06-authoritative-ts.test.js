import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadScenarioFile,
  loadScenarioWorldState
} from '../src/simulation/scenario-loader.ts';
import { serializeWorldState, validateScenarioSchema } from '../src/simulation/state.ts';
import { createWorld } from '../src/simulation/world.ts';
import { runSimulation, initializeScenario, evaluateWorld } from '../src/simulation/sim.ts';
import { generateDashboard } from '../src/simulation/dashboard.js';
import { parseBranch } from '../src/contracts/parse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const canonicalScenario = path.join(repoRoot, 'scenarios/new-aarhus-district-01.json');

test('v0.6: state.ts is authoritative (loads canonical scenario via .ts import)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  assert.equal(scenario.id, 'new_aarhus_district_01');
});

test('v0.6: world.ts is authoritative (builds world without falling back to .js)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = createWorld({ seed: 42, scenario });
  assert.equal(Object.keys(world.agents).length >= 11, true);
});

test('v0.6: sim.ts is authoritative (runSimulation produces resolved incident)', () => {
  const world = runSimulation({ days: 7, seed: 42, scenarioPath: canonicalScenario });
  const evaluation = evaluateWorld(world);
  assert.equal(evaluation.passed, true);
  assert.equal(world.incidents.missing_delivery.status, 'resolved');
});

test('v0.6: scenario-loader.ts is authoritative (loadScenarioWorldState returns world state)', () => {
  const state = loadScenarioWorldState(canonicalScenario);
  assert.equal(state.kind, 'world_state');
  assert.equal(state.version, 2);
  assert.equal(state.id, 'new_aarhus_district_01');
});

test('v0.6: runtime.d.ts declarations exist for memory, rumors, actions, relationships, economy, incidents, dashboard, dialogue, leno', () => {
  const declPath = path.join(repoRoot, 'src/contracts/runtime.d.ts');
  assert.equal(existsSync(declPath), true, 'runtime.d.ts must exist');
  const content = readFileSync(declPath, 'utf8');
  for (const name of ['memory.js', 'rumors.js', 'actions.js', 'relationships.js', 'economy.js', 'incidents.js', 'dashboard.js', 'dialogue.js', 'leno.js']) {
    assert.equal(content.includes(name), true, 'runtime.d.ts must reference ' + name);
  }
});

test('v0.6: parseBranch wrapper accepts a valid branch and rejects missing fields', () => {
  const valid = parseBranch({
    id: 'branch_a',
    worldId: 'new_aarhus_district_01',
    name: 'test_branch',
    originSnapshotId: 'snap_00001',
    parentSnapshotId: 'snap_00001',
    createdAt: '2026-06-16T00:00:00Z',
    currentTick: 96,
    currentDay: 2,
    currentTime: '00:00'
  });
  assert.equal(valid.id, 'branch_a');
  assert.throws(() => parseBranch({ id: 'broken' }), /Invalid branch/);
});

test('v0.6: validate:branch CLI exits 0 on canonical branch fixture', () => {
  const branchPath = path.join(tmpdir(), 'branch-v06-' + Date.now() + '.json');
  const branch = {
    id: 'branch_v06',
    worldId: 'new_aarhus_district_01',
    name: 'ts_runtime_branch',
    originSnapshotId: 'snap_00001',
    parentSnapshotId: 'snap_00001',
    createdAt: new Date().toISOString(),
    note: 'v0.6 fixture'
  };
  writeFileSync(branchPath, JSON.stringify(branch));
  try {
    execSync('node src/cli/validate.js branch "' + branchPath + '"', { cwd: repoRoot, stdio: 'pipe' });
  } catch (err) {
    throw new Error('validate:branch failed: ' + (err.stdout?.toString() ?? err.message));
  } finally {
    unlinkSync(branchPath);
  }
});

test('v0.6: validate:branch CLI rejects missing originSnapshotId', () => {
  const branchPath = path.join(tmpdir(), 'branch-bad-' + Date.now() + '.json');
  writeFileSync(branchPath, JSON.stringify({ id: 'b', worldId: 'w', name: 'n', parentSnapshotId: 'p' }));
  try {
    execSync('node src/cli/validate.js branch "' + branchPath + '"', { cwd: repoRoot, stdio: 'pipe' });
    assert.fail('validate:branch should have failed on missing originSnapshotId');
  } catch (err) {
    if (err.status === 0) throw new Error('expected non-zero exit');
  } finally {
    unlinkSync(branchPath);
  }
});

test('v0.6: validate:dashboard CLI exits 0 on freshly generated dashboard', () => {
  const outDir = path.join(tmpdir(), 'dashboard-v06-' + Date.now());
  mkdirSync(outDir, { recursive: true });
  const scenario = loadScenarioFile(canonicalScenario);
  const world = runSimulation({ days: 7, seed: 42, scenarioPath: canonicalScenario, world: createWorld({ seed: 42, scenario }) });
  generateDashboard(world, outDir);
  try {
    execSync('node src/cli/validate.js dashboard "' + outDir + '"', { cwd: repoRoot, stdio: 'pipe' });
  } catch (err) {
    throw new Error('validate:dashboard failed: ' + (err.stdout?.toString() ?? err.message));
  }
});

test('v0.6: validate:dashboard CLI fails when a section is removed from the HTML', () => {
  const outDir = path.join(tmpdir(), 'dashboard-bad-' + Date.now());
  mkdirSync(outDir, { recursive: true });
  const htmlPath = path.join(outDir, 'index.html');
  writeFileSync(htmlPath, '<html><body><h1>Agents</h1><p>fake</p></body></html>');
  try {
    execSync('node src/cli/validate.js dashboard "' + outDir + '"', { cwd: repoRoot, stdio: 'pipe' });
    assert.fail('validate:dashboard should have failed when sections are missing');
  } catch (err) {
    if (err.status === 0) throw new Error('expected non-zero exit');
  } finally {
    if (existsSync(htmlPath)) unlinkSync(htmlPath);
  }
});

test('v0.6: ci:gate is the canonical 6-step gate', () => {
  // Smoke test: ci:gate should run end-to-end and exit 0
  try {
    execSync('npm run ci:gate', { cwd: repoRoot, stdio: 'pipe', timeout: 180_000 });
  } catch (err) {
    throw new Error('ci:gate failed: ' + (err.stdout?.toString() ?? err.message));
  }
});
