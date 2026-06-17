#!/usr/bin/env node
/**
 * validate-scenario-loader — auditerer at alle content/* packs kan
 * loades og har den forventede struktur (v1.0-rc12).
 *
 * JSON på sidste linje til ci:gate.
 */
import {
  loadAllScenarios,
  listEpisodes,
  loadEpisode,
  getEpisodeSteps,
  getEpisodeOutcomes,
  loadDialoguePack,
  loadEvidencePack,
  loadIncidentsPack,
  loadRumorsPack,
  loadQuestsPack,
  listResolutionPaths,
  loadResolutionPath
} from '../play/scenario-loader.js';

const checks = [];
function check(name, ok, detail = null) {
  checks.push({ name, ok, detail });
}

// 1. Episodes.
const eps = listEpisodes();
check('3 episodes discovered', eps.length === 3, { count: eps.length });
for (const eid of eps) {
  const ep = loadEpisode(eid);
  check(`episode ${eid} loads`, !!ep, ep ? { id: ep.id, themes: ep.themes?.length } : null);
  const steps = getEpisodeSteps(eid);
  check(`episode ${eid} has steps`, steps.length > 0, { steps: steps.length });
  const outcomes = getEpisodeOutcomes(eid);
  check(`episode ${eid} has outcomes`, outcomes.length > 0, { outcomes: outcomes.length });
}

// 2. Dialogue pack.
const dialogue = loadDialoguePack();
check('dialogue pack loads', Array.isArray(dialogue.dialogue));
check('dialogue has at least 1 entry', dialogue.dialogue?.length >= 1, { count: dialogue.dialogue?.length });

// 3. Evidence pack.
const evidence = loadEvidencePack();
check('evidence pack loads', Array.isArray(evidence.evidence));
check('evidence has at least 1 entry', evidence.evidence?.length >= 1, { count: evidence.evidence?.length });

// 4. Incidents pack.
const incidents = loadIncidentsPack();
check('incidents pack loads', Array.isArray(incidents.incidents));
check('incidents has 3 entries', incidents.incidents?.length === 3, { count: incidents.incidents?.length });

// 5. Rumors pack.
const rumors = loadRumorsPack();
check('rumors pack loads', Array.isArray(rumors.rumors));
check('rumors has 3 entries', rumors.rumors?.length === 3, { count: rumors.rumors?.length });

// 6. Quests pack.
const quests = loadQuestsPack();
check('quests pack loads', Array.isArray(quests.quests));

// 7. Resolution paths.
const paths = listResolutionPaths();
check('resolution paths discovered', paths.length >= 1, { count: paths.length });
for (const pid of paths) {
  const p = loadResolutionPath(pid);
  check(`resolution path ${pid} loads`, !!p, p ? { risk: p.risk, steps: p.steps?.length } : null);
}

// 8. Aggregator works.
const all = loadAllScenarios();
check('loadAllScenarios aggregator', all.episodes.length === 3 && all.resolutionPaths.length === paths.length, {
  episodes: all.episodes.length,
  resolutionPaths: all.resolutionPaths.length,
  incidents: all.incidents.length,
  rumors: all.rumors.length
});

const allOk = checks.every(c => c.ok);
process.stdout.write(JSON.stringify({
  ok: allOk,
  kind: 'scenario-loader-validator',
  counts: {
    episodes: eps.length,
    resolutionPaths: paths.length,
    incidents: incidents.incidents?.length || 0,
    rumors: rumors.rumors?.length || 0,
    evidence: evidence.evidence?.length || 0,
    dialogue: dialogue.dialogue?.length || 0
  },
  checks
}) + '\n');
process.exit(allOk ? 0 : 1);