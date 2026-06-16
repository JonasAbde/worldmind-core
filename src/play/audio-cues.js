/**
 * Lightweight play audio cue mapping — paths only, no playback in core.
 *
 * Clients (worldmind-site) read `audioCues` from command results and play
 * assets via HTMLAudioElement. See assets.js for canonical path registry.
 */

import { buildConsequenceBeat } from './game-shell-model.js';

export const AUDIO_CUE_KINDS = Object.freeze([
  'walk_start',
  'evidence_found',
  'rumor_heard',
  'consequence',
  'level_up',
  'hotspot_inspect'
]);

export const AUDIO_CUE_PATHS = Object.freeze({
  walk_start: 'assets/audio/walk-start.wav',
  evidence_found: 'assets/audio/evidence-found.wav',
  rumor_heard: 'assets/audio/rumor-heard.wav',
  consequence: 'assets/audio/consequence.wav',
  level_up: 'assets/audio/level-up.wav',
  hotspot_inspect: 'assets/audio/hotspot-inspect.wav'
});

export function makeAudioCue(kind) {
  const path = AUDIO_CUE_PATHS[kind];
  if (!path) return null;
  return { kind, path };
}

export function validateAudioCue(cue) {
  const errors = [];
  if (!cue || typeof cue !== 'object') {
    errors.push('cue must be an object');
    return { ok: false, errors };
  }
  if (!AUDIO_CUE_KINDS.includes(cue.kind)) errors.push(`unknown kind: ${cue.kind}`);
  if (typeof cue.path !== 'string' || !cue.path.startsWith('assets/audio/')) {
    errors.push('path must start with assets/audio/');
  }
  if (cue.path && cue.path !== AUDIO_CUE_PATHS[cue.kind]) {
    errors.push(`path mismatch for kind ${cue.kind}`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Derive audio cues from a post-progression command result envelope.
 */
export function collectAudioCues(result, command, effectiveArgs = {}) {
  if (!result?.ok) return [];

  const cues = [];
  const seen = new Set();
  const push = (kind) => {
    if (seen.has(kind)) return;
    const cue = makeAudioCue(kind);
    if (!cue) return;
    seen.add(kind);
    cues.push(cue);
  };

  if (command === 'move' && result.walkAnimation?.waypoints?.length) {
    push('walk_start');
  }

  const evidenceIds = result.dialogue?.evidenceIds ?? [];
  const evidenceDelta = result.consequence?.evidenceDelta ?? [];
  if (evidenceIds.length > 0 || evidenceDelta.length > 0) {
    push('evidence_found');
  }

  if (command === 'listen_rumors' || (result.kind === 'rumors' && (result.rumors?.length || (result.consequence?.newRumors ?? 0) > 0))) {
    push('rumor_heard');
  }

  const focus = effectiveArgs.focus || effectiveArgs.topic;
  if (command === 'inspect' && focus && focus !== 'general') {
    push('hotspot_inspect');
  }

  if (result.progressionDelta?.leveledUp) {
    push('level_up');
  }

  if (buildConsequenceBeat(result.consequence)) {
    push('consequence');
  }

  return cues;
}

export function attachAudioCues(result, command, effectiveArgs = {}) {
  if (!result?.ok) return result;
  const audioCues = collectAudioCues(result, command, effectiveArgs);
  if (!audioCues.length) return result;
  return { ...result, audioCues };
}
