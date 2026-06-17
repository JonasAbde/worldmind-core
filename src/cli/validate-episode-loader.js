#!/usr/bin/env node
/**
 * validate-episode-loader — auditerer at alle 3 episoder har en
 * gyldig mapping i EPISODE_SCENARIO_MAP (v1.0-rc13).
 *
 * JSON på sidste linje til ci:gate.
 */
import { listEpisodes, loadEpisode } from '../play/scenario-loader.js';
import {
  EPISODE_SCENARIO_MAP,
  isEpisodePlayable,
  listPlayableEpisodes,
  getEpisodeScenarioPath,
  getEpisodeEntryIncident,
  getEpisodeCoreAgents,
  getEpisodeRequiredEvidence
} from '../play/episode-loader.js';

const checks = [];
function check(name, ok, detail = null) {
  checks.push({ name, ok, detail });
}

// 1. All 3 authored episodes have mappings.
const eps = listEpisodes();
for (const eid of eps) {
  check(`episode ${eid} has mapping`, isEpisodePlayable(eid), { mapped: isEpisodePlayable(eid) });
}

// 2. listPlayableEpisodes returns 3.
const playable = listPlayableEpisodes();
check('listPlayableEpisodes returns 3 episodes', playable.length === 3, { count: playable.length });

// 3. Each playable episode has scenario path, incident, agents, evidence.
for (const eid of playable) {
  check(`episode ${eid} has scenario path`, !!getEpisodeScenarioPath(eid));
  check(`episode ${eid} has entry incident`, !!getEpisodeEntryIncident(eid));
  const agents = getEpisodeCoreAgents(eid);
  check(`episode ${eid} has core agents`, agents.length >= 1, { count: agents.length });
  const ev = getEpisodeRequiredEvidence(eid);
  check(`episode ${eid} has required evidence`, ev.length >= 1, { count: ev.length });
}

// 4. Episode metadata combines authored + mapping fields.
for (const eid of playable) {
  const ep = loadEpisode(eid);
  check(`episode ${eid} authored data loads`, !!ep, ep ? { themes: ep.themes?.length } : null);
}

// 5. Scenario paths are consistent (all 3 currently point at canonical).
const paths = playable.map(getEpisodeScenarioPath);
check('all episodes currently use canonical scenario', paths.every(p => p === paths[0]), { paths });

// 6. Required evidence matches authored evidence-pack ids.
import { loadEvidencePack } from '../play/scenario-loader.js';
const evidenceIds = (loadEvidencePack().evidence || []).map(e => e.id);
for (const eid of playable) {
  const req = getEpisodeRequiredEvidence(eid);
  const missing = req.filter(eid => !evidenceIds.includes(eid));
  check(`episode ${eid} required evidence all exist in pack`, missing.length === 0, { missing });
}

const allOk = checks.every(c => c.ok);
process.stdout.write(JSON.stringify({
  ok: allOk,
  kind: 'episode-loader-validator',
  episodes: playable,
  counts: { total: eps.length, playable: playable.length },
  checks
}) + '\n');
process.exit(allOk ? 0 : 1);