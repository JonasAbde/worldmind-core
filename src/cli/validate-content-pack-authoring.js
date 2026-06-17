#!/usr/bin/env node
/**
 * validate-content-pack-authoring — auditerer at content-pack indeholder
 * de udvidede authoring-felter fra plan 54 (npcDialogueTopics,
 * founderUnlockConditions, consequenceSummary, requiredEvidence).
 *
 * Sprint af v1.0-rc11. JSON på sidste linje til ci:gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadContentPack,
  getDialogueTopicsForAgent,
  getFounderUnlockConditions,
  AUTHORING_FIELDS
} from '../play/content-pack-authoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = process.cwd();

const checks = [];
function check(name, ok, detail = null) {
  checks.push({ name, ok, detail });
}

const pack = loadContentPack();

// 1. Pack loads.
check('pack loads', !!pack);

// 2. Every character has npcDialogueTopics array (even if empty).
for (const ch of pack.characters || []) {
  check(`character ${ch.id} has npcDialogueTopics`, Array.isArray(ch.npcDialogueTopics), {
    hasField: Array.isArray(ch.npcDialogueTopics),
    length: ch.npcDialogueTopics?.length ?? 0
  });
}

// 3. Quest has founderUnlockConditions.
const quest = pack.quests?.find(q => q.id === 'quest_missing_delivery');
check('quest_missing_delivery exists', !!quest);
if (quest) {
  check('quest has founderUnlockConditions', Array.isArray(quest.founderUnlockConditions), {
    length: quest.founderUnlockConditions?.length ?? 0
  });
}

// 4. Each resolutionPath has consequenceSummary.
if (quest) {
  for (const rp of quest.resolutionPaths || []) {
    check(`path ${rp.id} has consequenceSummary`, typeof rp.consequenceSummary === 'string' && rp.consequenceSummary.length > 0, {
      summary: rp.consequenceSummary || null
    });
  }
}

// 5. Each resolutionPath has requiredEvidence (can be empty array).
if (quest) {
  for (const rp of quest.resolutionPaths || []) {
    check(`path ${rp.id} has requiredEvidence field`, Array.isArray(rp.requiredEvidence), {
      length: rp.requiredEvidence?.length ?? 0
    });
  }
}

// 6. Each dialogue topic has id, label, requiredTrust.
for (const ch of pack.characters || []) {
  const topics = getDialogueTopicsForAgent(ch.id);
  for (const t of topics) {
    const ok = typeof t.id === 'string'
      && typeof t.label === 'string'
      && typeof t.requiredTrust === 'number'
      && t.requiredTrust >= 0
      && t.requiredTrust <= 100;
    check(`topic ${ch.id}/${t.id} structure`, ok);
  }
}

// 7. Founder unlock conditions reference the canonical quest/incident.
const conds = getFounderUnlockConditions(pack);
check('founder unlock conditions exist', conds.length >= 1, { count: conds.length });
for (const c of conds) {
  check(`founder condition ${c.kind} has required fields`, c.kind && (c.incidentId || c.evidenceIds || c.minReputation !== undefined));
}

// 8. AUTHORING_FIELDS catalog.
check('AUTHORING_FIELDS catalog complete',
  AUTHORING_FIELDS.includes('npcDialogueTopics')
  && AUTHORING_FIELDS.includes('founderUnlockConditions')
  && AUTHORING_FIELDS.includes('consequenceSummary')
  && AUTHORING_FIELDS.includes('requiredEvidence')
);

const allOk = checks.every(c => c.ok);
const summary = {
  ok: allOk,
  kind: 'content-pack-authoring-validator',
  authoringFields: [...AUTHORING_FIELDS],
  checks
};
process.stdout.write(JSON.stringify(summary) + '\n');
process.exit(allOk ? 0 : 1);