/**
 * v36 — play-server static asset serving (assets/ fallback from repo root)
 *
 * serveStatic normalizes URL paths to POSIX segments (relPosix + split('/'))
 * before path.join so Windows backslashes never break the assets/ → ASSETS_DIR
 * fallback. See src/cli/play-server.js serveStatic.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAY_SERVER_SRC = path.join(REPO, 'src/cli/play-server.js');

async function startServer(port = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/cli/play-server.js', '--port', String(port), '--host', '127.0.0.1'], {
      cwd: REPO,
      env: { ...process.env, WM_DB_PATH: path.join(REPO, 'data/test-v36-play-api.sqlite') },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('play-server start timeout')); }, 15000);
    child.stdout.on('data', (d) => {
      out += d.toString();
      const m = out.match(/play-server listening on (\d+)/);
      if (m) { clearTimeout(timer); resolve({ child, port: Number(m[1]) }); }
    });
    child.on('error', reject);
  });
}

async function fetchAsset(port, urlPath) {
  const res = await fetch(`http://127.0.0.1:${port}${urlPath}`);
  const body = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  return { status: res.status, contentType: res.headers.get('content-type'), body };
}

test('v36.0 — serveStatic documents POSIX path normalization for Windows', () => {
  const src = readFileSync(PLAY_SERVER_SRC, 'utf8');
  assert.match(src, /relPosix.*split\('\/'\)/s, 'serveStatic should split on POSIX / before path.join');
  assert.match(src, /\.replace\(\/\\\\\/g, '\/'\)/, 'serveStatic should normalize backslashes to forward slashes');
  assert.match(src, /relPosix\.startsWith\('assets\/'\)/, 'assets/ fallback should key off POSIX relPosix');
});

describe('v36: play-server asset routes', () => {
  let child;
  let port;

  before(async () => {
    const started = await startServer(0);
    child = started.child;
    port = started.port;
  });

  after(() => { if (child) child.kill(); });

  test('v36.1 — GET /assets/locations/cafe.png returns 200 image/png', async () => {
    const r = await fetchAsset(port, '/assets/locations/cafe.png');
    assert.equal(r.status, 200);
    assert.equal(r.contentType, 'image/png');
    assert.ok(r.body && r.body.length > 8);
    assert.equal(r.body[0], 0x89);
    assert.equal(r.body[1], 0x50); // PNG signature
  });

  test('v36.2 — GET /assets/locations/market.webp returns 200 when file exists', async () => {
    const assetPath = path.join(REPO, 'assets/locations/market.webp');
    if (!existsSync(assetPath)) {
      return; // optional asset — skip when not checked in
    }
    const r = await fetchAsset(port, '/assets/locations/market.webp');
    assert.equal(r.status, 200);
    assert.equal(r.contentType, 'image/webp');
    assert.ok(r.body && r.body.length > 4);
    assert.equal(r.body.toString('ascii', 0, 4), 'RIFF');
  });

  test('v36.3 — GET /assets/models/locations/cafe.glb returns 200 model/gltf-binary', async () => {
    const assetPath = path.join(REPO, 'assets/models/locations/cafe.glb');
    assert.ok(existsSync(assetPath), 'baked cafe.glb must exist — run npm run bake:3d-models in worldmind-site');
    const r = await fetchAsset(port, '/assets/models/locations/cafe.glb');
    assert.equal(r.status, 200);
    assert.equal(r.contentType, 'model/gltf-binary');
    assert.ok(r.body && r.body.length > 12);
    assert.equal(r.body.toString('ascii', 0, 4), 'glTF');
  });

  test('v36.4 — GET /assets/models/characters/humanoid.glb returns 200', async () => {
    const assetPath = path.join(REPO, 'assets/models/characters/humanoid.glb');
    assert.ok(existsSync(assetPath), 'baked humanoid.glb must exist');
    const r = await fetchAsset(port, '/assets/models/characters/humanoid.glb');
    assert.equal(r.status, 200);
    assert.equal(r.contentType, 'model/gltf-binary');
    assert.equal(r.body.toString('ascii', 0, 4), 'glTF');
  });

  test('v36.5 — GET /assets/models/locations/missing.glb returns 404', async () => {
    const r = await fetchAsset(port, '/assets/models/locations/missing.glb');
    assert.equal(r.status, 404);
  });
});
