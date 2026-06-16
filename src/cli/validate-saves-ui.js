#!/usr/bin/env node
/**
 * validate-saves-ui — CI gate for the save browser UI + branch timeline + diff viewer.
 *
 * Checks (all must pass for ok: true):
 *   1.  /api/health reachable
 *   2.  /api/state reachable
 *   3.  /api/saves listable
 *   4.  /api/command accepts a known command
 *   5.  /api/save creates a snapshot
 *   6.  /api/saves/:id inspect returns redacted hiddenCause / private memory
 *   7.  /api/saves/:id/restore updates currentSnapshotId
 *   8.  /api/branches listable
 *   9.  /api/branches POST creates a branch
 *   10. /api/saves/diff produces a structural diff
 *   11. static-play/index.html contains save / branch / diff sections
 *   12. Leno summary in /api/state does not leak hiddenCause when no evidence
 *
 * Flags:
 *   --port=N     port of running play-server (default: 8080)
 *   --host=ADDR  host (default: 127.0.0.1)
 *   --json       JSON-only output (last line is the JSON report)
 *   --skip-server  skip server checks (useful for offline validation)
 *   --help
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const opts = { port: 8080, host: '127.0.0.1', jsonOnly: false, skipServer: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.jsonOnly = true;
    else if (a === '--skip-server') opts.skipServer = true;
    else if (a === '--port') opts.port = Number(argv[++i]);
    else if (a.startsWith('--port=')) opts.port = Number(a.split('=')[1]);
    else if (a === '--host') opts.host = argv[++i];
    else if (a.startsWith('--host=')) opts.host = a.split('=')[1];
  }
  return opts;
}

function showHelp() {
  process.stdout.write(`validate-saves-ui — save browser UI + branch restore gate

Usage:
  node src/cli/validate-saves-ui.js [--port=N] [--host=ADDR] [--json] [--skip-server]

Exit codes:
  0 — all checks pass
  1 — one or more checks failed
`);
}

function ok(name, extra = {}) { return { name, ok: true, ...extra }; }
function fail(name, errors) { return { name, ok: false, errors: Array.isArray(errors) ? errors : [String(errors)] }; }

async function probeHealth(host, port) {
  try {
    const r = await fetchOnce(host, port, '/api/health');
    return r.status === 200 && r.json?.ok;
  } catch {
    return false;
  }
}

function startTemporaryServer(opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/cli/play-server.js', '--host', opts.host, '--port', String(opts.port)], {
      cwd: REPO,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      reject(new Error(`temporary play-server timeout: ${err || out}`));
    }, 8000);
    child.stdout.on('data', (b) => {
      out += b.toString();
      if (out.includes('play-server listening on')) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on('data', (b) => { err += b.toString(); });
    child.on('exit', (code) => {
      if (!out.includes('play-server listening on')) {
        clearTimeout(timer);
        reject(new Error(`temporary play-server exited ${code}: ${err || out}`));
      }
    });
  });
}

function stopTemporaryServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.killed) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    child.once('exit', finish);
    child.kill('SIGTERM');
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      finish();
    }, 500);
  });
}

function fetchOnce(host, port, urlPath, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host, port, path: urlPath, method: opts.method || 'GET',
      headers: { 'content-type': 'application/json', ...(opts.headers || {}) }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* not json */ }
        resolve({ status: res.statusCode || 0, json, text });
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

function readStaticSections(htmlPath) {
  if (!fs.existsSync(htmlPath)) return { found: false, sections: [] };
  const html = fs.readFileSync(htmlPath, 'utf8');
  const required = [
    'id="section-saves"',
    'id="section-branches"',
    'id="section-diff"',
    'data-saves-list',
    'data-branches-tree',
    'data-diff-panel'
  ];
  return { found: true, sections: required.filter((m) => html.includes(m)), required };
}

