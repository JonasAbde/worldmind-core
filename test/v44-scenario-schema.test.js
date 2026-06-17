// v1.0-rc12 — JSON Schema validation for scenario loader.
// Plan 54 medium-term: "Add a JSON Schema for content packs so
// authoring errors are caught at load time."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePackShape,
  validateEpisodeShape,
  validateResolutionPathShape,
  validateIncidentShape,
  validateRumorShape,
  validateEvidenceShape,
  validateDialogueEntryShape,
  validateAllScenarios,
  SCHEMA_VERSION
} from '../src/play/scenario-schema.js';

const REPO = process.cwd();

test('SCHEMA_VERSION is set', () => {
  assert.ok(SCHEMA_VERSION);
  assert.match(SCHEMA_VERSION, /^\d+\.\d+/);
});

test('validateEpisodeShape accepts the-missing-delivery', () => {
  const result = validateEpisodeShape({
    id: 'the-missing-delivery',
    title: 'The Missing Delivery',
    status: 'playable_3d_ready',
    district: 'new-aarhus-district-01',
    themes: ['trust'],
    requiredSystems: ['dialogue']
  });
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('validateEpisodeShape rejects missing id', () => {
  const result = validateEpisodeShape({ title: 'No id' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('id')));
});

test('validateResolutionPathShape accepts peaceful_mediation', () => {
  const result = validateResolutionPathShape({
    id: 'peaceful_mediation',
    label: 'Peaceful Mediation',
    risk: 'low',
    steps: ['inspect cafe', 'talk sara'],
    reward: { xp: 40, trust: 8 }
  });
  assert.equal(result.ok, true);
});

test('validateResolutionPathShape rejects invalid risk level', () => {
  const result = validateResolutionPathShape({
    id: 'x',
    label: 'X',
    risk: 'impossible',
    steps: []
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('risk')));
});

test('validateIncidentShape accepts missing_delivery', () => {
  const result = validateIncidentShape({
    id: 'missing_delivery',
    title: 'The Missing Delivery',
    locationId: 'cafe',
    riskLevel: 'high',
    status: 'active',
    linkedEvidence: ['cafe_delivery_gap']
  });
  assert.equal(result.ok, true);
});

test('validateRumorShape accepts rumor_missing_delivery_blame', () => {
  const result = validateRumorShape({
    id: 'rumor_missing_delivery_blame',
    claim: 'Sara may have caused the missing delivery herself.',
    truthLevel: 'false_or_misleading',
    sourceEvidenceId: 'rumor_source_nadia'
  });
  assert.equal(result.ok, true);
});

test('validateRumorShape rejects unknown truthLevel', () => {
  const result = validateRumorShape({
    id: 'x',
    claim: 'y',
    truthLevel: 'maybe',  // invalid
    sourceEvidenceId: 'z'
  });
  assert.equal(result.ok, false);
});

test('validateEvidenceShape accepts cafe_delivery_gap', () => {
  const result = validateEvidenceShape({
    id: 'cafe_delivery_gap',
    title: 'Café delivery gap',
    category: 'logistics'
  });
  assert.equal(result.ok, true);
});

test('validateDialogueEntryShape accepts dialogue_sara_help', () => {
  const result = validateDialogueEntryShape({
    id: 'dialogue_sara_help',
    agentId: 'sara',
    topic: 'delivery',
    tone: 'worried',
    line: 'The community is already feeling the impact.',
    unlocks: ['cafe_delivery_gap']
  });
  assert.equal(result.ok, true);
});

test('validatePackShape aggregates errors from many entries', () => {
  const result = validatePackShape({
    incidents: [
      { id: 'good', title: 'Good', locationId: 'cafe', riskLevel: 'high', status: 'active', linkedEvidence: [] },
      { /* missing fields */ }
    ]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 1);
});

test('validateAllScenarios returns one validation result for the full content tree', () => {
  const result = validateAllScenarios();
  assert.ok(typeof result.ok === 'boolean');
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.counts);
  assert.ok(result.counts.episodes >= 3);
  assert.ok(result.counts.incidents === 3);
  assert.ok(result.counts.rumors === 3);
});

test('validate-scenario-schema CLI passes', async () => {
  const { spawn } = await import('node:child_process');
  const out = await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['src/cli/validate-scenario-schema.js'], { cwd: REPO });
    let buf = '';
    p.stdout.on('data', d => buf += d);
    p.stderr.on('data', d => buf += d);
    p.on('exit', code => code === 0 ? resolve(buf) : reject(new Error(`exit ${code}: ${buf}`)));
  });
  const json = JSON.parse(out.trim().split('\n').pop());
  assert.equal(json.ok, true);
  assert.equal(json.kind, 'scenario-schema-validator');
  assert.ok(Array.isArray(json.checks));
});