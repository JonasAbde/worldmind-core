#!/usr/bin/env node
/**
 * play:web — generate the static WorldMind play UI.
 *
 * Builds `static-play/index.html` and `static-play/state.json` from
 * the canonical scenario. The page embeds the initial world state
 * as a JSON blob plus the deterministic demo paths. After the
 * page is opened in a browser, the user can dispatch structured
 * commands through the text input or quick-action buttons; the
 * in-page script calls back into a small runtime that delegates
 * to the same `play-engine` (server-side, via fetch wrappers —
 * or, in this static build, via a pre-baked response set).
 *
 * The static UI is intentionally READ-ONLY: the page cannot mutate
 * the world because the simulation is server-side. To actually run
 * commands, the founder uses `npm run play` (CLI) or `npm run demo:play`.
 *
 * Flags:
 *   --out-dir=PATH   output directory (default static-play)
 *   --scenario=PATH  scenario file (default scenarios/new-aarhus-district-01.json)
 *   --quiet          suppress human-readable output
 *
 * Exit codes:
 *   0 — generated
 *   1 — invalid arguments
 *   2 — engine / render error
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bootstrapWorld,
  resolveCommand,
  runScriptedPath,
  getDemoPaths
} from '../play/play-engine.js';
import { renderWebPage } from '../play/web-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = process.cwd();

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--quiet') flags.quiet = true;
    else if (a === '--help' || a === '-h') flags.help = true;
    else if (a.startsWith('--') && a.includes('=')) {
      const eq = a.indexOf('=');
      flags[a.slice(2, eq)] = a.slice(eq + 1);
    }
  }
  return flags;
}

function report(payload, quiet) {
  if (quiet) return;
  process.stdout.write(JSON.stringify({ ok: true, kind: 'play-web', ...payload }) + '\n');
}

function die(message, code = 1) {
  process.stdout.write(JSON.stringify({ ok: false, kind: 'play-web', message }) + '\n');
  process.exit(code);
}

const APP_CSS = `* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0e1117; color: #e6e6e6; }
.wm-main { max-width: 1200px; margin: 0 auto; padding: 16px; }
.wm-header { padding: 16px 0; border-bottom: 1px solid #1f2937; margin-bottom: 16px; }
.wm-header h1 { margin: 0; font-size: 1.5rem; }
.wm-subtitle { color: #8b95a1; margin: 4px 0 0; font-size: 0.9rem; }
.wm-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
.wm-col-left, .wm-col-right { display: flex; flex-direction: column; gap: 12px; }
.wm-section { background: #161b22; border: 1px solid #21262d; border-radius: 6px; padding: 12px 16px; }
.wm-section h2 { margin: 0 0 8px; font-size: 1.05rem; color: #58a6ff; }
.wm-section h3 { margin: 8px 0 4px; font-size: 0.85rem; color: #8b95a1; text-transform: uppercase; letter-spacing: 0.05em; }
.wm-empty { color: #6e7681; font-style: italic; }
.wm-location-name { font-size: 1.1rem; font-weight: bold; margin: 4px 0; }
.wm-agents-here, .wm-agent-list, .wm-demo-path-list { list-style: none; padding: 0; margin: 0; }
.wm-agents-here li, .wm-agent-list li { padding: 4px 0; border-bottom: 1px solid #21262d; }
.wm-agent { display: flex; flex-direction: column; gap: 2px; }
.wm-agent-role { color: #8b95a1; font-size: 0.8rem; }
.wm-agent-loc { color: #6e7681; font-size: 0.75rem; }
.wm-command-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.wm-cmd-btn { background: #21262d; color: #e6e6e6; border: 1px solid #30363d; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 0.85rem; }
.wm-cmd-btn:hover { background: #30363d; }
.wm-cmd-form { display: flex; flex-direction: column; gap: 4px; }
.wm-cmd-form input { background: #0d1117; color: #e6e6e6; border: 1px solid #30363d; border-radius: 4px; padding: 6px 8px; font-family: monospace; }
.wm-cmd-form button { background: #1f6feb; color: white; border: none; border-radius: 4px; padding: 6px; cursor: pointer; }
.wm-cmd-form label { font-size: 0.75rem; color: #8b95a1; }
.wm-dialogue-agent { font-size: 0.95rem; }
.wm-dialogue-agent em { color: #f0883e; }
.wm-leno-summary, .wm-section pre { background: #0d1117; padding: 8px; border-radius: 4px; font-size: 0.8rem; overflow-x: auto; white-space: pre-wrap; }
.wm-saves-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.wm-saves-table th, .wm-saves-table td { border: 1px solid #21262d; padding: 4px 6px; text-align: left; }
.wm-saves-table th { background: #21262d; }
.wm-demo-path { background: #0d1117; border: 1px solid #21262d; border-radius: 4px; padding: 8px; margin-bottom: 8px; }
.wm-demo-path h3 { margin: 0 0 4px; font-size: 0.9rem; color: #f0883e; text-transform: none; letter-spacing: 0; }
.wm-demo-steps { padding-left: 20px; margin: 4px 0; }
.wm-demo-steps li { font-family: monospace; font-size: 0.8rem; }
.wm-hint { color: #8b95a1; font-size: 0.8rem; font-style: italic; }
.wm-incident-status { font-size: 1rem; margin: 4px 0; }
code { background: #0d1117; padding: 1px 4px; border-radius: 3px; font-size: 0.85em; }
@media (max-width: 768px) { .wm-grid { grid-template-columns: 1fr; } }`;

const APP_JS = `(function () {
  'use strict';
  var stateEl = document.getElementById('wm-state');
  if (!stateEl) return;
  var initial = JSON.parse(stateEl.textContent);
  var world = initial.world;

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function dispatch(cmd) {
    // Static build: the in-page runtime is read-only. We surface a
    // short status banner explaining how to run the command for real,
    // and append the command to a "log" so the page is interactive.
    var banner = document.getElementById('wm-runtime-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'wm-runtime-banner';
      banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1f6feb;color:white;padding:8px 12px;font-size:0.8rem;text-align:center;z-index:10;';
      document.body.appendChild(banner);
    }
    banner.textContent = 'Static build: command "' + cmd + '" recorded. Run via: npm run play -- --command=' + escapeHtml(cmd.split(' ')[0]) + ' (or visit the CLI for full execution).';
  }

  document.querySelectorAll('.wm-cmd-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { dispatch(btn.getAttribute('data-command')); });
  });
  var form = document.getElementById('wm-cmd-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('wm-cmd-input');
      if (input && input.value.trim()) dispatch(input.value.trim());
    });
  }
})();`;

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === '--') argv.shift();
  const flags = parseFlags(argv);

  if (flags.help) {
    process.stdout.write('Usage: node src/cli/play-web.js [--out-dir=PATH] [--scenario=PATH]\n');
    process.exit(0);
  }

  const outDir = path.resolve(flags['out-dir'] || path.join(REPO, 'static-play'));
  const scenarioPath = flags.scenario || path.join(REPO, 'scenarios/new-aarhus-district-01.json');

  fs.mkdirSync(outDir, { recursive: true });

  // Bootstrap a fresh world from the canonical scenario.
  const world = bootstrapWorld({ scenarioPath });

  // Pre-compute a "look" result so the page shows an initial
  // dialogue/consequence panel (empty, but the structure is there).
  const initial = resolveCommand(world, 'look', {});

  // Pre-compute the Leno summary (with the guard built into the
  // renderer; the page never ships a leaky summary).
  const lenoResult = resolveCommand(world, 'ask_leno', {});

  const payload = {
    world: {
      id: world.id, name: world.name, day: world.day, time: world.time, tick: world.tick,
      agents: world.agents, locations: world.locations, incidents: world.incidents,
      rumors: world.rumors, items: world.items, factions: world.factions,
      memories: world.memories, economy: world.economy,
      playerKnowledge: world.playerKnowledge
    },
    dialogue: initial.kind === 'look' ? null : initial.dialogue,
    consequence: initial.consequence ?? null,
    leno: lenoResult.leno ?? null,
    saves: [],
    branches: [],
    demoPaths: getDemoPaths(),
    appCss: APP_CSS,
    appJs: APP_JS
  };

  const html = renderWebPage(payload);
  const htmlPath = path.join(outDir, 'index.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  // The state.json sidecar lets the validator + tests assert on the
  // exact content the page was built from.
  const statePath = path.join(outDir, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify({
    world: payload.world,
    demoPaths: payload.demoPaths,
    leno: payload.leno
  }, null, 2), 'utf8');

  report({
    htmlPath,
    statePath,
    sectionsRendered: [
      'Current Location', 'Visible Agents', 'Available Commands', 'Dialogue',
      'Consequence', 'Evidence', 'Incident', 'Leno', 'Saves', 'Branches', 'Demo Paths'
    ]
  });
}

main();
