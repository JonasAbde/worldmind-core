// v1.0-rc13 — Episode-aware bootstrap: seedPlayableXxx per episode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { bootstrapWorld } from '../src/play/play-engine.js';

const REPO = process.cwd();
const SCENARIO = path.join(REPO, 'scenarios/new-aarhus-district-01.json');

test('bootstrapWorld without episode still seeds missing_delivery (backward compat)', () => {
  const world = bootstrapWorld({ scenarioPath: SCENARIO });
  assert.ok(world.incidents.missing_delivery, 'missing_delivery should still be seeded');
});

test('bootstrapWorld with episode=the-missing-delivery seeds missing_delivery', () => {
  const world = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'the-missing-delivery' });
  assert.ok(world.incidents.missing_delivery);
  assert.equal(world.incidents.missing_delivery.status, 'active');
});

test('bootstrapWorld with episode=noise-along-the-quay seeds noise_complaint_5561', () => {
  const world = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'noise-along-the-quay' });
  assert.ok(world.incidents.noise_complaint_5561, 'noise_complaint_5561 should be seeded');
  assert.equal(world.incidents.noise_complaint_5561.status, 'active');
  assert.equal(world.incidents.noise_complaint_5561.locationId, 'district_square');
  // Should also have evidence linked
  assert.ok(Array.isArray(world.incidents.noise_complaint_5561.linkedEvidence));
  assert.ok(world.incidents.noise_complaint_5561.linkedEvidence.length >= 2);
});

test('bootstrapWorld with episode=ownership-dispute seeds ownership_dispute_5562', () => {
  const world = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'ownership-dispute' });
  assert.ok(world.incidents.ownership_dispute_5562, 'ownership_dispute_5562 should be seeded');
  assert.equal(world.incidents.ownership_dispute_5562.status, 'active');
  assert.equal(world.incidents.ownership_dispute_5562.locationId, 'workshop');
  assert.ok(world.incidents.ownership_dispute_5562.linkedEvidence.includes('workshop_charter_2019'));
  assert.ok(world.incidents.ownership_dispute_5562.linkedEvidence.includes('corporate_ownership_deed'));
});

test('episode seed sets the world\'s _episode metadata', () => {
  const world = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'noise-along-the-quay' });
  assert.equal(world._episode, 'noise-along-the-quay');
});

test('episode seed places player at the episode entry location', () => {
  const world1 = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'the-missing-delivery' });
  assert.equal(world1.agents.player.locationId, 'cafe');

  const world2 = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'noise-along-the-quay' });
  assert.equal(world2.agents.player.locationId, 'district_square');

  const world3 = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'ownership-dispute' });
  assert.equal(world3.agents.player.locationId, 'workshop');
});

test('episode seed creates an unresolved question appropriate for the episode', () => {
  const world = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'noise-along-the-quay' });
  assert.ok(Array.isArray(world.playerKnowledge.unresolvedQuestions));
  assert.ok(world.playerKnowledge.unresolvedQuestions.length >= 1);
  // Should mention something related to noise / signal
  const joined = world.playerKnowledge.unresolvedQuestions.join(' ').toLowerCase();
  assert.match(joined, /noise|signal|quay|audio/);
});

test('unknown episode falls back to the-missing-delivery seed', () => {
  const world = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'unknown-episode' });
  // Falls back to default
  assert.ok(world.incidents.missing_delivery);
  assert.equal(world._episode, 'the-missing-delivery');
});