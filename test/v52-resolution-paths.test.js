// v1.0-rc18 — All 9 authored resolution paths are wired into runScriptedPath.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDemoPaths,
  runScriptedPath,
  bootstrapWorld
} from '../src/play/play-engine.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.join(__dirname, '..');
const SCENARIO = path.join(REPO, 'scenarios', 'new-aarhus-district-01.json');

test('getDemoPaths returns all 9 authored resolution paths', () => {
  const paths = getDemoPaths();
  assert.equal(paths.length, 9, `expected 9 demo paths, got ${paths.length}`);
});

test('every demo path has a matching authored JSON file', () => {
  const paths = getDemoPaths();
  const authoredDir = path.join(REPO, 'content', 'resolution-paths');
  for (const p of paths) {
    const authoredPath = path.join(authoredDir, `${p.name}.json`);
    assert.ok(existsSync(authoredPath),
      `missing authored JSON for path "${p.name}" (expected ${authoredPath})`);
  }
});

test('every authored resolution path file is represented in getDemoPaths', () => {
  const authoredDir = path.join(REPO, 'content', 'resolution-paths');
  const authoredFiles = readdirSync(authoredDir)
    .filter(f => f.endsWith('.json') && f !== 'resolution-paths-pack.json');
  const demoNames = new Set(getDemoPaths().map(p => p.name));
  for (const f of authoredFiles) {
    const name = f.replace(/\.json$/, '');
    assert.ok(demoNames.has(name), `authored path ${name} not wired into getDemoPaths()`);
  }
});

test('runScriptedPath executes each path without errors', () => {
  const paths = getDemoPaths();
  for (const p of paths) {
    const world = bootstrapWorld({ scenarioPath: SCENARIO });
    const steps = runScriptedPath(world, p.name);
    assert.ok(Array.isArray(steps), `runScriptedPath(${p.name}) should return array`);
    assert.ok(steps.length > 0, `${p.name} should execute at least 1 step`);
  }
});

test('each demo path has at least 2 steps and a non-empty description', () => {
  const paths = getDemoPaths();
  for (const p of paths) {
    assert.ok(p.steps && p.steps.length >= 2, `${p.name} should have >=2 steps`);
    assert.ok(p.description && p.description.length > 0, `${p.name} should have a description`);
    assert.ok(p.label && p.label.length > 0, `${p.name} should have a label`);
  }
});

test('resolution path JSON files have required fields', () => {
  const authoredDir = path.join(REPO, 'content', 'resolution-paths');
  const authoredFiles = readdirSync(authoredDir)
    .filter(f => f.endsWith('.json') && f !== 'resolution-paths-pack.json');
  for (const f of authoredFiles) {
    const data = JSON.parse(readFileSync(path.join(authoredDir, f), 'utf8'));
    assert.ok(data.id, `${f} missing id`);
    assert.ok(data.label, `${f} missing label`);
    assert.ok(Array.isArray(data.steps), `${f} missing steps array`);
    assert.ok(data.steps.length >= 1, `${f} has empty steps`);
  }
});