/**
 * Web renderer for the WorldMind play UI.
 *
 * Pure functions that turn a `play-engine` result envelope + world
 * state into HTML fragments. The generator (`src/cli/play-web.js`)
 * assembles these into a complete `index.html` page.
 *
 * The renderer is also responsible for the **Leno evidence guard**
 * in the UI: source-defining mentions of "Nadia" are redacted from
 * the Leno summary panel unless `rumor_source_nadia` evidence is
 * present in `playerKnowledge.evidenceIds`.
 *
 * Public API:
 *   renderWebPage(payload)        -> full HTML page string
 *   renderHeader(world)           -> <header> fragment
 *   renderLocation(world)         -> Current Location panel
 *   renderAgents(world)           -> Visible Agents panel
 *   renderCommandButtons()        -> quick-action button row
 *   renderCommandForm()           -> freeform text input
 *   renderDialogueTurn(dialogue)  -> Dialogue panel
 *   renderConsequence(c)          -> Consequence panel
 *   renderEvidence(payload)       -> Evidence panel (with guard)
 *   renderIncident(world)         -> Incident progress panel
 *   renderLeno(payload)           -> Leno panel (with guard)
 *   renderSaves(saves)            -> Save Browser panel
 *   renderBranches(branches)      -> Branches panel
 *   renderDemoPaths(paths)        -> Demo paths selector
 *   escapeHtml(text)              -> safe HTML escape
 */

const SOURCE_DEFINING = /\bnadia\s+is\s+the\s+source\b/i;

function hasNadiaEvidence(payload) {
  const pk = payload?.playerKnowledge ?? payload?.world?.playerKnowledge;
  return Boolean(pk?.evidenceIds?.includes?.('rumor_source_nadia'));
}

export function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Apply the Leno evidence guard to a summary text.
 *   - Source-defining Nadia mentions ("Nadia is the source") are
 *     REPLACED with "REDACTED — evidence required" unless
 *     `rumor_source_nadia` is in evidence.
 *   - Plain "Nadia" mentions are passed through (Leno may speculate).
 */
export function applyLenoGuard(text, payload) {
  if (typeof text !== 'string') return '';
  if (hasNadiaEvidence(payload)) return text;
  return text.replace(SOURCE_DEFINING, 'REDACTED — evidence required');
}

export function renderHeader(world) {
  return `<header class="wm-header">
  <h1>WorldMind — Interactive Play</h1>
  <p class="wm-subtitle">${escapeHtml(world?.name ?? 'Unknown world')} · Day ${escapeHtml(world?.day ?? '?')} · ${escapeHtml(world?.time ?? '00:00')}</p>
</header>`;
}

export function renderLocation(world) {
  const player = world?.agents?.player;
  const locId = player?.locationId;
  const loc = locId ? world.locations?.[locId] : null;
  const locName = loc?.name ?? locId ?? 'unknown';
  return `<section class="wm-section wm-location" id="wm-location">
  <h2>Current Location</h2>
  <p class="wm-location-name">${escapeHtml(locName)}</p>
  <ul class="wm-agents-here">${(loc?.agentsPresent ?? [])
    .filter((id) => id !== 'player')
    .map((id) => `<li data-agent-id="${escapeHtml(id)}">${escapeHtml(world.agents[id]?.name ?? id)}</li>`)
    .join('') || '<li class="wm-empty">No other agents here.</li>'}</ul>
</section>`;
}

export function renderAgents(world) {
  const list = Object.values(world?.agents ?? {}).filter((a) => a.id !== 'player');
  return `<section class="wm-section wm-agents" id="wm-agents">
  <h2>Visible Agents</h2>
  <ul class="wm-agent-list">${list.map((a) => `
    <li class="wm-agent" data-agent-id="${escapeHtml(a.id)}">
      <strong>${escapeHtml(a.name)}</strong>
      <span class="wm-agent-role">${escapeHtml(a.role ?? '')}</span>
      <span class="wm-agent-loc">@ ${escapeHtml(world.locations?.[a.locationId]?.name ?? a.locationId ?? '?')}</span>
    </li>`).join('')}</ul>
</section>`;
}

export function renderCommandButtons() {
  const buttons = [
    { cmd: 'look', label: 'Look around' },
    { cmd: 'status', label: 'Status' },
    { cmd: 'ask_leno', label: 'Ask Leno' },
    { cmd: 'inspect', label: 'Inspect…' },
    { cmd: 'talk', label: 'Talk to…' },
    { cmd: 'ask', label: 'Ask…' },
    { cmd: 'listen_rumors', label: 'Listen for rumors' },
    { cmd: 'trace_rumor', label: 'Trace rumor' },
    { cmd: 'counter_rumor', label: 'Counter rumor' },
    { cmd: 'pay', label: 'Pay…' },
    { cmd: 'save', label: 'Save' },
    { cmd: 'branch', label: 'Branch' }
  ];
  return `<section class="wm-section wm-commands" id="wm-commands">
  <h2>Available Commands</h2>
  <div class="wm-command-buttons">${buttons.map((b) =>
    `<button type="button" class="wm-cmd-btn" data-command="${escapeHtml(b.cmd)}">${escapeHtml(b.label)}</button>`
  ).join('')}</div>
  <form class="wm-cmd-form" id="wm-cmd-form">
    <label for="wm-cmd-input">Structured command (e.g. <code>ask rune nadia</code>)</label>
    <input type="text" id="wm-cmd-input" name="cmd" placeholder="ask rune nadia" autocomplete="off" />
    <button type="submit">Run</button>
  </form>
</section>`;
}

