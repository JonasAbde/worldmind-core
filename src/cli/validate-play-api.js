#!/usr/bin/env node
/**
 * validate:play-api — assert play-server exposes the v1 play API contract.
 *
 * Checks /api/health and /api/state on a temporary play-server instance.
 *
 * Usage:
 *   node src/cli/validate-play-api.js [--host=127.0.0.1] [--port=0]
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAY_API_VERSION } from '../play/play-api-payload.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const opts = { host: '127.0.0.1', port: 0 };
  for (const a of argv) {
    if (a.startsWith('--host=')) opts.host = a.split('=')[1];
    else if (a.startsWith('--port=')) opts.port = Number(a.split('=')[1]);
  }
  return opts;
}

function fetchJson(host, port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: host, port, path: urlPath, method: 'GET', headers: { accept: 'application/json' } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function startServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/cli/play-server.js', '--port', String(port), '--host', '127.0.0.1'], {
      cwd: REPO,
      env: { ...process.env, WM_DB_PATH: path.join(REPO, 'data/validate-play-api.sqlite') },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('play-server start timeout'));
    }, 15000);
    child.stdout.on('data', (d) => {
      out += d.toString();
      const m = out.match(/play-server listening on (\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ child, port: Number(m[1]) });
      }
    });
    child.on('error', reject);
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('exit', (code) => {
      if (!out.includes('listening')) reject(new Error(`play-server exited ${code}: ${out}`));
    });
  });
}

function checkLeaks(payload) {
  const { redaction: _r, ...rest } = payload;
  const raw = JSON.stringify(rest);
  const problems = [];
  if (/"hiddenCause"\s*:\s*"[^"]+"/.test(raw)) problems.push('hiddenCause string leak');
  if (/"secrets"\s*:\s*\[\s*"[^"]+"/.test(raw)) problems.push('agent secrets leak');
  if (/\bnadia\s+is\s+the\s+source\b/i.test(raw)) problems.push('unguarded nadia source phrase');
  return problems;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let child;
  let port = opts.port;
  try {
    const started = await startServer(port);
    child = started.child;
    port = started.port;

    const health = await fetchJson(opts.host, port, '/api/health');
    if (health.status !== 200 || !health.json.ok) {
      throw new Error('health check failed');
    }
    if (health.json.apiVersion !== PLAY_API_VERSION) {
      throw new Error(`apiVersion mismatch: ${health.json.apiVersion}`);
    }

    const state = await fetchJson(opts.host, port, '/api/state');
    if (state.status !== 200 || !state.json.ok) {
      throw new Error('state check failed');
    }
    const shell = state.json.gameShell;
    if (!shell?.location) throw new Error('gameShell.location missing');
    if (!Array.isArray(shell.npcCards)) throw new Error('gameShell.npcCards missing');
    if (!shell.caseBoard) throw new Error('gameShell.caseBoard missing');
    if (!shell.founder) throw new Error('gameShell.founder missing');
    if (!Array.isArray(shell.founder.contracts)) throw new Error('gameShell.founder.contracts missing');
    if (typeof shell.founder.tierLabel !== 'string' || !shell.founder.tierLabel) {
      throw new Error('gameShell.founder.tierLabel missing');
    }
    if (!state.json.playerSnapshot) throw new Error('playerSnapshot missing');
    if (!state.json.districtView?.nodes) throw new Error('districtView missing');

    const leaks = checkLeaks(state.json);
    if (leaks.length) throw new Error(`leak checks failed: ${leaks.join(', ')}`);

    process.stdout.write(JSON.stringify({
      ok: true,
      kind: 'play-api-validator',
      port,
      apiVersion: PLAY_API_VERSION,
      npcCount: shell.npcCards.length,
      hotspotCount: shell.location.hotspots?.length ?? 0
    }) + '\n');
    process.exit(0);
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, kind: 'play-api-validator', error: String(err.message || err) }) + '\n');
    process.exit(1);
  } finally {
    if (child) child.kill();
  }
}

main();
