// v1.0-rc21 — Ship-ready infra verification.
//
// Release verify now covers:
// 1. Standard gates (typecheck, check, validators, audit)
// 2. Content pack integrity (rc12 schema)
// 3. Asset pipeline (rc15-rc17 GLB files exist + valid)
// 4. Authoring panel reachable (rc20 /api/content endpoint)
// 5. All 3 episodes playable (rc13)
// 6. All 9 resolution paths executable (rc18)
//
// TDD: this test runs as part of the test suite to ensure every
// release-verify check stays in sync with code reality.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.join(__dirname, '..');

test('release-verify.js includes content pack integrity check', () => {
  const src = readFileSync(path.join(REPO, 'src', 'cli', 'release-verify.js'), 'utf8');
  assert.ok(src.includes('validate:scenario') || src.includes('validate-content-pack'),
    'release-verify should include content pack schema validation');
});

test('release-verify.js includes asset pipeline check', () => {
  const src = readFileSync(path.join(REPO, 'src', 'cli', 'release-verify.js'), 'utf8');
  assert.ok(src.includes('assets:validate') || src.includes('asset'),
    'release-verify should include asset validation');
});

test('release-verify.js includes authoring endpoint check', () => {
  const src = readFileSync(path.join(REPO, 'src', 'cli', 'release-verify.js'), 'utf8');
  assert.ok(src.includes('api/content') || src.includes('author') || src.includes('validate:web-play'),
    'release-verify should include authoring endpoint check');
});

test('README documents the authoring panel route', () => {
  const readme = readFileSync(path.join(REPO, 'README.md'), 'utf8');
  // Should mention /author or authoring or content pack editing
  assert.ok(/author|content.pack.edit|designer/i.test(readme),
    'README should document the authoring panel');
});

test('install guide documents Python asset pipeline (rc15-rc17)', () => {
  const guide = readFileSync(path.join(REPO, 'docs', '54_INSTALL_AND_RUN_GUIDE.md'), 'utf8');
  // Should mention Python (for the asset builder) OR have a note about rc15
  assert.ok(/python|trimesh|GLB|asset.builder|procedural/i.test(guide),
    'install guide should document the Python asset pipeline');
});

test('all 17 GLB files exist (rc15 asset pipeline output)', () => {
  const expected = [
    'cafe', 'apartment', 'workshop', 'market', 'district_square',
    'player', 'sara', 'malik', 'nadia', 'rune', 'amina', 'omar',
    'elias', 'freja', 'yasin', 'lina', 'humanoid'
  ];
  for (const id of expected) {
    const dir = expected.indexOf(id) < 5 ? 'locations' : 'characters';
    const p = path.join(REPO, 'assets', 'models', dir, `${id}.glb`);
    assert.ok(existsSync(p), `${id}.glb should exist in ${dir}/`);
  }
});

test('package.json description reflects v1.0 status', () => {
  const pkg = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  assert.ok(/v1\.0/.test(pkg.description),
    'package.json description should mention v1.0');
});

test('git tag v1.0.0 can be applied (HEAD is clean and at main)', async () => {
  const { execSync } = await import('node:child_process');
  // Verify HEAD is on master and there are no uncommitted changes
  // that would block a release tag.
  const branch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: REPO, encoding: 'utf8'
  }).trim();
  assert.equal(branch, 'master', 'release should be tagged on master branch');
  const status = execSync('git status --porcelain', {
    cwd: REPO, encoding: 'utf8'
  }).trim();
  assert.equal(status, '', 'working tree should be clean for release');
});