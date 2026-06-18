// v1.0-rc19 — Episode 2 + 3 playable end-to-end with new NPCs.
//
// noise-along-the-quay (omar/lina/elias/yasin) and ownership-dispute
// (freja/yasin) episodes should bootstrap without errors, seed their
// incident, and let the player talk to episode-specific NPCs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { bootstrapWorld } from '../src/play/play-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.join(__dirname, '..');
const SCENARIO = path.join(REPO, 'scenarios', 'new-aarhus-district-01.json');

test('episode=noise-along-the-quay seeds noise_complaint_5561 incident', () => {
  const world = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'noise-along-the-quay' });
  const incidents = world.incidents || {};
  const hasNoise = Object.values(incidents).some(i => i.id === 'noise_complaint_5561');
  assert.ok(hasNoise, 'noise_complaint_5561 should be seeded');
});

test('episode=noise-along-the-quay has omar, lina, elias as active NPCs', () => {
  const world = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'noise-along-the-quay' });
  const agents = world.agents || {};
  for (const npc of ['omar', 'lina', 'elias']) {
    assert.ok(agents[npc], `episode 2 NPC ${npc} should exist in world.agents`);
  }
});

test('episode=ownership-dispute seeds ownership_dispute_5562 incident', () => {
  const world = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'ownership-dispute' });
  const incidents = world.incidents || {};
  const hasOwnership = Object.values(incidents).some(i => i.id === 'ownership_dispute_5562');
  assert.ok(hasOwnership, 'ownership_dispute_5562 should be seeded');
});

test('episode=ownership-dispute has freja, yasin as active NPCs', () => {
  const world = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'ownership-dispute' });
  const agents = world.agents || {};
  for (const npc of ['freja', 'yasin']) {
    assert.ok(agents[npc], `episode 3 NPC ${npc} should exist in world.agents`);
  }
});

test('every episode-specific NPC has dialogue entries in dialogue-pack.json', () => {
  const dialoguePath = path.join(REPO, 'content', 'dialogue', 'dialogue-pack.json');
  const d = JSON.parse(readFileSync(dialoguePath, 'utf8'));
  const agentIds = new Set(d.dialogue.map(e => e.agentId));
  for (const npc of ['omar', 'lina', 'elias', 'freja', 'yasin']) {
    assert.ok(agentIds.has(npc), `episode-specific NPC ${npc} should have at least 1 dialogue entry`);
  }
});

test('player has unresolvedQuestions tied to the active episode incident', () => {
  // Episode 2: questions about noise source.
  const w2 = bootstrapWorld({ scenarioPath: SCENARIO, episode: 'noise-along-the-quay' });
  const qs = w2.playerKnowledge?.unresolvedQuestions || [];
  assert.ok(qs.length >= 1, 'episode 2 should seed at least 1 unresolved question');
  assert.ok(qs.some(q => /noise|quay|harbor|cargo|press|crane/i.test(q)),
    'at least one question should reference noise/quay/harbor');
});

test('every new NPC has a GLB model file', () => {
  for (const npc of ['omar', 'lina', 'elias', 'freja', 'yasin']) {
    const p = path.join(REPO, 'assets', 'models', 'characters', `${npc}.glb`);
    assert.ok(existsSync(p), `${npc}.glb should exist in assets/models/characters/`);
  }
});