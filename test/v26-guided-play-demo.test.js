/**
 * v26 — Guided play demo (peaceful path → founder tier 1).
 */
import { it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGuidedPlayDemo } from '../src/cli/demo-guided-play.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCENARIO = './scenarios/new-aarhus-district-01.json';

it('v26.1 — runGuidedPlayDemo reaches peaceful resolution and founder tier 1', () => {
  const report = runGuidedPlayDemo({ scenarioPath: SCENARIO, days: 1 });
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.kind, 'guided-play-demo');
  assert.equal(report.path, 'peaceful');
  assert.equal(report.incident.status, 'resolved');
  assert.equal(report.incident.resolutionState, 'peaceful_mediation');
  assert.equal(report.founder.unlocked, true);
  assert.equal(report.contractsCompleted, 3);
  assert.equal(report.baseLevel, 1);
});

it('v26.2 — guided demo steps are deterministic across runs', () => {
  const a = runGuidedPlayDemo({ scenarioPath: SCENARIO, days: 1 });
  const b = runGuidedPlayDemo({ scenarioPath: SCENARIO, days: 1 });
  assert.deepEqual(
    JSON.stringify(a),
    JSON.stringify(b),
    'guided demo report should be byte-stable'
  );
});

it('v26.3 — guided demo records bootstrap, resolution, and contract phases', () => {
  const report = runGuidedPlayDemo({ scenarioPath: SCENARIO, days: 1 });
  const phases = report.steps.map((s) => s.phase);
  assert.ok(phases.includes('bootstrap'));
  assert.ok(phases.includes('incident_resolution'));
  assert.equal(phases.filter((p) => p === 'contract_start').length, 3);
  assert.equal(phases.filter((p) => p === 'contract_complete').length, 3);
});

it('v26.4 — demo:guided-play CLI exits 0 and prints JSON', () => {
  const out = execSync('node src/cli/demo-guided-play.js', {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60_000
  }).trim();
  const lines = out.split('\n').filter(Boolean);
  const report = JSON.parse(lines[lines.length - 1]);
  assert.equal(report.ok, true, out);
  assert.equal(report.contractsCompleted, 3);
  assert.equal(report.baseLevel, 1);
  assert.equal(report.founder.unlocked, true);
});
