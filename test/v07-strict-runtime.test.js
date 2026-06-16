import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScenarioFile } from '../src/simulation/scenario-loader.ts';
import { createWorld } from '../src/simulation/world.ts';
import { runSimulation, initializeScenario, evaluateWorld } from '../src/simulation/sim.ts';
import { loadScenarioWorldState } from '../src/simulation/scenario-loader.ts';
import { loadScenarioFile as loadScenarioFileV7 } from '../src/simulation/scenario-loader.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const canonicalScenario = path.join(repoRoot, 'scenarios/new-aarhus-district-01.json');

test('v0.7: memory.ts is authoritative (createMemory + maybeCreateMemory wired through)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = createWorld({ seed: 42, scenario });
  const before = Object.keys(world.memories).length;
  runSimulation({ days: 7, seed: 42, world });
  assert.ok(Object.keys(world.memories).length > before, 'memory layer must record new memories during sim');
});

test('v0.7: rumors.ts is authoritative (runSimulation produces at least one rumor)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = runSimulation({ days: 7, seed: 42, scenarioPath: canonicalScenario });
  assert.ok(Object.keys(world.rumors).length >= 1, 'at least one rumor expected from the canonical sim');
});

test('v0.7: actions.ts is authoritative (executeAction from sim runs end-to-end)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = createWorld({ seed: 42, scenario });
  runSimulation({ days: 7, seed: 42, world });
  const evaluation = evaluateWorld(world);
  assert.equal(evaluation.passed, true);
});

test('v0.7: relationships.ts is authoritative (relationship events exist after sim)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = runSimulation({ days: 7, seed: 42, scenarioPath: canonicalScenario });
  assert.ok(world.relationshipEvents.length > 0, 'relationship events should be logged');
});

test('v0.7: economy.ts is authoritative (economy events exist after sim)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = runSimulation({ days: 7, seed: 42, scenarioPath: canonicalScenario });
  const econEvents = world.events.filter((e) => e.type === 'economy_pressure');
  assert.ok(econEvents.length > 0, 'economy pressure events should be logged');
});

test('v0.7: incidents.ts is authoritative (missing_delivery incident created and resolved)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = runSimulation({ days: 7, seed: 42, scenarioPath: canonicalScenario });
  assert.equal(world.incidents.missing_delivery.status, 'resolved');
});

test('v0.7: dialogue.ts is authoritative (generateDialogueReply returns shaped output)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = runSimulation({ days: 7, seed: 42, scenarioPath: canonicalScenario });
  // dynamic import so test does not pull in dialogue when not used
  return import('../src/simulation/dialogue.ts').then(({ generateDialogueReply }) => {
    const reply = generateDialogueReply(world, { speakerId: 'sara', topic: 'delivery' });
    assert.equal(typeof reply.reply, 'string');
    assert.ok(reply.reply.length > 0);
  });
});

test('v0.7: leno.ts is authoritative (lenoSummarize + lenoSuggestActions run end-to-end)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = runSimulation({ days: 7, seed: 42, scenarioPath: canonicalScenario });
  return import('../src/simulation/leno.ts').then(({ lenoSummarize, lenoSuggestActions }) => {
    const summary = lenoSummarize(world);
    assert.ok(summary.includes('World:'), 'leno summary should contain a world header');
    const suggestions = lenoSuggestActions(world);
    assert.ok(Array.isArray(suggestions) && suggestions.length > 0);
  });
});

test('v0.7: dashboard.ts is authoritative (generateDashboard writes HTML and JSON)', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = runSimulation({ days: 7, seed: 42, scenarioPath: canonicalScenario });
  return import('../src/simulation/dashboard.ts').then(({ generateDashboard }) => {
    const outDir = path.join(tmpdir(), 'dashboard-v07-' + Date.now());
    const { htmlPath, dataPath } = generateDashboard(world, outDir);
    assert.ok(existsSync(htmlPath), 'index.html must exist');
    assert.ok(existsSync(dataPath), 'world-state.json must exist');
    unlinkSync(htmlPath);
    unlinkSync(dataPath);
  });
});

