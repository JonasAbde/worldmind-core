/**
 * v21 — Action Outcome Contract v1
 * Verifies resolveCommand() returns a stable, complete result envelope.
 */
import { it } from 'node:test';
import assert from 'node:assert';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';

function newWorld() {
  return bootstrapWorld({ scenarioPath: './scenarios/new-aarhus-district-01.json', days: 1 });
}

const ALL_COMMANDS = ['look','status','inspect','listen_rumors','ask','talk','pay','trace_rumor','counter_rumor','start_delivery_workflow','ask_leno'];

const REQUIRED_CONSEQUENCE = [
  'relationships','relationshipDelta','newMemories','newRumors',
  'moneyDelta','reputationDelta','energyDelta','evidenceDelta',
  'economyDelta','founderDelta','factionDelta','incidentDelta',
  'unlocks','lastEvent'
];

// v21.1: top-level fields
for (const cmd of ALL_COMMANDS) {
  it(`v21.1 — ${cmd}: returns required top-level fields`, () => {
    const world = newWorld();
    const args = cmd === 'inspect' ? { target: 'cafe' } :
      cmd === 'listen_rumors' ? { target: 'market' } :
      cmd === 'ask' ? { target: 'rune', topic: 'nadia' } :
      cmd === 'talk' ? { target: 'sara', message: 'hello' } :
      cmd === 'pay' ? { target: 'malik', amount: 5 } :
      cmd === 'trace_rumor' || cmd === 'counter_rumor' ? { rumor: Object.keys(world.rumors||{})[0] || 'none' } : {};
    const result = resolveCommand(world, cmd, args);
    assert.equal(result.ok, true, `ok should be true for ${cmd}: ${result.error}`);
    assert(result.world !== undefined, 'world should be returned');
  });
}

// v21.2: consequence delta fields
for (const cmd of ALL_COMMANDS) {
  it(`v21.2 — ${cmd}: consequence has all required delta fields`, () => {
    const world = newWorld();
    const args = cmd === 'inspect' ? { target: 'cafe' } :
      cmd === 'listen_rumors' ? { target: 'market' } :
      cmd === 'ask' ? { target: 'rune', topic: 'nadia' } :
      cmd === 'talk' ? { target: 'sara', message: 'hello' } :
      cmd === 'pay' ? { target: 'malik', amount: 5 } :
      cmd === 'trace_rumor' || cmd === 'counter_rumor' ? { rumor: Object.keys(world.rumors||{})[0] || 'none' } : {};
    if (cmd === 'trace_rumor' || cmd === 'counter_rumor') {
      // Pre-condition: need a rumor first
      const r = resolveCommand(world, 'listen_rumors', { target: 'market' });
      const rumorId = Object.keys(world.rumors || {})[0];
      if (!rumorId) { assert.fail('no rumor created'); return; }
      const r2 = resolveCommand(world, cmd, cmd === 'counter_rumor' ? { rumor: rumorId, message: 'counter' } : { rumor: rumorId });
      for (const field of REQUIRED_CONSEQUENCE) {
        assert(field in (r2.consequence || {}), `consequence.${field} must be present for ${cmd}`);
      }
      return;
    }
    const result = resolveCommand(world, cmd, args);
    if (!result.ok) { assert.fail(`command failed: ${result.error}`); return; }
    for (const field of REQUIRED_CONSEQUENCE) {
      assert(field in (result.consequence || {}), `consequence.${field} must be present for ${cmd}`);
    }
  });
}

