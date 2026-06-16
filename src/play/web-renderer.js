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
 *   renderDistrictView(view)      -> 2D SVG district map
 *   renderCommandButtons()        -> quick-action button row
 *   renderCommandForm()           -> freeform text input
 *   renderDialogueTurn(dialogue)  -> Dialogue panel
 *   renderConsequence(c)          -> Consequence panel
 *   renderEvidence(payload)       -> Evidence panel (with guard)
 *   renderIncident(world)         -> Incident progress panel
 *   renderLeno(payload)           -> Leno panel (with guard)
 *   renderPhoneTabs()             -> Phone UI tabs
 *   renderEventFeed(events)       -> Event feed panel
 *   renderSaves(saves)            -> Save Browser panel
 *   renderBranches(branches)      -> Branches panel
 *   renderDemoPaths(paths)        -> Demo paths selector
 *   escapeHtml(text)              -> safe HTML escape
 */
import { buildDistrictView } from './district-view.js';
import { bindAssets } from './assets.js';

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

export function renderTopBar(world, payload) {
  const money = world?.agents?.player?.stats?.money ?? 0;
  const lenoReady = payload?.leno?.summary ? 'online' : 'standby';
  return `<section class="wm-section wm-topbar" id="wm-topbar">
  <h2>Game Shell</h2>
  <div class="wm-topbar-grid">
    <span><strong>Day:</strong> ${escapeHtml(world?.day ?? '?')}</span>
    <span><strong>Time:</strong> ${escapeHtml(world?.time ?? '?')}</span>
    <span><strong>Money:</strong> ${escapeHtml(money)}</span>
    <span><strong>Leno:</strong> ${escapeHtml(lenoReady)}</span>
  </div>
</section>`;
}

function locationScenePath(locId) {
  const map = {
    cafe: 'assets/locations/cafe.png',
    market: 'assets/locations/market.png',
    workshop: 'assets/locations/workshop.png',
    apartment: 'assets/locations/apartment.png',
    district_square: 'assets/locations/district-square.png'
  };
  return map[locId] ?? null;
}

function hotspotModel(locId) {
  const base = {
    cafe: [
      { id: 'cafe_delivery_crate', label: 'Delivery crate', command: 'inspect cafe', preview: 'Inspect missing delivery crate', risk: 1 },
      { id: 'cafe_stock_shelf', label: 'Stock shelf', command: 'inspect cafe', preview: 'Inspect low stock indicators', risk: 1 }
    ],
    market: [
      { id: 'market_rumor_corner', label: 'Rumor corner', command: 'listen_rumors market', preview: 'Hear local rumor trail', risk: 2 }
    ],
    workshop: [
      { id: 'workshop_repair_bench', label: 'Repair bench', command: 'inspect workshop', preview: 'Inspect repair flow and costs', risk: 2 },
      { id: 'courier_route_marker', label: 'Courier route marker', command: 'inspect workshop', preview: 'Inspect route bottlenecks', risk: 2 }
    ],
    apartment: [
      { id: 'registry_kiosk', label: 'Registry kiosk feed', command: 'inspect apartment', preview: 'Inspect registry pressure', risk: 2 }
    ]
  };
  return base[locId] ?? [];
}

