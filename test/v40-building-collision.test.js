/**
 * v40 — building footprints + collision metadata on visualCues
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDING_PRESETS,
  buildLocationCollision,
  presetForLocation
} from '../src/play/building-footprints.js';
import { build3DVisualCues, validate3DVisualCues } from '../src/play/district-3d-layout.js';
import { bootstrapWorld } from '../src/play/play-engine.js';

test('v40 — presetForLocation resolves zone fallbacks', () => {
  assert.equal(presetForLocation('cafe').style, 'cafe');
  assert.equal(presetForLocation('unknown_shop', 'commerce').style, 'market');
  assert.equal(presetForLocation('unknown_yard', 'civic').style, 'civic');
  assert.equal(presetForLocation('mystery').style, 'residential');
});

test('v40 — buildLocationCollision matches baked footprints', () => {
  const cafe = buildLocationCollision('cafe', 'social');
  assert.equal(cafe.shape, 'box');
  const [w, , d] = BUILDING_PRESETS.cafe.footprint;
  assert.deepEqual(cafe.footprint, [w, d]);
  assert.ok(cafe.halfExtents[0] >= w / 2);
  assert.ok(cafe.radius > 0);

  const square = buildLocationCollision('district_square', 'civic');
  assert.equal(square.shape, 'circle');
  assert.ok(square.radius >= BUILDING_PRESETS.district_square.footprint[0] / 2);
});

test('v40 — visualCues locations expose footprint + collision', () => {
  const cues = build3DVisualCues(bootstrapWorld());
  const check = validate3DVisualCues(cues);
  assert.equal(check.ok, true, check.errors?.join('; '));

  for (const loc of cues.locations) {
    assert.ok(Array.isArray(loc.footprint) && loc.footprint.length === 3, `${loc.id} footprint`);
    assert.ok(loc.buildingStyle, `${loc.id} buildingStyle`);
    assert.equal(loc.collision?.shape, loc.buildingStyle === 'civic' ? 'circle' : 'box', loc.id);
    assert.ok(loc.collision?.halfExtents?.length === 2, `${loc.id} halfExtents`);
    assert.ok(typeof loc.collision?.radius === 'number' && loc.collision.radius > 0, `${loc.id} radius`);
  }
});