// v21.3: no hidden-truth leaks
for (const cmd of ['inspect','listen_rumors','ask','talk','pay','trace_rumor','counter_rumor']) {
  it(`v21.3 — ${cmd}: no hiddenCause or secrets in result text`, () => {
    const world = newWorld();
    const args = cmd === 'inspect' ? { target: 'cafe' } :
      cmd === 'listen_rumors' ? { target: 'market' } :
      cmd === 'ask' ? { target: 'rune', topic: 'nadia' } :
      cmd === 'talk' ? { target: 'sara', message: 'hello' } :
      cmd === 'pay' ? { target: 'malik', amount: 5 } : {};
    if (cmd === 'trace_rumor' || cmd === 'counter_rumor') {
      resolveCommand(world, 'listen_rumors', { target: 'market' });
      const rumorId = Object.keys(world.rumors || {})[0];
      if (!rumorId) { assert.fail('no rumor'); return; }
      const r = resolveCommand(world, cmd, cmd === 'counter_rumor' ? { rumor: rumorId, message: 'counter' } : { rumor: rumorId });
      for (const term of ['Nadia planted','hiddenCause','secret','private memory']) {
        assert(!r.text?.includes(term), `${cmd} must not contain "${term}"`);
      }
      return;
    }
    const result = resolveCommand(world, cmd, args);
    for (const term of ['Nadia planted','hiddenCause','secret','private memory']) {
      assert(!result.text?.includes(term), `${cmd} must not contain "${term}"`);
    }
  });
}

// v21.4: moneyDelta sign
it('v21.4 — pay: moneyDelta is negative for player', () => {
  const world = newWorld();
  const result = resolveCommand(world, 'pay', { target: 'malik', amount: 5 });
  assert.equal(result.ok, true);
  assert.ok(result.consequence?.moneyDelta <= 0, 'paying should reduce money');
});

// v21.5: delta types
for (const cmd of ['inspect','listen_rumors','pay']) {
  it(`v21.5 — ${cmd}: all numeric deltas are numbers`, () => {
    const world = newWorld();
    const args = cmd === 'inspect' ? { target: 'cafe' } :
      cmd === 'listen_rumors' ? { target: 'market' } : { target: 'malik', amount: 5 };
    const result = resolveCommand(world, cmd, args);
    const c = result.consequence || {};
    for (const field of ['moneyDelta','reputationDelta','energyDelta','newMemories','newRumors']) {
      assert(typeof c[field] === 'number', `consequence.${field} must be a number`);
    }
  });
}

// v21.6: start_delivery_workflow consequence
it('v21.6 — start_delivery_workflow: founderDelta is present', () => {
  const world = newWorld();
  world.incidents = world.incidents || {};
  world.incidents.missing_delivery = { id: 'missing_delivery', status: 'resolved', title: 'The Missing Delivery' };
  world.founder = { unlocked: true, baseLevel: 0, reputation: 0, contractsCompleted: 0, activeContract: null };
  const result = resolveCommand(world, 'start_delivery_workflow');
  assert.equal(result.ok, true);
  assert('founderDelta' in (result.consequence || {}), 'consequence must have founderDelta');
});

// v21.7: look safeWorldSummary
it('v21.7 — look: safeWorldSummary is present', () => {
  const world = newWorld();
  const result = resolveCommand(world, 'look');
  assert.equal(result.ok, true);
  assert(result.safeWorldSummary !== undefined, 'safeWorldSummary must be present');
  const s = JSON.stringify(result.safeWorldSummary || '');
  for (const term of ['Nadia planted','hiddenCause','private memory','rumor_source_nadia']) {
    assert(!s.includes(term), `safeWorldSummary must not contain "${term}"`);
  }
});

// v21.8: majorDecisionPrompt shape on pay
it('v21.8 — pay: majorDecisionPrompt has required fields if present', () => {
  const world = newWorld();
  const result = resolveCommand(world, 'pay', { target: 'malik', amount: 15 });
  if (result.majorDecisionPrompt) {
    assert(result.majorDecisionPrompt.id !== undefined, 'majorDecisionPrompt.id required');
    assert(result.majorDecisionPrompt.label !== undefined, 'majorDecisionPrompt.label required');
    assert(result.majorDecisionPrompt.requiredEvidence !== undefined, 'majorDecisionPrompt.requiredEvidence required');
  }
});
