// v1.0-rc19 — Per-episode content: dialogue trees for non-canonical NPCs.
//
// The dialogue-pack.json has 5 entries for episode 1 NPCs. This sprint
// adds 8+ entries for episode 2 + 3 NPCs (omar, freja, elias, yasin, lina)
// covering noise-along-the-quay and ownership-dispute topics.
//
// Also: episode 2 (noise-along-the-quay) needs dialogue for omar (ex-
// Registry investigator, dock context) and lina (harbor trader) so the
// player can resolve the noise complaint. Episode 3 (ownership-dispute)
// needs dialogue for freja (mediator) and yasin (workshop).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.join(__dirname, '..');
const DIALOGUE_PATH = path.join(REPO, 'content', 'dialogue', 'dialogue-pack.json');

test('dialogue-pack.json has at least 12 dialogue entries (was 5)', () => {
  const data = JSON.parse(readFileSync(DIALOGUE_PATH, 'utf8'));
  assert.ok(data.dialogue.length >= 12,
    `dialogue pack should have >=12 entries, got ${data.dialogue.length}`);
});

test('every episode 2 NPC has at least one dialogue entry', () => {
  const data = JSON.parse(readFileSync(DIALOGUE_PATH, 'utf8'));
  // Episode 2 (noise-along-the-quay) cores: omar, lina
  for (const npc of ['omar', 'lina']) {
    const has = data.dialogue.some(d => d.agentId === npc);
    assert.ok(has, `NPC ${npc} should have at least one dialogue entry for episode 2`);
  }
});

test('every episode 3 NPC has at least one dialogue entry', () => {
  const data = JSON.parse(readFileSync(DIALOGUE_PATH, 'utf8'));
  // Episode 3 (ownership-dispute) cores: freja, yasin
  for (const npc of ['freja', 'yasin']) {
    const has = data.dialogue.some(d => d.agentId === npc);
    assert.ok(has, `NPC ${npc} should have at least one dialogue entry for episode 3`);
  }
});

test('every dialogue entry has required fields', () => {
  const data = JSON.parse(readFileSync(DIALOGUE_PATH, 'utf8'));
  for (const d of data.dialogue) {
    assert.ok(d.id, `entry missing id: ${JSON.stringify(d).slice(0, 80)}`);
    assert.ok(d.agentId, `entry ${d.id} missing agentId`);
    assert.ok(d.topic, `entry ${d.id} missing topic`);
    assert.ok(d.line && d.line.length > 5, `entry ${d.id} has empty/short line`);
  }
});

test('elias has audio-recording context dialogue (episode 2 evidence)', () => {
  const data = JSON.parse(readFileSync(DIALOGUE_PATH, 'utf8'));
  const eliasEntries = data.dialogue.filter(d => d.agentId === 'elias');
  assert.ok(eliasEntries.length >= 1, 'elias should have dialogue entries');
  // Should mention audio/recording (his NPC identity marker)
  const hasAudio = eliasEntries.some(d => /audio|recording|recode|recording|hear/i.test(d.line));
  assert.ok(hasAudio, 'elias should have a dialogue line about audio/recording');
});

test('omar dialogue references his dock-Registry context', () => {
  const data = JSON.parse(readFileSync(DIALOGUE_PATH, 'utf8'));
  const omarEntries = data.dialogue.filter(d => d.agentId === 'omar');
  assert.ok(omarEntries.length >= 1, 'omar should have dialogue entries');
  // Should reference dock/harbor/registry
  const hasContext = omarEntries.some(d =>
    /dock|harbor|harbor|registry|cargo|wharf|quay/i.test(d.line));
  assert.ok(hasContext, 'omar should have a dialogue line about dock/harbor/registry');
});

test('noise-along-the-quay episode resolves via 3+ new dialogue gates', () => {
  const data = JSON.parse(readFileSync(DIALOGUE_PATH, 'utf8'));
  // The episode 2 resolution path requires:
  // - omar's noise investigation info
  // - lina's harbor cargo manifest
  // - elias's audio recording analysis
  // All three should be dialogue entries.
  const required = [
    { agentId: 'omar', topic: 'noise' },
    { agentId: 'lina', topic: 'cargo' },
    { agentId: 'elias', topic: 'recording' }
  ];
  for (const req of required) {
    const has = data.dialogue.some(d =>
      d.agentId === req.agentId && d.topic.toLowerCase().includes(req.topic));
    assert.ok(has, `need a ${req.agentId} dialogue entry about ${req.topic}`);
  }
});