/**
 * v35 — SHIP gameplay eval: investigation loop from docs/52_FULL_FEATURED_GAMEPLAY_EXPANSION_PLAN.md
 *
 * Scripted path through play-engine:
 *   move → inspect hotspot → talk/ask + rumors → case board / rumor trail / quest / XP / Leno
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';
import { buildGameplayShellModel } from '../src/play/game-shell-model.js';
import { getContentPack } from '../src/play/content-pack-runtime.js';

function worldForShipEval() {
  const world = bootstrapWorld({ scenarioPath: './scenarios/new-aarhus-district-01.json', days: 1 });
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
  world.agents.player.locationId = 'market';
  if (world.agents?.rune?.relationships?.player) {
    world.agents.rune.relationships.player.trust = 5;
  }
  return world;
}

test('v35 — SHIP investigation loop: move, inspect, rumor gather, shell + quest + XP', () => {
  const world = worldForShipEval();
  const pack = getContentPack();
  const crateHotspot = pack?.locations?.find((l) => l.id === 'cafe')?.hotspots
    ?.find((h) => h.id === 'cafe_delivery_crate');
  assert.ok(crateHotspot, 'content pack should define cafe_delivery_crate hotspot');

  const xpBefore = world.progression?.xp ?? 0;
  const shellBefore = buildGameplayShellModel(world);
  assert.equal(shellBefore.caseBoard.evidenceCards.length, 0);
  assert.equal(shellBefore.rumorTrail.length, 0);
  assert.equal(shellBefore.location.id, 'market');

  // 1. move to cafe
  const move = resolveCommand(world, 'move cafe');
  assert.equal(move.ok, true, move.error);
  assert.equal(world.agents.player.locationId, 'cafe');
  assert.ok((world.progression?.xp ?? 0) >= xpBefore);

  // 2. inspect delivery crate hotspot
  const inspect = resolveCommand(world, `inspect cafe ${crateHotspot.inspectFocus ?? 'cafe_delivery_crate'}`);
  assert.equal(inspect.ok, true, inspect.error);
  assert.ok(world.playerKnowledge.evidenceIds.includes('cafe_delivery_gap'));

  let shell = buildGameplayShellModel(world, { playerKnowledge: world.playerKnowledge });
  assert.ok(shell.caseBoard.evidenceCards.some((c) => c.id === 'cafe_delivery_gap'));
  assert.ok(shell.questProgress.paths.some((p) => p.id === 'investigation_and_counter_rumor'));
  const invPath = shell.questProgress.paths.find((p) => p.id === 'investigation_and_counter_rumor');
  assert.ok(invPath.steps.find((s) => s.step.startsWith('inspect cafe'))?.done);
  assert.ok((world.progression?.xp ?? 0) > xpBefore, 'inspect should award progression XP');

  // 3. talk + ask + listen for rumors
  const talk = resolveCommand(world, 'talk sara');
  assert.equal(talk.ok, true, talk.error);

  const listen = resolveCommand(world, 'listen_rumors market');
  assert.equal(listen.ok, true, listen.error);
  assert.ok(world.playerKnowledge.knownRumorIds.length >= 1, 'player should know at least one rumor');
  assert.ok(world.playerKnowledge.evidenceIds.includes('market_rumor_chain'));

  shell = buildGameplayShellModel(world, { playerKnowledge: world.playerKnowledge });
  assert.ok(shell.rumorTrail.length >= 1, 'rumorTrail should reflect heard rumors');
  assert.ok(
    shell.caseBoard.rumorCards.length >= 1 || shell.rumorTrail.some((r) => r.claim),
    'case board or rumor trail should surface rumor gameplay'
  );
  const invAfterListen = shell.questProgress.paths.find((p) => p.id === 'investigation_and_counter_rumor');
  assert.ok(invAfterListen.steps.find((s) => s.step.startsWith('listen_rumors'))?.done);

  const ask = resolveCommand(world, 'ask rune nadia');
  assert.equal(ask.ok, true, ask.error);
  assert.ok(
    world.playerKnowledge.evidenceIds.includes('market_rumor_chain'),
    'ask rune nadia grants pack dialogue evidence'
  );

  shell = buildGameplayShellModel(world, { playerKnowledge: world.playerKnowledge });
  const invAfterAsk = shell.questProgress.paths.find((p) => p.id === 'investigation_and_counter_rumor');
  assert.ok(invAfterAsk.steps.filter((s) => s.done).length >= 3, 'quest should advance through investigation steps');
  assert.ok((world.progression?.xp ?? 0) > xpBefore + 20, 'multiple actions should stack progression XP');
  assert.ok(shell.progression?.xp >= world.progression.xp);
  assert.equal(shell.progression.level, world.progression.level);

  // 7. Leno suggestions when investigation trail exists
  assert.ok(Array.isArray(shell.leno?.suggestions));
  assert.ok(shell.leno.suggestions.length >= 1);
  assert.ok(
    shell.leno.suggestions.some((s) => s.includes('trace_rumor') || s.includes('counter_rumor') || s.includes('inspect')),
    `expected actionable Leno hints, got: ${shell.leno.suggestions.join(', ')}`
  );

  const lenoAsk = resolveCommand(world, 'ask_leno');
  assert.equal(lenoAsk.ok, true);
  const shellWithLeno = buildGameplayShellModel(world, {
    leno: lenoAsk.leno,
    playerKnowledge: world.playerKnowledge
  });
  assert.ok(shellWithLeno.leno.suggestions.length <= 3);
  assert.ok(shellWithLeno.leno.summary || shellWithLeno.leno.suggestions.length >= 1);
});

test('v35 — cafe hotspot visible on shell after move', () => {
  const world = worldForShipEval();
  resolveCommand(world, 'move cafe');
  const shell = buildGameplayShellModel(world);
  const hotspot = shell.location.hotspots.find((h) => h.id === 'cafe_delivery_crate');
  assert.ok(hotspot, 'cafe should expose delivery crate hotspot in game shell');
  assert.match(hotspot.command, /^inspect cafe/);
  assert.ok(hotspot.risk >= 1);
});
