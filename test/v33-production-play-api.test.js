/**
 * v33 — Production Play API verification (visualCues v4 + walkAnimation on move)
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPlayApiOnHost } from '../src/cli/validate-play-api.js';
import {
  assertVisualCuesV5,
  assertVisualCuesCollision,
  assertWalkAnimation,
  pickMoveTarget
} from '../src/play/play-api-verify.js';
import { buildPlayStatePayload } from '../src/play/play-api-payload.js';
import { bootstrapWorld } from '../src/play/play-engine.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fetchJson(port, urlPath, options = {}) {
  return fetch(`http://127.0.0.1:${port}${urlPath}`, {
    headers: { accept: 'application/json', ...(options.headers || {}) },
    ...options
  }).then(async (res) => ({ status: res.status, json: await res.json() }));
}

async function startServer(port = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/cli/play-server.js', '--port', String(port), '--host', '127.0.0.1'], {
      cwd: REPO,
      env: { ...process.env, WM_DB_PATH: path.join(REPO, 'data/test-v33-play-api.sqlite') },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')); }, 15000);
    child.stdout.on('data', (d) => {
      out += d.toString();
      const m = out.match(/play-server listening on (\d+)/);
      if (m) { clearTimeout(timer); resolve({ child, port: Number(m[1]) }); }
    });
    child.on('error', reject);
  });
}

test('v33.1 — play-api-verify helpers accept visualCues v4 payload', () => {
  const world = bootstrapWorld();
  const payload = buildPlayStatePayload(world);
  const check = assertVisualCuesV5(payload.visualCues);
  assert.equal(check.ok, true, check.problems?.join('; '));
  const collision = assertVisualCuesCollision(payload.visualCues);
  assert.equal(collision.ok, true, collision.problems?.join('; '));
  assert.equal(payload.visualCues.version, 5);
  assert.ok(payload.visualCues.walkGraph?.nodes?.cafe);
  assert.ok(payload.visualCues.interior?.locationId);
  assert.ok(Array.isArray(payload.visualCues.interior.hotspots));
});

describe('v33: play-server production API checks', () => {
  let child;
  let port;

  before(async () => {
    const started = await startServer(0);
    child = started.child;
    port = started.port;
  });

  after(() => { if (child) child.kill(); });

  test('v33.2 — GET /api/state includes visualCues v4 with walkGraph and interior', async () => {
    const r = await fetchJson(port, '/api/state');
    assert.equal(r.status, 200);
    const check = assertVisualCuesV5(r.json.visualCues);
    assert.equal(check.ok, true, check.problems?.join('; '));
    assert.ok(r.json.visualCues.interior.sceneTexture?.includes('assets/locations'));
  });

  test('v33.3 — POST move returns walkAnimation with waypoints', async () => {
    const state = await fetchJson(port, '/api/state');
    const { from, to } = pickMoveTarget(state.json);
    assert.ok(from && to, 'expected distinct move target');

    const move = await fetchJson(port, '/api/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `move ${to}` })
    });
    assert.equal(move.status, 200);
    assert.equal(move.json.ok, true);
    const walkCheck = assertWalkAnimation(move.json.result?.walkAnimation, from, to);
    assert.equal(walkCheck.ok, true, walkCheck.problems?.join('; '));
  });

  test('v33.4 — verifyPlayApiOnHost passes full gate', async () => {
    const summary = await verifyPlayApiOnHost('127.0.0.1', port);
    assert.equal(summary.visualCuesVersion, 5);
    assert.ok(summary.waypointCount >= 2);
    assert.ok(summary.walkGraphNodes >= 4);
  });
});
