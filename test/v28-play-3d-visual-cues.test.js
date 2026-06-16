/**
 * v28 — 3D visual cues on Play API boot payload
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayStatePayload } from '../src/play/play-api-payload.js';
import { bootstrapWorld } from '../src/play/play-engine.js';
import { build3DVisualCues, validate3DVisualCues } from '../src/play/district-3d-layout.js';

test('v28: build3DVisualCues includes district buildings and agents', () => {
  const world = bootstrapWorld();
  const cues = build3DVisualCues(world);
  const check = validate3DVisualCues(cues);
  assert.equal(check.ok, true, check.errors?.join('; '));
  assert.equal(cues.version, 2);
  assert.ok(cues.locations.length >= 4);
  assert.ok(cues.locations.every((l) => typeof l.sceneTexture === 'string' && l.sceneTexture.includes('assets/locations')));
  assert.ok(cues.player?.position?.length === 3);
  assert.ok(cues.camera?.walkEye?.length === 3);
  assert.ok(cues.locations.some((l) => l.id === 'cafe'));
  assert.ok(cues.camera?.target?.length === 3);
  assert.equal(cues.playerLocationId, world.agents.player.locationId);
});

test('v28: GET /api/state payload includes visualCues', () => {
  const world = bootstrapWorld();
  const payload = buildPlayStatePayload(world);
  assert.ok(payload.visualCues);
  assert.equal(payload.visualCues.kind, 'worldmind_3d_visual_cues');
  assert.ok(Array.isArray(payload.visualCues.hotspots));
});
