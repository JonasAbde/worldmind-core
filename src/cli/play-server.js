#!/usr/bin/env node
/**
 * play:server — live browser runtime for WorldMind.
 *
 * Serves static-play/ and exposes a small JSON API around the shared
 * play-engine. This turns the v1.0-rc5 read-only UI into a live runtime
 * without adding React, 3D, multiplayer, or duplicate gameplay logic.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapWorld, resolveCommand, getDemoPaths } from '../play/play-engine.js';
import { bindAssets, getAssetRegistry } from '../play/assets.js';
import { buildDistrictView } from '../play/district-view.js';
import {
  createInitialProgression,
  awardProgression,
  summarizeProgression
} from '../play/progression.js';
import {
  summarizeContentPack,
  validateContentPack,
  buildAuthoringChecklist
} from '../play/authoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = process.cwd();

const DEFAULT_SCENARIO = path.join(REPO, 'scenarios/new-aarhus-district-01.json');
const DEFAULT_STATIC_DIR = path.join(REPO, 'static-play');
const DEFAULT_CONTENT_PACK = path.join(REPO, 'content/worldmind/content-pack-v1.json');

const sessions = new Map();

function parseFlags(argv) {
  const flags = { port: 8080, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--json') flags.json = true;
    else if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else if (arg.startsWith('--')) {
      flags[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  flags.port = Number(flags.port || 8080);
  return flags;
}

function loadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function sanitizeWorld(world) {
  return {
    id: world.id,
    name: world.name,
    day: world.day,
    time: world.time,
    tick: world.tick,
    agents: world.agents,
    locations: world.locations,
    incidents: world.incidents,
    rumors: world.rumors,
    playerKnowledge: world.playerKnowledge,
    assets: world.assets
  };
}

function createSession({ scenarioPath = DEFAULT_SCENARIO, contentPackPath = DEFAULT_CONTENT_PACK } = {}) {
  const world = bindAssets(bootstrapWorld({ scenarioPath }));
  const contentPack = loadJson(contentPackPath, null);
  const progression = createInitialProgression();
  const session = {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    world,
    progression,
    contentPack,
    commandLog: []
  };
  sessions.set(session.id, session);
  return session;
}

function getSession(req, options) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const explicit = url.searchParams.get('session') || req.headers['x-worldmind-session'];
  if (explicit && sessions.has(explicit)) return sessions.get(explicit);
  return createSession(options);
}

function buildPayload(session, extra = {}) {
  const districtView = buildDistrictView(session.world);
  const contentValidation = session.contentPack ? validateContentPack(session.contentPack) : { ok: false, errors: ['content pack missing'] };
  return {
    ok: true,
    sessionId: session.id,
    world: sanitizeWorld(session.world),
    progression: summarizeProgression(session.progression),
    assets: getAssetRegistry(),
    districtView,
    content: session.contentPack ? summarizeContentPack(session.contentPack) : null,
    authoringChecklist: session.contentPack ? buildAuthoringChecklist(session.contentPack) : [],
    contentValidation,
    demoPaths: getDemoPaths(),
    commandLog: session.commandLog.slice(-20),
    ...extra
  };
}

function sendJson(res, status, payload, sessionId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  };
  if (sessionId) headers['x-worldmind-session'] = sessionId;
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function safeStaticPath(staticDir, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.resolve(staticDir, `.${decodeURIComponent(requested)}`);
  if (!resolved.startsWith(path.resolve(staticDir))) return null;
  return resolved;
}

export function createPlayServer(options = {}) {
  const scenarioPath = options.scenarioPath || DEFAULT_SCENARIO;
  const staticDir = options.staticDir || DEFAULT_STATIC_DIR;
  const contentPackPath = options.contentPackPath || DEFAULT_CONTENT_PACK;

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const session = getSession(req, { scenarioPath, contentPackPath });

      if (req.method === 'GET' && url.pathname === '/api/health') {
        return sendJson(res, 200, { ok: true, kind: 'worldmind-play-server', sessions: sessions.size }, session.id);
      }

      if (req.method === 'GET' && url.pathname === '/api/state') {
        return sendJson(res, 200, buildPayload(session), session.id);
      }

      if (req.method === 'GET' && url.pathname === '/api/assets') {
        return sendJson(res, 200, { ok: true, assets: getAssetRegistry() }, session.id);
      }

      if (req.method === 'GET' && url.pathname === '/api/district') {
        return sendJson(res, 200, { ok: true, districtView: buildDistrictView(session.world) }, session.id);
      }

      if (req.method === 'GET' && url.pathname === '/api/progression') {
        return sendJson(res, 200, { ok: true, progression: summarizeProgression(session.progression) }, session.id);
      }

      if (req.method === 'GET' && url.pathname === '/api/content') {
        return sendJson(res, 200, {
          ok: Boolean(session.contentPack),
          content: session.contentPack ? summarizeContentPack(session.contentPack) : null,
          checklist: session.contentPack ? buildAuthoringChecklist(session.contentPack) : [],
          validation: session.contentPack ? validateContentPack(session.contentPack) : { ok: false, errors: ['content pack missing'] }
        }, session.id);
      }

      if (req.method === 'POST' && url.pathname === '/api/command') {
        const raw = await readBody(req);
        const input = raw ? JSON.parse(raw) : {};
        const commandText = input.commandText || input.command || '';
        const result = resolveCommand(session.world, commandText, input.args || {});
        bindAssets(session.world);
        const progress = awardProgression(session.progression, result, commandText);
        session.progression = progress.progression;
        session.commandLog.push({
          at: new Date().toISOString(),
          command: commandText,
          ok: Boolean(result.ok),
          kind: result.kind,
          error: result.error || null,
          xpGained: progress.delta.xpGained
        });
        return sendJson(res, result.ok ? 200 : 400, buildPayload(session, {
          result: {
            ok: result.ok,
            kind: result.kind,
            command: result.command || commandText,
            text: result.text || null,
            error: result.error || null,
            dialogue: result.dialogue || null,
            consequence: result.consequence || null,
            leno: result.leno || null,
            rumors: result.rumors || null,
            snapshot: result.snapshot || null
          },
          progressionDelta: progress.delta
        }), session.id);
      }

      if (req.method === 'POST' && url.pathname === '/api/reset') {
        sessions.delete(session.id);
        const fresh = createSession({ scenarioPath, contentPackPath });
        return sendJson(res, 200, buildPayload(fresh, { resetFrom: session.id }), fresh.id);
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        const filePath = safeStaticPath(staticDir, url.pathname);
        if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return sendJson(res, 404, { ok: false, error: 'not found' }, session.id);
        }
        res.writeHead(200, { 'content-type': contentType(filePath), 'cache-control': 'no-store' });
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(filePath).pipe(res);
      }

      return sendJson(res, 405, { ok: false, error: 'method not allowed' }, session.id);
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  });
}

function printHelp() {
  process.stdout.write(`Usage: node src/cli/play-server.js [--port=8080] [--host=127.0.0.1] [--static-dir=static-play] [--dry-run]\n\nAPI:\n  GET  /api/health\n  GET  /api/state\n  GET  /api/assets\n  GET  /api/district\n  GET  /api/progression\n  GET  /api/content\n  POST /api/command   { "commandText": "ask rune nadia" }\n  POST /api/reset\n`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === '--') argv.shift();
  const flags = parseFlags(argv);
  if (flags.help) {
    printHelp();
    return;
  }

  const options = {
    scenarioPath: flags.scenario ? path.resolve(flags.scenario) : DEFAULT_SCENARIO,
    staticDir: flags['static-dir'] ? path.resolve(flags['static-dir']) : DEFAULT_STATIC_DIR,
    contentPackPath: flags['content-pack'] ? path.resolve(flags['content-pack']) : DEFAULT_CONTENT_PACK
  };

  if (flags.dryRun) {
    const session = createSession(options);
    const payload = buildPayload(session, { dryRun: true });
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    return;
  }

  const server = createPlayServer(options);
  server.listen(flags.port, flags.host, () => {
    process.stdout.write(JSON.stringify({
      ok: true,
      kind: 'worldmind-play-server',
      url: `http://${flags.host}:${flags.port}`,
      api: `http://${flags.host}:${flags.port}/api/state`,
      staticDir: options.staticDir
    }) + '\n');
  });
}

main();