export function renderDialogueTurn(dialogue) {
  if (!dialogue) {
    return `<section class="wm-section wm-dialogue" id="wm-dialogue">
  <h2>Dialogue</h2>
  <p class="wm-empty">No dialogue yet. Try <code>ask rune nadia</code> or <code>talk sara</code>.</p>
</section>`;
  }
  const revealed = (dialogue.revealedFacts ?? []).map((f) => `<li>${escapeHtml(f)}</li>`).join('');
  const evidence = (dialogue.evidenceIds ?? []).map((e) => `<code>${escapeHtml(e)}</code>`).join(' ');
  return `<section class="wm-section wm-dialogue" id="wm-dialogue">
  <h2>Dialogue</h2>
  <p class="wm-dialogue-agent"><strong>${escapeHtml(dialogue.agentName)}</strong> says: <em>${escapeHtml(dialogue.message ?? '')}</em></p>
  ${revealed ? `<h3>Revealed facts</h3><ul>${revealed}</ul>` : ''}
  ${evidence ? `<h3>Evidence collected</h3><p>${evidence}</p>` : ''}
  <h3>Player options</h3>
  <ul>
    <li>continue this thread (ask again, follow up)</li>
    <li>inspect the area for more clues</li>
    <li>listen for rumors here</li>
    <li>ask Leno for advice</li>
  </ul>
</section>`;
}

export function renderConsequence(consequence) {
  if (!consequence) {
    return `<section class="wm-section wm-consequence" id="wm-consequence">
  <h2>Consequence</h2>
  <p class="wm-empty">No consequence yet.</p>
</section>`;
  }
  const rels = (consequence.relationships ?? []).map((r) =>
    `<li>${escapeHtml(r.agentId)}: trust ${r.trustDelta >= 0 ? '+' : ''}${r.trustDelta}, fear ${r.fearDelta >= 0 ? '+' : ''}${r.fearDelta}</li>`
  ).join('');
  const incident = consequence.incident
    ? `<p>Incident: <strong>${escapeHtml(consequence.incident.title)}</strong> — ${escapeHtml(consequence.incident.status)} ${consequence.incident.resolutionState ? `(${escapeHtml(consequence.incident.resolutionState)})` : ''}</p>`
    : '';
  return `<section class="wm-section wm-consequence" id="wm-consequence">
  <h2>Consequence</h2>
  ${rels ? `<h3>Relationships</h3><ul>${rels}</ul>` : ''}
  <p>New memories: <strong>${consequence.newMemories >= 0 ? '+' : ''}${consequence.newMemories ?? 0}</strong></p>
  <p>Rumor changes: <strong>${consequence.newRumors >= 0 ? '+' : ''}${consequence.newRumors ?? 0}</strong></p>
  <p>Money: <strong>${consequence.moneyDelta >= 0 ? '+' : ''}${consequence.moneyDelta ?? 0}</strong></p>
  ${incident}
</section>`;
}

export function renderEvidence(payload) {
  const pk = payload?.playerKnowledge ?? payload?.world?.playerKnowledge ?? { evidenceIds: [], knownRumorIds: [], suspectedCauses: [], unresolvedQuestions: [] };
  const guardedSummary = applyLenoGuard(payload?.leno?.summary ?? '', payload);
  return `<section class="wm-section wm-evidence" id="wm-evidence">
  <h2>Evidence</h2>
  <p><strong>Known facts:</strong> ${(pk.evidenceIds ?? []).map((e) => `<code>${escapeHtml(e)}</code>`).join(' ') || '<em>(none collected yet)</em>'}</p>
  <p><strong>Suspected causes:</strong> ${(pk.suspectedCauses ?? []).join(', ') || '<em>(none)</em>'}</p>
  <p><strong>Unresolved questions:</strong> ${(pk.unresolvedQuestions ?? []).join(', ') || '<em>(none)</em>'}</p>
  ${guardedSummary ? `<h3>Leno summary (guarded)</h3><pre>${escapeHtml(guardedSummary)}</pre>` : ''}
</section>`;
}

export function renderIncident(world) {
  const inc = Object.values(world?.incidents ?? {}).find((i) => i.id === 'missing_delivery')
    ?? Object.values(world?.incidents ?? {})[0];
  if (!inc) {
    return `<section class="wm-section wm-incident" id="wm-incident">
  <h2>Incident Progress</h2>
  <p class="wm-empty">No active incident.</p>
</section>`;
  }
  const steps = (inc.knownFacts ?? []).map((f) => `<li>${escapeHtml(f)}</li>`).join('');
  return `<section class="wm-section wm-incident" id="wm-incident">
  <h2>Incident Progress — ${escapeHtml(inc.title ?? 'The Missing Delivery')}</h2>
  <p class="wm-incident-status">Status: <strong>${escapeHtml(inc.status ?? 'unknown')}</strong>${inc.resolutionState ? ` — ${escapeHtml(inc.resolutionState)}` : ''}</p>
  <h3>Known facts</h3>
  <ol>${steps || '<li class="wm-empty">(none yet)</li>'}</ol>
</section>`;
}

