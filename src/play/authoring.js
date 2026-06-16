/**
 * Content authoring helpers for WorldMind.
 *
 * This is the creator-mode foundation: content packs describe episodes,
 * quests, dialogue beats, rumors, evidence, and asset references in a
 * deterministic JSON format. Runtime code can validate and summarize the
 * pack without needing editor UI yet.
 */

export const CONTENT_PACK_VERSION = 1;

export function createContentPackTemplate() {
  return {
    kind: 'worldmind_content_pack',
    version: CONTENT_PACK_VERSION,
    id: 'content-pack-template',
    title: 'Untitled WorldMind Content Pack',
    worldId: 'new_aarhus_district_01',
    episodes: [],
    characters: [],
    locations: [],
    rumors: [],
    evidence: [],
    dialogue: [],
    quests: [],
    assetBindings: []
  };
}

const REQUIRED_TOP_LEVEL = [
  'kind', 'version', 'id', 'title', 'worldId', 'episodes', 'characters',
  'locations', 'rumors', 'evidence', 'dialogue', 'quests', 'assetBindings'
];

function requireString(obj, key, errors, path) {
  if (typeof obj?.[key] !== 'string' || obj[key].trim() === '') {
    errors.push(`${path}.${key} must be a non-empty string`);
  }
}

function requireArray(obj, key, errors, path) {
  if (!Array.isArray(obj?.[key])) errors.push(`${path}.${key} must be an array`);
}

export function validateContentPack(pack) {
  const errors = [];
  if (!pack || typeof pack !== 'object') {
    return { ok: false, errors: ['content pack must be an object'] };
  }
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in pack)) errors.push(`missing top-level key: ${key}`);
  }
  if (pack.kind !== 'worldmind_content_pack') errors.push('kind must be worldmind_content_pack');
  if (pack.version !== CONTENT_PACK_VERSION) errors.push(`version must be ${CONTENT_PACK_VERSION}`);
  requireString(pack, 'id', errors, 'pack');
  requireString(pack, 'title', errors, 'pack');
  requireString(pack, 'worldId', errors, 'pack');

  for (const key of ['episodes', 'characters', 'locations', 'rumors', 'evidence', 'dialogue', 'quests', 'assetBindings']) {
    requireArray(pack, key, errors, 'pack');
  }

  for (const [i, episode] of (pack.episodes || []).entries()) {
    requireString(episode, 'id', errors, `episodes[${i}]`);
    requireString(episode, 'title', errors, `episodes[${i}]`);
    requireArray(episode, 'questIds', errors, `episodes[${i}]`);
  }

  for (const [i, quest] of (pack.quests || []).entries()) {
    requireString(quest, 'id', errors, `quests[${i}]`);
    requireString(quest, 'title', errors, `quests[${i}]`);
    requireArray(quest, 'resolutionPaths', errors, `quests[${i}]`);
    for (const [j, path] of (quest.resolutionPaths || []).entries()) {
      requireString(path, 'id', errors, `quests[${i}].resolutionPaths[${j}]`);
      requireArray(path, 'steps', errors, `quests[${i}].resolutionPaths[${j}]`);
    }
  }

  for (const [i, binding] of (pack.assetBindings || []).entries()) {
    requireString(binding, 'entityType', errors, `assetBindings[${i}]`);
    requireString(binding, 'entityId', errors, `assetBindings[${i}]`);
    requireString(binding, 'assetPath', errors, `assetBindings[${i}]`);
    if (binding.assetPath && !String(binding.assetPath).startsWith('assets/')) {
      errors.push(`assetBindings[${i}].assetPath must start with assets/`);
    }
  }

  const ids = new Set();
  for (const collection of ['episodes', 'characters', 'locations', 'rumors', 'evidence', 'dialogue', 'quests']) {
    for (const item of pack[collection] || []) {
      if (!item.id) continue;
      const scoped = `${collection}:${item.id}`;
      if (ids.has(scoped)) errors.push(`duplicate id in ${collection}: ${item.id}`);
      ids.add(scoped);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function summarizeContentPack(pack) {
  return {
    id: pack?.id ?? null,
    title: pack?.title ?? null,
    worldId: pack?.worldId ?? null,
    counts: {
      episodes: pack?.episodes?.length ?? 0,
      characters: pack?.characters?.length ?? 0,
      locations: pack?.locations?.length ?? 0,
      rumors: pack?.rumors?.length ?? 0,
      evidence: pack?.evidence?.length ?? 0,
      dialogue: pack?.dialogue?.length ?? 0,
      quests: pack?.quests?.length ?? 0,
      assetBindings: pack?.assetBindings?.length ?? 0
    },
    questIds: (pack?.quests ?? []).map((q) => q.id),
    episodeIds: (pack?.episodes ?? []).map((e) => e.id)
  };
}

export function buildAuthoringChecklist(pack) {
  const summary = summarizeContentPack(pack);
  return [
    { id: 'has_episode', label: 'At least one playable episode', ok: summary.counts.episodes >= 1 },
    { id: 'has_quest', label: 'At least one quest', ok: summary.counts.quests >= 1 },
    { id: 'has_dialogue', label: 'Dialogue beats exist', ok: summary.counts.dialogue >= 1 },
    { id: 'has_evidence', label: 'Evidence objects exist', ok: summary.counts.evidence >= 1 },
    { id: 'has_assets', label: 'Asset bindings exist', ok: summary.counts.assetBindings >= 1 },
    { id: 'has_3_paths', label: 'Main quest has 3 resolution paths', ok: (pack?.quests?.[0]?.resolutionPaths?.length ?? 0) >= 3 }
  ];
}
