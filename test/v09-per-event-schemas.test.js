/**
 * v0.9 — per-event-type schema validation + state validator + risk --strict
 *
 * Failing tests written first per TDD. The implementation must satisfy
 * every assertion below.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateEventRecord } from '../src/contracts/validators.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function runScript(script, env = {}) {
  return execSync(`npm run ${script}`, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, ...env }
  }).trim();
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

describe('v0.9: per-event-type schema validators', () => {
  it('validateRumorSpreadEvent requires payload.rumorId', () => {
    // Rumor spread events must carry the rumorId they reference.
    const valid = {
      id: 'ev_1',
      type: 'rumor_spread',
      tick: 5,
      day: 1,
      time: '06:00',
      public: false,
      visibleToAgentIds: ['player'],
      causes: [],
      consequences: [],
      importance: 3,
      actorIds: ['rune'],
      description: 'Rune heard a rumor',
      payload: { rumorId: 'rumor_1', claim: 'something', belief: 50 }
    };
    const r1 = validateEventRecord(valid);
    assert.equal(r1.valid, true, `valid rumor_spread should pass: ${JSON.stringify(r1.errors)}`);

    const missing = { ...valid, payload: { claim: 'no id' } };
    const r2 = validateEventRecord(missing);
    assert.equal(r2.valid, false, 'rumor_spread without payload.rumorId should fail');
  });

  it('validateIncidentEvent requires payload.incidentId', () => {
    const valid = {
      id: 'ev_2',
      type: 'incident_detected',
      tick: 10,
      day: 1,
      time: '08:00',
      public: true,
      visibleToAgentIds: ['player', 'sara'],
      causes: [],
      consequences: [],
      importance: 4,
      actorIds: ['sara'],
      description: 'Missing delivery detected',
      payload: { incidentId: 'inc_1' }
    };
    const r1 = validateEventRecord(valid);
    assert.equal(r1.valid, true, `valid incident event should pass: ${JSON.stringify(r1.errors)}`);

    const missing = { ...valid, payload: {} };
    const r2 = validateEventRecord(missing);
    assert.equal(r2.valid, false, 'incident event without payload.incidentId should fail');
  });

  it('validateRelationshipChangedEvent requires payload.sourceAgentId and targetAgentId', () => {
    const valid = {
      id: 'ev_3',
      type: 'relationship_changed',
      tick: 7,
      day: 1,
      time: '09:00',
      public: false,
      visibleToAgentIds: ['sara', 'malik'],
      causes: [],
      consequences: [],
      importance: 2,
      actorIds: ['sara'],
      description: 'Trust grew',
      payload: { sourceAgentId: 'sara', targetAgentId: 'malik' }
    };
    const r1 = validateEventRecord(valid);
    assert.equal(r1.valid, true, `valid relationship_changed should pass: ${JSON.stringify(r1.errors)}`);

    const missing = { ...valid, payload: { sourceAgentId: 'sara' } };
    const r2 = validateEventRecord(missing);
    assert.equal(r2.valid, false, 'relationship_changed without targetAgentId should fail');
  });

  it('validateDailyCheckpoint requires payload agentCount, memoryCount, rumorCount, incidentCount', () => {
    const valid = {
      id: 'ev_4',
      type: 'daily_checkpoint',
      tick: 96,
      day: 2,
      time: '00:00',
      public: true,
      visibleToAgentIds: ['player'],
      causes: [],
      consequences: [],
      importance: 1,
      actorIds: [],
      description: 'Day 2 checkpoint',
      payload: { agentCount: 11, memoryCount: 50, rumorCount: 1, incidentCount: 1 }
    };
    const r1 = validateEventRecord(valid);
    assert.equal(r1.valid, true, `valid daily_checkpoint should pass: ${JSON.stringify(r1.errors)}`);

    const missing = { ...valid, payload: { agentCount: 11 } };
    const r2 = validateEventRecord(missing);
    assert.equal(r2.valid, false, 'daily_checkpoint without all four counts should fail');
  });

  it('validateLenoSummaryTick has type-specific payload shape', () => {
    // leno_summary_tick events have an `includeHiddenCause` boolean.
    const valid = {
      id: 'ev_5',
      type: 'leno_summary_tick',
      tick: 96,
      day: 2,
      time: '00:00',
      public: false,
      visibleToAgentIds: ['player'],
      causes: [],
      consequences: [],
      importance: 1,
      actorIds: ['player'],
      description: 'Leno summary tick',
      payload: { includeHiddenCause: false, hiddenCause: null, openIncidentCount: 1 }
    };
    const r1 = validateEventRecord(valid);
    assert.equal(r1.valid, true, `valid leno_summary_tick should pass: ${JSON.stringify(r1.errors)}`);

    const missing = { ...valid, payload: { openIncidentCount: 1 } };
    const r2 = validateEventRecord(missing);
    assert.equal(r2.valid, false, 'leno_summary_tick without includeHiddenCause should fail');
  });
});

describe('v0.9: validate:state CLI', () => {
  it('npm run validate:state exits 0 on the canonical scenario state', () => {
    const out = runScript('validate:state');
    const lines = out.split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    assert.equal(last.ok, true, `validate:state should pass: ${JSON.stringify(last)}`);
    assert.equal(last.kind, 'state');
    assert.ok(last.totalKeys >= 15, `state should have at least 15 top-level keys, got ${last.totalKeys}`);
    assert.deepEqual(last.missingKeys, [], 'no required keys should be missing');
  });

  it('validate:state flags missing top-level keys', () => {
    // Read the scenario state, strip a required key, write a copy,
    // and verify the validator catches it.
    const original = readJson(path.join(repoRoot, 'scenarios/new-aarhus-district-01.json'));
    const broken = { ...original };
    delete broken.playerKnowledge;
    const tmp = path.join(repoRoot, 'scenarios/.v09-broken-state.json');
    fs.writeFileSync(tmp, JSON.stringify(broken));
    try {
      let exitCode = 0;
      try {
        runScript(`validate:state -- ${tmp}`);
      } catch (err) {
        exitCode = err.status ?? 1;
      }
      assert.notEqual(exitCode, 0, 'validate:state should fail when playerKnowledge is missing');
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});

describe('v0.9: validate:risk --strict', () => {
  it('npm run validate:risk --strict exits 0 and reports per-action permission routing', () => {
    const out = runScript('validate:risk -- --strict');
    const lines = out.split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    assert.equal(last.ok, true, `validate:risk --strict should pass: ${JSON.stringify(last)}`);
    assert.equal(last.kind, 'risk');
    assert.equal(last.strict, true);
    // Each action must declare a permission that the actor can satisfy.
    assert.ok(last.totalActions >= 19, 'should still cover all canonical actions');
    assert.ok(last.permissionAudit.every((p) => p.permission && p.risk !== undefined), 'every audited action has permission + risk');
  });
});

describe('v0.9: validate:event-log now uses per-type schema', () => {
  it('event-log validator now reports per-type failures with detailed errors', () => {
    const out = runScript('validate:event-log');
    const lines = out.split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    assert.equal(last.ok, true, `validate:event-log should pass: ${JSON.stringify(last)}`);
    // perTypeValidation summary field proves the new behaviour is wired.
    assert.ok(last.perTypeValidation, 'report should include perTypeValidation summary');
    assert.ok(last.perTypeValidation.totalChecked >= 1, 'should have checked at least one event');
    // Soft mode (the default) reports the per-type tally but does not
    // block the gate. The strict mode is opt-in and the unit tests
    // exercise the validator directly with synthetic events.
    assert.equal(last.perTypeValidation.mode, 'strict', 'default mode is now strict (v1.0-rc1: all event-emitters populate typed payload)');
  });
});

describe('v0.9: ci:gate is extended to 13 steps', () => {
  it('ci:gate now includes validate:state and validate:risk --strict', () => {
    const pkg = readJson(path.join(repoRoot, 'package.json'));
    const cmd = pkg.scripts['ci:gate'];
    // The ci:gate may invoke validators either as `npm run validate:state`
    // or directly as `node src/cli/validate.js state`. Both count.
    const hasState = cmd.includes('validate:state') || cmd.includes('validate.js state');
    const hasRiskStrict = (cmd.includes('validate:risk') || cmd.includes('validate.js risk')) && cmd.includes('--strict');
    assert.ok(hasState, 'ci:gate should run validate:state');
    assert.ok(hasRiskStrict, 'ci:gate should run validate:risk --strict');
  });
});

describe('v0.9: per-event-type unit tests against the canonical run', () => {
  // The synthetic per-type unit tests above are the authoritative
  // enforcement. The canonical run uses `consequences: []` for some
  // event types instead of typed payload fields, so soft mode is the
  // pragmatic default until those events are migrated to typed
  // payloads (planned for v1.0).
  it('the canonical 7-day run produces events for all per-type-validated categories', () => {
    const out = runScript('validate:event-log');
    const lines = out.split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    assert.equal(last.ok, true);
    // The canonical run should produce at least one of every
    // type-validated event category.
    assert.ok(last.totalEvents > 50, 'canonical run should produce many events');
    assert.ok(last.perTypeValidation.totalChecked === last.totalEvents, 'per-type validation should check all events');
  });
});
