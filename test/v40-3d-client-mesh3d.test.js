/**
 * v40 — static-play 3d-client.js loads mesh3d GLB assets
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectVisualCuesModelUrls,
  shouldUseGltfBody,
  shouldUseGltfBuilding
} from '../src/play/embodied-3d-render.js';
import { build3DVisualCues } from '../src/play/district-3d-layout.js';
import { bootstrapWorld } from '../src/play/play-engine.js';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..', 'static-play', '3d-client.js');

test('v40 — embodied-3d-render helpers gate glTF usage', () => {
  assert.equal(shouldUseGltfBuilding('assets/models/locations/cafe.glb'), true);
  assert.equal(shouldUseGltfBuilding(null), false);
  assert.equal(shouldUseGltfBody('mesh3d', 'assets/models/characters/humanoid.glb'), true);
  assert.equal(shouldUseGltfBody('sprite2d', 'assets/models/characters/humanoid.glb'), false);
});

test('v40 — collectVisualCuesModelUrls dedupes district models', () => {
  const cues = build3DVisualCues(bootstrapWorld());
  const urls = collectVisualCuesModelUrls(cues);
  assert.ok(urls.length >= 5, 'locations + humanoid');
  assert.ok(urls.every((u) => u.endsWith('.glb')));
  assert.equal(new Set(urls).size, urls.length);
});

test('v40 — 3d-client.js wires GLTFLoader and mesh3d branches', () => {
  const src = readFileSync(CLIENT, 'utf8');
  assert.match(src, /GLTFLoader/);
  assert.match(src, /shouldUseGltfBuilding/);
  assert.match(src, /shouldUseGltfBody/);
  assert.match(src, /loadGltfScene/);
  assert.match(src, /modelUrl/);
  assert.match(src, /renderMode/);
});
