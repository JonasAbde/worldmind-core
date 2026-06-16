import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';
import { bindAssets, validateAssetRegistry } from '../src/play/assets.js';
import { buildDistrictView, validateDistrictView } from '../src/play/district-view.js';
import { createInitialProgression, awardProgression, validateProgression } from '../src/play/progression.js';
import { validateContentPack, summarizeContentPack, buildAuthoringChecklist } from '../src/play/authoring.js';

const REPO = process.cwd();
const CONTENT_PACK = path.join(REPO, 'content/worldmind/content-pack-v1.json');

test('asset registry validates stable WorldMind asset paths', () => {
  const result = validateAssetRegistry();
  assert.equal(result.ok, true);
  assert.ok(result.paths.includes('assets/hero/worldmind-cover.png'));
  assert.ok(result.paths.includes('assets/ui/hud-memory-permissions.png'));
});

test('asset binding attaches assets to agents and locations', () => {
  const world = bindAssets(bootstrapWorld());
  assert.ok(world.assets.hero);
  assert.ok(world.agents.sara.assets.portrait);
  assert.ok(world.locations.cafe.assets.scene);
});

test('content pack validates and exposes authoring checklist', () => {
  const pack = JSON.parse(fs.readFileSync(CONTENT_PACK, 'utf8'));
  const validation = validateContentPack(pack);
  assert.equal(validation.ok, true);
  const summary = summarizeContentPack(pack);
  assert.equal(summary.counts.episodes, 1);
  assert.equal(summary.counts.quests, 1);
  assert.ok(buildAuthoringChecklist(pack).every((item) => item.ok));
});

test('district view builds spatial graph from world state', () => {
  const world = bindAssets(bootstrapWorld());
  const view = buildDistrictView(world);
  const validation = validateDistrictView(view);
  assert.equal(validation.ok, true);
  assert.ok(view.nodes.length >= 4);
  assert.ok(view.edges.length >= 3);
});

test('progression loop awards XP from validated play result', () => {
  const world = bindAssets(bootstrapWorld());
  const progress = createInitialProgression();
  const result = resolveCommand(world, 'look', {});
  const awarded = awardProgression(progress, result, 'look');
  assert.equal(validateProgression(awarded.progression).ok, true);
  assert.ok(awarded.progression.xp > 0);
  assert.equal(awarded.delta.leveledUp, false);
});