export function renderLocation(world) {
  const player = world?.agents?.player;
  const locId = player?.locationId;
  const loc = locId ? world.locations?.[locId] : null;
  const locName = loc?.name ?? locId ?? 'unknown';
  const scene = locationScenePath(locId);
  const hotspots = hotspotModel(locId);
  return `<section class="wm-section wm-location" id="wm-location">
  <h2>Current Location</h2>
  <p class="wm-location-name">${escapeHtml(locName)}</p>
  ${scene ? `<div class="wm-location-scene">
    <img src="${escapeHtml(scene)}" alt="${escapeHtml(locName)} scene" class="wm-scene-img" />
  </div>` : ''}
  <h3>Hotspots</h3>
  <ul class="wm-hotspot-list">${hotspots.map((h) => `
    <li class="wm-hotspot" data-hotspot-id="${escapeHtml(h.id)}">
      <strong>${escapeHtml(h.label)}</strong>
      <span>${escapeHtml(h.preview)}</span>
      <span>risk ${escapeHtml(h.risk)}</span>
      <button type="button" data-run-command="${escapeHtml(h.command)}">Run</button>
    </li>
  `).join('') || '<li class="wm-empty">No hotspots configured.</li>'}</ul>
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
  <ul class="wm-agent-list">${list.map((a) => {
    const rel = a?.relationships?.player ?? { trust: 0, suspicion: 0, fear: 0 };
    const avatar = a?.assets?.avatar || `assets/characters/${a.id}/avatar.png`;
    return `
    <li class="wm-agent" data-agent-id="${escapeHtml(a.id)}">
      <div class="wm-agent-card">
        <img src="${escapeHtml(avatar)}" alt="${escapeHtml(a.name)} avatar" class="wm-agent-avatar" />
        <div>
          <strong>${escapeHtml(a.name)}</strong>
          <span class="wm-agent-role">${escapeHtml(a.role ?? '')}</span>
          <span class="wm-agent-loc">@ ${escapeHtml(world.locations?.[a.locationId]?.name ?? a.locationId ?? '?')}</span>
          <span class="wm-agent-stats">trust ${escapeHtml(rel.trust)} · suspicion ${escapeHtml(rel.suspicion)} · fear ${escapeHtml(rel.fear)}</span>
          <div class="wm-agent-actions">
            <button type="button" data-run-command="talk ${escapeHtml(a.id)}">Talk</button>
            <button type="button" data-run-command="ask ${escapeHtml(a.id)} delivery">Ask</button>
            <button type="button" data-run-command="ask_leno">Ask Leno</button>
            <button type="button" data-run-command="pay ${escapeHtml(a.id)} 5">Negotiate</button>
          </div>
        </div>
      </div>
    </li>`;
  }).join('')}</ul>
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
  const ticker = [
    `relationships: ${rels ? 'updated' : 'no change'}`,
    `memories: ${consequence.newMemories >= 0 ? '+' : ''}${consequence.newMemories ?? 0}`,
    `rumors: ${consequence.newRumors >= 0 ? '+' : ''}${consequence.newRumors ?? 0}`,
    `money: ${consequence.moneyDelta >= 0 ? '+' : ''}${consequence.moneyDelta ?? 0}`
  ];
  return `<section class="wm-section wm-consequence" id="wm-consequence">
  <h2>Consequence</h2>
  ${rels ? `<h3>Relationships</h3><ul>${rels}</ul>` : ''}
  <p>New memories: <strong>${consequence.newMemories >= 0 ? '+' : ''}${consequence.newMemories ?? 0}</strong></p>
  <p>Rumor changes: <strong>${consequence.newRumors >= 0 ? '+' : ''}${consequence.newRumors ?? 0}</strong></p>
  <p>Money: <strong>${consequence.moneyDelta >= 0 ? '+' : ''}${consequence.moneyDelta ?? 0}</strong></p>
  ${incident}
  <h3>Consequence Ticker</h3>
  <ul class="wm-ticker">${ticker.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
</section>`;
}

export function renderEvidence(payload) {
  const pk = payload?.playerKnowledge ?? payload?.world?.playerKnowledge ?? { evidenceIds: [], knownRumorIds: [], suspectedCauses: [], unresolvedQuestions: [] };
  const guardedSummary = applyLenoGuard(payload?.leno?.summary ?? '', payload);
  const evidenceCards = (pk.evidenceIds ?? []).map((e) => `<li class="wm-case-card"><img src="assets/ui/evidence-card.png" alt="Evidence card" /><span>${escapeHtml(e)}</span></li>`).join('');
  const rumorCards = (pk.knownRumorIds ?? []).map((r) => `<li class="wm-case-card"><img src="assets/ui/rumor-card.png" alt="Rumor card" /><span>${escapeHtml(r)}</span></li>`).join('');
  return `<section class="wm-section wm-evidence" id="wm-evidence">
  <h2>Evidence</h2>
  <p><strong>Known facts:</strong> ${(pk.evidenceIds ?? []).map((e) => `<code>${escapeHtml(e)}</code>`).join(' ') || '<em>(none collected yet)</em>'}</p>
  <p><strong>Suspected causes:</strong> ${(pk.suspectedCauses ?? []).join(', ') || '<em>(none)</em>'}</p>
  <p><strong>Unresolved questions:</strong> ${(pk.unresolvedQuestions ?? []).join(', ') || '<em>(none)</em>'}</p>
  <h3>Case Board</h3>
  <div class="wm-case-board">
    <div><h4>Evidence Cards</h4><ul>${evidenceCards || '<li class="wm-empty">No evidence cards yet.</li>'}</ul></div>
    <div><h4>Rumor Cards</h4><ul>${rumorCards || '<li class="wm-empty">No rumor cards yet.</li>'}</ul></div>
  </div>
  ${guardedSummary ? `<h3>Leno summary (guarded)</h3><pre>${escapeHtml(guardedSummary)}</pre>` : ''}
</section>`;
}

export function renderRumorTrail(payload) {
  const pk = payload?.playerKnowledge ?? payload?.world?.playerKnowledge ?? {};
  const known = pk.knownRumorIds ?? [];
  return `<section class="wm-section wm-rumors" id="wm-rumor-trail">
  <h2>Rumor Trail</h2>
  <ul>${known.map((id) => `<li><code>${escapeHtml(id)}</code> · spread risk: medium · <button type="button" data-run-command="trace_rumor ${escapeHtml(id)}">Trace</button> <button type="button" data-run-command="counter_rumor ${escapeHtml(id)}">Counter</button></li>`).join('') || '<li class="wm-empty">No known rumors yet.</li>'}</ul>
  <p class="wm-hint">Counter-rumor without enough evidence can backfire.</p>
</section>`;
}

export function renderFounderPanel(world) {
  const incident = Object.values(world?.incidents ?? {}).find((i) => i.id === 'missing_delivery');
  const unlocked = Boolean(incident?.status === 'resolved' || incident?.resolutionState === 'founder_negotiation');
  return `<section class="wm-section wm-founder" id="wm-founder">
  <h2>Founder/Base</h2>
  ${unlocked
    ? `<p>Founder loop unlocked.</p>
       <ul>
         <li>First workflow contract available</li>
         <li>Malik/Sara contract option available</li>
         <li>Base progress + reputation loop active</li>
       </ul>`
    : '<p class="wm-empty">Resolve The Missing Delivery to unlock founder loop.</p>'}
</section>`;
}

export function renderMajorDecisionPanel() {
  const choices = [
    'expose_nadia',
    'protect_sara_privately',
    'sell_info_registry',
    'negotiate_malik',
    'start_delivery_workflow'
  ];
  return `<section class="wm-section wm-major-decisions" id="wm-major-decisions">
  <h2>Major Decisions</h2>
  <p>Create branch before high-impact choices.</p>
  <div class="wm-decision-list">${choices.map((c) => `<button type="button" data-major-decision="${c}">${escapeHtml(c)}</button>`).join('')}</div>
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
    `<tr data-save-id="${escapeHtml(s.id)}"><td><code>${escapeHtml(s.id)}</code></td><td>${escapeHtml(s.branch ?? 'main')}</td><td>Day ${escapeHtml(String(s.day ?? '?'))} ${escapeHtml(s.time ?? '')}</td><td>${escapeHtml(s.tick ?? '?')}</td><td>${escapeHtml(s.createdAt ?? '')}</td></tr>`
  ).join('');
  return `<section class="wm-section wm-saves" id="section-saves">
  <h2>Saves</h2>
  <p class="wm-empty" data-saves-summary>${rows ? `${(saves ?? []).length} snapshot(s) saved.` : 'No saves yet. Use the CLI <code>npm run saves:list</code> to browse.'}</p>
  ${rows ? `<table class="wm-saves-table" data-saves-list><thead><tr><th>ID</th><th>Branch</th><th>Day/Time</th><th>Tick</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
  <div class="wm-save-actions">
    <button type="button" data-action="saves-refresh">Refresh</button>
    <button type="button" data-action="save-now">Save now</button>
    <input type="search" placeholder="Filter by id or branch" data-saves-filter />
  </div>
</section>`;
}

export function renderBranches(branches) {
  const tree = (branches ?? []).map((b) => `
    <li data-branch-id="${escapeHtml(b.id)}">
      <strong>${escapeHtml(b.name)}</strong>
      <span class="wm-branch-meta">origin <code>${escapeHtml(b.originSnapshotId ?? '?')}</code>${b.currentSnapshotId ? ` → current <code>${escapeHtml(b.currentSnapshotId)}</code>` : ''}</span>
      ${b.note ? `<div class="wm-branch-note">${escapeHtml(b.note)}</div>` : ''}
    </li>
  `).join('');
  return `<section class="wm-section wm-branches" id="section-branches">
  <h2>Branches</h2>
  <ul class="wm-branches-tree" data-branches-tree>${tree || '<li class="wm-empty">No branches yet.</li>'}</ul>
  <form class="wm-branch-create" data-branch-create>
    <label>Name <input type="text" name="name" required /></label>
    <label>Snapshot ID <input type="text" name="snapshotId" required /></label>
    <label>Note <input type="text" name="note" /></label>
    <button type="submit">Create branch</button>
    <output data-branch-create-output></output>
  </form>
</section>`;
}

export function renderDiff() {
  return `<section class="wm-section wm-diff" id="section-diff">
  <h2>Snapshot Diff</h2>
  <form class="wm-diff-form" data-diff-form>
    <label>From <input type="text" name="from" required /></label>
    <label>To <input type="text" name="to" required /></label>
    <button type="submit">Compute diff</button>
    <output data-diff-output></output>
  </form>
  <pre class="wm-diff-panel" data-diff-panel>Pick two snapshots and compute a diff.</pre>
</section>`;
}

/** District View — SVG map showing the 4 MVP locations */
export function renderDistrictView(view) {
  const viewBox = '0 0 100 100';
  const nodes = (view?.nodes ?? []).map((node) => {
    const classes = node.id === view?.playerLocationId ? 'wm-node wm-player-location' : 'wm-node';
    const agentList = (node.agentsHere ?? []).map((a) => `<text x="${node.x + 4}" y="${node.y + 6}" font-size="2" data-agent-id="${a.id}">${a.name}</text>`).join('');
    return `<g class="${classes}" data-location-id="${node.id}">
      <circle cx="${node.x}" cy="${node.y}" r="4" />
      <text x="${node.x + 4}" y="${node.y - 2}" font-size="3">${escapeHtml(node.name)}</text>
      ${agentList}
    </g>`;
  }).join('\n');
  const edges = (view?.edges ?? []).map((edge) => {
    const from = view.nodes.find((n) => n.id === edge.from) || {};
    const to = view.nodes.find((n) => n.id === edge.to) || {};
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="currentColor" stroke-width="0.3" />`;
  }).join('\n');
  return `<section class="wm-section wm-district-view" id="section-district">
    <h2>District View</h2>
    <svg viewBox="${viewBox}" class="wm-district-svg" data-district-map>
      ${edges}
      ${nodes}
    </svg>
    <p class="wm-hint">Click on a location circle to move there.</p>
  </section>`;
}

