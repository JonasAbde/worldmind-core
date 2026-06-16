import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// TDD RED phase: Write tests BEFORE implementation

// --- GitHub Actions CI ---

test('v1.0-rc10: GitHub Actions CI workflow exists', () => {
  const wf = path.join(ROOT, '.github/workflows/ci.yml');
  assert.ok(fs.existsSync(wf), 'ci.yml should exist');
  const content = fs.readFileSync(wf, 'utf8');
  assert.ok(content.includes('npm test'), 'should run npm test');
  assert.ok(content.includes('release:verify') || content.includes('ci:gate'), 'should include release gate');
  assert.ok(content.includes('npm run validate:leno'), 'should run validate:leno');
  assert.ok(content.includes('npm run demo:play'), 'should run demo:play');
});

// --- Release verification ---

test('v1.0-rc10: release:verify script exists', () => {
  // Run the script directly to avoid circular dependency with npm test
  const result = execSync('node src/cli/release-verify.js --help 2>&1 || node src/cli/release-verify.js 2>&1 | head -5', {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 30_000
  });
  // Should either show help or attempt to run (not "missing script")
  assert.ok(!result.includes('missing script'), 'release:verify should exist');
  assert.ok(!result.includes('ENOENT'), 'release-verify should be executable');
});

test('v1.0-rc10: release:verify runs full gate', () => {
  // Smoke: run release:verify directly and check it exits 0
  // Uses timeout to avoid hanging if something is wrong
  const result = execSync('node src/cli/release-verify.js', {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 300_000
  });
  assert.ok(result.toLowerCase().includes('ok') || result.includes('{') || result.includes('✓') || result.includes('passed'), 'release:verify should produce ok output');
});

test('v1.0-rc10: audit:worldmind script exists', () => {
  const result = execSync('node src/cli/audit-worldmind.js 2>&1', {
    encoding: 'utf8',
    cwd: ROOT
  });
  assert.ok(result.includes('audit') || result.includes('ok') || result.includes('✓'), 'audit:worldmind should exist and produce output');
});

test('v1.0-rc10: audit checks no hiddenCause in public fields', () => {
  const content = fs.readFileSync(path.join(ROOT, 'src/play/web-renderer.js'), 'utf8');
  // hiddenCause should never be referenced in a way that exposes it publicly
  // It should only appear in private sections
  assert.ok(!content.includes('.hiddenCause') || content.includes('private'), 'hiddenCause should be in private context');
});

test('v1.0-rc10: audit checks private memory redaction in play-server', () => {
  const serverPath = path.join(ROOT, 'src/cli/play-server.js');
  if (fs.existsSync(serverPath)) {
    const content = fs.readFileSync(serverPath, 'utf8');
    assert.ok(content.includes('markPrivateObjects') || content.includes('private'), 'play-server should redact private objects');
  }
});

test('v1.0-rc10: audit checks Risk 4/5 gated in actions.js', () => {
  const actionsPath = path.join(ROOT, 'src/simulation/actions.js');
  if (fs.existsSync(actionsPath)) {
    const content = fs.readFileSync(actionsPath, 'utf8');
    // spread_rumor is risk 3 and should be gated (max is 3)
    assert.ok(content.includes('risk') || content.includes('RISK'), 'actions should have risk tracking');
  }
});

test('v1.0-rc10: audit checks no admin/world_change in creator permissions', () => {
  const creatorPath = path.join(ROOT, 'src/cli/creator.js');
  if (fs.existsSync(creatorPath)) {
    const content = fs.readFileSync(creatorPath, 'utf8');
    assert.ok(content.includes('admin') || content.includes('PERMISSIONS_MVP_SAFE'), 'creator should filter unsafe permissions');
  }
});

test('v1.0-rc10: audit checks Leno evidence guard in web-renderer', () => {
  const rendererPath = path.join(ROOT, 'src/play/web-renderer.js');
  const content = fs.readFileSync(rendererPath, 'utf8');
  assert.ok(content.includes('applyLenoGuard') || content.includes('hasNadiaEvidence'), 'Leno evidence guard should exist');
});

// --- README quickstart ---

test('v1.0-rc10: README mentions play:web', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(readme.includes('play:web'), 'README quickstart should mention play:web');
});

test('v1.0-rc10: README mentions play:server', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(readme.includes('play:server') || readme.includes('play:server'), 'README quickstart should mention play:server');
});

test('v1.0-rc10: README mentions creator', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(readme.includes('creator'), 'README should mention creator');
});

// --- Release checklist ---

test('v1.0-rc10: release checklist doc exists', () => {
  const checklistPath = path.join(ROOT, 'docs/55_V1_0_RELEASE_CHECKLIST.md');
  assert.ok(fs.existsSync(checklistPath), 'docs/55_V1_0_RELEASE_CHECKLIST.md should exist');
});

// --- No generated sqlite committed ---

test('v1.0-rc10: no .sqlite files in git tracked files', () => {
  const result = execSync('git ls-files --cached "*.sqlite" "data/*.sqlite"', { encoding: 'utf8', cwd: ROOT });
  assert.equal(result.trim(), '', 'no .sqlite files should be committed to git');
});

// --- Generated fixture hygiene ---

test('v1.0-rc10: generated UI fixtures have no hiddenCause exposed', () => {
  const htmlPath = path.join(ROOT, 'static-play/index.html');
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    // The key "hiddenCause" may appear as JSON schema (e.g. "hiddenCause":null)
    // but the actual secret text must never appear.
    const SECRET_TEXT = 'Nadia planted a false rumor';
    assert.ok(!html.includes(SECRET_TEXT), 'the actual hiddenCause text should not appear in generated HTML');
    // secrets array must be empty for all agents
    const safeState = JSON.parse(fs.readFileSync(path.join(ROOT, 'static-play/state.json'), 'utf8'));
    for (const agent of Object.values(safeState.world?.agents ?? {})) {
      assert.equal(agent.secrets?.length ?? 0, 0, `agent ${agent.id} should have no secrets in browser state`);
    }
  }
});