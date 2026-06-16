/**
 * v24 — Play API contract (gameShell on /api/state)
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAY_API_VERSION, buildPlayStatePayload } from '../src/play/play-api-payload.js';
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
      env: { ...process.env, WM_DB_PATH: path.join(REPO, 'data/test-play-api.sqlite') },
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

test('v24: buildPlayStatePayload includes gameShell and districtView', () => {
  const world = bootstrapWorld();
  const payload = buildPlayStatePayload(world);
  assert.equal(payload.apiVersion, PLAY_API_VERSION);
  assert.ok(payload.gameShell?.location);
  assert.ok(Array.isArray(payload.gameShell.npcCards));
  assert.ok(payload.gameShell.caseBoard);
  assert.ok(Array.isArray(payload.gameShell.founder?.contracts));
  assert.ok(payload.gameShell.founder.contracts.length >= 1);
  assert.equal(typeof payload.gameShell.founder.tierLabel, 'string');
  assert.ok(payload.gameShell.founder.tierLabel.length > 0);
  assert.ok(payload.districtView?.nodes?.length >= 4);
  assert.ok(payload.playerSnapshot);
  assert.equal(payload.redaction.hiddenCause, 'never_in_api');
});

describe('v24: play-server API contract', () => {
  let child;
  let port;

  before(async () => {
    const started = await startServer(0);
    child = started.child;
    port = started.port;
  });

  after(() => { if (child) child.kill(); });

  test('GET /api/health exposes apiVersion', async () => {
    const r = await fetchJson(port, '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.json.apiVersion, PLAY_API_VERSION);
    assert.match(r.json.contract, /PLAY_API_CONTRACT/);
  });

  test('GET /api/state exposes gameShell for client boot', async () => {
    const r = await fetchJson(port, '/api/state');
    assert.equal(r.status, 200);
    assert.equal(r.json.apiVersion, PLAY_API_VERSION);
    assert.ok(r.json.gameShell.location.scene);
    assert.ok(r.json.gameShell.npcCards.length > 0);
    assert.ok(Array.isArray(r.json.gameShell.founder?.contracts));
    assert.equal(typeof r.json.gameShell.founder.tierLabel, 'string');
    assert.ok(r.json.gameShell.founder.tierLabel.length > 0);
    assert.ok(r.json.districtView);
    const raw = JSON.stringify({ ...r.json, redaction: undefined });
    assert.doesNotMatch(raw, /"hiddenCause"\s*:\s*"[^"]+"/);
  });

  test('POST /api/command still returns gameShell', async () => {
    const r = await fetchJson(port, '/api/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'look' })
    });
    assert.equal(r.status, 200);
    assert.ok(r.json.result.gameShell);
  });

  test('CORS preflight when WM_CORS_ORIGIN set', async () => {
    if (child) child.kill();
    const started = await new Promise((resolve, reject) => {
      const c = spawn(process.execPath, ['src/cli/play-server.js', '--port', '0', '--host', '127.0.0.1'], {
        cwd: REPO,
        env: {
          ...process.env,
          WM_CORS_ORIGIN: 'http://localhost:5173',
          WM_DB_PATH: path.join(REPO, 'data/test-play-api-cors.sqlite')
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let out = '';
      c.stdout.on('data', (d) => {
        out += d.toString();
        const m = out.match(/play-server listening on (\d+)/);
        if (m) resolve({ child: c, port: Number(m[1]) });
      });
      c.on('error', reject);
      setTimeout(() => reject(new Error('cors server timeout')), 15000);
    });
    child = started.child;
    port = started.port;
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' }
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });
});
