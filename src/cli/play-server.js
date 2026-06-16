#!/usr/bin/env node
/**
 * play-server — WorldMind v1.0-rc6/rc7 live web play server.
 *
 * Serves static-play/ plus a JSON API for the play engine, save browser,
 * branch timeline, and diff viewer. No frameworks. Uses save/timeline logic
 * from src/persistence/* directly — no duplicate game logic.
 *
 * Endpoints:
 *   GET  /api/health
 *   GET  /api/state
 *   POST /api/command
 *   POST /api/save
 *   POST /api/branch
 *   GET  /api/saves
 *   GET  /api/saves/:id
 *   POST /api/saves/:id/restore
 *   GET  /api/branches
 *   GET  /api/saves/diff?from=A&to=B
 *   GET  /api/events
 *   GET  /api/demo/path/:name
 *   GET  /*  (static files from static-play/)
 *
 * Filters: hiddenCause and private memories are redacted from /api/saves/:id
 * and /api/state when no evidence is present. Leno guard reuses the same
 * evidence logic as the CLI.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bootstrapWorld,
  resolveCommand,
  getDemoPaths,
  parseCommandText
} from '../play/play-engine.js';
import {
  buildCommandText,
  resolveMajorDecisionPrompt
} from '../play/game-shell-model.js';
import {
  PLAY_API_VERSION,
  buildPlayStatePayload,
  buildCommandResultPayload
} from '../play/play-api-payload.js';
import { openSqliteWorldStore } from '../persistence/sqlite.js';
import { diffSnapshots, filterEvents } from '../persistence/timeline.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATIC_DIR = path.resolve(path.join(REPO, 'static-play'));
const ASSETS_DIR = path.resolve(path.join(REPO, 'assets'));
const DB_PATH = process.env.WM_DB_PATH || path.join(REPO, 'data/worldmind.sqlite');
const DEFAULT_SCENARIO = path.join(REPO, 'scenarios/new-aarhus-district-01.json');
const CORS_ORIGINS = (process.env.WM_CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { port: 8080, host: '127.0.0.1', help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--port') opts.port = Number(argv[++i]);
    else if (a.startsWith('--port=')) opts.port = Number(a.split('=')[1]);
    else if (a === '--host') opts.host = argv[++i];
    else if (a.startsWith('--host=')) opts.host = a.split('=')[1];
  }
  return opts;
}

function showHelp() {
  process.stdout.write(`worldmind play-server — live web play runtime

Usage:
  node src/cli/play-server.js [--host=ADDR] [--port=N]

Options:
  --host=ADDR   bind address (default 127.0.0.1)
  --port=N      bind port    (default 8080; 0 = random for tests)
  --help        show this help

Endpoints:
  GET  /api/health
  GET  /api/state
  POST /api/command    body: { command, args? }
  POST /api/save       body: { branchName?, note? }
  POST /api/branch     body: { name, snapshotId, note? }
  GET  /api/saves
  GET  /api/saves/:id
  POST /api/saves/:id/restore   body: { actor?, reason? }
  GET  /api/branches
  GET  /api/saves/diff?from=A&to=B
  GET  /api/events?since=N
  GET  /api/demo/path/:name
`);
}

// ---------------------------------------------------------------------------
// Server state
// ---------------------------------------------------------------------------

let world = null;
let store = null;
let eventLog = []; // in-memory tail of events emitted by resolveCommand

function ensureBoot() {
  if (world && store) return;
  world = bootstrapWorld({ scenarioPath: DEFAULT_SCENARIO });
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  store = openSqliteWorldStore({ dbPath: DB_PATH }).init();
  // Log initial boot
  eventLog.push({
    id: `boot_${Date.now()}`,
    type: 'system.boot',
    at: new Date().toISOString(),
    tick: world.tick ?? 0,
    day: world.day ?? 1,
    time: world.time ?? 'morning',
    message: 'play-server boot'
  });
  // Cap in-memory log to 500 events
  if (eventLog.length > 500) eventLog = eventLog.slice(-500);
}

function recordEvents(newEvents) {
  if (!Array.isArray(newEvents)) return;
  for (const ev of newEvents) {
    eventLog.push({
      id: ev.id || `evt_${eventLog.length + 1}`,
      type: ev.type || 'unknown',
      at: new Date().toISOString(),
      tick: ev.tick ?? world?.tick ?? 0,
      day: ev.day ?? world?.day ?? 0,
      time: ev.time ?? world?.time ?? 'morning',
      message: ev.message || ev.description || ''
    });
  }
  if (eventLog.length > 500) eventLog = eventLog.slice(-500);
}

// ---------------------------------------------------------------------------
// Redaction: hiddenCause + private memory
// ---------------------------------------------------------------------------

function hasEvidence(world) {
  // Leno guard reuse: at least one visible fact with non-empty evidence[]
  const facts = world?.visibleFacts || world?.facts || [];
  return facts.some((f) => Array.isArray(f.evidence) && f.evidence.length > 0);
}

function markPrivateObjects(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(markPrivateObjects);
  const out = { ...value };
  if (out.visibility === 'private') {
    out._redacted = true;
    if ('summary' in out) out.summary = null;
    if ('details' in out) out.details = { _redacted: true };
    if ('content' in out) out.content = { _redacted: true };
    if ('text' in out) out.text = null;
    if ('secret' in out) out.secret = { _redacted: true };
  }
  if (Array.isArray(out.secrets)) out.secrets = out.secrets.map(() => ({ _redacted: true }));
  for (const key of Object.keys(out)) out[key] = markPrivateObjects(out[key]);
  return out;
}

function redactWorldState(state) {
  if (!state || typeof state !== 'object') return state;
  const allowHiddenCause = hasEvidence(state);
  const clone = markPrivateObjects(JSON.parse(JSON.stringify(state)));
  if (clone.incident && clone.incident.hiddenCause && !allowHiddenCause) {
    clone.incident = { ...clone.incident, hiddenCause: { _redacted: true } };
  }
  if (clone.incidents && typeof clone.incidents === 'object' && !allowHiddenCause) {
    for (const id of Object.keys(clone.incidents)) {
      if (clone.incidents[id]?.hiddenCause) {
        clone.incidents[id].hiddenCause = { _redacted: true };
      }
    }
  }
  return clone;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sanitizeCommandResult(result, world, majorDecisionPrompt) {
  return buildCommandResultPayload(world, result, { majorDecisionPrompt });
}

function corsHeaders(req) {
  if (!CORS_ORIGINS.length) return {};
  const origin = req.headers.origin;
  if (!origin) return {};
  const allowed = CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin);
  if (!allowed) return {};
  return {
    'access-control-allow-origin': CORS_ORIGINS.includes('*') ? '*' : origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin'
  };
}

function applyCors(req, res) {
  const h = corsHeaders(req);
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
}

function jsonResponse(req, res, status, payload) {
  const body = JSON.stringify(payload);
  applyCors(req, res);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > 1_000_000) {
        req.destroy();
        reject(new Error('body too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`invalid JSON: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

function isPathInside(baseDir, targetPath) {
  const rel = path.relative(path.resolve(baseDir), path.resolve(targetPath));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function serveStatic(req, res, urlPath) {
  // Normalize URL segments to POSIX before path.join — on Windows, mixing
  // backslashes in rel paths would break the assets/ → ASSETS_DIR fallback.
  const relPosix = (urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''))
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
  if (!relPosix || relPosix.includes('..')) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  const staticFull = path.resolve(STATIC_DIR, ...relPosix.split('/'));
  if (!isPathInside(STATIC_DIR, staticFull)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  let full = staticFull;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    if (relPosix.startsWith('assets/')) {
      const assetRel = relPosix.slice('assets/'.length);
      const assetFull = path.resolve(ASSETS_DIR, ...assetRel.split('/'));
      if (isPathInside(ASSETS_DIR, assetFull) && fs.existsSync(assetFull) && fs.statSync(assetFull).isFile()) {
        full = assetFull;
      } else {
        res.writeHead(404);
        res.end('not found');
        return;
      }
    } else {
      res.writeHead(404);
      res.end('not found');
      return;
    }
  }
  const ext = path.extname(full).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json'
  };
  res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(full).pipe(res);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleHealth(req, res) {
  jsonResponse(req, res, 200, {
    ok: true,
    engine: 'play-engine',
    version: '1.0-rc7',
    apiVersion: PLAY_API_VERSION,
    contract: 'docs/PLAY_API_CONTRACT.md',
    dbPath: DB_PATH
  });
}

async function handleState(req, res) {
  ensureBoot();
  jsonResponse(req, res, 200, buildPlayStatePayload(world));
}

async function handleCommand(req, res) {
  ensureBoot();
  let body;
  try { body = await readBody(req); }
  catch (err) { return jsonResponse(req, res, 400, { ok: false, error: err.message }); }
  const { command, args = {}, text } = body;
  let cmdName = command;
  let cmdArgs = args;
  if (!cmdName && typeof text === 'string') {
    const parsed = parseCommandText(text);
    cmdName = parsed?.command || null;
    cmdArgs = parsed?.args || {};
  }
  if (!cmdName) return jsonResponse(req, res, 400, { ok: false, error: 'command or text required' });
  try {
    const cmdText = typeof text === 'string' ? text.trim() : buildCommandText(cmdName, cmdArgs);
    const result = resolveCommand(world, cmdName, cmdArgs);
    if (Array.isArray(result?.events)) recordEvents(result.events);
    const majorDecisionPrompt = result.majorDecisionPrompt ?? resolveMajorDecisionPrompt({
      commandText: cmdText,
      command: cmdName,
      args: cmdArgs,
      playerKnowledge: world.playerKnowledge,
      consequence: result.consequence
    });
    const sanitized = sanitizeCommandResult(result, world, majorDecisionPrompt?.branchSuggested ? majorDecisionPrompt : undefined);
    jsonResponse(req, res, 200, { ok: true, command: cmdName, args: cmdArgs, text: cmdText, result: sanitized });
  } catch (err) {
    jsonResponse(req, res, 400, { ok: false, error: String(err?.message || err) });
  }
}

async function handleSave(req, res) {
  ensureBoot();
  let body = {};
  try { body = await readBody(req); } catch { /* defaults */ }
  const branchName = body.branchName || world.branchName || 'main';
  const note = body.note || null;
  const meta = store.saveSnapshot(world, { branchName, note });
  recordEvents([{ type: 'snapshot.saved', message: `Saved ${meta.snapshotId} on branch ${branchName}` }]);
  jsonResponse(req, res, 200, { ok: true, ...meta });
}