export function renderLeno(payload) {
  const leno = payload?.leno;
  const guarded = applyLenoGuard(leno?.summary ?? '', payload);
  const suggestions = (leno?.suggestions ?? []).map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  return `<section class="wm-section wm-leno" id="wm-leno">
  <h2>Leno Suggestions</h2>
  ${guarded ? `<pre class="wm-leno-summary">${escapeHtml(guarded)}</pre>` : '<p class="wm-empty">No summary yet — try <code>ask_leno</code>.</p>'}
  ${suggestions ? `<ol>${suggestions}</ol>` : ''}
</section>`;
}

export function renderSaves(saves) {
  const rows = (saves ?? []).map((s) =>
    `<tr><td><code>${escapeHtml(s.id)}</code></td><td>${escapeHtml(s.branch ?? 'main')}</td><td>Day ${escapeHtml(String(s.day ?? '?'))} ${escapeHtml(s.time ?? '')}</td><td>${escapeHtml(s.tick ?? '?')}</td><td>${escapeHtml(s.createdAt ?? '')}</td></tr>`
  ).join('');
  return `<section class="wm-section wm-saves" id="wm-saves">
  <h2>Saves</h2>
  <p class="wm-empty">${rows ? `${(saves ?? []).length} snapshot(s) saved.` : 'No saves yet. Use the CLI <code>npm run saves:list</code> to browse.'}</p>
  ${rows ? `<table class="wm-saves-table"><thead><tr><th>ID</th><th>Branch</th><th>Day/Time</th><th>Tick</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
</section>`;
}

export function renderBranches(branches) {
  const list = (branches ?? []).map((b) =>
    `<li><strong>${escapeHtml(b.name)}</strong> — origin <code>${escapeHtml(b.originSnapshotId ?? '?')}</code>${b.note ? ` — ${escapeHtml(b.note)}` : ''}</li>`
  ).join('');
  return `<section class="wm-section wm-branches" id="wm-branches">
  <h2>Branches</h2>
  <ul>${list || '<li class="wm-empty">No branches yet.</li>'}</ul>
</section>`;
}

export function renderDemoPaths(paths) {
  const items = (paths ?? []).map((p) => `
    <li class="wm-demo-path" data-path="${escapeHtml(p.name)}">
      <h3>${escapeHtml(p.label ?? p.name)}</h3>
      <p>${escapeHtml(p.description ?? '')}</p>
      <ol class="wm-demo-steps">${(p.steps ?? []).map((s) => `<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
    </li>
  `).join('');
  return `<section class="wm-section wm-demo-paths" id="wm-demo-paths">
  <h2>Demo Paths</h2>
  <ul class="wm-demo-path-list">${items}</ul>
  <p class="wm-hint">Run any path deterministically via <code>npm run demo:play -- --path=${escapeHtml(paths?.[0]?.name ?? 'peaceful')}</code>.</p>
</section>`;
}

/**
 * Assemble a full `index.html` page from a payload object:
 *   { world, dialogue, consequence, leno, playerKnowledge,
 *     saves, branches, demoPaths, evidence, appCss, appJs }
 */
export function renderWebPage(payload) {
  const world = payload?.world ?? {};
  const css = payload?.appCss ?? '';
  const js = payload?.appJs ?? '';
  const stateJson = JSON.stringify({
    world: {
      id: world.id, name: world.name, day: world.day, time: world.time, tick: world.tick,
      agents: world.agents, locations: world.locations, incidents: world.incidents,
      rumors: world.rumors, playerKnowledge: world.playerKnowledge
    },
    demoPaths: payload?.demoPaths ?? [],
    initialResult: {
      dialogue: payload?.dialogue ?? null,
      consequence: payload?.consequence ?? null,
      leno: payload?.leno ?? null
    }
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WorldMind — Interactive Play</title>
  <style>${css}</style>
</head>
<body class="wm-body">
  <main class="wm-main">
    ${renderHeader(world)}
    <div class="wm-grid">
      <div class="wm-col-left">
        ${renderLocation(world)}
        ${renderAgents(world)}
        ${renderCommandButtons()}
        ${renderDemoPaths(payload?.demoPaths ?? [])}
      </div>
      <div class="wm-col-right">
        ${renderDialogueTurn(payload?.dialogue)}
        ${renderConsequence(payload?.consequence)}
        ${renderEvidence(payload)}
        ${renderIncident(world)}
        ${renderLeno(payload)}
        ${renderSaves(payload?.saves)}
        ${renderBranches(payload?.branches)}
      </div>
    </div>
  </main>
  <script id="wm-state" type="application/json">${escapeHtml(stateJson)}</script>
  <script>${js}</script>
</body>
</html>`;
}
