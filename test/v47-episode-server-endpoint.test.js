// v1.0-rc13 — Play server episode endpoints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const REPO = process.cwd();

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(buf) });
        } catch (e) {
          reject(new Error(`bad json: ${buf.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

let server;
let port;

test.before(async () => {
  const { spawn } = await import('node:child_process');
  server = spawn(process.execPath, ['src/cli/play-server.js', '--port=0'], {
    cwd: REPO,
    env: { ...process.env, WM_DB_PATH: `${REPO}/data/test-episode-server.sqlite` }
  });
  server.stderr.on('data', () => {});  // silence
  // Wait for "listening on" line
  await new Promise((resolve) => {
    server.stdout.on('data', (d) => {
      const m = String(d).match(/listening on (\d+)/);
      if (m) { port = Number(m[1]); resolve(); }
    });
    setTimeout(resolve, 3000);
  });
});

test.after(() => {
  if (server) server.kill();
});

test('GET /api/episodes returns 3 playable episodes', async () => {
  const { status, json } = await fetchJson(`http://127.0.0.1:${port}/api/episodes`);
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.kind, 'episodes-list');
  assert.ok(Array.isArray(json.episodes));
  assert.equal(json.episodes.length, 3);
  for (const ep of json.episodes) {
    assert.ok(ep.id);
    assert.ok(ep.title);
    assert.ok(ep.scenario);
    assert.ok(ep.incident);
  }
});

test('GET /api/episodes includes the-missing-delivery', async () => {
  const { json } = await fetchJson(`http://127.0.0.1:${port}/api/episodes`);
  const ids = json.episodes.map(e => e.id);
  assert.ok(ids.includes('the-missing-delivery'));
  assert.ok(ids.includes('noise-along-the-quay'));
  assert.ok(ids.includes('ownership-dispute'));
});