async function handleBranchCreate(req, res) {
  ensureBoot();
  let body = {};
  try { body = await readBody(req); } catch { /* defaults */ }
  const { name, snapshotId, note = '' } = body;
  if (!name || !snapshotId) {
    return jsonResponse(req, res, 400, { ok: false, error: 'name and snapshotId required' });
  }
  try {
    const result = store.createTimelineBranch({ snapshotId, name, note });
    jsonResponse(req, res, 200, { ok: true, branchId: result.id, ...result });
  } catch (err) {
    jsonResponse(req, res, 404, { ok: false, error: String(err?.message || err) });
  }
}

async function handleSavesList(req, res) {
  ensureBoot();
  const rows = store.listSnapshots(world.id);
  jsonResponse(req, res, 200, {
    ok: true,
    snapshots: rows.map((r) => ({
      id: r.id,
      worldId: r.worldId,
      branchId: r.branchId,
      branchName: r.branchName,
      parentSnapshotId: r.parentSnapshotId,
      originSnapshotId: r.originSnapshotId,
      createdAt: r.createdAt,
      tick: r.tick,
      day: r.day,
      time: r.time,
      note: r.note ?? null,
      memoryCount: r.memoryCount,
      eventCount: r.eventCount,
      relationshipCount: r.relationshipCount,
      rumorCount: r.rumorCount,
      incidentStatus: r.incidentStatus
    }))
  });
}