/** Phone UI panel with tabs */
export function renderPhoneTabs() {
  return `<section class="wm-section wm-phone" id="section-phone">
    <h2>Phone</h2>
    <div class="wm-phone-tabs">
      <button type="button" data-phone-tab="messages">Messages</button>
      <button type="button" data-phone-tab="contacts">Contacts</button>
      <button type="button" data-phone-tab="rumors">Rumors</button>
      <button type="button" data-phone-tab="evidence">Evidence</button>
      <button type="button" data-phone-tab="jobs">Jobs/Incident</button>
      <button type="button" data-phone-tab="saves">Saves</button>
      <button type="button" data-phone-tab="branches">Branches</button>
      <button type="button" data-phone-tab="leno">Leno</button>
      <button type="button" data-phone-tab="creator">Creator</button>
    </div>
    <div class="wm-phone-content" data-phone-content>
      <div data-phone-pane="messages" class="wm-phone-pane">Messages panel</div>
      <div data-phone-pane="contacts" class="wm-phone-pane">Contacts panel</div>
      <div data-phone-pane="rumors" class="wm-phone-pane">Rumors panel</div>
      <div data-phone-pane="evidence" class="wm-phone-pane">Evidence panel</div>
      <div data-phone-pane="jobs" class="wm-phone-pane">Jobs/incident panel</div>
      <div data-phone-pane="saves" class="wm-phone-pane">Saves panel</div>
      <div data-phone-pane="branches" class="wm-phone-pane">Branches panel</div>
      <div data-phone-pane="leno" class="wm-phone-pane">Leno panel</div>
      <div data-phone-pane="creator" class="wm-phone-pane">
        <h3>Creator Agent Form</h3>
        <form class="creator-agent-form" data-creator-agent-form>
          <input type="text" placeholder="Agent name" data-agent-name />
          <input type="text" placeholder="Role" data-agent-role />
          <button type="submit">Generate Agent</button>
        </form>
        <h3>Creator Location Form</h3>
        <form class="creator-location-form" data-creator-location-form>
          <input type="text" placeholder="Location name" data-loc-name />
          <input type="text" placeholder="Zone type" data-loc-zone />
          <button type="submit">Generate Location</button>
        </form>
        <h3>Creator Incident Form</h3>
        <form class="creator-incident-form" data-creator-incident-form>
          <input type="text" placeholder="Incident title" data-inc-title />
          <input type="text" placeholder="Visible problem" data-inc-problem />
          <button type="submit">Generate Incident</button>
        </form>
        <pre data-creator-preview></pre>
        <button type="button" data-validate-creator>Validate</button>
        <button type="button" data-export-scenario>Export Scenario</button>
      </div>
    </div>
      </section>`;
    }

    /** Event Feed — live event ticker */
