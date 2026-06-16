// TDD tests for v1.0-rc7: Save Browser UI + Branch Timeline Restore.
// Tests cover 6 new endpoints + Leno/hidden/private filter + restore + diff + UI sections.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));

function startServer({ port = 0, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/cli/play-server.js', '--port', String(port)], {
      cwd: REPO,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`server start timeout: ${err}`));
    }, 8000);
    child.stdout.on('data', (b) => {
      out += b.toString();
      const m = out.match(/play-server listening on (\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ child, port: Number(m[1]) });
      }
    });
    child.stderr.on('data', (b) => { err += b.toString(); });
    child.on('exit', (code) => {
      if (!out.includes('listening on')) {
        clearTimeout(timer);
        reject(new Error(`server exited ${code}: ${err || out}`));
      }
    });
  });
}

function stopServer({ child }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    if (!child || child.exitCode !== null || child.killed) return finish();
    child.once('exit', finish);
    child.kill('SIGTERM');
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      finish();
    }, 500);
  });
}

async function fetchJson(port, path, opts = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

async function waitForEvents(port, threshold = 1) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const r = await fetchJson(port, '/api/events');
    if (r.json?.ok && Array.isArray(r.json.events) && r.json.events.length >= threshold) return r.json.events;
    await new Promise((r) => setTimeout(r, 100));
  }
  return [];
}

