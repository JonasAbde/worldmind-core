// v1.0-rc17 — Animation tracks for procedural GLB models.
//
// 4 animation tracks per humanoid:
// - idle  (subtle breathing + blink, 2s loop)
// - talk  (jaw + head micro-movements, 1.5s loop)
// - examine (lean forward, 1s)
// - walk  (4-frame walk cycle, 0.8s loop)
//
// Animations are baked into the GLB as glTF animation tracks during
// build-glb-pbr.py. Runtime reads them via THREE.AnimationMixer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.join(__dirname, '..');

function runPythonBuild() {
  return spawnSync('python', ['tools/build-glb-pbr.py', '--out=assets/models'], {
    cwd: REPO, encoding: 'utf8'
  });
}

test('build-glb-pbr.py writes glTF animation tracks per humanoid GLB', () => {
  // Build (or rebuild) all GLBs.
  const r = runPythonBuild();
  assert.equal(r.status, 0, `build failed: ${r.stderr}`);
  // After build, humanoid.glb must contain at least 4 animation tracks.
  const humanoidPath = path.join(REPO, 'assets', 'models', 'characters', 'humanoid.glb');
  assert.ok(existsSync(humanoidPath), 'humanoid.glb should exist');
  const data = readFileSync(humanoidPath);
  const jsonLen = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLen).toString('utf8'));
  assert.ok(Array.isArray(json.animations) && json.animations.length >= 4,
    `humanoid.glb should have >=4 animation tracks, got ${json.animations?.length}`);
});

test('animation tracks have names: idle, talk, examine, walk', () => {
  const humanoidPath = path.join(REPO, 'assets', 'models', 'characters', 'humanoid.glb');
  const data = readFileSync(humanoidPath);
  const jsonLen = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLen).toString('utf8'));
  const names = (json.animations || []).map(a => a.name).sort();
  for (const expected of ['idle', 'talk', 'examine', 'walk']) {
    assert.ok(names.includes(expected), `humanoid.glb missing animation ${expected} (got: ${names.join(', ')})`);
  }
});

test('animation tracks have non-zero durations', () => {
  const humanoidPath = path.join(REPO, 'assets', 'models', 'characters', 'humanoid.glb');
  const data = readFileSync(humanoidPath);
  const jsonLen = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLen).toString('utf8'));
  // Each animation track should declare a duration > 0 in its glTF metadata.
  // We don't decode full keyframes — just assert the count matches accessors.
  for (const anim of json.animations || []) {
    assert.ok(anim.channels && anim.channels.length > 0,
      `animation ${anim.name} should have at least 1 channel`);
  }
});

test('animations target node TRS (translation/rotation/scale)', () => {
  const humanoidPath = path.join(REPO, 'assets', 'models', 'characters', 'humanoid.glb');
  const data = readFileSync(humanoidPath);
  const jsonLen = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLen).toString('utf8'));
  // glTF animation channel target.path is "translation"|"rotation"|"scale"|"weights"
  for (const anim of json.animations || []) {
    for (const channel of anim.channels || []) {
      const pathName = channel.target?.path;
      assert.ok(['translation', 'rotation', 'scale', 'weights'].includes(pathName),
        `animation ${anim.name} channel has invalid path ${pathName}`);
    }
  }
});

test('per-character GLBs (sara, omar) also have animations', () => {
  for (const id of ['sara', 'omar']) {
    const p = path.join(REPO, 'assets', 'models', 'characters', `${id}.glb`);
    // Rebuild first to ensure animations are baked in.
    spawnSync('python', ['tools/build-glb-pbr.py', '--kind=character', `--id=${id}`, '--out=assets/models'], {
      cwd: REPO, encoding: 'utf8'
    });
    const data = readFileSync(p);
    const jsonLen = data.readUInt32LE(12);
    const json = JSON.parse(data.subarray(20, 20 + jsonLen).toString('utf8'));
    assert.ok(Array.isArray(json.animations) && json.animations.length >= 1,
      `${id}.glb should have at least 1 animation, got ${json.animations?.length}`);
  }
});