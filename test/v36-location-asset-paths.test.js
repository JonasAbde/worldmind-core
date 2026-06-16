/**
 * v36 — location scene textures resolve to existing assets (webp preferred)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveSceneTexturePath,
  sceneTexturePathForLocation
} from '../src/play/location-scene-assets.js';
import { build3DVisualCues } from '../src/play/district-3d-layout.js';
import { bootstrapWorld } from '../src/play/play-engine.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function assertAssetOnDisk(relPath) {
  const full = join(REPO_ROOT, ...relPath.split('/'));
  assert.ok(existsSync(full), `missing asset file: ${relPath}`);
}

const CORE_LOCATIONS = ['cafe', 'market', 'workshop', 'apartment', 'district_square'];

test('v36: sceneTexturePathForLocation resolves to existing files', () => {
  for (const id of CORE_LOCATIONS) {
    const path = sceneTexturePathForLocation(id);
    assert.match(path, /^assets\/locations\//);
    assert.match(path, /\.(png|webp)$/);
    assertAssetOnDisk(path);
    if (id === 'apartment') {
      assert.ok(path.includes('apartment-interior'), `apartment should use interior diorama, got ${path}`);
    }
    assert.equal(path.endsWith('.webp'), true, `${id} should prefer webp when both formats exist`);
  }
});

test('v36: resolveSceneTexturePath prefers webp for pack png paths', () => {
  for (const id of CORE_LOCATIONS) {
    const resolved = resolveSceneTexturePath(`assets/locations/${id}.png`);
    assert.equal(resolved, `assets/locations/${id}.webp`);
    assertAssetOnDisk(resolved);
  }
});

test('v36: build3DVisualCues location sceneTexture paths exist on disk', () => {
  const world = bootstrapWorld();
  const cues = build3DVisualCues(world);
  for (const id of CORE_LOCATIONS) {
    const loc = cues.locations.find((l) => l.id === id);
    assert.ok(loc, `missing location ${id}`);
    assertAssetOnDisk(loc.sceneTexture);
    if (id === 'apartment') {
      assert.ok(loc.sceneTexture.includes('apartment-interior'));
    }
    assert.equal(loc.sceneTexture.endsWith('.webp'), true);
  }
  assert.ok(cues.interior?.sceneTexture);
  assertAssetOnDisk(cues.interior.sceneTexture);
});
