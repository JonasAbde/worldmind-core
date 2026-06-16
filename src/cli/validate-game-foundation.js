#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { bootstrapWorld, resolveCommand } from '../play/play-engine.js';
import { bindAssets, validateAssetRegistry } from '../play/assets.js';
import { buildDistrictView, validateDistrictView } from '../play/district-view.js';
import { createInitialProgression, awardProgression, validateProgression } from '../play/progression.js';
import { validateContentPack, summarizeContentPack } from '../play/authoring.js';

const REPO = process.cwd();
const scenarioPath = path.join(REPO, 'scenarios/new-aarhus-district-01.json');
const contentPath = path.join(REPO, 'content/worldmind/content-pack-v1.json');

function ok(name, extra = {}) {
  return { name, ok: true, ...extra };
}

function fail(name, error) {
  return { name, ok: false, errors: [String(error?.message || error)] };
}

function run(name, fn) {
  try { return fn(); } catch (error) { return fail(name, error); }
}

const checks = [];
let world = null;

checks.push(run('asset registry', () => {
  const result = validateAssetRegistry();
  return result.ok ? ok('asset registry', { totalPaths: result.totalPaths }) : { name: 'asset registry', ...result };
}));

checks.push(run('world asset binding', () => {
  world = bindAssets(bootstrapWorld({ scenarioPath }));
  const agents = Object.values(world.agents || {}).filter((a) => a.assets?.portrait).length;
  const locations = Object.values(world.locations || {}).filter((l) => l.assets?.scene).length;
  const errors = [];
  if (agents < 10) errors.push(`expected at least 10 agent asset bindings, got ${agents}`);
  if (locations < 4) errors.push(`expected at least 4 location asset bindings, got ${locations}`);
  return errors.length ? { name: 'world asset binding', ok: false, errors } : ok('world asset binding', { agents, locations });
}));

checks.push(run('content pack', () => {
  const pack = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  const result = validateContentPack(pack);
  return result.ok ? ok('content pack', { summary: summarizeContentPack(pack) }) : { name: 'content pack', ...result };
}));

checks.push(run('district view', () => {
  if (!world) world = bindAssets(bootstrapWorld({ scenarioPath }));
  const view = buildDistrictView(world);
  const result = validateDistrictView(view);
  return result.ok ? ok('district view', { nodes: view.nodes.length, edges: view.edges.length }) : { name: 'district view', ...result };
}));

checks.push(run('progression loop', () => {
  if (!world) world = bindAssets(bootstrapWorld({ scenarioPath }));
  const progress = createInitialProgression();
  const result = resolveCommand(world, 'look', {});
  const awarded = awardProgression(progress, result, 'look');
  const validation = validateProgression(awarded.progression);
  if (!validation.ok) return { name: 'progression loop', ...validation };
  if (awarded.progression.xp <= 0) return { name: 'progression loop', ok: false, errors: ['expected positive XP after look command'] };
  return ok('progression loop', { xp: awarded.progression.xp, level: awarded.progression.level });
}));

const passed = checks.every((c) => c.ok);
const payload = { ok: passed, kind: 'game-foundation-validator', checks };
if (!process.argv.includes('--json')) {
  process.stdout.write(passed ? 'game foundation: ok\n' : 'game foundation: failed\n');
  for (const check of checks) process.stdout.write(`${check.ok ? 'OK' : 'FAIL'} ${check.name}\n`);
}
process.stdout.write(JSON.stringify(payload) + '\n');
process.exit(passed ? 0 : 1);
