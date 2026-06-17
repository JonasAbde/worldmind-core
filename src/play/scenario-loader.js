/**
 * WorldMind Scenario Loader (v1.0-rc12).
 *
 * Reads the content/ directory tree:
 *   content/episodes/<id>/{episode.json, steps.json, outcomes.json, README.md}
 *   content/dialogue/dialogue-pack.json
 *   content/evidence/evidence-pack.json
 *   content/incidents/incidents-pack.json
 *   content/quests/quests-pack.json
 *   content/rumors/rumors-pack.json
 *   content/resolution-paths/*.json
 *
 * Pure loader with caching. Exposes typed read accessors and a
 * loadAllScenarios() aggregator.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SCENARIO_DIR = join(__dirname, '../../content');

const EPISODES_DIR = join(SCENARIO_DIR, 'episodes');
const DIALOGUE_DIR = join(SCENARIO_DIR, 'dialogue');
const EVIDENCE_DIR = join(SCENARIO_DIR, 'evidence');
const INCIDENTS_DIR = join(SCENARIO_DIR, 'incidents');
const QUESTS_DIR = join(SCENARIO_DIR, 'quests');
const RUMORS_DIR = join(SCENARIO_DIR, 'rumors');
const RESOLUTION_PATHS_DIR = join(SCENARIO_DIR, 'resolution-paths');

// --- Caches ---

let _episodes = null;
let _packs = {
  dialogue: null,
  evidence: null,
  incidents: null,
  quests: null,
  rumors: null
};
let _resolutionPaths = null;

function safeReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// --- Episodes ---

export function listEpisodes() {
  if (!_episodes) {
    try {
      _episodes = readdirSync(EPISODES_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort();
    } catch {
      _episodes = [];
    }
  }
  return [..._episodes];
}

export function loadEpisode(episodeId) {
  return safeReadJson(join(EPISODES_DIR, episodeId, 'episode.json'));
}

export function getEpisodeSteps(episodeId) {
  const data = safeReadJson(join(EPISODES_DIR, episodeId, 'steps.json'));
  return Array.isArray(data?.steps) ? data.steps : [];
}

export function getEpisodeOutcomes(episodeId) {
  const data = safeReadJson(join(EPISODES_DIR, episodeId, 'outcomes.json'));
  return Array.isArray(data?.outcomes) ? data.outcomes : [];
}

// --- Packs ---

function loadPack(dir, key) {
  if (!_packs[key]) {
    const files = ['pack.json', `${key}-pack.json`];
    for (const f of files) {
      const data = safeReadJson(join(dir, f));
      if (data) {
        _packs[key] = data;
        return _packs[key];
      }
    }
    _packs[key] = { [key]: [] };
  }
  return _packs[key];
}

export function loadDialoguePack() {
  return loadPack(DIALOGUE_DIR, 'dialogue');
}

export function loadEvidencePack() {
  return loadPack(EVIDENCE_DIR, 'evidence');
}

export function loadIncidentsPack() {
  return loadPack(INCIDENTS_DIR, 'incidents');
}

export function loadQuestsPack() {
  return loadPack(QUESTS_DIR, 'quests');
}

export function loadRumorsPack() {
  return loadPack(RUMORS_DIR, 'rumors');
}

// --- Pack lookups ---

export function getDialogueForAgent(agentId) {
  const pack = loadDialoguePack();
  return (pack.dialogue || []).filter(d => d.agentId === agentId);
}

export function getEvidenceById(id) {
  const pack = loadEvidencePack();
  return (pack.evidence || []).find(e => e.id === id) || null;
}

export function getIncidentById(id) {
  const pack = loadIncidentsPack();
  return (pack.incidents || []).find(i => i.id === id) || null;
}

export function getRumorById(id) {
  const pack = loadRumorsPack();
  return (pack.rumors || []).find(r => r.id === id) || null;
}

// --- Resolution paths ---

export function listResolutionPaths() {
  if (!_resolutionPaths) {
    try {
      const files = readdirSync(RESOLUTION_PATHS_DIR)
        .filter(f => f.endsWith('.json') && f !== 'resolution-paths-pack.json' && f !== 'README.md');
      _resolutionPaths = files
        .map(f => f.replace(/\.json$/, ''))
        .sort();
    } catch {
      _resolutionPaths = [];
    }
  }
  return [..._resolutionPaths];
}

export function loadResolutionPath(pathId) {
  return safeReadJson(join(RESOLUTION_PATHS_DIR, `${pathId}.json`));
}

// --- Aggregator ---

export function loadAllScenarios() {
  return {
    episodes: listEpisodes().map(id => loadEpisode(id)),
    dialogue: loadDialoguePack().dialogue || [],
    evidence: loadEvidencePack().evidence || [],
    incidents: loadIncidentsPack().incidents || [],
    quests: loadQuestsPack().quests || [],
    rumors: loadRumorsPack().rumors || [],
    resolutionPaths: listResolutionPaths().map(id => loadResolutionPath(id))
  };
}