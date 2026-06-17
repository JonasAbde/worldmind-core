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
  getDemoPaths
} from '../play/play-engine.js';
import { renderWebPage } from '../play/web-renderer.js';
import { buildGameplayShellModel } from '../play/game-shell-model.js';
import { injectEpisodeSelectorInto } from '../play/episode-selector.js';

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
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0a0d12; color: #e6e6e6; }
.wm-main { max-width: 1440px; margin: 0 auto; padding: 12px 16px 24px; }
.wm-header { padding: 8px 0 12px; border-bottom: 1px solid #1f2937; margin-bottom: 8px; }
.wm-header h1 { margin: 0; font-size: 1.25rem; }
.wm-subtitle { color: #8b95a1; margin: 4px 0 0; font-size: 0.85rem; }
.wm-visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

/* Game topbar */
.wm-game-topbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; background: linear-gradient(180deg, #161b22 0%, #0d1117 100%); border: 1px solid #30363d; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }
.wm-topbar-brand { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.wm-topbar-logo { width: 24px; height: 24px; }
.wm-topbar-stats { display: flex; flex-wrap: wrap; gap: 10px 14px; font-size: 0.8rem; color: #c9d1d9; }
.wm-topbar-stats strong { color: #58a6ff; margin-right: 2px; }

/* Three-column game shell */
.wm-game-shell { display: grid; grid-template-columns: minmax(220px, 28%) minmax(280px, 1fr) minmax(260px, 32%); gap: 12px; align-items: start; }
.wm-game-left, .wm-game-center, .wm-game-right { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.wm-section { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 10px 12px; }
.wm-section h2 { margin: 0 0 8px; font-size: 1rem; color: #58a6ff; }
.wm-section h3 { margin: 8px 0 4px; font-size: 0.78rem; color: #8b95a1; text-transform: uppercase; letter-spacing: 0.05em; }
.wm-empty { color: #6e7681; font-style: italic; }

/* Location scene */
.wm-location-name { font-size: 1.05rem; font-weight: bold; margin: 4px 0; }
.wm-location-mood { color: #8b95a1; font-size: 0.8rem; margin: 0 0 6px; }
.wm-scene-stage { position: relative; border-radius: 8px; overflow: hidden; border: 1px solid #30363d; background: #0d1117; }
.wm-scene-img { width: 100%; display: block; max-height: 220px; object-fit: cover; }
.wm-scene-placeholder { padding: 40px; text-align: center; color: #6e7681; }
.wm-hotspot-overlay { display: none; }

/* Hotspot cards */
.wm-hotspot-list { display: grid; gap: 8px; }
.wm-hotspot-card { display: grid; grid-template-columns: 40px 1fr; gap: 8px; align-items: start; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 8px; }
.wm-hotspot-icon { width: 36px; height: 36px; object-fit: contain; border-radius: 4px; }
.wm-hotspot-pin { font-size: 1.4rem; color: #f0883e; line-height: 1; }
.wm-hotspot-desc { margin: 4px 0; font-size: 0.82rem; color: #c9d1d9; }
.wm-hotspot-meta, .wm-hotspot-evidence { font-size: 0.72rem; color: #8b95a1; margin: 2px 0; }
.wm-hotspot-run { background: #1f6feb; border: none; color: #fff; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 0.78rem; margin-top: 4px; }

/* NPC cards */
.wm-npc-grid { display: grid; gap: 8px; }
.wm-npc-card { display: grid; grid-template-columns: 64px 1fr; gap: 8px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 8px; }
.wm-npc-portrait { width: 64px; height: 64px; border-radius: 6px; object-fit: cover; border: 1px solid #21262d; }
.wm-agent-role, .wm-agent-loc { display: block; color: #8b95a1; font-size: 0.75rem; }
.wm-npc-mood { display: block; font-size: 0.72rem; color: #f0883e; margin: 2px 0; }
.wm-agent-stats { display: block; color: #9fb4c8; font-size: 0.72rem; }
.wm-npc-topics { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; }
.wm-topic-chip { background: #21262d; border-radius: 999px; padding: 2px 6px; font-size: 0.68rem; color: #c9d1d9; }
.wm-agent-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.wm-agent-actions button { background: #1b2633; border: 1px solid #34495e; color: #dce6ef; border-radius: 4px; padding: 2px 6px; font-size: 0.72rem; cursor: pointer; }

/* Case board tabs */
.wm-case-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.wm-case-tab { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; border-radius: 4px; padding: 4px 8px; font-size: 0.72rem; cursor: pointer; }
.wm-case-tab.active { background: #1f6feb; border-color: #388bfd; color: #fff; }
.wm-case-pane { display: none; }
.wm-case-pane.active { display: block; }
.wm-case-board ul { list-style: none; padding: 0; margin: 0; }
.wm-case-card, .wm-suspect-card { display: flex; align-items: flex-start; gap: 8px; border: 1px solid #21262d; border-radius: 6px; padding: 6px; margin: 6px 0; background: #0d1117; }
.wm-case-card img { width: 36px; height: 36px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.wm-case-meta { display: block; color: #8b95a1; font-size: 0.7rem; margin-top: 2px; }
.wm-case-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.wm-case-actions button, .wm-case-card button, .wm-leno-ask-btn { background: #1b2633; border: 1px solid #34495e; color: #dce6ef; border-radius: 4px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer; }
.wm-case-link { border: 1px dashed #30363d; border-radius: 4px; padding: 4px 6px; margin: 4px 0; font-size: 0.75rem; }
.wm-lock-badge, .wm-redacted .wm-lock-badge { color: #f85149; font-size: 0.68rem; }
.wm-case-card.wm-locked, .wm-suspect-card.wm-redacted { opacity: 0.75; border-style: dashed; }

/* Rumor trail */
.wm-rumor-trail-card { display: grid; grid-template-columns: 36px 1fr; gap: 8px; border: 1px solid #30363d; border-radius: 6px; padding: 8px; margin-bottom: 8px; background: #0d1117; }
.wm-rumor-icon { width: 32px; height: 32px; }
.wm-rumor-claim { margin: 0 0 4px; font-size: 0.85rem; }
.wm-rumor-meta { margin: 2px 0; font-size: 0.72rem; color: #8b95a1; }
.wm-rumor-warning { color: #f0883e; font-size: 0.75rem; margin: 4px 0; }

/* Leno panel */
.wm-leno-wrap { display: grid; grid-template-columns: 56px 1fr; gap: 8px; align-items: start; }
.wm-leno-avatar { width: 56px; height: 56px; border-radius: 8px; }
.wm-leno-summary { background: #0d1117; padding: 8px; border-radius: 4px; font-size: 0.78rem; white-space: pre-wrap; margin: 0 0 6px; }

/* Founder */
.wm-founder-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; background: #238636; color: #fff; }
.wm-founder-badge.wm-locked-badge { background: #6e7681; }
.wm-founder-stats { list-style: none; padding: 0; margin: 8px 0; font-size: 0.82rem; }
.wm-founder-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.wm-founder-actions button { background: #3d1f6b; color: #fff; border: 1px solid #5d2fa0; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 0.78rem; }
.wm-founder-actions button:disabled { opacity: 0.45; cursor: not-allowed; }

/* Action center + bottom bar */
.wm-action-center { min-height: 120px; }
.wm-game-bottom { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
.wm-consequence-ticker-live { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 6px 10px; font-size: 0.78rem; color: #f0883e; min-height: 28px; }
.wm-consequence-ticker-live:empty::before { content: 'Consequence ticker — run a command to see live deltas.'; color: #6e7681; font-style: italic; }

/* Modal */
.wm-modal { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; }
.wm-modal.hidden { display: none; }
.wm-modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.65); }
.wm-modal-card { position: relative; background: #161b22; border: 1px solid #388bfd; border-radius: 8px; padding: 16px 20px; max-width: 420px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
.wm-modal-card h3 { margin: 0 0 8px; color: #58a6ff; }
.wm-modal-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.wm-modal-actions button { border-radius: 4px; padding: 8px 12px; cursor: pointer; font-size: 0.82rem; border: 1px solid #30363d; }
.wm-modal-actions button[data-modal-branch] { background: #1f6feb; color: #fff; border-color: #388bfd; }
.wm-modal-actions button[data-modal-continue] { background: #21262d; color: #e6e6e6; }
.wm-modal-actions button[data-modal-cancel] { background: transparent; color: #8b95a1; }

/* District map */
.wm-district-svg { width: 100%; height: auto; max-height: 160px; color: #58a6ff; }
.wm-player-location circle { fill: #f0883e; stroke: #fff; stroke-width: 0.4; }

/* Commands fallback */
.wm-command-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.wm-cmd-btn { background: #21262d; color: #e6e6e6; border: 1px solid #30363d; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 0.82rem; }
.wm-cmd-form { display: flex; flex-direction: column; gap: 4px; }
.wm-cmd-form input { background: #0d1117; color: #e6e6e6; border: 1px solid #30363d; border-radius: 4px; padding: 6px 8px; font-family: monospace; }
.wm-cmd-form button { background: #1f6feb; color: white; border: none; border-radius: 4px; padding: 6px; cursor: pointer; }
.wm-dialogue-agent em { color: #f0883e; }
.wm-ticker { margin: 0; padding-left: 18px; font-size: 0.8rem; }
.wm-decision-list button { background: #3d1f6b; color: #fff; border: 1px solid #5d2fa0; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.75rem; }
.wm-event-feed { list-style: none; padding: 0; margin: 0; max-height: 140px; overflow-y: auto; font-size: 0.78rem; }
.wm-event-feed li { padding: 4px 0; border-bottom: 1px solid #21262d; }
.wm-ancillary-panels { margin-top: 16px; }
.wm-ancillary-panels summary { cursor: pointer; color: #8b95a1; font-size: 0.85rem; }
.wm-ancillary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; margin-top: 8px; }
.wm-saves-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
.wm-saves-table th, .wm-saves-table td { border: 1px solid #21262d; padding: 4px; }
code { background: #0d1117; padding: 1px 4px; border-radius: 3px; font-size: 0.85em; }
@media (max-width: 1024px) { .wm-game-shell { grid-template-columns: 1fr; } }
@media (max-width: 768px) { .wm-topbar-stats { font-size: 0.72rem; } }`;

const APP_JS = `(function () {
  'use strict';
  var stateEl = document.getElementById('wm-state');
  if (!stateEl) return;
  var initial = JSON.parse(stateEl.textContent);
  var world = initial.world;
  var majorDecisions = (initial.gameShell && initial.gameShell.majorDecisions) || [];

  function matchMajorDecision(cmd) {
    var n = String(cmd || '').trim().toLowerCase();
    if (!n) return null;
    for (var i = 0; i < majorDecisions.length; i++) {
      var d = majorDecisions[i];
      var dc = String(d.command || '').trim().toLowerCase();
      if (dc && (n === dc || n.indexOf(dc) === 0)) return d;
    }
    return null;
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showBanner(text) {
    var banner = document.getElementById('wm-runtime-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'wm-runtime-banner';
      banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1f6feb;color:white;padding:8px 12px;font-size:0.8rem;text-align:center;z-index:10;font-family:monospace;';
      document.body.appendChild(banner);
    }
    banner.textContent = text;
  }

  // Detect live server by probing /api/health; fall back to static dispatch.
  var liveMode = false;
  fetch('/api/health').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (j && j.ok) {
      liveMode = true;
      showBanner('Live: connected to play-server (' + (j.version || 'unknown') + ')');
      refreshSaves();
      refreshBranches();
    } else {
      showBanner('Static build: start the server with "npm run play:server" for live execution.');
    }
  }).catch(function () {
    showBanner('Static build: start the server with "npm run play:server" for live execution.');
  });

  function api(method, path, body) {
    return fetch(path, {
      method: method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); });
  }

  function renderCaseBoardHtml(caseBoard) {
    var evIcon = 'assets/ui/evidence-card.png';
    var ruIcon = 'assets/ui/rumor-card.png';
    var evidenceCards = (caseBoard && caseBoard.evidenceCards || []).map(function (card) {
      var c = typeof card === 'string' ? { id: card, label: card } : card;
      return '<li class="wm-case-card' + (c.locked ? ' wm-locked' : '') + '" data-case-card-id="' + escapeHtml(c.id) + '">' +
        '<img src="' + evIcon + '" alt="Evidence" />' +
        '<div><strong>' + escapeHtml(c.label || c.id) + '</strong>' +
        (c.locationId ? '<span class="wm-case-meta">@ ' + escapeHtml(c.locationId) + '</span>' : '') +
        (c.inspectCommand ? '<button type="button" data-run-command="' + escapeHtml(c.inspectCommand) + '">Inspect</button>' : '') +
        '</div></li>';
    }).join('');
    var rumorCards = (caseBoard && caseBoard.rumorCards || []).map(function (card) {
      var c = typeof card === 'string' ? { id: card, label: card } : card;
      return '<li class="wm-case-card' + (c.sourceRedacted ? ' wm-redacted' : '') + '" data-case-card-id="' + escapeHtml(c.id) + '">' +
        '<img src="' + ruIcon + '" alt="Rumor" />' +
        '<div><strong>' + escapeHtml(c.label || c.id) + '</strong>' +
        (c.sourceRedacted ? '<span class="wm-lock-badge">Source locked</span>' : '') +
        '<div class="wm-case-actions">' +
        '<button type="button" data-run-command="' + escapeHtml(c.traceCommand) + '">Trace</button>' +
        '<button type="button" data-run-command="' + escapeHtml(c.counterCommand) + '">Counter</button>' +
        '</div></div></li>';
    }).join('');
    var suspects = (caseBoard && caseBoard.suspectCards || []).map(function (s) {
      return '<li class="wm-suspect-card' + (s.redacted ? ' wm-redacted' : '') + '" data-suspect-id="' + escapeHtml(s.id) + '">' +
        '<strong>' + (s.redacted ? 'REDACTED' : escapeHtml(s.label)) + '</strong>' +
        '<span class="wm-case-meta">' + escapeHtml(s.role) + '</span>' +
        (s.inspectCommand ? '<button type="button" data-run-command="' + escapeHtml(s.inspectCommand) + '">Investigate</button>' : '<span class="wm-lock-badge">Evidence required</span>') +
        '</li>';
    }).join('');
    var links = (caseBoard && caseBoard.links || []).map(function (link) {
      return '<li class="wm-case-link" data-link-from="' + escapeHtml(link.from) + '" data-link-to="' + escapeHtml(link.to) + '">' +
        '<code>' + escapeHtml(link.from) + '</code> → <code>' + escapeHtml(link.to) + '</code>' +
        '<span class="wm-case-meta">' + escapeHtml(link.relation) + (link.redacted ? ' · REDACTED' : '') + '</span></li>';
    }).join('');
    return '<div class="wm-case-pane active" data-case-pane="evidence"><ul>' + (evidenceCards || '<li class="wm-empty">No evidence cards yet.</li>') + '</ul></div>' +
      '<div class="wm-case-pane" data-case-pane="rumors"><ul>' + (rumorCards || '<li class="wm-empty">No rumor cards yet.</li>') + '</ul></div>' +
      '<div class="wm-case-pane" data-case-pane="suspects"><ul>' + (suspects || '<li class="wm-empty">No suspects profiled.</li>') + '</ul></div>' +
      '<div class="wm-case-pane" data-case-pane="links"><ul class="wm-case-links">' + (links || '<li class="wm-empty">Collect more cards to reveal links.</li>') + '</ul></div>';
  }

  function renderRumorTrailHtml(rumors) {
    return (rumors || []).map(function (r) {
      return '<article class="wm-rumor-trail-card" data-rumor-id="' + escapeHtml(r.id) + '">' +
        '<img src="assets/ui/rumor-card.png" alt="" class="wm-rumor-icon" />' +
        '<div><p class="wm-rumor-claim">' + escapeHtml(r.claim || r.id) + '</p>' +
        '<p class="wm-rumor-meta">spread: ' + escapeHtml(r.spreadRisk) + ' · distortion: ' + escapeHtml(r.distortion || 'unknown') + ' · trace: ' + escapeHtml(r.traceState || 'untraced') + '</p>' +
        (r.backfireWarning ? '<p class="wm-rumor-warning">⚠ Counter-rumor without source evidence can backfire.</p>' : '') +
        '<div class="wm-case-actions">' +
        '<button type="button" data-run-command="' + escapeHtml(r.traceCommand) + '">Trace</button>' +
        '<button type="button" data-run-command="' + escapeHtml(r.counterCommand) + '">Counter</button>' +
        '</div></div></article>';
    }).join('') || '<p class="wm-empty">No known rumors yet.</p>';
  }

  var pendingCommand = null;
  var pendingDecision = null;

  function showMajorDecisionModal(decision, cmd) {
    var modal = document.getElementById('wm-major-decision-modal');
    if (!modal) {
      if (confirm('Create branch before this decision?')) {
        runBranchThenCommand(decision, cmd);
      } else {
        dispatch(cmd, true);
      }
      return;
    }
    pendingCommand = cmd;
    pendingDecision = decision;
    var title = modal.querySelector('[data-modal-title]');
    var body = modal.querySelector('[data-modal-body]');
    if (title) title.textContent = 'Major decision: ' + (decision.label || decision.id || 'choice');
    if (body) body.textContent = 'Create a branch snapshot before "' + (decision.label || cmd) + '"? You can continue without branching if save fails.';
    modal.classList.remove('hidden');
  }

  function hideMajorDecisionModal() {
    var modal = document.getElementById('wm-major-decision-modal');
    if (modal) modal.classList.add('hidden');
    pendingCommand = null;
    pendingDecision = null;
  }

  function runBranchThenCommand(decision, cmd) {
    if (!liveMode) {
      showBanner('Start play-server to branch before decision.');
      dispatch(cmd, true);
      return;
    }
    api('POST', '/api/save', { branchName: 'main', note: 'pre-decision:' + (decision && decision.id || cmd) }).then(function (saveRes) {
      if (!saveRes.body || !saveRes.body.ok) {
        showBanner('Branch save failed — continuing without branch.');
        dispatch(cmd, true);
        return;
      }
      var snapshotId = saveRes.body.snapshotId;
      var branchName = 'decision_' + ((decision && decision.id) || 'choice') + '_' + Date.now();
      api('POST', '/api/branch', { name: branchName, snapshotId: snapshotId, note: 'before ' + (decision && decision.label || cmd) }).then(function (branchRes) {
        if (branchRes.body && branchRes.body.ok) {
          showBanner('Branch created: ' + branchName);
          var branchEl = document.querySelector('[data-topbar-branch]');
          if (branchEl) branchEl.innerHTML = '<strong>Branch</strong> ' + escapeHtml(branchName);
          refreshSaves();
          refreshBranches();
        } else {
          showBanner('Branch create failed — continuing anyway.');
        }
        dispatch(cmd, true);
      });
    });
  }

  function promptMajorDecisionBranch(decision, cmd) {
    if (!decision || !decision.branchSuggested) return;
    showMajorDecisionModal(decision, cmd || decision.command);
  }

  function applyCommandResult(result) {
    if (!result) return;

    if (result.consequence) {
      var c = result.consequence;
      var rels = (c.relationships || []).map(function (r) {
        return '<li>' + escapeHtml(r.agentId) + ': trust ' + (r.trustDelta >= 0 ? '+' : '') + r.trustDelta + ', fear ' + (r.fearDelta >= 0 ? '+' : '') + r.fearDelta + '</li>';
      }).join('');
      var ticker = [
        'relationships: ' + (rels ? 'updated' : 'no change'),
        'memories: ' + (c.newMemories >= 0 ? '+' : '') + (c.newMemories ?? 0),
        'rumors: ' + (c.newRumors >= 0 ? '+' : '') + (c.newRumors ?? 0),
        'money: ' + (c.moneyDelta >= 0 ? '+' : '') + (c.moneyDelta ?? 0),
        'reputation: ' + (c.reputationDelta >= 0 ? '+' : '') + (c.reputationDelta ?? 0),
        'energy: ' + (c.energyDelta >= 0 ? '+' : '') + (c.energyDelta ?? 0),
        'food scarcity: ' + (c.economyDelta && c.economyDelta.foodScarcity >= 0 ? '+' : '') + ((c.economyDelta && c.economyDelta.foodScarcity) || 0),
        'base progress: +' + ((c.founderDelta && c.founderDelta.contractsCompleted) || 0) + ' contracts'
      ];
      var tickerEl = document.querySelector('[data-consequence-ticker]');
      if (tickerEl) {
        tickerEl.textContent = ticker.join(' · ');
      }
      var consequenceEl = document.getElementById('wm-consequence');
      if (consequenceEl) {
        consequenceEl.innerHTML = '<h2>Consequence</h2>' +
          (rels ? '<h3>Relationships</h3><ul>' + rels + '</ul>' : '') +
          '<p>New memories: <strong>' + (c.newMemories >= 0 ? '+' : '') + (c.newMemories ?? 0) + '</strong></p>' +
          '<p>Rumor changes: <strong>' + (c.newRumors >= 0 ? '+' : '') + (c.newRumors ?? 0) + '</strong></p>' +
          '<p>Money: <strong>' + (c.moneyDelta >= 0 ? '+' : '') + (c.moneyDelta ?? 0) + '</strong></p>' +
          '<h3>Consequence Ticker</h3><ul class="wm-ticker">' +
          ticker.map(function (t) { return '<li>' + escapeHtml(t) + '</li>'; }).join('') +
          '</ul>';
      }
    }

    if (result.dialogue) {
      var d = result.dialogue;
      var dialogueEl = document.getElementById('wm-dialogue');
      if (dialogueEl) {
        dialogueEl.innerHTML = '<h2>Dialogue</h2><p class="wm-dialogue-agent"><strong>' +
          escapeHtml(d.agentName) + '</strong> says: <em>' + escapeHtml(d.message ?? '') + '</em></p>';
      }
    }

    if (result.leno && result.leno.summary) {
      var lenoEl = document.getElementById('wm-leno');
      if (lenoEl) {
        var content = lenoEl.querySelector('[data-leno-content]');
        if (content) {
          var summaryEl = content.querySelector('[data-leno-summary]');
          if (summaryEl) summaryEl.textContent = result.leno.summary;
          else content.innerHTML = '<pre class="wm-leno-summary" data-leno-summary>' + escapeHtml(result.leno.summary) + '</pre><button type="button" data-run-command="ask_leno">Ask Leno</button>';
        } else {
          lenoEl.innerHTML = '<h2>Leno</h2><pre class="wm-leno-summary">' + escapeHtml(result.leno.summary) + '</pre>';
        }
      }
      var lenoTop = document.querySelector('[data-topbar-leno]');
      if (lenoTop) lenoTop.innerHTML = '<strong>Leno</strong> online';
    }

    if (result.world) {
      var dayEl = document.querySelector('[data-topbar-day]');
      var timeEl = document.querySelector('[data-topbar-time]');
      if (dayEl) dayEl.innerHTML = '<strong>Day</strong> ' + escapeHtml(result.world.day ?? '?');
      if (timeEl) timeEl.innerHTML = '<strong>Time</strong> ' + escapeHtml(result.world.time ?? '?');
    }

    if (result.playerSnapshot) {
      var moneyEl = document.querySelector('[data-topbar-money]');
      var repEl = document.querySelector('[data-topbar-reputation]');
      var energyEl = document.querySelector('[data-topbar-energy]');
      if (moneyEl) moneyEl.innerHTML = '<strong>Money</strong> ' + escapeHtml(result.playerSnapshot.money ?? 0);
      if (repEl) repEl.innerHTML = '<strong>Rep</strong> ' + escapeHtml(result.playerSnapshot.reputation ?? 0);
      if (energyEl) energyEl.innerHTML = '<strong>Energy</strong> ' + escapeHtml(result.playerSnapshot.energy ?? 0);
    }

    if (result.consequence) {
      var c2 = result.consequence;
      if (c2.reputationDelta !== undefined) {
        var repTop = document.querySelector('[data-topbar-reputation]');
        if (repTop && result.playerSnapshot) repTop.innerHTML = '<strong>Rep</strong> ' + escapeHtml(result.playerSnapshot.reputation ?? 0);
      }
    }

    if (result.founder) {
      var contractsEl = document.querySelector('[data-founder-contracts]');
      var baseEl = document.querySelector('[data-founder-base-level]');
      var activeEl = document.querySelector('[data-founder-active-contract]');
      var founderRep = document.querySelector('[data-founder-reputation]');
      var founderMoney = document.querySelector('[data-founder-money]');
      if (contractsEl) contractsEl.textContent = String(result.founder.contractsCompleted ?? 0);
      if (baseEl) baseEl.textContent = String(result.founder.baseLevel ?? 0);
      if (activeEl) activeEl.textContent = result.founder.activeContract?.id ?? 'none';
      if (founderRep) founderRep.textContent = String(result.founder.reputation ?? 0);
      if (founderMoney) founderMoney.textContent = String(result.founder.money ?? 0);
    }

    if (result.gameShell) {
      if (result.gameShell.caseBoard) {
        var boardEl = document.querySelector('[data-case-board]');
        if (boardEl) boardEl.innerHTML = renderCaseBoardHtml(result.gameShell.caseBoard);
      }
      if (result.gameShell.rumorTrail) {
        var trailEl = document.querySelector('[data-rumor-trail]');
        if (trailEl) trailEl.innerHTML = renderRumorTrailHtml(result.gameShell.rumorTrail);
      }
    }

    if (result.text) {
      var feed = document.querySelector('[data-event-feed]');
      if (feed) {
        var li = document.createElement('li');
        li.innerHTML = '<code>' + escapeHtml(result.kind || 'command') + '</code> · ' + escapeHtml(result.text);
        feed.insertBefore(li, feed.firstChild);
      }
    }

    if (result.playerKnowledge) {
      var evidenceSection = document.getElementById('wm-evidence');
      if (evidenceSection) {
        var pk = result.playerKnowledge;
        var facts = evidenceSection.querySelector('p strong');
        if (facts && facts.textContent === 'Known facts:') {
          facts.parentElement.innerHTML = '<strong>Known facts:</strong> ' +
            ((pk.evidenceIds || []).map(function (e) { return '<code>' + escapeHtml(e) + '</code>'; }).join(' ') || '<em>(none collected yet)</em>');
        }
      }
    }

  }

  function dispatch(cmd, skipMajorCheck) {
    if (!skipMajorCheck && liveMode) {
      var preDecision = matchMajorDecision(cmd);
      if (preDecision && preDecision.branchSuggested) {
        showMajorDecisionModal(preDecision, cmd);
        return;
      }
    }
    if (!liveMode) {
      showBanner('Static build: command "' + cmd + '" recorded. Run via: npm run play -- --command=' + escapeHtml(cmd.split(' ')[0]));
      return;
    }
    api('POST', '/api/command', { text: cmd }).then(function (r) {
      if (r.status === 200 && r.body.ok) {
        applyCommandResult(r.body.result);
        showBanner('Command "' + cmd + '" executed.');
      } else {
        showBanner('Command failed: ' + (r.body.error || r.status));
      }
    });
  }

  // Save browser
  function refreshSaves() {
    api('GET', '/api/saves').then(function (r) {
      if (r.status !== 200 || !r.body.ok) return;
      var list = document.querySelector('[data-saves-list] tbody');
      var summary = document.querySelector('[data-saves-summary]');
      if (!list || !summary) return;
      list.innerHTML = r.body.snapshots.map(function (s) {
        return '<tr data-save-id="' + escapeHtml(s.id) + '"><td><code>' + escapeHtml(s.id) + '</code></td><td>' + escapeHtml(s.branchName) + '</td><td>Day ' + escapeHtml(String(s.day)) + ' ' + escapeHtml(s.time) + '</td><td>' + escapeHtml(String(s.tick)) + '</td><td>' + escapeHtml(s.createdAt) + '</td><td><button data-action="restore" data-save-id="' + escapeHtml(s.id) + '">Restore</button> <button data-action="inspect" data-save-id="' + escapeHtml(s.id) + '">Inspect</button></td></tr>';
      }).join('');
      summary.textContent = r.body.snapshots.length + ' snapshot(s) saved.';
      // Attach restore handlers
      list.querySelectorAll('[data-action="restore"]').forEach(function (btn) {
        btn.addEventListener('click', function () { restoreSave(btn.getAttribute('data-save-id')); });
      });
      list.querySelectorAll('[data-action="inspect"]').forEach(function (btn) {
        btn.addEventListener('click', function () { inspectSave(btn.getAttribute('data-save-id')); });
      });
    });
  }

  function inspectSave(id) {
    api('GET', '/api/saves/' + encodeURIComponent(id)).then(function (r) {
      var out = document.querySelector('[data-diff-output]');
      if (out) out.textContent = 'Inspect ' + id + ' — ' + JSON.stringify(r.body, null, 2).slice(0, 500);
    });
  }

  function restoreSave(id) {
    api('POST', '/api/saves/' + encodeURIComponent(id) + '/restore', { actor: 'web-ui', reason: 'manual' }).then(function (r) {
      if (r.status === 200 && r.body.ok) {
        showBanner('Restored snapshot ' + id);
        refreshSaves();
        refreshBranches();
      } else {
        showBanner('Restore failed: ' + (r.body.error || r.status));
      }
    });
  }

  // Branch tree
  function refreshBranches() {
    api('GET', '/api/branches').then(function (r) {
      if (r.status !== 200 || !r.body.ok) return;
      var tree = document.querySelector('[data-branches-tree]');
      if (!tree) return;
      tree.innerHTML = r.body.branches.map(function (b) {
        return '<li data-branch-id="' + escapeHtml(b.id) + '"><strong>' + escapeHtml(b.name) + '</strong> <span class="wm-branch-meta">origin <code>' + escapeHtml(b.originSnapshotId) + '</code>' + (b.currentSnapshotId ? ' → current <code>' + escapeHtml(b.currentSnapshotId) + '</code>' : '') + '</span></li>';
      }).join('') || '<li class="wm-empty">No branches yet.</li>';
    });
  }

  // Save / Branch / Diff controls
  document.querySelectorAll('.wm-cmd-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { dispatch(btn.getAttribute('data-command')); });
  });
  document.addEventListener('click', function (e) {
    var runBtn = e.target.closest('[data-run-command]');
    if (runBtn) {
      e.preventDefault();
      dispatch(runBtn.getAttribute('data-run-command'));
    }
    var tabBtn = e.target.closest('[data-case-tab]');
    if (tabBtn) {
      var tab = tabBtn.getAttribute('data-case-tab');
      document.querySelectorAll('[data-case-tab]').forEach(function (b) { b.classList.toggle('active', b === tabBtn); });
      document.querySelectorAll('[data-case-pane]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-case-pane') === tab); });
    }
  });

  var modal = document.getElementById('wm-major-decision-modal');
  if (modal) {
    modal.querySelector('[data-modal-branch]')?.addEventListener('click', function () {
      var cmd = pendingCommand;
      var decision = pendingDecision;
      hideMajorDecisionModal();
      runBranchThenCommand(decision, cmd);
    });
    modal.querySelector('[data-modal-continue]')?.addEventListener('click', function () {
      var cmd = pendingCommand;
      hideMajorDecisionModal();
      if (cmd) dispatch(cmd, true);
    });
    modal.querySelector('[data-modal-cancel]')?.addEventListener('click', hideMajorDecisionModal);
    modal.querySelector('[data-modal-close]')?.addEventListener('click', hideMajorDecisionModal);
  }
  document.querySelectorAll('[data-major-decision]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var choice = btn.getAttribute('data-major-decision');
      var runAfter = btn.getAttribute('data-run-after-branch') || choice;
      var executeDecision = function () {
        dispatch(runAfter);
      };
      if (!liveMode) {
        showBanner('Major decision: ' + choice + '. Start play-server to branch before decision.');
        return;
      }
      var mkBranch = confirm('Create branch before this decision?');
      if (!mkBranch) {
        showBanner('Decision noted without branch: ' + choice);
        executeDecision();
        return;
      }
      api('POST', '/api/save', { branchName: 'main', note: 'pre-decision:' + choice }).then(function (saveRes) {
        if (!saveRes.body || !saveRes.body.ok) {
          showBanner('Pre-decision save failed: ' + (saveRes.body?.error || saveRes.status));
          return;
        }
        var snapshotId = saveRes.body.snapshotId;
        var branchName = 'decision_' + choice + '_' + Date.now();
        api('POST', '/api/branch', { name: branchName, snapshotId: snapshotId, note: 'before ' + choice }).then(function (branchRes) {
          if (branchRes.body && branchRes.body.ok) {
            showBanner('Branch created before decision: ' + branchName);
            refreshSaves();
            refreshBranches();
            executeDecision();
          } else {
            showBanner('Branch create failed: ' + (branchRes.body?.error || branchRes.status));
          }
        });
      });
    });
  });
  var form = document.getElementById('wm-cmd-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('wm-cmd-input');
      if (input && input.value.trim()) dispatch(input.value.trim());
    });
  }
  var refreshBtn = document.querySelector('[data-action="saves-refresh"]');
  if (refreshBtn) refreshBtn.addEventListener('click', refreshSaves);
  var filter = document.querySelector('[data-saves-filter]');
  if (filter) filter.addEventListener('input', function () {
    var q = filter.value.toLowerCase();
    document.querySelectorAll('[data-saves-list] tbody tr').forEach(function (tr) {
      tr.style.display = tr.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
    });
  });
  var branchForm = document.querySelector('[data-branch-create]');
  if (branchForm) branchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new FormData(branchForm);
    api('POST', '/api/branch', { name: data.get('name'), snapshotId: data.get('snapshotId'), note: data.get('note') || '' }).then(function (r) {
      var out = document.querySelector('[data-branch-create-output]');
      if (out) out.textContent = r.body.ok ? 'Branch created: ' + r.body.branchId : 'Error: ' + (r.body.error || r.status);
      if (r.body.ok) refreshBranches();
    });
  });
  var diffForm = document.querySelector('[data-diff-form]');
  var diffPanel = document.querySelector('[data-diff-panel]');
  var diffOut = document.querySelector('[data-diff-output]');
  if (diffForm) diffForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new FormData(diffForm);
    var from = data.get('from'); var to = data.get('to');
    api('GET', '/api/saves/diff?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to)).then(function (r) {
      if (r.body.ok && diffPanel) diffPanel.textContent = JSON.stringify(r.body.diff, null, 2);
      if (diffOut) diffOut.textContent = r.body.ok ? 'Diff computed.' : 'Error: ' + (r.body.error || r.status);
    });
  });

  // Save now button
  var saveBtn = document.querySelector('[data-action="save-now"]');
  if (saveBtn) saveBtn.addEventListener('click', function () {
    api('POST', '/api/save', { branchName: 'main', note: 'from web-ui' }).then(function (r) {
      showBanner(r.body.ok ? ('Saved ' + r.body.snapshotId) : ('Save failed: ' + (r.body.error || r.status)));
      if (r.body.ok) refreshSaves();
    });
  });
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

  // Redacted copy: all private/hidden fields stripped so the browser
  // payload NEVER leaks secrets, even if the original world has them.
  const safeWorld = JSON.parse(JSON.stringify(world));
  // Strip incident hiddenCause (the central design secret)
  if (safeWorld.incidents) {
    for (const inc of Object.values(safeWorld.incidents)) {
      if (inc.hiddenCause !== undefined) inc.hiddenCause = null;
    }
  }
  // Strip agent secrets (private motivations)
  if (safeWorld.agents) {
    for (const agent of Object.values(safeWorld.agents)) {
      if (agent.secrets) agent.secrets = [];
    }
  }

  // Pre-compute a "look" result so the page shows an initial
  // dialogue/consequence panel (empty, but the structure is there).
  const initial = resolveCommand(safeWorld, 'look', {});

  // Pre-compute the Leno summary on the REDACTED world state so the
  // payload NEVER contains hidden secrets even in the initial snapshot.
  const lenoResult = resolveCommand(safeWorld, 'ask_leno', {});

  const payload = {
    world: {
      id: world.id, name: world.name, day: world.day, time: world.time, tick: world.tick,
      agents: safeWorld.agents, locations: world.locations, incidents: safeWorld.incidents,
      rumors: world.rumors, items: world.items, factions: world.factions,
      memories: world.memories, economy: world.economy,
      playerKnowledge: world.playerKnowledge
    },
    dialogue: initial.kind === 'look' ? null : initial.dialogue,
    consequence: initial.consequence ?? null,
    leno: lenoResult.leno ?? null,
    gameShell: buildGameplayShellModel(world, { leno: lenoResult.leno, playerKnowledge: world.playerKnowledge }),
    saves: [],
    branches: [],
    demoPaths: getDemoPaths(),
    appCss: APP_CSS,
    appJs: APP_JS
  };

  const html = injectEpisodeSelectorInto(renderWebPage(payload), 'topbar-after');
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