async function runChecks(opts) {
  const checks = [];
  const base = `${opts.host}:${opts.port}`;

  if (!opts.skipServer) {
    checks.push(await (async () => {
      try {
        const r = await fetchOnce(opts.host, opts.port, '/api/health');
        return r.status === 200 && r.json?.ok
          ? ok('health endpoint', { version: r.json.version })
          : fail('health endpoint', `status ${r.status}`);
      } catch (err) { return fail('health endpoint', err.message); }
    })());

    checks.push(await (async () => {
      try {
        const r = await fetchOnce(opts.host, opts.port, '/api/state');
        return r.status === 200 && r.json?.ok
          ? ok('state endpoint', { tick: r.json.tick, day: r.json.day })
          : fail('state endpoint', `status ${r.status}`);
      } catch (err) { return fail('state endpoint', err.message); }
    })());

    checks.push(await (async () => {
      try {
        const r = await fetchOnce(opts.host, opts.port, '/api/saves');
        return r.status === 200 && r.json?.ok
          ? ok('saves list', { count: r.json.snapshots.length })
          : fail('saves list', `status ${r.status}`);
      } catch (err) { return fail('saves list', err.message); }
    })());

    checks.push(await (async () => {
      try {
        const r = await fetchOnce(opts.host, opts.port, '/api/command', {
          method: 'POST', body: { command: 'look' }
        });
        return r.status === 200 && r.json?.ok
          ? ok('command dispatch (look)')
          : fail('command dispatch (look)', `status ${r.status} ${r.json?.error || ''}`);
      } catch (err) { return fail('command dispatch (look)', err.message); }
    })());

    checks.push(await (async () => {
      try {
        const r = await fetchOnce(opts.host, opts.port, '/api/save', { method: 'POST', body: { branchName: 'main' } });
        return r.status === 200 && r.json?.ok
          ? ok('save creates snapshot', { snapshotId: r.json.snapshotId })
          : fail('save creates snapshot', `status ${r.status} ${r.json?.error || ''}`);
      } catch (err) { return fail('save creates snapshot', err.message); }
    })());

    let newSnapshotId = null;
    checks.push(await (async () => {
      try {
        const list = await fetchOnce(opts.host, opts.port, '/api/saves');
        if (!list.json?.snapshots?.length) return fail('inspect snapshot', 'no snapshots');
        newSnapshotId = list.json.snapshots[list.json.snapshots.length - 1].id;
        const r = await fetchOnce(opts.host, opts.port, `/api/saves/${newSnapshotId}`);
        if (r.status !== 200 || !r.json?.ok) return fail('inspect snapshot', `status ${r.status}`);
        const blob = JSON.stringify(r.json);
        const privateMatches = blob.match(/"visibility"\s*:\s*"private"/g) || [];
        const redactedMatches = blob.match(/"_redacted"\s*:\s*true/g) || [];
        if (privateMatches.length > redactedMatches.length) {
          return fail('inspect redacts private memory', `private=${privateMatches.length}, redacted=${redactedMatches.length}`);
        }
        return ok('inspect redacts private memory', { privateMatches: privateMatches.length, redactedMatches: redactedMatches.length });
      } catch (err) { return fail('inspect redacts private memory', err.message); }
    })());

    checks.push(await (async () => {
      if (!newSnapshotId) return fail('restore updates state', 'no snapshot to restore');
      try {
        const r = await fetchOnce(opts.host, opts.port, `/api/saves/${newSnapshotId}/restore`, { method: 'POST', body: {} });
        if (r.status !== 200 || !r.json?.ok) return fail('restore updates state', `status ${r.status} ${r.json?.error || ''}`);
        const s = await fetchOnce(opts.host, opts.port, '/api/state');
        if (s.json?.currentSnapshotId !== newSnapshotId) {
          return fail('restore updates state', `expected currentSnapshotId=${newSnapshotId}, got ${s.json?.currentSnapshotId}`);
        }
        return ok('restore updates state', { currentSnapshotId: s.json.currentSnapshotId });
      } catch (err) { return fail('restore updates state', err.message); }
    })());

    checks.push(await (async () => {
      try {
        const r = await fetchOnce(opts.host, opts.port, '/api/branches');
        return r.status === 200 && r.json?.ok
          ? ok('branches list', { count: r.json.branches.length })
          : fail('branches list', `status ${r.status}`);
      } catch (err) { return fail('branches list', err.message); }
    })());

    let branchSnapshotId = null;
    checks.push(await (async () => {
      try {
        const list = await fetchOnce(opts.host, opts.port, '/api/saves');
        if (!list.json?.snapshots?.length) return fail('branch create', 'no snapshot available');
        branchSnapshotId = list.json.snapshots[0].id;
        const name = `validate-${Date.now()}`;
        const r = await fetchOnce(opts.host, opts.port, '/api/branch', {
          method: 'POST', body: { name, snapshotId: branchSnapshotId, note: 'validate-saves-ui' }
        });
        return r.status === 200 && r.json?.ok
          ? ok('branch create', { branchId: r.json.branchId })
          : fail('branch create', `status ${r.status} ${r.json?.error || ''}`);
      } catch (err) { return fail('branch create', err.message); }
    })());

    checks.push(await (async () => {
      try {
        const list = await fetchOnce(opts.host, opts.port, '/api/saves');
        if (!list.json?.snapshots?.length || list.json.snapshots.length < 1) {
          return fail('diff endpoint', 'not enough snapshots');
        }
        const from = list.json.snapshots[0].id;
        const to = list.json.snapshots[list.json.snapshots.length - 1].id;
        const r = await fetchOnce(opts.host, opts.port, `/api/saves/diff?from=${from}&to=${to}`);
        return r.status === 200 && r.json?.ok
          ? ok('diff endpoint', { from, to })
          : fail('diff endpoint', `status ${r.status} ${r.json?.error || ''}`);
      } catch (err) { return fail('diff endpoint', err.message); }
    })());

    checks.push(await (async () => {
      try {
        const r = await fetchOnce(opts.host, opts.port, '/api/state');
        const blob = JSON.stringify(r.json);
        if (/"hiddenCause"\s*:\s*"[^"]*nadia/i.test(blob)) {
          return fail('leno guard in state', 'hiddenCause leaked as string');
        }
        return ok('leno guard in state');
      } catch (err) { return fail('leno guard in state', err.message); }
    })());
  }

  // Static checks (always run, no server needed)
  checks.push((() => {
    const htmlPath = path.join(REPO, 'static-play/index.html');
    const r = readStaticSections(htmlPath);
    if (!r.found) return fail('static sections present', 'static-play/index.html missing');
    if (r.sections.length < r.required.length) {
      return fail('static sections present', `missing ${r.required.length - r.sections.length} markers`);
    }
    return ok('static sections present', { markers: r.sections.length });
  })());

  return checks;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { showHelp(); process.exit(0); }
  let tempServer = null;
  try {
    if (!opts.skipServer && !(await probeHealth(opts.host, opts.port))) {
      tempServer = await startTemporaryServer(opts);
    }
    const checks = await runChecks(opts);
    const passed = checks.every((c) => c.ok);
    const payload = { ok: passed, kind: 'saves-ui-validator', checks };
    if (!opts.jsonOnly) {
      process.stdout.write(passed ? 'saves-ui: ok\n' : 'saves-ui: failed\n');
      for (const c of checks) process.stdout.write(`${c.ok ? 'OK' : 'FAIL'} ${c.name}\n`);
    }
    process.stdout.write(JSON.stringify(payload) + '\n');
    process.exitCode = passed ? 0 : 1;
  } catch (err) {
    const payload = { ok: false, kind: 'saves-ui-validator', checks: [fail('validator bootstrap', err.message)] };
    if (!opts.jsonOnly) process.stdout.write('saves-ui: failed\nFAIL validator bootstrap\n');
    process.stdout.write(JSON.stringify(payload) + '\n');
    process.exitCode = 1;
  } finally {
    if (tempServer) await stopTemporaryServer(tempServer);
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) main();

export { runChecks, parseArgs };
