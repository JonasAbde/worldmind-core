/**
 * v29 — Quest resolution paths from content pack + trust gates + founder upfront cost
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';
import { buildQuestProgressView, stepMatchesStep } from '../src/play/quest-progress.js';
import { buildGameplayShellModel } from '../src/play/game-shell-model.js';

function worldWithActiveIncident() {
  const world = bootstrapWorld();
  world.incidents = {
    missing_delivery: {
      id: 'missing_delivery',
      status: 'active',
      title: 'The Missing Delivery',
      resolutionState: 'unresolved',
      involvedAgentIds: ['sara', 'malik', 'nadia', 'rune']
    }
  };
  world.founder = { unlocked: false, baseLevel: 0, reputation: 0, contractsCompleted: 0, activeContract: null };
  world.questProgress = { questId: 'quest_missing_delivery', completedSteps: [], resolvedPathId: null };
  if (world.agents?.player?.stats) {
    world.agents.player.stats.money = 100;
    world.agents.player.stats.energy = 100;
  }
  return world;
}

test('v29.1 — step matcher accepts inspect focus variants', () => {
  assert.equal(stepMatchesStep('inspect cafe', 'inspect cafe cafe_delivery_crate'), true);
  assert.equal(stepMatchesStep('trace_rumor', 'trace_rumor rumor_001'), true);
  assert.equal(stepMatchesStep('pay malik 5', 'pay malik 10'), false);
});

test('v29.2 — peaceful path steps resolve missing_delivery incident', () => {
  const world = worldWithActiveIncident();
  const steps = [
    'inspect cafe cafe_delivery_crate',
    'talk sara',
    'ask amina mediation',
    'pay malik 5'
  ];
  let last;
  for (const cmd of steps) {
    last = resolveCommand(world, cmd);
    assert.equal(last.ok, true, `${cmd}: ${last.error}`);
  }
  assert.equal(world.incidents.missing_delivery.status, 'resolved');
  assert.equal(world.questProgress.resolvedPathId, 'peaceful_mediation');
  assert.ok(last.questResolution?.label?.includes('Peaceful'));
});

test('v29.3 — ask rune nadia blocked below trust threshold', () => {
  const world = worldWithActiveIncident();
  if (world.agents?.rune?.relationships?.player) {
    world.agents.rune.relationships.player.trust = 0;
  }
  const blocked = resolveCommand(world, 'ask rune nadia');
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? '', /trust/i);
});

test('v29.4 — founder contract deducts upfront cost on start', () => {
  const world = bootstrapWorld();
  world.incidents = { missing_delivery: { id: 'missing_delivery', status: 'resolved', title: 'The Missing Delivery' } };
  world.founder = { unlocked: true, baseLevel: 0, reputation: 0, contractsCompleted: 0, activeContract: null };
  const moneyBefore = world.agents?.player?.stats?.money ?? 0;
  const start = resolveCommand(world, 'start_delivery_workflow delivery_sara_emergency');
  assert.equal(start.ok, true, start.error);
  const moneyAfterStart = world.agents?.player?.stats?.money ?? 0;
  assert.equal(moneyAfterStart, moneyBefore - 8);
  const run = resolveCommand(world, 'run_delivery_contract');
  assert.equal(run.ok, true, run.error);
  const moneyAfterRun = world.agents?.player?.stats?.money ?? 0;
  assert.ok(moneyAfterRun > moneyAfterStart);
});

test('v29.5 — game shell exposes questProgress and locked topics', () => {
  const world = worldWithActiveIncident();
  if (world.agents?.rune?.relationships?.player) {
    world.agents.rune.relationships.player.trust = 0;
  }
  const shell = buildGameplayShellModel(world);
  assert.ok(shell.questProgress?.paths?.length >= 3);
  const rune = shell.npcCards?.find((c) => c.id === 'rune');
  assert.ok(rune?.lockedTopics?.some((t) => t.topic === 'nadia'));
});
