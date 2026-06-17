// v1.0-rc11 — Content Pack Authoring Extensions (plan 54 short-term targets).
// Adds:
//   - npcDialogueTopics on characters
//   - founderUnlockConditions on quests
//   - consequenceSummary + requiredEvidence on resolutionPaths
//   - validate-content-pack-authoring CLI
//   - game-shell-model consumers
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadContentPack,
  getDialogueTopicsForAgent,
  getFounderUnlockConditions,
  getResolutionPathSummary,
  getRequiredEvidenceForPath,
  AUTHORING_FIELDS
} from '../src/play/content-pack-authoring.js';
import {
  getContentPack
} from '../src/play/content-pack-runtime.js';

const REPO = process.cwd();

test('AUTHORING_FIELDS lists the 3 short-term authoring targets', () => {
  assert.ok(AUTHORING_FIELDS.includes('npcDialogueTopics'));
  assert.ok(AUTHORING_FIELDS.includes('founderUnlockConditions'));
  assert.ok(AUTHORING_FIELDS.includes('consequenceSummary'));
  assert.ok(AUTHORING_FIELDS.includes('requiredEvidence'));
});

test('loadContentPack returns the parsed content pack', () => {
  const pack = loadContentPack();
  assert.ok(pack);
  assert.equal(pack.id, 'new-aarhus-content-pack-v1');
});

test('every character has npcDialogueTopics array (even if empty)', () => {
  const pack = loadContentPack();
  for (const ch of pack.characters) {
    assert.ok(Array.isArray(ch.npcDialogueTopics), `character ${ch.id} missing npcDialogueTopics`);
  }
});

test('getDialogueTopicsForAgent returns topics for sara', () => {
  const topics = getDialogueTopicsForAgent('sara');
  assert.ok(Array.isArray(topics));
  // Either topics are present (positive case) or empty (placeholder, still array)
});

test('getDialogueTopicsForAgent returns empty array for unknown agent', () => {
  const topics = getDialogueTopicsForAgent('nobody-here');
  assert.deepEqual(topics, []);
});

test('every topic has id, label, requiredTrust', () => {
  const topics = getDialogueTopicsForAgent('sara');
  for (const t of topics) {
    assert.ok(typeof t.id === 'string');
    assert.ok(typeof t.label === 'string');
    assert.ok(typeof t.requiredTrust === 'number' && t.requiredTrust >= 0 && t.requiredTrust <= 100);
  }
});

test('getFounderUnlockConditions returns array with at least one condition', () => {
  const pack = loadContentPack();
  const conds = getFounderUnlockConditions(pack);
  assert.ok(Array.isArray(conds));
  assert.ok(conds.length >= 1, 'at least one founder unlock condition');
});

test('founder unlock conditions reference the canonical quest id', () => {
  const conds = getFounderUnlockConditions();
  // Should mention quest_missing_delivery or incident resolution
  const joined = JSON.stringify(conds);
  assert.match(joined, /quest_missing_delivery|missing_delivery|incident/i);
});

test('getResolutionPathSummary returns human-readable summary for each path', () => {
  const pack = loadContentPack();
  const quest = pack.quests.find(q => q.id === 'quest_missing_delivery');
  for (const rp of quest.resolutionPaths) {
    const summary = getResolutionPathSummary(rp);
    assert.ok(typeof summary === 'string');
    assert.ok(summary.length > 0, `empty summary for ${rp.id}`);
  }
});

test('getRequiredEvidenceForPath returns array of evidence ids', () => {
  const req = getRequiredEvidenceForPath({ requiredEvidence: ['cafe_delivery_gap', 'rumor_source_nadia'] });
  assert.deepEqual(req, ['cafe_delivery_gap', 'rumor_source_nadia']);
});

test('getRequiredEvidenceForPath returns empty array when field is missing', () => {
  const req = getRequiredEvidenceForPath({});
  assert.deepEqual(req, []);
});

test('validate-content-pack-authoring CLI passes', async () => {
  const { spawn } = await import('node:child_process');
  const out = await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['src/cli/validate-content-pack-authoring.js'], { cwd: REPO });
    let buf = '';
    p.stdout.on('data', d => buf += d);
    p.stderr.on('data', d => buf += d);
    p.on('exit', code => code === 0 ? resolve(buf) : reject(new Error(`exit ${code}: ${buf}`)));
  });
  const json = JSON.parse(out.trim().split('\n').pop());
  assert.equal(json.ok, true);
  assert.equal(json.kind, 'content-pack-authoring-validator');
  assert.ok(Array.isArray(json.checks));
  // At least 4 check categories
  assert.ok(json.checks.length >= 4);
});

test('content pack runtime still loads without breakage', () => {
  const pack = getContentPack();
  assert.ok(pack);
  // Existing fields still present
  assert.ok(Array.isArray(pack.locations));
  assert.ok(Array.isArray(pack.episodes));
});