/**
 * WorldMind Content Pack Authoring Extensions (v1.0-rc11).
 *
 * Plan 54 short-term targets — designer-editable metadata that flows
 * from the content pack into the play engine and UI shell:
 *
 *   - npcDialogueTopics[]    on characters → NPC action button topics
 *   - founderUnlockConditions[] on quests  → unlock check (not hardcoded)
 *   - consequenceSummary     on resolutionPaths → human-readable summary
 *   - requiredEvidence[]     on resolutionPaths → evidence gate before path
 *
 * Pure module: loads the content pack, exposes read accessors, validates
 * structure. No I/O beyond the initial read.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACK_PATH = join(__dirname, '../../content/worldmind/content-pack-v1.json');

let _pack = null;

export const AUTHORING_FIELDS = Object.freeze([
  'npcDialogueTopics',
  'founderUnlockConditions',
  'consequenceSummary',
  'requiredEvidence'
]);

export function loadContentPack() {
  if (_pack) return _pack;
  _pack = JSON.parse(readFileSync(PACK_PATH, 'utf8'));
  return _pack;
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Read accessors ---

// Returns the authored dialogue topics for an agent id. Falls back to
// deriving them from dialogue[] entries if no explicit
// npcDialogueTopics[] is set on the character.
export function getDialogueTopicsForAgent(agentId) {
  const pack = loadContentPack();
  const ch = pack?.characters?.find(c => c.id === agentId);
  if (!ch) return [];
  if (Array.isArray(ch.npcDialogueTopics) && ch.npcDialogueTopics.length > 0) {
    return ch.npcDialogueTopics.map(t => ({ ...t }));
  }
  // Fallback: derive from dialogue[] entries that mention this agent.
  const dialogue = pack?.dialogue?.filter(d => d.agentId === agentId) || [];
  return dialogue.map(d => ({
    id: d.topic,
    label: d.label || d.topic,
    requiredTrust: d.requiredRelationship?.trust ?? 0,
    unlocks: d.unlocks || []
  }));
}

export function getFounderUnlockConditions(pack) {
  const p = pack || loadContentPack();
  const quest = p.quests?.find(q => q.id === 'quest_missing_delivery');
  if (!quest) return [];
  if (Array.isArray(quest.founderUnlockConditions) && quest.founderUnlockConditions.length > 0) {
    return quest.founderUnlockConditions;
  }
  // Default: any resolutionPath counts as unlock.
  return [{
    kind: 'incident',
    incidentId: quest.incidentId,
    status: 'resolved',
    description: `Resolve incident ${quest.incidentId}.`
  }];
}

export function getResolutionPathSummary(rp) {
  if (!rp) return '';
  if (rp.consequenceSummary) return rp.consequenceSummary;
  // Derive summary from steps if no explicit field.
  if (Array.isArray(rp.steps) && rp.steps.length > 0) {
    return `${rp.label || rp.id}: ${rp.steps.length} step(s) — ${rp.steps.slice(0, 3).join(', ')}${rp.steps.length > 3 ? '…' : ''}.`;
  }
  return rp.label || rp.id || 'unknown path';
}

export function getRequiredEvidenceForPath(rp) {
  if (!rp) return [];
  return Array.isArray(rp.requiredEvidence) ? [...rp.requiredEvidence] : [];
}

// --- Game-shell-model extension: lookup founder unlock check ---

export function isFounderUnlockedFromPack(world, pack) {
  const conds = getFounderUnlockConditions(pack);
  for (const c of conds) {
    if (c.kind === 'incident' && c.incidentId && c.status) {
      const incident = world?.incidents?.[c.incidentId];
      if (incident && incident.status === c.status) return true;
      if (incident && incident.resolutionState) return true;
    }
    if (c.kind === 'evidence' && Array.isArray(c.evidenceIds)) {
      const known = world?.playerKnowledge?.evidenceIds || [];
      if (c.evidenceIds.every(eid => known.includes(eid))) return true;
    }
    if (c.kind === 'reputation' && typeof c.minReputation === 'number') {
      const rep = world?.agents?.player?.stats?.reputation ?? 0;
      if (rep >= c.minReputation) return true;
    }
  }
  return false;
}

// --- Renderer for dialogue topic list ---

export function renderDialogueTopicsForAgent(agentId) {
  const topics = getDialogueTopicsForAgent(agentId);
  if (topics.length === 0) {
    return `<ul class="wm-npc-topics" data-agent="${escapeHtml(agentId)}"><li class="wm-empty">No topics available.</li></ul>`;
  }
  const items = topics.map(t => `
    <li class="wm-npc-topic" data-topic="${escapeHtml(t.id)}">
      <span class="wm-npc-topic-label">${escapeHtml(t.label)}</span>
      <span class="wm-npc-topic-trust">trust ≥ ${t.requiredTrust}</span>
      ${t.unlocks?.length > 0 ? `<span class="wm-npc-topic-unlocks">unlocks: ${t.unlocks.map(escapeHtml).join(', ')}</span>` : ''}
    </li>
  `).join('');
  return `<ul class="wm-npc-topics" data-agent="${escapeHtml(agentId)}">${items}</ul>`;
}