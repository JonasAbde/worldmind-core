import { test } from 'node:test';

import assert from 'node:assert/strict';

import { existsSync } from 'node:fs';

import { join, dirname } from 'node:path';

import { fileURLToPath } from 'node:url';

import { resolveCharacterFigurePath } from '../src/play/character-figure-assets.js';

import { sceneTexturePathForLocation } from '../src/play/location-scene-assets.js';



const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');



test('v37 — resolveCharacterFigurePath prefers portrait over UI sheets', () => {

  for (const id of ['player', 'sara', 'malik', 'omar', 'lina', 'yasin', 'freja', 'elias']) {

    const path = resolveCharacterFigurePath(id);

    assert.match(path, /^assets\/characters\//);

    assert.ok(path.includes('portrait') || path.includes('avatar'), `${id} should use portrait art, got ${path}`);

    assert.ok(!path.includes('character-sheet'), `${id} must not use character-sheet`);
    assert.ok(!path.includes('player-sheet'), `${id} must not use player-sheet`);
    assert.ok(existsSync(join(REPO, ...path.split('/'))), `${id} figure missing: ${path}`);

  }

});



test('v37 — player resolves to portrait not character-sheet', () => {

  const path = resolveCharacterFigurePath('player');

  assert.ok(path.includes('portrait'), `expected portrait path, got ${path}`);

  assert.ok(!path.includes('sheet'), `character-sheet is UI-only, got ${path}`);

});



test('v37 — apartment scene uses interior diorama backdrop', () => {

  const path = sceneTexturePathForLocation('apartment');

  assert.ok(path.includes('apartment-interior'), `expected interior scene, got ${path}`);

  assert.ok(existsSync(join(REPO, ...path.split('/'))), `missing ${path}`);

});


