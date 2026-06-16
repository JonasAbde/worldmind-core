// v1.0-rc1: typed payload migration tests.
// Every runtime event-emitter must populate payload with the
// type-specific required fields declared in validateEventPayloadByType.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { validateEventRecord, validateEventPayloadByType } from '../src/contracts/validators.js';

const ROOT = process.cwd();

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

test('v1.0 typed payload: validator accepts a canonical daily_checkpoint', () => {
  const ev = {
    id: 'e_test_dc',
    type: 'daily_checkpoint',
    tick: 0, day: 1, time: '00:00',
    actorIds: [],
    locationId: 'apartment',
    description: 'test',
    payload: { agentCount: 1, memoryCount: 0, rumorCount: 0, incidentCount: 0 }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid checkpoint failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical leno_summary_tick', () => {
  const ev = {
    id: 'e_test_leno',
    type: 'leno_summary_tick',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['player'],
    locationId: 'apartment',
    description: 'test',
    payload: { includeHiddenCause: false, hiddenCause: null }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid leno_summary_tick failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical rumor_spread', () => {
  const ev = {
    id: 'e_test_rs',
    type: 'rumor_spread',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['nadia', 'malik'],
    locationId: 'market',
    description: 'test rumor spread',
    payload: { rumorId: 'rumor_test' }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid rumor_spread failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical counter_rumor', () => {
  const ev = {
    id: 'e_test_cr',
    type: 'counter_rumor',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['player'],
    locationId: 'cafe',
    description: 'test counter rumor',
    payload: { rumorId: 'rumor_test' }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid counter_rumor failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical rumor_traced', () => {
  const ev = {
    id: 'e_test_rt',
    type: 'rumor_traced',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['player'],
    locationId: 'market',
    description: 'test rumor traced',
    payload: { rumorId: 'rumor_test', sourceRevealed: false }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid rumor_traced failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical relationship_changed', () => {
  const ev = {
    id: 'e_test_rc',
    type: 'relationship_changed',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['sara', 'malik'],
    locationId: 'cafe',
    description: 'test rel change',
    payload: { sourceAgentId: 'sara', targetAgentId: 'malik', reason: 'test', numericImpact: 5 }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid relationship_changed failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical economy_pressure', () => {
  const ev = {
    id: 'e_test_ep',
    type: 'economy_pressure',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['sara', 'yasin'],
    locationId: 'cafe',
    description: 'test economy pressure',
    payload: { foodPrice: 20 }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid economy_pressure failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical delivery_failed', () => {
  const ev = {
    id: 'e_test_df',
    type: 'delivery_failed',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['malik', 'sara'],
    locationId: 'market',
    description: 'test delivery failed',
    payload: { fromLocationId: 'market', toLocationId: 'cafe' }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid delivery_failed failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical delivery_restored', () => {
  const ev = {
    id: 'e_test_dr',
    type: 'delivery_restored',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['player', 'sara', 'malik'],
    locationId: 'cafe',
    description: 'test delivery restored',
    payload: { fromLocationId: 'market', toLocationId: 'cafe' }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid delivery_restored failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical incident_detected', () => {
  const ev = {
    id: 'e_test_id',
    type: 'incident_detected',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['sara', 'malik'],
    locationId: 'cafe',
    description: 'test incident detected',
    payload: { incidentId: 'missing_delivery' }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid incident_detected failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical incident_resolved', () => {
  const ev = {
    id: 'e_test_ir',
    type: 'incident_resolved',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['player', 'sara'],
    locationId: 'cafe',
    description: 'test incident resolved',
    payload: { incidentId: 'missing_delivery', resolutionId: 'investigation_and_counter_rumor' }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid incident_resolved failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical rumor_created', () => {
  const ev = {
    id: 'e_test_rumc',
    type: 'rumor_created',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['nadia'],
    locationId: 'market',
    description: 'test rumor created',
    payload: { rumorId: 'rumor_test' }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid rumor_created failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validator accepts a canonical delivery_completed', () => {
  const ev = {
    id: 'e_test_dc2',
    type: 'delivery_completed',
    tick: 0, day: 1, time: '00:00',
    actorIds: ['malik', 'sara'],
    locationId: 'cafe',
    description: 'test delivery completed',
    payload: { fromLocationId: 'market', toLocationId: 'cafe' }
  };
  const r = validateEventRecord(ev);
  assert.equal(r.valid, true, `valid delivery_completed failed: ${JSON.stringify(r)}`);
});

test('v1.0 typed payload: validate:event-log CLI exits 0 in strict mode on canonical run', () => {
  // Running the canonical 7-day sim and feeding it to the strict
  // event-log validator must produce 0 per-type payload violations.
  const out = run('node src/cli/validate-event-log.js');
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true, `validate:event-log failed: ${JSON.stringify(parsed)}`);
  assert.equal(parsed.perTypeValidation.totalFailed, 0, `strict mode found ${parsed.perTypeValidation.totalFailed} violations (expected 0). Sample: ${JSON.stringify(parsed)}`);
  assert.equal(parsed.perTypeValidation.mode, 'strict', `mode is not strict: ${JSON.stringify(parsed.perTypeValidation)}`);
});

test('v1.0 typed payload: ci:gate output flips event-log to strict mode', () => {
  // ci:gate runs validate-event-log.js (which is now strict by default)
  // and the output should contain "mode":"strict", not "mode":"soft".
  const out = run('npm run ci:gate 2>&1');
  assert.ok(out.includes('"mode":"strict"'), `ci:gate did not produce strict mode marker: ${out.slice(-2000)}`);
  assert.ok(!out.includes('"mode":"soft"'), `ci:gate still contains soft mode marker: ${out.slice(-2000)}`);
});

test('v1.0 typed payload: leno.ts exports lenoTickPayload', () => {
  // The lenoTickPayload helper is the typed-payload source for
  // leno_summary_tick events. Confirm the module is wired up.
  // We assert via the file system that the export exists.
  const lenoSrc = fs.readFileSync('src/simulation/leno.ts', 'utf8');
  assert.ok(lenoSrc.includes('export function lenoTickPayload'), 'leno.ts missing lenoTickPayload export');
  assert.ok(lenoSrc.includes('includeHiddenCause'), 'lenoTickPayload missing includeHiddenCause');
  assert.ok(lenoSrc.includes('hiddenCause'), 'lenoTickPayload missing hiddenCause');
});
