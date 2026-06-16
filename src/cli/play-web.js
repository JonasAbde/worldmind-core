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
.wm-agent-card { display: grid; grid-template-columns: 56px 1fr; gap: 8px; align-items: start; }
.wm-agent-avatar { width: 56px; height: 56px; border-radius: 6px; object-fit: cover; border: 1px solid #30363d; }
.wm-agent-role { color: #8b95a1; font-size: 0.8rem; }
.wm-agent-loc { color: #6e7681; font-size: 0.75rem; }
.wm-agent-stats { color: #9fb4c8; font-size: 0.75rem; display: block; margin: 2px 0; }
.wm-agent-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.wm-agent-actions button { background: #1b2633; border: 1px solid #34495e; color: #dce6ef; border-radius: 4px; padding: 2px 6px; font-size: 0.75rem; cursor: pointer; }
.wm-topbar-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 0.85rem; }
.wm-location-scene { margin: 8px 0; }
.wm-scene-img { width: 100%; border-radius: 6px; border: 1px solid #30363d; }
.wm-hotspot-list { list-style: none; padding: 0; margin: 0 0 8px; display: grid; gap: 6px; }
.wm-hotspot { display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; align-items: center; background: #0d1117; border: 1px solid #21262d; border-radius: 4px; padding: 6px; }
.wm-hotspot button { background: #1f6feb; border: none; color: #fff; border-radius: 4px; padding: 4px 8px; cursor: pointer; }
.wm-case-board { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.wm-case-board ul { list-style: none; padding: 0; margin: 0; }
.wm-case-card { display: flex; align-items: center; gap: 6px; border: 1px solid #21262d; border-radius: 4px; padding: 4px; margin: 4px 0; background: #0d1117; }
.wm-case-card img { width: 40px; height: 40px; object-fit: cover; border-radius: 4px; }
.wm-case-meta { display: block; color: #8b95a1; font-size: 0.72rem; margin-top: 2px; }
.wm-case-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.wm-case-actions button, .wm-case-card button { background: #1b2633; border: 1px solid #34495e; color: #dce6ef; border-radius: 4px; padding: 2px 6px; font-size: 0.72rem; cursor: pointer; }
.wm-case-links-wrap { grid-column: 1 / -1; margin-top: 4px; }
.wm-case-links { list-style: none; padding: 0; margin: 0; }
.wm-case-link { border: 1px dashed #30363d; border-radius: 4px; padding: 4px 6px; margin: 4px 0; font-size: 0.78rem; background: #0d1117; }
.wm-ticker { margin: 0; padding-left: 18px; font-size: 0.82rem; }
.wm-decision-list { display: flex; flex-wrap: wrap; gap: 6px; }
.wm-decision-list button { background: #3d1f6b; color: #fff; border: 1px solid #5d2fa0; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.78rem; }
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
    var evidenceCards = (caseBoard && caseBoard.evidenceCards || []).map(function (card) {
      var c = typeof card === 'string' ? { id: card, label: card } : card;
      return '<li class="wm-case-card" data-case-card-id="' + escapeHtml(c.id) + '">' +
        '<img src="assets/ui/evidence-card.png" alt="Evidence card" />' +
        '<div><strong>' + escapeHtml(c.label || c.id) + '</strong>' +
        (c.locationId ? '<span class="wm-case-meta">@ ' + escapeHtml(c.locationId) + '</span>' : '') +
        (c.inspectCommand ? '<button type="button" data-run-command="' + escapeHtml(c.inspectCommand) + '">Inspect</button>' : '') +
        '</div></li>';
    }).join('');
    var rumorCards = (caseBoard && caseBoard.rumorCards || []).map(function (card) {
      var c = typeof card === 'string' ? { id: card, label: card } : card;
      return '<li class="wm-case-card" data-case-card-id="' + escapeHtml(c.id) + '">' +
        '<img src="assets/ui/rumor-card.png" alt="Rumor card" />' +
        '<div><strong>' + escapeHtml(c.label || c.id) + '</strong>' +
        (c.sourceRedacted ? '<span class="wm-case-meta">Source: REDACTED</span>' : '') +
        '<div class="wm-case-actions">' +
        '<button type="button" data-run-command="' + escapeHtml(c.traceCommand) + '">Trace</button>' +
        '<button type="button" data-run-command="' + escapeHtml(c.counterCommand) + '">Counter</button>' +
        '</div></div></li>';
    }).join('');
    var links = (caseBoard && caseBoard.links || []).map(function (link) {
      return '<li class="wm-case-link" data-link-from="' + escapeHtml(link.from) + '" data-link-to="' + escapeHtml(link.to) + '">' +
        '<code>' + escapeHtml(link.from) + '</code> → <code>' + escapeHtml(link.to) + '</code>' +
        '<span class="wm-case-meta">' + escapeHtml(link.relation) + (link.redacted ? ' · REDACTED' : '') + '</span></li>';
    }).join('');
    return '<div><h4>Evidence Cards</h4><ul>' + (evidenceCards || '<li class="wm-empty">No evidence cards yet.</li>') + '</ul></div>' +
      '<div><h4>Rumor Cards</h4><ul>' + (rumorCards || '<li class="wm-empty">No rumor cards yet.</li>') + '</ul></div>' +
      (links ? '<div class="wm-case-links-wrap"><h4>Case Links</h4><ul class="wm-case-links">' + links + '</ul></div>' : '');
  }

  function promptMajorDecisionBranch(decision) {
    if (!decision || !decision.branchSuggested || !liveMode) return;
    var label = decision.label || decision.id || 'decision';
    if (!confirm('Major decision detected: "' + label + '". Save branch snapshot for timeline?')) {
      showBanner('Major decision recorded without branch: ' + label);
      return;
    }
    api('POST', '/api/save', { branchName: 'main', note: 'post-decision:' + (decision.id || label) }).then(function (saveRes) {
      if (!saveRes.body || !saveRes.body.ok) {
        showBanner('Post-decision save failed: ' + (saveRes.body && saveRes.body.error || saveRes.status));
        return;
      }
      var snapshotId = saveRes.body.snapshotId;
      var branchName = 'decision_' + (decision.id || 'choice') + '_' + Date.now();
      api('POST', '/api/branch', { name: branchName, snapshotId: snapshotId, note: 'after ' + label }).then(function (branchRes) {
        if (branchRes.body && branchRes.body.ok) {
          showBanner('Branch saved for major decision: ' + branchName);
          refreshSaves();
          refreshBranches();
        } else {
          showBanner('Branch create failed: ' + (branchRes.body && branchRes.body.error || branchRes.status));
        }
      });
    });
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
        lenoEl.innerHTML = '<h2>Leno Suggestions</h2><pre class="wm-leno-summary">' + escapeHtml(result.leno.summary) + '</pre>';
      }
      var lenoTop = document.querySelector('[data-topbar-leno]');
      if (lenoTop) lenoTop.innerHTML = '<strong>Leno:</strong> online';
    }

    if (result.world) {
      var dayEl = document.querySelector('[data-topbar-day]');
      var timeEl = document.querySelector('[data-topbar-time]');
      if (dayEl) dayEl.innerHTML = '<strong>Day:</strong> ' + escapeHtml(result.world.day ?? '?');
      if (timeEl) timeEl.innerHTML = '<strong>Time:</strong> ' + escapeHtml(result.world.time ?? '?');
    }

    if (result.playerSnapshot) {
      var moneyEl = document.querySelector('[data-topbar-money]');
      if (moneyEl) moneyEl.innerHTML = '<strong>Money:</strong> ' + escapeHtml(result.playerSnapshot.money ?? 0);
    }

    if (result.founder) {
      var contractsEl = document.querySelector('[data-founder-contracts]');
      var baseEl = document.querySelector('[data-founder-base-level]');
      var activeEl = document.querySelector('[data-founder-active-contract]');
      if (contractsEl) contractsEl.textContent = String(result.founder.contractsCompleted ?? 0);
      if (baseEl) baseEl.textContent = String(result.founder.baseLevel ?? 0);
      if (activeEl) activeEl.textContent = result.founder.activeContract?.id ?? 'none';
    }

    if (result.text) {
      var feed = document.querySelector('[data-event-feed]');
      if (feed) {
        var li = document.createElement('li');
        li.innerHTML = '<code>' + escapeHtml(result.kind || 'command') + '</code> · ' + escapeHtml(result.text);
        feed.insertBefore(li, feed.firstChild);
      }
    }

    if (result.gameShell && result.gameShell.caseBoard) {
      var boardEl = document.querySelector('[data-case-board]');
      if (boardEl) boardEl.innerHTML = renderCaseBoardHtml(result.gameShell.caseBoard);
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

    if (result.majorDecisionPrompt) {
      promptMajorDecisionBranch(result.majorDecisionPrompt);
    }
  }

  function dispatch(cmd) {
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
  });
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
