#!/usr/bin/env node
/**
 * validate:play-api — assert play-server exposes the v1 play API contract.
 *
 * Checks /api/health, /api/state (visualCues v4), and POST /api/command move
 * (walkAnimation with waypoints).
 *
 * Usage:
 *   node src/cli/validate-play-api.js [--host=127.0.0.1] [--port=0]
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAY_API_VERSION } from '../play/play-api-payload.js';
import {
  assertVisualCuesV4,
  assertVisualCuesMesh3d,
  assertVisualCuesCollision,
  assertWalkAnimation,
  pickMoveTarget
} from '../play/play-api-verify.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const opts = { host: '127.0.0.1', port: 0 };
  for (const a of argv) {
    if (a.startsWith('--host=')) opts.host = a.split('=')[1];
    else if (a.startsWith('--port=')) opts.port = Number(a.split('=')[1]);
  }
  return opts;
}

function requestJson(host, port, urlPath, options = {}) {
  const { method = 'GET', body } = options;
  return new Promise((resolve, reject) => {
    const headers = { accept: 'application/json', ...(options.headers || {}) };
    const payload = body != null ? JSON.stringify(body) : null;
    if (payload) headers['content-type'] = 'application/json';
    const req = http.request(
      { hostname: host, port, path: urlPath, method, headers },
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
    if (payload) req.write(payload);
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

function requestStatus(host, port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: host, port, path: urlPath }, (res) => {
      res.resume();
      resolve({ status: res.statusCode, contentType: res.headers['content-type'] });
    }).on('error', reject);
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

export async function verifyPlayApiOnHost(host, port) {
  const health = await requestJson(host, port, '/api/health');
  if (health.status !== 200 || !health.json.ok) {
    throw new Error('health check failed');
  }
  if (health.json.apiVersion !== PLAY_API_VERSION) {
    throw new Error(`apiVersion mismatch: ${health.json.apiVersion}`);
  }

  const state = await requestJson(host, port, '/api/state');
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

  const visualCheck = assertVisualCuesV4(state.json.visualCues);
  if (!visualCheck.ok) {
    throw new Error(`visualCues v4 check failed: ${visualCheck.problems.join(', ')}`);
  }

  const mesh3dCheck = assertVisualCuesMesh3d(state.json.visualCues);
  if (!mesh3dCheck.ok) {
    throw new Error(`visualCues mesh3d check failed: ${mesh3dCheck.problems.join(', ')}`);
  }

  const collisionCheck = assertVisualCuesCollision(state.json.visualCues);
  if (!collisionCheck.ok) {
    throw new Error(`visualCues collision check failed: ${collisionCheck.problems.join(', ')}`);
  }

  const sampleModel = state.json.visualCues.locations?.find((l) => l.modelUrl)?.modelUrl;
  if (sampleModel) {
    const modelPath = sampleModel.startsWith('/') ? sampleModel : `/${sampleModel}`;
    const modelRes = await requestStatus(host, port, modelPath);
    if (modelRes.status !== 200) {
      throw new Error(`modelUrl fetch failed: ${modelPath} (${modelRes.status})`);
    }
    if (!String(modelRes.contentType || '').includes('gltf')) {
      throw new Error(`modelUrl content-type expected gltf, got ${modelRes.contentType}`);
    }
  }

  const leaks = checkLeaks(state.json);
  if (leaks.length) throw new Error(`leak checks failed: ${leaks.join(', ')}`);

  const { from, to } = pickMoveTarget(state.json);
  if (!from || !to) throw new Error('could not resolve move target for walkAnimation check');

  const move = await requestJson(host, port, '/api/command', {
    method: 'POST',
    body: { text: `move ${to}` }
  });
  if (move.status !== 200 || !move.json.ok) {
    throw new Error(`move command failed: ${move.json.error || move.status}`);
  }
  const walkCheck = assertWalkAnimation(move.json.result?.walkAnimation, from, to);
  if (!walkCheck.ok) {
    throw new Error(`walkAnimation check failed: ${walkCheck.problems.join(', ')}`);
  }

  return {
    apiVersion: PLAY_API_VERSION,
    npcCount: shell.npcCards.length,
    hotspotCount: shell.location.hotspots?.length ?? 0,
    visualCuesVersion: state.json.visualCues.version,
    walkGraphNodes: Object.keys(state.json.visualCues.walkGraph.nodes).length,
    moveFrom: from,
    moveTo: to,
    waypointCount: move.json.result.walkAnimation.waypoints.length
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let child;
  let port = opts.port;
  try {
    const started = await startServer(port);
    child = started.child;
    port = started.port;

    const summary = await verifyPlayApiOnHost(opts.host, port);

    process.stdout.write(JSON.stringify({
      ok: true,
      kind: 'play-api-validator',
      port,
      ...summary
    }) + '\n');
    process.exit(0);
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, kind: 'play-api-validator', error: String(err.message || err) }) + '\n');
    process.exit(1);
  } finally {
    if (child) child.kill();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) main();
