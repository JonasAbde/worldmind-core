import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCharacterFullBodyPath } from '../src/play/character-fullbody-assets.js';
import { build3DVisualCues } from '../src/play/district-3d-layout.js';
import { bootstrapWorld } from '../src/play/play-engine.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

const FULLBODY_AGENTS = [
  'player', 'sara', 'malik', 'rune', 'amina', 'nadia',
  'omar', 'lina', 'yasin', 'freja', 'elias'
];

test('v38 — resolveCharacterFullBodyPath prefers fullbody art', () => {
  for (const id of FULLBODY_AGENTS) {
    const path = resolveCharacterFullBodyPath(id);
    assert.ok(path.includes('fullbody'), `${id} should resolve fullbody: ${path}`);
    assert.ok(existsSync(join(REPO, ...path.split('/'))), `missing ${path}`);
  }
});

test('v38 — visualCues agents include fullBodyTexture', () => {
  const world = bootstrapWorld();
  const cues = build3DVisualCues(world);
  const agents = cues.locations.flatMap((l) => l.agents ?? []);
  assert.ok(agents.length > 0);
  assert.ok(agents.every((a) => typeof a.fullBodyTexture === 'string'));
  assert.ok(agents.every((a) => a.fullBodyTexture.includes('fullbody')), 'agents should use fullbody textures');
  assert.ok(cues.player?.fullBodyTexture);
});

test('v38 — district_square is a playable location in default world', () => {
  const world = bootstrapWorld();
  assert.ok(world.locations?.district_square, 'scenario must include district_square');
  const cues = build3DVisualCues(world);
  const square = cues.locations.find((l) => l.id === 'district_square');
  assert.ok(square, 'visualCues must include district_square');
  assert.ok(square.sceneTexture?.includes('district-square'));
});