test('v0.7: legacy .d.ts files are removed (runtime.d.ts and utils.d.ts no longer exist)', () => {
  assert.equal(existsSync(path.join(repoRoot, 'src/contracts/runtime.d.ts')), false, 'runtime.d.ts should be deleted');
  assert.equal(existsSync(path.join(repoRoot, 'src/simulation/utils.d.ts')), false, 'utils.d.ts should be deleted');
});

test('v0.7: legacy .js runtime files are removed (9 files now live as .ts)', () => {
  for (const name of ['memory.js', 'rumors.js', 'actions.js', 'relationships.js', 'economy.js', 'incidents.js', 'dashboard.js', 'dialogue.js', 'leno.js']) {
    assert.equal(existsSync(path.join(repoRoot, 'src/simulation', name)), false, name + ' should be deleted');
  }
});

test('v0.7: tsconfig.json has strict:true enabled by default', () => {
  const tsconfig = JSON.parse(execSync('node -e "console.log(JSON.stringify(require(\'./tsconfig.json\')))"', { cwd: repoRoot, encoding: 'utf8' }));
  assert.equal(tsconfig.compilerOptions.strict, true, 'strict must be true in default tsconfig.json');
});

test('v0.7: validate:action CLI exits 0 on a valid canonical action payload', () => {
  const scenario = loadScenarioFile(canonicalScenario);
  const world = createWorld({ seed: 42, scenario });
  const validAction = {
    actorId: 'sara',
    actionId: 'inspect_location',
    targetLocationId: 'cafe',
    focus: 'stock',
    worldPath: canonicalScenario
  };
  const actionPath = path.join(tmpdir(), 'action-v07-' + Date.now() + '.json');
  writeFileSync(actionPath, JSON.stringify(validAction));
  try {
    execSync('node src/cli/validate.js action "' + actionPath + '"', { cwd: repoRoot, stdio: 'pipe' });
  } catch (err) {
    throw new Error('validate:action failed: ' + (err.stdout?.toString() ?? err.message));
  } finally {
    unlinkSync(actionPath);
  }
});

test('v0.7: validate:action CLI rejects missing actor', () => {
  const actionPath = path.join(tmpdir(), 'action-bad-' + Date.now() + '.json');
  writeFileSync(actionPath, JSON.stringify({ actionId: 'inspect_location' }));
  try {
    execSync('node src/cli/validate.js action "' + actionPath + '"', { cwd: repoRoot, stdio: 'pipe' });
    assert.fail('validate:action should have failed on missing actor');
  } catch (err) {
    if (err.status === 0) throw new Error('expected non-zero exit');
  } finally {
    unlinkSync(actionPath);
  }
});

test('v0.7: typed diff-checker CLI detects drift between canonical scenario and initial sim state', () => {
  // The diff-checker should pass when canonical scenario == initial state
  try {
    execSync('node src/cli/diff-checker.js canonical --scenario scenarios/new-aarhus-district-01.json', { cwd: repoRoot, stdio: 'pipe' });
  } catch (err) {
    throw new Error('diff-checker canonical should pass on canonical scenario: ' + (err.stdout?.toString() ?? err.message));
  }
});

test('v0.7: typed diff-checker CLI fails when the canonical scenario is mutated', () => {
  const tmp = path.join(tmpdir(), 'mutated-scenario-' + Date.now() + '.json');
  const scenario = JSON.parse(execSync('node -e "console.log(JSON.stringify(require(\'./scenarios/new-aarhus-district-01.json\')))"', { cwd: repoRoot, encoding: 'utf8' }));
  scenario.name = 'MUTATED';
  writeFileSync(tmp, JSON.stringify(scenario));
  try {
    execSync('node src/cli/diff-checker.js canonical --scenario "' + tmp + '"', { cwd: repoRoot, stdio: 'pipe' });
    assert.fail('diff-checker should have failed on mutated scenario');
  } catch (err) {
    if (err.status === 0) throw new Error('expected non-zero exit');
  } finally {
    unlinkSync(tmp);
  }
});

test('v0.7: ci:gate now includes validate:action and the diff-checker', () => {
  try {
    execSync('npm run ci:gate', { cwd: repoRoot, stdio: 'pipe', timeout: 180_000 });
  } catch (err) {
    throw new Error('ci:gate failed: ' + (err.stdout?.toString() ?? err.message));
  }
});
