/**
 * Runtime bridge from authored content pack → play simulation state.
 * Single loader shared by play-engine and game-shell-model.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACK_PATH = join(__dirname, '../../content/worldmind/content-pack-v1.json');

let _pack = null;

export function getContentPack() {
  if (_pack) return _pack;
  try {
    _pack = JSON.parse(readFileSync(PACK_PATH, 'utf8'));
  } catch {
    _pack = null;
  }
  return _pack;
}

export function ensurePlayerKnowledge(world) {
  if (!world.playerKnowledge) {
    world.playerKnowledge = {
      evidenceIds: [],
      knownRumorIds: [],
      suspectedCauses: [],
      unresolvedQuestions: []
    };
  }
  return world.playerKnowledge;
}

/** Grant pack evidence ids; returns newly granted ids. */
export function grantEvidence(world, ids = []) {
  if (!ids?.length) return [];
  const pk = ensurePlayerKnowledge(world);
  const granted = [];
  for (const id of ids) {
    if (!pk.evidenceIds.includes(id)) {
      pk.evidenceIds.push(id);
      granted.push(id);
    }
  }
  return granted;
}

export function dialogueEntryFor(agentId, topic) {
  const pack = getContentPack();
  if (!pack?.dialogue) return null;
  return pack.dialogue.find((d) => d.agentId === agentId && d.topic === topic) ?? null;
}

export function dialogueUnlocksFor(agentId, topic) {
  return dialogueEntryFor(agentId, topic)?.unlocks ?? [];
}

export function dialogueMinTrust(agentId, topic) {
  return dialogueEntryFor(agentId, topic)?.requiredRelationship?.trust ?? 0;
}

export function hotspotById(hotspotId) {
  const pack = getContentPack();
  if (!pack?.locations || !hotspotId) return null;
  for (const loc of pack.locations) {
    const hotspot = (loc.hotspots ?? []).find((h) => h.id === hotspotId);
    if (hotspot) return { locationId: loc.id, hotspot };
  }
  return null;
}

/** Resolve inspect focus → evidence ids + finding text from pack hotspots. */
export function inspectPackRewards(locationId, focus) {
  const pack = getContentPack();
  const loc = pack?.locations?.find((l) => l.id === locationId);
  if (!loc) return { evidence: [], findingText: null, hotspotId: null };

  const hotspots = loc.hotspots ?? [];
  const normalizedFocus = focus && focus !== 'general' ? focus : null;
  const hotspot = normalizedFocus
    ? hotspots.find((h) => h.id === normalizedFocus || h.inspectFocus === normalizedFocus)
    : hotspots.find((h) => (h.possibleEvidence?.length ?? 0) > 0) ?? hotspots[0];

  if (!hotspot) return { evidence: [], findingText: null, hotspotId: null };

  const evidence = [
    ...(hotspot.grantsEvidence ?? []),
    ...(hotspot.possibleEvidence ?? [])
  ].filter((id, i, arr) => arr.indexOf(id) === i);

  return {
    evidence,
    findingText: hotspot.description ?? hotspot.preview ?? null,
    hotspotId: hotspot.id
  };
}

/** Add pack-authored rumor ids heard at a location into playerKnowledge. */
export function syncPackRumorsAtLocation(world, locationId) {
  const pack = getContentPack();
  const pk = ensurePlayerKnowledge(world);
  const granted = [];
  for (const rumor of pack?.rumors ?? []) {
    const linkedAtLocation = (pack.caseLinks ?? []).some((link) => {
      if (link.to !== rumor.id) return false;
      const evidence = (pack.evidence ?? []).find((e) => e.id === link.from);
      return evidence?.locationId === locationId;
    });
    if (locationId !== 'market' || !linkedAtLocation) continue;
    if (!pk.knownRumorIds.includes(rumor.id)) {
      pk.knownRumorIds.push(rumor.id);
      granted.push(rumor.id);
    }
  }
  return granted;
}

/** Build inspect command with hotspot focus for shell hotspots. */
export function hotspotCommandText(hotspot) {
  const base = hotspot.command ?? '';
  if (!base.startsWith('inspect ')) return base;
  const focus = hotspot.inspectFocus ?? hotspot.id;
  const loc = base.replace(/^inspect\s+/, '').trim();
  return focus ? `inspect ${loc} ${focus}` : base;
}