async function handleSavesInspect(req, res, id) {
  ensureBoot();
  try {
    const row = store.openSqliteWorldStore
      ? // direct db access for inspect
        null
      : null;
    const loaded = store.loadSnapshot(id);
    const redacted = redactWorldState(loaded);
    jsonResponse(req, res, 200, { ok: true, snapshot: { id, state: redacted, redacted: !hasEvidence(loaded) } });
  } catch (err) {
    const msg = String(err?.message || err);
    const code = msg.includes('not found') ? 404 : 500;
    jsonResponse(req, res, code, { ok: false, error: msg });
  }
}

async function handleSavesRestore(req, res, id) {
  ensureBoot();
  let body = {};
  try { body = await readBody(req); } catch { /* defaults */ }
  try {
    const loaded = store.loadSnapshot(id);
    world = loaded;
    recordEvents([{
      type: 'snapshot.restored',
      message: `Restored ${id} (actor=${body.actor || 'anonymous'}, reason=${body.reason || 'unspecified'})`
    }]);
    jsonResponse(req, res, 200, { ok: true, restoredSnapshotId: id, currentSnapshotId: world.currentSnapshotId });
  } catch (err) {
    const msg = String(err?.message || err);
    const code = msg.includes('not found') ? 404 : 500;
    jsonResponse(req, res, code, { ok: false, error: msg });
  }
}

async function handleBranchesList(req, res) {
  ensureBoot();
  const rows = store.listTimelineBranches(world.id);
  jsonResponse(req, res, 200, {
    ok: true,
    branches: rows.map((b) => ({
      id: b.id,
      worldId: b.worldId,
      name: b.name,
      originSnapshotId: b.originSnapshotId,
      parentSnapshotId: b.parentSnapshotId,
      currentSnapshotId: b.currentSnapshotId,
      currentDay: b.currentDay,
      currentTime: b.currentTime,
      snapshotCount: b.snapshotCount,
      note: b.note,
      createdAt: b.createdAt
    }))
  });
}

