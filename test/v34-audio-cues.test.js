/**
 * v34 — play audio cue contract (engine → client asset paths)
 */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_CUE_KINDS,
  AUDIO_CUE_PATHS,
  collectAudioCues,
  makeAudioCue,
  validateAudioCue
} from '../src/play/audio-cues.js';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';
import { buildCommandResultPayload } from '../src/play/play-api-payload.js';
import { flattenAssetPaths, getAssetRegistry } from '../src/play/assets.js';

function newWorld() {
  return bootstrapWorld({ scenarioPath: './scenarios/new-aarhus-district-01.json', days: 1 });
}

it('v34.1 — audio cue kinds map to assets/audio paths', () => {
  for (const kind of AUDIO_CUE_KINDS) {
    const cue = makeAudioCue(kind);
    assert.ok(cue, kind);
    assert.equal(cue.path, AUDIO_CUE_PATHS[kind]);
    assert.match(cue.path, /^assets\/audio\//);
    const check = validateAudioCue(cue);
    assert.equal(check.ok, true, check.errors?.join('; '));
  }
});

it('v34.2 — asset registry includes all play cue paths', () => {
  const paths = flattenAssetPaths(getAssetRegistry());
  for (const kind of AUDIO_CUE_KINDS) {
    assert.ok(paths.includes(AUDIO_CUE_PATHS[kind]), `missing registry path for ${kind}`);
  }
});

it('v34.3 — move emits walk_start when walkAnimation has waypoints', () => {
  const world = newWorld();
  world.agents.player.locationId = 'cafe';
  const move = resolveCommand(world, 'move', { target: 'market' });
  assert.equal(move.ok, true);
  assert.ok(move.walkAnimation?.waypoints?.length);
  assert.ok(Array.isArray(move.audioCues));
  assert.ok(move.audioCues.some((c) => c.kind === 'walk_start'));
});

it('v34.4 — hotspot inspect and evidence cues fire from pack rewards', () => {
  const world = newWorld();
  const inspect = resolveCommand(world, 'inspect', { target: 'cafe', focus: 'cafe_delivery_crate' });
  assert.equal(inspect.ok, true);
  assert.ok(inspect.audioCues?.some((c) => c.kind === 'hotspot_inspect'));
  assert.ok(inspect.audioCues?.some((c) => c.kind === 'evidence_found'));
});

it('v34.5 — listen_rumors emits rumor_heard', () => {
  const world = newWorld();
  const result = resolveCommand(world, 'listen_rumors', { target: 'market' });
  assert.equal(result.ok, true);
  assert.ok(result.audioCues?.some((c) => c.kind === 'rumor_heard'));
});

it('v34.6 — progression level up emits level_up cue', () => {
  const world = newWorld();
  let last = null;
  for (let i = 0; i < 12; i += 1) {
    last = resolveCommand(world, 'listen_rumors', { target: 'market' });
    if (last.progressionDelta?.leveledUp) break;
  }
  assert.ok(last?.progressionDelta?.leveledUp || (last?.progression?.level ?? 1) > 1);
  assert.ok(last?.audioCues?.some((c) => c.kind === 'level_up'));
});

it('v34.7 — buildCommandResultPayload preserves audioCues', () => {
  const world = newWorld();
  const move = resolveCommand(world, 'move', { target: 'workshop' });
  const payload = buildCommandResultPayload(world, move);
  assert.ok(Array.isArray(payload.audioCues));
  assert.ok(payload.audioCues.some((c) => c.kind === 'walk_start'));
  for (const cue of payload.audioCues) {
    assert.equal(validateAudioCue(cue).ok, true);
  }
});
