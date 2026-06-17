/**
 * WorldMind Episode Loader (v1.0-rc13).
 *
 * Maps each authored episode (content/episodes/<id>/episode.json) to
 * a playable scenario + entry incident + core NPCs + required evidence.
 *
 * In v1.0-rc13 all 3 episodes share the canonical
 * `scenarios/new-aarhus-district-01.json` scenario — the entry
 * incident differs per episode. Future per-episode scenarios will
 * plug in here.
 *
 * Pure module: no I/O beyond read access via scenario-loader.js.
 */

import { listEpisodes, loadEpisode } from './scenario-loader.js';

export const EPISODE_SCENARIO_MAP = Object.freeze({
  'the-missing-delivery': {
    scenario: 'scenarios/new-aarhus-district-01.json',
    incident: 'missing_delivery',
    coreAgents: ['sara', 'malik', 'nadia', 'rune', 'amina'],
    requiredEvidence: ['cafe_delivery_gap', 'market_rumor_chain', 'rumor_source_nadia'],
    description: 'Sara\'s café is missing a delivery. Malik refused. A rumor connects Sara to the Registry. Resolve the incident through one of three paths.'
  },
  'noise-along-the-quay': {
    scenario: 'scenarios/new-aarhus-district-01.json',
    incident: 'noise_complaint_5561',
    coreAgents: ['elias', 'omar', 'freja'],
    requiredEvidence: ['audio_anomaly_capture', 'signal_interference_log'],
    description: 'A noise complaint at the quay. Audio anomalies detected. Signal interference logged. Trace the source.'
  },
  'ownership-dispute': {
    scenario: 'scenarios/new-aarhus-district-01.json',
    incident: 'ownership_dispute_5562',
    coreAgents: ['yasin', 'lina'],
    requiredEvidence: ['workshop_charter_2019', 'corporate_ownership_deed'],
    description: 'The old workshop has a contested ownership. A charter from 2019 and a corporate deed are the key evidence.'
  }
});

export function listPlayableEpisodes() {
  return listEpisodes().filter(isEpisodePlayable);
}

export function isEpisodePlayable(episodeId) {
  return Boolean(EPISODE_SCENARIO_MAP[episodeId]);
}

export function getEpisodeScenarioPath(episodeId) {
  const m = EPISODE_SCENARIO_MAP[episodeId];
  if (!m) return null;
  return m.scenario;
}

export function getEpisodeEntryIncident(episodeId) {
  const m = EPISODE_SCENARIO_MAP[episodeId];
  if (!m) return null;
  return m.incident;
}

export function getEpisodeCoreAgents(episodeId) {
  const m = EPISODE_SCENARIO_MAP[episodeId];
  if (!m) return [];
  return [...m.coreAgents];
}

export function getEpisodeRequiredEvidence(episodeId) {
  const m = EPISODE_SCENARIO_MAP[episodeId];
  if (!m) return [];
  return [...m.requiredEvidence];
}

export function episodeMetadata(episodeId) {
  if (!isEpisodePlayable(episodeId)) return null;
  const ep = loadEpisode(episodeId);
  if (!ep) return null;
  const mapping = EPISODE_SCENARIO_MAP[episodeId];
  return {
    id: ep.id,
    title: ep.title,
    status: ep.status,
    themes: ep.themes || [],
    requiredSystems: ep.requiredSystems || [],
    scenario: mapping.scenario,
    incident: mapping.incident,
    agents: [...mapping.coreAgents],
    evidence: [...mapping.requiredEvidence],
    description: mapping.description
  };
}