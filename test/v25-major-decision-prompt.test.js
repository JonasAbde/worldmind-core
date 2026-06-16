/**
 * v25 — majorDecisionPrompt on consequential commands
 */
import { it } from 'node:test';
import assert from 'node:assert';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';
import {
  detectMajorDecisionFromCommand,
  resolveMajorDecisionPrompt
} from '../src/play/game-shell-model.js';

function newWorld() {
  return bootstrapWorld({ scenarioPath: './scenarios/new-aarhus-district-01.json', days: 1 });
}

function unlockFounder(world) {
  world.incidents = {
    missing_delivery: { id: 'missing_delivery', status: 'resolved', title: 'The Missing Delivery' }
  };
  world.founder = {
    unlocked: true,
    baseLevel: 0,
    reputation: 0,
    contractsCompleted: 0,
    activeContract: null
  };
}

it('v25.1 — detectMajorDecisionFromCommand matches pay >= 15', () => {
  const decision = detectMajorDecisionFromCommand('pay malik 20', { evidenceIds: [] });
  assert.equal(decision?.id, 'founder_negotiation');
  assert.equal(decision?.reason, 'pay_threshold');
});

it('v25.2 — detectMajorDecisionFromCommand ignores small pay', () => {
  const decision = detectMajorDecisionFromCommand('pay malik 5', { evidenceIds: [] });
  assert.equal(decision?.id, 'peaceful_mediation');
  assert.notEqual(decision?.reason, 'pay_threshold');
});

it('v25.3 — counter_rumor with rumor id surfaces majorDecisionPrompt', () => {
  const world = newWorld();
  resolveCommand(world, 'listen_rumors', { target: 'market' });
  const rumorId = Object.keys(world.rumors || {})[0];
  assert.ok(rumorId, 'expected a rumor from listen_rumors');

  const result = resolveCommand(world, 'counter_rumor', { rumor: rumorId, message: 'counter claim' });
  assert.equal(result.ok, true);
  assert.ok(result.majorDecisionPrompt, 'counter_rumor should surface majorDecisionPrompt');
  assert.equal(result.majorDecisionPrompt.reason, 'counter_rumor');
  assert.equal(result.majorDecisionPrompt.branchSuggested, true);
});

it('v25.4 — founder tier unlock surfaces majorDecisionPrompt after contract completion', () => {
  const world = newWorld();
  unlockFounder(world);
  world.founder.contractsCompleted = 2;

  resolveCommand(world, 'start_delivery_workflow', { contract: 'delivery_sara_emergency' });
  const result = resolveCommand(world, 'run_delivery_contract');

  assert.equal(result.ok, true);
  assert.ok(result.consequence?.unlocks?.includes('founder_tier_1'));
  assert.ok(result.majorDecisionPrompt, 'tier unlock should surface majorDecisionPrompt');
  assert.equal(result.majorDecisionPrompt.id, 'founder_tier_unlock');
  assert.equal(result.majorDecisionPrompt.reason, 'founder_tier_unlock');
  assert.match(result.majorDecisionPrompt.label, /District courier/);
});

it('v25.5 — resolveMajorDecisionPrompt prefers command match over consequence', () => {
  const prompt = resolveMajorDecisionPrompt({
    commandText: 'pay malik 15',
    playerKnowledge: { evidenceIds: [] },
    consequence: { unlocks: ['founder_tier_1'] }
  });
  assert.equal(prompt?.id, 'founder_negotiation');
});
