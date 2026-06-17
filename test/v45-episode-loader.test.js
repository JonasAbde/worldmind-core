// v1.0-rc13 — Multi-episode play: episode-to-scenario mapping.
// Each authored episode (content/episodes/<id>/episode.json) maps to
// a playable scenario. The mapping knows:
//   - which scenarios to load (canonical scenario for now, future per-episode)
//   - which incident is the entry-point
//   - which NPCs are core to this episode
//   - which evidence is required to complete the episode
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  listPlayableEpisodes,
  getEpisodeScenarioPath,
  getEpisodeEntryIncident,
  getEpisodeCoreAgents,
  getEpisodeRequiredEvidence,
  episodeMetadata,
  isEpisodePlayable,
  EPISODE_SCENARIO_MAP
} from '../src/play/episode-loader.js';

const REPO = process.cwd();

test('EPISODE_SCENARIO_MAP covers all 3 authored episodes', () => {
  for (const eid of ['the-missing-delivery', 'noise-along-the-quay', 'ownership-dispute']) {
    assert.ok(EPISODE_SCENARIO_MAP[eid], `missing mapping for ${eid}`);
  }
});

test('listPlayableEpisodes returns 3 playable episodes', () => {
  const eps = listPlayableEpisodes();
  assert.equal(eps.length, 3);
});

test('isEpisodePlayable returns true for all 3 episodes', () => {
  for (const eid of ['the-missing-delivery', 'noise-along-the-quay', 'ownership-dispute']) {
    assert.equal(isEpisodePlayable(eid), true);
  }
});

test('isEpisodePlayable returns false for unknown episode', () => {
  assert.equal(isEpisodePlayable('unknown-episode'), false);
});

test('getEpisodeScenarioPath returns a path that exists', () => {
  const p = getEpisodeScenarioPath('the-missing-delivery');
  assert.ok(p.endsWith('.json'));
  assert.ok(p.includes('scenarios/'));
});

test('getEpisodeEntryIncident returns the canonical incident id', () => {
  assert.equal(getEpisodeEntryIncident('the-missing-delivery'), 'missing_delivery');
  assert.equal(getEpisodeEntryIncident('noise-along-the-quay'), 'noise_complaint_5561');
  assert.equal(getEpisodeEntryIncident('ownership-dispute'), 'ownership_dispute_5562');
});

test('getEpisodeCoreAgents returns the NPCs central to the episode', () => {
  const sara = getEpisodeCoreAgents('the-missing-delivery');
  assert.ok(sara.includes('sara'));
  assert.ok(sara.includes('malik'));
});

test('getEpisodeRequiredEvidence returns required evidence ids', () => {
  const req = getEpisodeRequiredEvidence('the-missing-delivery');
  assert.ok(Array.isArray(req));
  assert.ok(req.includes('cafe_delivery_gap'));
});

test('episodeMetadata returns combined { id, title, status, themes, requiredSystems, scenario, incident, agents, evidence }', () => {
  const meta = episodeMetadata('the-missing-delivery');
  assert.equal(meta.id, 'the-missing-delivery');
  assert.ok(meta.title);
  assert.ok(meta.themes.length >= 3);
  assert.ok(meta.requiredSystems.length >= 3);
  assert.ok(meta.scenario);
  assert.equal(meta.incident, 'missing_delivery');
  assert.ok(meta.agents.includes('sara'));
  assert.ok(meta.evidence.includes('cafe_delivery_gap'));
});

test('episodeMetadata returns null for unknown episode', () => {
  const meta = episodeMetadata('not-a-real-episode');
  assert.equal(meta, null);
});

test('validate-episode-loader CLI passes', async () => {
  const { spawn } = await import('node:child_process');
  const out = await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['src/cli/validate-episode-loader.js'], { cwd: REPO });
    let buf = '';
    p.stdout.on('data', d => buf += d);
    p.stderr.on('data', d => buf += d);
    p.on('exit', code => code === 0 ? resolve(buf) : reject(new Error(`exit ${code}: ${buf}`)));
  });
  const json = JSON.parse(out.trim().split('\n').pop());
  assert.equal(json.ok, true);
  assert.equal(json.kind, 'episode-loader-validator');
  assert.ok(Array.isArray(json.checks));
});