async function handleSavesDiff(req, res, urlObj) {
  ensureBoot();
  const from = urlObj.searchParams.get('from');
  const to = urlObj.searchParams.get('to');
  if (!from || !to) return jsonResponse(req, res, 400, { ok: false, error: 'from and to required' });
  try {
    const fromState = store.loadSnapshot(from);
    const toState = store.loadSnapshot(to);
    const diff = diffSnapshots(fromState, toState);
    jsonResponse(req, res, 200, { ok: true, from, to, diff });
  } catch (err) {
    const msg = String(err?.message || err);
    const code = msg.includes('not found') ? 404 : 500;
    jsonResponse(req, res, code, { ok: false, error: msg });
  }
}

async function handleEvents(req, res, urlObj) {
  ensureBoot();
  const since = Number(urlObj.searchParams.get('since') || 0);
  const events = eventLog.slice(since);
  jsonResponse(req, res, 200, { ok: true, count: events.length, total: eventLog.length, events });
}

async function handleDemoPath(req, res, name) {
  ensureBoot();
  const paths = getDemoPaths();
  if (!paths[name]) return jsonResponse(req, res, 404, { ok: false, error: 'unknown demo path' });
  // Run scripted path on a copy so it doesn't mutate the live world
  const copy = JSON.parse(JSON.stringify(world));
  const result = resolveCommand; // imported
  // Use the engine's runScriptedPath but operate on a copy through JSON round-trip is unsafe;
  // runScriptedPath mutates the world in place. We must clone the world using createWorld.
  // For simplicity, execute against a copy via the engine's helper:
  const runScripted = (await import('../play/play-engine.js')).runScriptedPath;
  const freshWorld = (await import('../play/play-engine.js')).bootstrapWorld({ scenarioPath: DEFAULT_SCENARIO });
  const steps = runScripted(freshWorld, name);
  recordEvents([{ type: 'demo.path', message: `Ran demo path ${name}` }]);
  jsonResponse(req, res, 200, { ok: true, path: name, steps, world: redactWorldState(freshWorld) });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function route(req, res, urlPath, urlObj) {
  try {
    if (req.method === 'OPTIONS') {
      applyCors(req, res);
      res.writeHead(204, { ...corsHeaders(req), 'content-length': '0' });
      res.end();
      return;
    }
    if (urlPath === '/api/health') return handleHealth(req, res);
    if (urlPath === '/api/state') return handleState(req, res);
    if (urlPath === '/api/command' && req.method === 'POST') return handleCommand(req, res);
    if (urlPath === '/api/save' && req.method === 'POST') return handleSave(req, res);
    if (urlPath === '/api/branch' && req.method === 'POST') return handleBranchCreate(req, res);
    if (urlPath === '/api/branches' && req.method === 'POST') return handleBranchCreate(req, res);
    if (urlPath === '/api/saves' && req.method === 'GET') return handleSavesList(req, res);
    if (urlPath === '/api/branches' && req.method === 'GET') return handleBranchesList(req, res);
    if (urlPath === '/api/events' && req.method === 'GET') return handleEvents(req, res, urlObj);
    if (urlPath === '/api/saves/diff' && req.method === 'GET') return handleSavesDiff(req, res, urlObj);
    const mSave = urlPath.match(/^\/api\/saves\/([^/]+)$/);
    if (mSave && req.method === 'GET') return handleSavesInspect(req, res, mSave[1]);
    const mRestore = urlPath.match(/^\/api\/saves\/([^/]+)\/restore$/);
    if (mRestore && req.method === 'POST') return handleSavesRestore(req, res, mRestore[1]);
    const mDemo = urlPath.match(/^\/api\/demo\/path\/([\w-]+)$/);
    if (mDemo && req.method === 'GET') return handleDemoPath(req, res, mDemo[1]);
    if (req.method === 'GET') return serveStatic(req, res, urlPath);
    jsonResponse(req, res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    jsonResponse(req, res, 500, { ok: false, error: String(err?.message || err) });
  }
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { showHelp(); process.exit(0); }
  const server = http.createServer((req, res) => {
    const urlObj = new URL(req.url, `http://${opts.host}:${opts.port}`);
    route(req, res, urlObj.pathname, urlObj);
  });
  server.listen(opts.port, opts.host, () => {
    const addr = server.address();
    process.stdout.write(`play-server listening on ${addr.port}\n`);
  });
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => { server.close(() => process.exit(0)); });
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) main();

export { main, route, redactWorldState, ensureBoot };
