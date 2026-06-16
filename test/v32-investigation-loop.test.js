/**
 * v32 — Investigation loop: rumors, trace, case board, Leno suggestions, major decisions
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';
import { buildGameplayShellModel } from '../src/play/game-shell-model.js';
import { lenoSuggestActions } from '../src/simulation/leno.ts';

function worldWithActiveIncident() {
  const world = bootstrapWorld();
  world.playerKnowledge = {
    evidenceIds: [],
    knownRumorIds: [],
    suspectedCauses: [],
    unresolvedQuestions: []
  };
  world.incidents = {
    missing_delivery: {
      id: 'missing_delivery',
      status: 'active',
      title: 'The Missing Delivery',
      resolutionState: 'unresolved',
      knownFacts: ['Sara is low on supplies.'],
      involvedAgentIds: ['sara', 'malik', 'nadia', 'rune']
    }
  };
  world.questProgress = { questId: 'quest_missing_delivery', completedSteps: [], resolvedPathId: null };
  if (world.agents?.rune?.relationships?.player) {
    world.agents.rune.relationships.player.trust = 5;
  }
  return world;
}

test('v32.1 — listen_rumors at market adds pack rumor to playerKnowledge', () => {
  const world = worldWithActiveIncident();
  const result = resolveCommand(world, 'listen_rumors market');
  assert.equal(result.ok, true, result.error);

  const pk = world.playerKnowledge;
  assert.ok(pk.knownRumorIds.includes('rumor_missing_delivery_blame'), 'pack rumor id should be known');
  assert.ok(pk.evidenceIds.includes('market_rumor_chain'), 'market rumor chain evidence granted');
});

test('v32.2 — trace_rumor grants rumor_source_nadia when investigation trail exists', () => {
  const world = worldWithActiveIncident();
  resolveCommand(world, 'listen_rumors market');
  const rumorId = Object.keys(world.rumors || {})[0];
  assert.ok(rumorId, 'expected runtime rumor from simulation');

  const trace = resolveCommand(world, 'trace_rumor', { rumor: rumorId });
  assert.equal(trace.ok, true, trace.error);
  assert.ok(
    world.playerKnowledge.evidenceIds.includes('rumor_source_nadia'),
    'trace should reveal Nadia as rumor source with market trail'
  );
});

test('v32.3 — caseBoard suspectCards unlock from pack evidence thresholds', () => {
  const world = worldWithActiveIncident();
  let shell = buildGameplayShellModel(world);
  const suspects = shell.caseBoard.suspectCards;
  assert.ok(suspects.some((s) => s.id === 'sara' && !s.locked));
  assert.ok(suspects.some((s) => s.id === 'nadia' && s.locked));

  resolveCommand(world, 'listen_rumors market');
  const rumorId = Object.keys(world.rumors || {})[0];
  resolveCommand(world, 'trace_rumor', { rumor: rumorId });

  shell = buildGameplayShellModel(world);
  const nadia = shell.caseBoard.suspectCards.find((s) => s.id === 'nadia');
  assert.ok(nadia, 'Nadia suspect card should exist');
  assert.equal(nadia.locked, false);
  assert.equal(nadia.inspectCommand, 'ask rune nadia');
});

test('v32.4 — gameShell exposes top 3 Leno command suggestions after ask_leno', () => {
  const world = worldWithActiveIncident();
  const lenoResult = resolveCommand(world, 'ask_leno');
  assert.equal(lenoResult.ok, true);
  assert.ok(Array.isArray(lenoResult.leno?.suggestions));
  assert.ok(lenoResult.leno.suggestions.length >= 1);

  const shell = buildGameplayShellModel(world, {
    leno: lenoResult.leno,
    playerKnowledge: world.playerKnowledge
  });
  assert.ok(shell.leno?.suggestions?.length <= 3);
  assert.ok(shell.leno.suggestions.every((s) => typeof s === 'string' && !s.includes(':')));
  const actionable = lenoSuggestActions(world, { incidentId: 'missing_delivery' });
  assert.deepEqual(shell.leno.suggestions, actionable.slice(0, 3));
});

test('v32.5 — majorDecisions hide resolved path decisions', () => {
  const world = worldWithActiveIncident();
  const before = buildGameplayShellModel(world);
  assert.ok(before.majorDecisions.some((d) => d.id === 'peaceful_mediation'));
  assert.ok(before.majorDecisions.some((d) => d.id === 'investigation_and_counter_rumor'));

  world.questProgress.resolvedPathId = 'peaceful_mediation';
  world.incidents.missing_delivery.status = 'resolved';

  const after = buildGameplayShellModel(world);
  assert.ok(!after.majorDecisions.some((d) => d.id === 'peaceful_mediation'));
  assert.ok(!after.majorDecisions.some((d) => d.id === 'investigation_and_counter_rumor'));
  assert.ok(!after.majorDecisions.some((d) => d.id === 'founder_negotiation'));
  assert.ok(after.majorDecisions.some((d) => d.id === 'protect_sara_privately'));
});