export function renderEventFeed(events) {
  const rows = (events ?? []).slice(-12).reverse().map((e) => {
    const time = `${e.day ?? '?'}d ${e.time ?? ''}`;
    return `<li><code>${escapeHtml(e.type)}</code> · ${escapeHtml(time)} · ${escapeHtml(e.message ?? '')}</li>`;
  }).join('');
  return `<section class="wm-section wm-events" id="section-events">
    <h2>Event Feed</h2>
    <ul class="wm-event-feed" data-event-feed>${rows || '<li class="wm-empty">No events yet — try a command.</li>'}</ul>
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
  bindAssets(world);
  const css = payload?.appCss ?? '';
  const js = payload?.appJs ?? '';
  const districtView = payload?.districtView ?? buildDistrictView(world);
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
      leno: payload?.leno ?? null,
      events: payload?.events ?? []
    },
    districtView
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
    ${renderTopBar(world, payload)}
    <div class="wm-grid">
      <div class="wm-col-left">
        ${renderLocation(world)}
        ${renderAgents(world)}
        ${renderDistrictView(districtView)}
        ${renderCommandButtons()}
        ${renderDemoPaths(payload?.demoPaths ?? [])}
      </div>
      <div class="wm-col-right">
        ${renderDialogueTurn(payload?.dialogue)}
        ${renderConsequence(payload?.consequence)}
        ${renderEvidence(payload)}
        ${renderRumorTrail(payload)}
        ${renderIncident(world)}
        ${renderLeno(payload)}
        ${renderFounderPanel(world)}
        ${renderMajorDecisionPanel()}
        ${renderPhoneTabs()}
        ${renderEventFeed(payload?.events)}
        ${renderSaves(payload?.saves)}
        ${renderBranches(payload?.branches)}
        ${renderDiff()}
      </div>
    </div>
  </main>
  <script id="wm-state" type="application/json">${escapeHtml(stateJson)}</script>
  <script>${js}</script>
</body>
</html>`;
}
