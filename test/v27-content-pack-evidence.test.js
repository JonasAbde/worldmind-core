/**
 * v27 — Content pack drives runtime evidence unlocks
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';
import { buildGameplayShellModel } from '../src/play/game-shell-model.js';
import { buildConsequenceBeat } from '../src/play/game-shell-model.js';

test('v27: inspect cafe delivery crate grants cafe_delivery_gap from pack', () => {
  const world = bootstrapWorld();
  const result = resolveCommand(world, 'inspect cafe cafe_delivery_crate');
  assert.equal(result.ok, true);
  assert.ok(result.consequence?.evidenceDelta?.includes('cafe_delivery_gap'));
  assert.ok(world.playerKnowledge.evidenceIds.includes('cafe_delivery_gap'));
});

test('v27: ask rune nadia grants market_rumor_chain from pack dialogue', () => {
  const world = bootstrapWorld();
  const result = resolveCommand(world, 'ask rune nadia');
  assert.equal(result.ok, true);
  assert.ok(result.dialogue?.evidenceIds?.includes('market_rumor_chain'));
  assert.ok(world.playerKnowledge.evidenceIds.includes('market_rumor_chain'));
});

test('v27: three pack evidence ids collectible in investigation loop', () => {
  const world = bootstrapWorld();
  resolveCommand(world, 'inspect cafe cafe_delivery_crate');
  resolveCommand(world, 'listen_rumors market');
  resolveCommand(world, 'ask rune nadia');
  const ids = world.playerKnowledge.evidenceIds;
  assert.ok(ids.includes('cafe_delivery_gap'));
  assert.ok(ids.includes('market_rumor_chain'));
  const shell = buildGameplayShellModel(world, { playerKnowledge: world.playerKnowledge });
  const evidenceCards = shell.caseBoard?.evidenceCards ?? [];
  assert.ok(evidenceCards.some((c) => c.id === 'cafe_delivery_gap'));
});

test('v27: buildConsequenceBeat surfaces evidence category', () => {
  const beat = buildConsequenceBeat({
    evidenceDelta: ['cafe_delivery_gap'],
    moneyDelta: 5,
    lastEvent: { description: 'Inspected café stock' }
  });
  assert.ok(beat.categories.includes('evidence'));
  assert.ok(beat.bullets.some((b) => b.text.includes('cafe_delivery_gap')));
});
