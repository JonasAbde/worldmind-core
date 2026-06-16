import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveLocationModelPath } from '../src/play/location-model-assets.js';
import { resolveCharacterModelPath } from '../src/play/character-model-assets.js';
import { build3DVisualCues } from '../src/play/district-3d-layout.js';
import { buildLocationCollision, presetForLocation } from '../src/play/building-footprints.js';
import { bootstrapWorld } from '../src/play/play-engine.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

const LOCATION_IDS = ['apartment', 'cafe', 'market', 'workshop', 'district_square'];

test('v39 — baked location GLB models exist on disk', () => {
  for (const id of LOCATION_IDS) {
    const path = resolveLocationModelPath(id);
    assert.equal(path, `assets/models/locations/${id}.glb`, id);
    assert.ok(existsSync(join(REPO, ...path.split('/'))), `missing ${path}`);
  }
});

test('v39 — shared humanoid GLB exists for characters', () => {
  const path = resolveCharacterModelPath('omar');
  assert.equal(path, 'assets/models/characters/humanoid.glb');
  assert.ok(existsSync(join(REPO, ...path.split('/'))));
});

test('v39 — visualCues expose mesh3d renderMode and modelUrl', () => {
  const world = bootstrapWorld();
  const cues = build3DVisualCues(world);
  for (const loc of cues.locations) {
    assert.equal(loc.renderMode, 'mesh3d', `${loc.id} renderMode`);
    assert.ok(loc.modelUrl?.includes('.glb'), `${loc.id} modelUrl`);
  }
  const agents = cues.locations.flatMap((l) => l.agents ?? []);
  assert.ok(agents.length > 0);
  assert.ok(agents.every((a) => a.renderMode === 'mesh3d'));
  assert.ok(agents.every((a) => typeof a.modelUrl === 'string' && a.modelUrl.includes('.glb')));
  assert.equal(cues.player?.renderMode, 'mesh3d');
  assert.ok(cues.player?.modelUrl?.includes('.glb'));
});

test('v39 — visualCues locations expose footprint-aligned collision', () => {
  const world = bootstrapWorld();
  const cues = build3DVisualCues(world);
  for (const loc of cues.locations) {
    const expected = buildLocationCollision(loc.id, loc.zone);
    assert.deepEqual(loc.collision, expected, `${loc.id} collision`);
    assert.ok(loc.collision.radius > 1.4, `${loc.id} radius covers mesh`);
    assert.equal(loc.collision.halfExtents.length, 2);
    if (loc.id === 'district_square') {
      assert.equal(loc.collision.shape, 'circle');
    } else {
      assert.equal(loc.collision.shape, 'box');
    }
  }
});

test('v39 — building presets match known district locations', () => {
  for (const id of LOCATION_IDS) {
    const preset = presetForLocation(id);
    assert.ok(preset.footprint.every((n) => n > 0), `${id} footprint`);
  }
});
