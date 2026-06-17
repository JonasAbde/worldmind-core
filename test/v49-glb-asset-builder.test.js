// v1.0-rc15 — Procedural GLB asset builder (Python + Node wrapper).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.join(__dirname, '..');
const TOOLS = path.join(REPO, 'tools');

function runWmAssets(subcommand, args = []) {
  const r = spawnSync(process.execPath, [path.join(TOOLS, 'wm-assets.js'), subcommand, ...args], {
    cwd: REPO, encoding: 'utf8'
  });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function parseLastJson(text) {
  // Find the FIRST '{' (the JSON object is the only thing printed by build-glb.py
  // for the build subcommand). For validate, multiple JSON blocks may be printed
  // (one per subdirectory) — pick the last complete object.
  const candidates = [];
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  // Try parsing from last to first — the last successful parse wins.
  for (let i = candidates.length - 1; i >= 0; i--) {
    try { return JSON.parse(candidates[i]); }
    catch { /* keep trying */ }
  }
  return null;
}

test('wm-assets.js exists and is a Node wrapper', () => {
  assert.ok(existsSync(path.join(TOOLS, 'wm-assets.js')));
  assert.ok(existsSync(path.join(TOOLS, 'build-glb.py')));
});

test('wm-assets.js --help prints usage', () => {
  const { status, out } = runWmAssets('--help');
  assert.equal(status, 0);
  assert.match(out, /wm-assets/);
  assert.match(out, /Usage:/);
});

test('wm-assets.js build generates all 17 GLBs', () => {
  const { status, out } = runWmAssets('build', ['--out=assets/models']);
  assert.equal(status, 0, `build failed: ${out.slice(-500)}`);
  const json = parseLastJson(out);
  assert.ok(json, 'should output JSON');
  assert.equal(json.kind, 'wm-asset-build');
  assert.equal(json.ok, true);
  assert.equal(json.built, 17);
  assert.equal(json.okCount, 17);
  assert.equal(json.failCount, 0);
});

test('built GLBs include all 5 locations + 11 NPCs + humanoid', () => {
  const { out } = runWmAssets('build', ['--out=assets/models']);
  const json = parseLastJson(out);
  const ids = json.reports.map(r => r.id).sort();
  // Locations
  for (const loc of ['cafe', 'apartment', 'market', 'workshop', 'district_square']) {
    assert.ok(ids.includes(loc), `missing location: ${loc}`);
  }
  // NPCs
  for (const npc of ['player', 'sara', 'malik', 'nadia', 'rune', 'amina', 'omar', 'elias', 'freja', 'yasin', 'lina']) {
    assert.ok(ids.includes(npc), `missing NPC: ${npc}`);
  }
  // Humanoid base
  assert.ok(ids.includes('humanoid'), 'missing humanoid base');
});

test('every built GLB is a valid glTF 2.0 binary', () => {
  const { out } = runWmAssets('build', ['--out=assets/models']);
  const json = parseLastJson(out);
  for (const r of json.reports) {
    assert.equal(r.ok, true, `${r.id} failed: ${JSON.stringify(r)}`);
    assert.ok(r.sizeBytes >= 100, `${r.id} too small`);
    assert.ok(r.vertexCount > 0, `${r.id} has no vertices`);
    // Validate the actual file header
    const assetPath = path.join(REPO, 'assets', 'models', r.kind === 'location' ? 'locations' : 'characters', `${r.id}.glb`);
    if (existsSync(assetPath)) {
      const header = readFileSync(assetPath).slice(0, 4);
      assert.deepEqual([...header], [0x67, 0x6C, 0x54, 0x46], `${r.id} has bad magic header`);
    }
  }
});

test('wm-assets.js validate runs without rebuilding', () => {
  const { status, out } = runWmAssets('validate', ['--out=assets/models']);
  assert.equal(status, 0);
  const json = parseLastJson(out);
  assert.ok(json);
  assert.equal(json.kind, 'wm-asset-validate');
  assert.equal(json.ok, true);
  assert.equal(json.okCount, 17);
});

test('wm-assets.js build with --kind=location only builds locations', () => {
  const { out } = runWmAssets('build', ['--out=assets/models', '--kind=location']);
  const json = parseLastJson(out);
  assert.ok(json);
  for (const r of json.reports) {
    assert.equal(r.kind, 'location', `${r.id} should be a location`);
  }
});

test('wm-assets.js build --id=cafe only builds cafe', () => {
  const { out } = runWmAssets('build', ['--out=assets/models', '--id=cafe']);
  const json = parseLastJson(out);
  assert.ok(json);
  assert.equal(json.built, 1, `expected 1 report, got ${json.built}: ${out.slice(-300)}`);
});

test('NPC character models are larger than just a capsule (have props)', () => {
  const { out } = runWmAssets('build', ['--out=assets/models']);
  const json = parseLastJson(out);
  // Pick sara — should have body + head + apron + earring = multiple primitives
  const sara = json.reports.find(r => r.id === 'sara');
  assert.ok(sara);
  assert.ok(sara.vertexCount > 100, 'sara should have meaningful geometry');
  assert.ok(sara.triangleCount > 50, 'sara should have multiple faces');
});

test('district_square is largest location (plaza has many props)', () => {
  const { out } = runWmAssets('build', ['--out=assets/models']);
  const json = parseLastJson(out);
  const ds = json.reports.find(r => r.id === 'district_square');
  const cafe = json.reports.find(r => r.id === 'cafe');
  assert.ok(ds.triangleCount > cafe.triangleCount);
});

test('cafe has the iconic delivery crate prop', () => {
  // The cafe spec includes a delivery crate box; verify cafe's geometry has
  // enough polygons to include the crate + awning + windows
  const { out } = runWmAssets('build', ['--out=assets/models']);
  const json = parseLastJson(out);
  const cafe = json.reports.find(r => r.id === 'cafe');
  assert.ok(cafe.triangleCount >= 100, 'cafe should have awning + crate + windows + door');
});

test('GLB files are under 200KB each (low-poly budget)', () => {
  const { out } = runWmAssets('build', ['--out=assets/models']);
  const json = parseLastJson(out);
  for (const r of json.reports) {
    assert.ok(r.sizeBytes < 200000, `${r.id} too large: ${r.sizeBytes} bytes`);
  }
});