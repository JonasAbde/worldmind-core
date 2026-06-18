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
  assert.equal(cues.version, 5);
  assert.ok(cues.walkGraph?.nodes);
  assert.ok(cues.walkGraph?.edges?.length >= 3);
  assert.ok(cues.interior?.sceneTexture?.includes('assets/locations'));
  assert.ok(cues.locations.length >= 4);
  assert.ok(cues.locations.every((l) => typeof l.sceneTexture === 'string' && l.sceneTexture.includes('assets/locations')));
  assert.ok(cues.player?.position?.length === 3);
  assert.ok(cues.camera?.walkEye?.length === 3);
  assert.ok(cues.locations.some((l) => l.id === 'cafe'));
  assert.ok(cues.camera?.target?.length === 3);
  assert.equal(cues.playerLocationId, world.agents.player.locationId);
  const agents = cues.locations.flatMap((l) => l.agents || []);
  assert.ok(agents.length >= 1, 'expected at least one district agent');
  assert.ok(agents.every((a) => a.idleAnimation === 'bob' || a.idleAnimation === 'turn'));
  assert.ok(agents.every((a) => typeof a.figureTexture === 'string' && a.figureTexture.includes('assets/characters/')));
  assert.ok(cues.player?.figureTexture?.includes('assets/characters/player'));
  if (cues.hotspots.length > 0) {
    const hs = cues.hotspots[0];
    assert.ok('preview' in hs || 'description' in hs, 'hotspot should include preview/description from gameShell');
    assert.ok(hs.preview || hs.description, 'hotspot preview/description should be non-empty when shell has hotspots');
  }
});

test('v28: GET /api/state payload includes visualCues', () => {
  const world = bootstrapWorld();
  const payload = buildPlayStatePayload(world);
  assert.ok(payload.visualCues);
  assert.equal(payload.visualCues.kind, 'worldmind_3d_visual_cues');
  assert.ok(Array.isArray(payload.visualCues.hotspots));
});
