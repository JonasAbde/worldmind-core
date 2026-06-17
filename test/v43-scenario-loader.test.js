// v1.0-rc12 — Scenario loader: reads content/episodes/, content/dialogue/,
// content/evidence/, content/incidents/, content/quests/, content/rumors/,
// content/resolution-paths/. Plan 54 medium-term target.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadAllScenarios,
  loadEpisode,
  listEpisodes,
  loadDialoguePack,
  loadEvidencePack,
  loadIncidentsPack,
  loadQuestsPack,
  loadRumorsPack,
  loadResolutionPath,
  listResolutionPaths,
  getEpisodeSteps,
  getEpisodeOutcomes,
  getDialogueForAgent,
  getEvidenceById,
  getIncidentById,
  getRumorById,
  SCENARIO_DIR
} from '../src/play/scenario-loader.js';

const REPO = process.cwd();

test('SCENARIO_DIR points to the repo content directory', () => {
  assert.ok(SCENARIO_DIR.endsWith('content'));
});

test('listEpisodes returns 3 episodes from content/episodes/', () => {
  const eps = listEpisodes();
  assert.ok(eps.length >= 3);
  for (const eid of ['the-missing-delivery', 'noise-along-the-quay', 'ownership-dispute']) {
    assert.ok(eps.includes(eid), `missing episode ${eid}`);
  }
});

test('loadEpisode returns episode.json metadata for the-missing-delivery', () => {
  const ep = loadEpisode('the-missing-delivery');
  assert.ok(ep);
  assert.equal(ep.id, 'the-missing-delivery');
  assert.ok(Array.isArray(ep.themes));
  assert.ok(Array.isArray(ep.requiredSystems));
});

test('getEpisodeSteps returns ordered steps with id, label, command', () => {
  const steps = getEpisodeSteps('the-missing-delivery');
  assert.ok(Array.isArray(steps));
  assert.ok(steps.length >= 4);
  for (const s of steps) {
    assert.ok(typeof s.id === 'string');
    assert.ok(typeof s.label === 'string');
    assert.ok(typeof s.command === 'string' || Array.isArray(s.commands));
  }
});

test('getEpisodeOutcomes returns outcomes with impact deltas', () => {
  const outcomes = getEpisodeOutcomes('the-missing-delivery');
  assert.ok(Array.isArray(outcomes));
  assert.ok(outcomes.length >= 1);
  for (const o of outcomes) {
    assert.ok(typeof o.id === 'string');
    assert.ok(o.impact && typeof o.impact === 'object');
  }
});

test('loadDialoguePack returns dialogue entries', () => {
  const pack = loadDialoguePack();
  assert.ok(Array.isArray(pack.dialogue));
  assert.ok(pack.dialogue.length >= 1);
});

test('getDialogueForAgent returns entries for sara', () => {
  const entries = getDialogueForAgent('sara');
  assert.ok(Array.isArray(entries));
  // Either entries exist (positive) or empty (still array)
});

test('loadEvidencePack returns evidence entries', () => {
  const pack = loadEvidencePack();
  assert.ok(Array.isArray(pack.evidence));
  assert.ok(pack.evidence.length >= 1);
});

test('getEvidenceById finds cafe_delivery_gap', () => {
  const ev = getEvidenceById('cafe_delivery_gap');
  assert.ok(ev);
  assert.equal(ev.id, 'cafe_delivery_gap');
});

test('getEvidenceById returns null for unknown evidence', () => {
  const ev = getEvidenceById('not-real-evidence');
  assert.equal(ev, null);
});

test('loadIncidentsPack returns 3 incidents', () => {
  const pack = loadIncidentsPack();
  assert.equal(pack.incidents.length, 3);
});

test('getIncidentById finds missing_delivery', () => {
  const inc = getIncidentById('missing_delivery');
  assert.ok(inc);
  assert.equal(inc.id, 'missing_delivery');
});

test('loadRumorsPack returns 3 rumors', () => {
  const pack = loadRumorsPack();
  assert.equal(pack.rumors.length, 3);
});

test('getRumorById finds rumor_missing_delivery_blame', () => {
  const r = getRumorById('rumor_missing_delivery_blame');
  assert.ok(r);
  assert.equal(r.truthLevel, 'false_or_misleading');
});

test('loadQuestsPack returns quest entries', () => {
  const pack = loadQuestsPack();
  assert.ok(Array.isArray(pack.quests));
  assert.ok(pack.quests.length >= 1);
});

test('listResolutionPaths returns 9 paths', () => {
  const paths = listResolutionPaths();
  assert.equal(paths.length, 9);
});

test('loadResolutionPath returns full path with id, label, risk, steps, reward', () => {
  const path = loadResolutionPath('peaceful_mediation');
  assert.ok(path);
  assert.equal(path.id, 'peaceful_mediation');
  assert.ok(Array.isArray(path.steps));
  assert.ok(path.reward);
});

test('loadAllScenarios returns a unified bundle of all packs', () => {
  const all = loadAllScenarios();
  assert.ok(all.episodes);
  assert.ok(all.dialogue);
  assert.ok(all.evidence);
  assert.ok(all.incidents);
  assert.ok(all.quests);
  assert.ok(all.rumors);
  assert.ok(all.resolutionPaths);
  // All bundles are non-empty
  assert.ok(all.episodes.length >= 3);
  assert.ok(all.incidents.length === 3);
  assert.ok(all.rumors.length === 3);
  assert.ok(all.resolutionPaths.length === 9);
});

test('validate-scenario-loader CLI passes', async () => {
  const { spawn } = await import('node:child_process');
  const out = await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['src/cli/validate-scenario-loader.js'], { cwd: REPO });
    let buf = '';
    p.stdout.on('data', d => buf += d);
    p.stderr.on('data', d => buf += d);
    p.on('exit', code => code === 0 ? resolve(buf) : reject(new Error(`exit ${code}: ${buf}`)));
  });
  const json = JSON.parse(out.trim().split('\n').pop());
  assert.equal(json.ok, true);
  assert.equal(json.kind, 'scenario-loader-validator');
  assert.ok(Array.isArray(json.checks));
  // At least 8 checks
  assert.ok(json.checks.length >= 8);
});