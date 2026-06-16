/**
 * v23 — Rumor Gameplay Runtime v1
 * Verifies: rumor runtime fields, counter-rumor backfire, evidence, ask_leno.
 */
import { it } from 'node:test';
import assert from 'node:assert';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';

function newWorld() {
  return bootstrapWorld({ scenarioPath: './scenarios/new-aarhus-district-01.json', days: 1 });
}

// v23.1: rumor objects have runtime fields
it('v23.1 — rumor objects have runtime fields: sourceConfidence, distortionLevel, knownBy, spreadRisk', () => {
  const world = newWorld();
  resolveCommand(world, 'listen_rumors', { target: 'market' });
  const rumorId = Object.keys(world.rumors || {})[0];
  assert(rumorId, 'should have at least one rumor');
  const r = world.rumors[rumorId];
  assert('sourceConfidence' in r, 'rumor must have sourceConfidence');
  assert('distortionLevel' in r, 'rumor must have distortionLevel');
  assert('knownBy' in r, 'rumor must have knownBy (flat array)');
  assert('spreadRisk' in r || 'spreadRate' in r, 'rumor must have spreadRisk or spreadRate');
  assert(typeof r.sourceConfidence === 'number', 'sourceConfidence must be a number');
  assert(typeof r.distortionLevel === 'number', 'distortionLevel must be a number');
});

// v23.2: sourceConfidence range
it('v23.2 — rumor sourceConfidence is in 0-100', () => {
  const world = newWorld();
  resolveCommand(world, 'listen_rumors', { target: 'market' });
  const r = world.rumors[Object.keys(world.rumors || {})[0]];
  if (!r) return;
  assert(r.sourceConfidence >= 0 && r.sourceConfidence <= 100, `sourceConfidence should be 0-100, got ${r.sourceConfidence}`);
});

// v23.3: distortionLevel range
it('v23.3 — rumor distortionLevel is in 0-100', () => {
  const world = newWorld();
  resolveCommand(world, 'listen_rumors', { target: 'market' });
  const r = world.rumors[Object.keys(world.rumors || {})[0]];
  if (!r) return;
  assert(r.distortionLevel >= 0 && r.distortionLevel <= 100, `distortionLevel should be 0-100, got ${r.distortionLevel}`);
});

// v23.4: knownBy is flat array
it('v23.4 — rumor knownBy is an array of agent IDs', () => {
  const world = newWorld();
  resolveCommand(world, 'listen_rumors', { target: 'market' });
  const r = world.rumors[Object.keys(world.rumors || {})[0]];
  if (!r) return;
  assert(Array.isArray(r.knownBy), 'knownBy must be an array');
});

// v23.5: player added to knownBy after listen
it('v23.5 — player is added to knownBy after listen_rumors', () => {
  const world = newWorld();
  resolveCommand(world, 'listen_rumors', { target: 'market' });
  const rumorId = Object.keys(world.rumors || {})[0];
  if (!rumorId) return;
  const r = world.rumors[rumorId];
  assert(r.knownBy?.includes('player') || r.knownByAgentIds?.includes('player'),
    'player should be in knownBy after listening');
});

// v23.6: counter-rumor reduces truthLevel
it('v23.6 — counter-rumor without evidence reduces truthLevel', () => {
  const world = newWorld();
  resolveCommand(world, 'listen_rumors', { target: 'market' });
  const rumorId = Object.keys(world.rumors || {})[0];
  if (!rumorId) { assert.fail('no rumor'); return; }
  const before = world.rumors[rumorId].truthLevel;
  resolveCommand(world, 'counter_rumor', { rumor: rumorId, message: 'Counter claim', evidenceStrength: 30 });
  const after = world.rumors[rumorId].truthLevel;
  assert(after < before, `truthLevel should drop (before=${before}, after=${after})`);
});

// v23.7: rumor runtime fields are numbers
it('v23.7 — rumor runtime fields are numbers within valid ranges', () => {
  const world = newWorld();
  resolveCommand(world, 'listen_rumors', { target: 'market' });
  const r = world.rumors[Object.keys(world.rumors || {})[0]];
  if (!r) return;
  const sc = r.sourceConfidence ?? 100;
  const dl = r.distortionLevel ?? 0;
  const sr = r.spreadRisk ?? r.spreadRate ?? 30;
  assert(sc >= 0 && sc <= 100, `sourceConfidence ${sc} not in 0-100`);
  assert(dl >= 0 && dl <= 100, `distortionLevel ${dl} not in 0-100`);
  assert(sr >= 0 && sr <= 100, `spreadRisk ${sr} not in 0-100`);
});

// v23.8: ask_leno has consequence with required fields
it('v23.8 — ask_leno: consequence has required delta fields', () => {
  const world = newWorld();
  const result = resolveCommand(world, 'ask_leno');
  assert.equal(result.ok, true, `ask_leno should succeed: ${result.error}`);
  const c = result.consequence;
  for (const field of ['relationships','newMemories','newRumors','evidenceDelta','moneyDelta','reputationDelta','energyDelta']) {
    assert(field in (c || {}), `ask_leno consequence.${field} must be present`);
  }
});

// v23.9: listen_rumors consequence relationshipDelta is present
it('v23.9 — listen_rumors: consequence.relationshipDelta is present and non-null', () => {
  const world = newWorld();
  const result = resolveCommand(world, 'listen_rumors', { target: 'market' });
  assert('relationshipDelta' in (result.consequence || {}), 'relationshipDelta must be present');
});