describe('v1.0-rc7: save browser UI + branch restore', () => {
  let tmpDir;
  let server;
  let port;

  after(async () => {
    if (server) await stopServer({ child: server });
    server = null;
  });

  test('start server with isolated data dir', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'wm-rc7-'));
    const dbPath = join(tmpDir, 'worldmind.sqlite');
    const started = await startServer({ env: { WM_DB_PATH: dbPath } });
    server = started.child;
    port = started.port;
    const health = await fetchJson(port, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);
    assert.equal(health.json.engine, 'play-engine');
  });

  test('GET /api/saves returns empty list initially', async () => {
    const r = await fetchJson(port, '/api/saves');
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.ok(Array.isArray(r.json.snapshots));
    assert.equal(r.json.snapshots.length, 0);
  });

  test('POST /api/save creates a snapshot in sqlite', async () => {
    // First, generate events so the world has something to save
    await fetchJson(port, '/api/command', { method: 'POST', body: { command: 'look' } });
    await waitForEvents(port, 1);
    const r = await fetchJson(port, '/api/save', { method: 'POST', body: { branchName: 'main', note: 'rc7-test' } });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.ok(typeof r.json.snapshotId === 'string');
    assert.ok(r.json.snapshotId.startsWith('snapshot'));
    assert.equal(r.json.branchName, 'main');
  });

  test('GET /api/saves lists the created snapshot with metadata', async () => {
    const r = await fetchJson(port, '/api/saves');
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.ok(r.json.snapshots.length >= 1);
    const snap = r.json.snapshots[0];
    assert.ok(snap.id);
    assert.ok(snap.branchName);
    assert.ok(snap.createdAt);
    assert.ok(typeof snap.day === 'number');
    assert.ok(typeof snap.tick === 'number');
  });

  test('GET /api/saves/:id inspects a snapshot without loading it', async () => {
    const list = await fetchJson(port, '/api/saves');
    const id = list.json.snapshots[0].id;
    const r = await fetchJson(port, `/api/saves/${id}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.snapshot.id, id);
    assert.ok(r.json.snapshot.state);
    // hiddenCause / private memory must NOT be exposed raw
    const json = JSON.stringify(r.json);
    assert.ok(!/hiddenCause/i.test(json) || /"_redacted"/.test(json) || r.json.redacted === true, 'hiddenCause should be redacted or flagged');
  });

  test('GET /api/saves/:id returns 404 for unknown id', async () => {
    const r = await fetchJson(port, '/api/saves/snapshot_does_not_exist');
    assert.equal(r.status, 404);
    assert.equal(r.json.ok, false);
  });

  test('POST /api/saves/:id/restore loads snapshot and updates state', async () => {
    const list = await fetchJson(port, '/api/saves');
    const id = list.json.snapshots[0].id;
    const r = await fetchJson(port, `/api/saves/${id}/restore`, { method: 'POST', body: {} });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.restoredSnapshotId, id);
    // state should now reference the restored snapshot
    const state = await fetchJson(port, '/api/state');
    assert.equal(state.json.currentSnapshotId, id);
  });

  test('POST /api/saves/:id/restore rejects unknown id', async () => {
    const r = await fetchJson(port, '/api/saves/snapshot_nope/restore', { method: 'POST', body: {} });
    assert.equal(r.status, 404);
    assert.equal(r.json.ok, false);
  });

  test('GET /api/branches lists branches with origin chain', async () => {
    // Save a snapshot and create a branch
    await fetchJson(port, '/api/command', { method: 'POST', body: { command: 'look' } });
    await fetchJson(port, '/api/save', { method: 'POST', body: { branchName: 'investigation' } });
    const r = await fetchJson(port, '/api/branches');
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.ok(Array.isArray(r.json.branches));
    assert.ok(r.json.branches.length >= 1);
    const main = r.json.branches.find((b) => b.name === 'main') || r.json.branches[0];
    assert.ok(main.originSnapshotId);
    assert.ok(main.parentSnapshotId);
  });

  test('POST /api/branches creates a new branch from a snapshot', async () => {
    const list = await fetchJson(port, '/api/saves');
    const id = list.json.snapshots[0].id;
    const r = await fetchJson(port, '/api/branches', {
      method: 'POST',
      body: { name: 'rc7-rc7-branch', snapshotId: id, note: 'created in test' }
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.ok(typeof r.json.branchId === 'string');
    assert.equal(r.json.originSnapshotId, id);
  });

  test('POST /api/branches rejects invalid input (missing name)', async () => {
    const r = await fetchJson(port, '/api/branches', { method: 'POST', body: { snapshotId: 'snapshot_1' } });
    assert.equal(r.status, 400);
    assert.equal(r.json.ok, false);
  });

  test('GET /api/saves/diff returns structural diff between two snapshots', async () => {
    // Create a second snapshot to diff against
    await fetchJson(port, '/api/command', { method: 'POST', body: { command: 'look' } });
    await fetchJson(port, '/api/save', { method: 'POST', body: { branchName: 'main' } });
    const list = await fetchJson(port, '/api/saves');
    if (list.json.snapshots.length < 2) return;
    const from = list.json.snapshots[0].id;
    const to = list.json.snapshots[list.json.snapshots.length - 1].id;
    const r = await fetchJson(port, `/api/saves/diff?from=${from}&to=${to}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.from, from);
    assert.equal(r.json.to, to);
    assert.ok(r.json.diff);
  });

  test('GET /api/saves/diff rejects missing from/to params', async () => {
    const r = await fetchJson(port, '/api/saves/diff');
    assert.equal(r.status, 400);
    assert.equal(r.json.ok, false);
  });

  test('GET /api/saves/diff rejects unknown snapshot ids', async () => {
    const r = await fetchJson(port, '/api/saves/diff?from=snapshot_nope&to=snapshot_nah');
    assert.equal(r.status, 404);
    assert.equal(r.json.ok, false);
  });

  test('hidden/private memory is filtered from save inspection payload', async () => {
    const list = await fetchJson(port, '/api/saves');
    const id = list.json.snapshots[0].id;
    const r = await fetchJson(port, `/api/saves/${id}`);
    // The inspect payload's `state` may include world.agents and world.memories.
    // We forbid any field literally named hiddenCause or with visibility: 'private' in raw form.
    const blob = JSON.stringify(r.json);
    // If private memory appears, it must be inside a `redacted: true` envelope
    const privateMatches = blob.match(/"visibility"\s*:\s*"private"/g) || [];
    const redactedMatches = blob.match(/"_redacted"\s*:\s*true/g) || [];
    assert.ok(
      privateMatches.length === 0 || redactedMatches.length >= privateMatches.length,
      `private visibility count (${privateMatches.length}) must be covered by redacted envelope count (${redactedMatches.length})`
    );
  });

  test('static-play generated page includes save browser + branch + diff sections', async () => {
    // Generate fresh static-play
    const { spawnSync } = await import('node:child_process');
    const gen = spawnSync(process.execPath, ['src/cli/play-web.js'], { cwd: REPO, encoding: 'utf8' });
    assert.equal(gen.status, 0, `play-web failed: ${gen.stderr}`);
    const html = readFileSync(join(REPO, 'static-play/index.html'), 'utf8');
    // Required section markers
    for (const marker of [
      'id="section-saves"',
      'id="section-branches"',
      'id="section-diff"',
      'data-saves-list',
      'data-branches-tree',
      'data-diff-panel'
    ]) {
      assert.ok(html.includes(marker), `expected static-play HTML to contain ${marker}`);
    }
  });

  test('POST /api/command returns gameShell and majorDecisionPrompt for major pay command', async () => {
    const r = await fetchJson(port, '/api/command', {
      method: 'POST',
      body: { text: 'pay malik 15' }
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.ok(r.json.result.gameShell?.caseBoard);
    assert.equal(r.json.result.majorDecisionPrompt?.id, 'founder_negotiation');
    assert.equal(r.json.text, 'pay malik 15');
  });

  test('validate:saves-ui passes', async () => {
    // Run validate:saves-ui against the running server (port 0 -> we need to know the port).
    // The validator should discover the server via WM_VALIDATE_PORT or by probing.
    // We pass the port via env.
    const { spawnSync } = await import('node:child_process');
    const v = spawnSync(process.execPath, ['src/cli/validate-saves-ui.js', '--port', String(port), '--json'], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...process.env, WM_DB_PATH: join(tmpDir, 'worldmind.sqlite') }
    });
    assert.equal(v.status, 0, `validate:saves-ui failed: ${v.stderr}\nstdout: ${v.stdout}`);
    const lines = v.stdout.trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]);
    assert.equal(last.ok, true);
    assert.ok(Array.isArray(last.checks));
    assert.ok(last.checks.every((c) => c.ok), 'all validator checks must pass');
  });

});
