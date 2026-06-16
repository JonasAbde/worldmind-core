import fs from 'node:fs';
import path from 'node:path';
import { lenoSuggestActions, lenoSummarize } from './leno.js';
import { evaluateWorld } from './sim.js';

export function generateDashboard(world, outDir = 'static-dashboard') {
  fs.mkdirSync(outDir, { recursive: true });
  const evalResult = evaluateWorld(world);
  const dataPath = path.join(outDir, 'world-state.json');
  fs.writeFileSync(dataPath, JSON.stringify({ world, evalResult }, null, 2));

  const agentRows = Object.values(world.agents)
    .map(a => `<tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.role)}</td><td>${escapeHtml(world.locations[a.locationId]?.name ?? a.locationId)}</td><td>${escapeHtml(a.currentIntent ?? '')}</td><td>${a.memoryIds.length}</td></tr>`)
    .join('');

  const locationRows = Object.values(world.locations)
    .map(loc => `<tr><td>${escapeHtml(loc.name)}</td><td>${escapeHtml(loc.type)}</td><td>${escapeHtml(loc.zoneType)}</td><td>${escapeHtml((loc.agentsPresent ?? []).map(id => world.agents[id]?.name ?? id).join(', ') || 'none')}</td><td>${escapeHtml((loc.objects ?? []).join(', ') || 'none')}</td></tr>`)
    .join('');

  const rumorRows = Object.values(world.rumors)
    .slice()
    .reverse()
    .map(r => `<tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.claim)}</td><td>${escapeHtml(world.agents[r.sourceAgentId]?.name ?? r.sourceAgentId ?? 'unknown')}</td><td>${r.truthLevel}</td><td>${(r.knownByAgentIds ?? []).length}</td></tr>`)
    .join('') || '<tr><td colspan="5">No rumors yet.</td></tr>';

  const player = world.agents.player;
  const playerRelationships = Object.entries(player.relationships)
    .map(([targetId, rel]) => ({ targetId, ...rel }))
    .sort((a, b) => (b.influence ?? 0) - (a.influence ?? 0))
    .slice(0, 8)
    .map(rel => `<tr><td>${escapeHtml(world.agents[rel.targetId]?.name ?? rel.targetId)}</td><td>${rel.trust}</td><td>${rel.suspicion}</td><td>${rel.respect}</td><td>${rel.affection}</td><td>${rel.influence?.toFixed?.(1) ?? rel.influence ?? ''}</td></tr>`)
    .join('');

  const incidentRows = Object.values(world.incidents)
    .map(i => `<li><b>${escapeHtml(i.title)}</b> — ${escapeHtml(i.status)}. Known facts: ${escapeHtml(i.knownFacts.join(' / '))}${i.status === 'resolved' ? ` · Resolution: ${escapeHtml(i.resolutionState)}` : ''}</li>`)
    .join('') || '<li>No incidents.</li>';

  const eventRows = world.events
    .slice(-40)
    .reverse()
    .map(e => `<tr><td>D${e.day} ${e.time}</td><td>${escapeHtml(e.type)}</td><td>${escapeHtml(e.description)}</td></tr>`)
    .join('');

  const overviewCards = [
    ['Day / Time', `${world.day} / ${world.time}`],
    ['Agents', String(Object.keys(world.agents).length)],
    ['Locations', String(Object.keys(world.locations).length)],
    ['Memories', String(Object.keys(world.memories).length)],
    ['Rumors', String(Object.keys(world.rumors).length)],
    ['Incidents', String(Object.keys(world.incidents).length)],
    ['Food price', String(world.agents.yasin?.stats.foodPrice ?? '')],
    ['Economy pressure', String(world.economy.foodScarcity ?? '')]
  ].map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');

  const snapshot = {
    day: world.day,
    time: world.time,
    tick: world.tick,
    events: world.events.length,
    memories: Object.keys(world.memories).length,
    rumors: Object.keys(world.rumors).length,
    incidents: Object.keys(world.incidents).length,
    passed: evalResult.passed
  };

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>WorldMind Dashboard</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:24px;background:#101418;color:#e7eef7}
h1,h2,h3{color:#b8e0ff;margin-top:0}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.card{background:#18212b;border:1px solid #304254;border-radius:14px;padding:16px}
.metric{background:#0c1117;border:1px solid #243445;border-radius:12px;padding:12px}
.metric span{display:block;color:#9cb2c8;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.metric strong{font-size:18px}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #304254;padding:8px;text-align:left;vertical-align:top}
code,pre{background:#0c1117;border-radius:10px;padding:12px;display:block;white-space:pre-wrap}
.pass{color:#9ff2b5}.fail{color:#ffb4b4}.muted{color:#9cb2c8}
.small{font-size:12px}
</style></head><body>
<h1>WorldMind — MVP v0.1 Dashboard</h1>
<p class="muted">Static snapshot generated from the simulation core. Event log is the source of truth.</p>
<div class="grid-3">${overviewCards}</div>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>World Overview</h2><pre>${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre></section>
  <section class="card"><h2>Leno Panel</h2><pre>${escapeHtml(lenoSummarize(world))}</pre><h3>Suggested actions</h3><ul>${lenoSuggestActions(world).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></section>
</div>
<section class="card"><h2>Agent Profile — Player</h2><table><tbody>
  <tr><th>Name</th><td>${escapeHtml(player.name)}</td><th>Role</th><td>${escapeHtml(player.role)}</td></tr>
  <tr><th>Location</th><td>${escapeHtml(world.locations[player.locationId]?.name ?? player.locationId)}</td><th>Current intent</th><td>${escapeHtml(player.currentIntent ?? '')}</td></tr>
  <tr><th>Money</th><td>${player.stats.money ?? ''}</td><th>Stress</th><td>${player.stats.stress ?? ''}</td></tr>
  <tr><th>Memories</th><td>${player.memoryIds.length}</td><th>Known incidents</th><td>${world.playerKnowledge.knownIncidentIds.length}</td></tr>
</tbody></table></section>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>Agent List</h2><table><thead><tr><th>Name</th><th>Role</th><th>Location</th><th>Intent</th><th>Memories</th></tr></thead><tbody>${agentRows}</tbody></table></section>
  <section class="card"><h2>Location View</h2><table><thead><tr><th>Location</th><th>Type</th><th>Zone</th><th>Agents Present</th><th>Objects</th></tr></thead><tbody>${locationRows}</tbody></table></section>
</div>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>Rumor Board</h2><table><thead><tr><th>ID</th><th>Claim</th><th>Source</th><th>Truth</th><th>Known By</th></tr></thead><tbody>${rumorRows}</tbody></table></section>
  <section class="card"><h2>Relationship Graph</h2><table><thead><tr><th>Target</th><th>Trust</th><th>Suspicion</th><th>Respect</th><th>Affection</th><th>Influence</th></tr></thead><tbody>${playerRelationships}</tbody></table></section>
</div>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>Incident View</h2><ul>${incidentRows}</ul></section>
  <section class="card"><h2>Save / Timeline View</h2><pre>${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre></section>
</div>
<section class="card" style="margin-top:16px;"><h2>Eval</h2><pre class="${evalResult.passed ? 'pass' : 'fail'}">${escapeHtml(JSON.stringify(evalResult, null, 2))}</pre></section>
<section class="card" style="margin-top:16px;"><h2>Event Log</h2><table><thead><tr><th>Time</th><th>Type</th><th>Description</th></tr></thead><tbody>${eventRows}</tbody></table></section>
<p class="small muted">Raw world state: <a href="world-state.json">world-state.json</a></p></body></html>`;
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  return { htmlPath: path.join(outDir, 'index.html'), dataPath };
}

function escapeHtml(str) {
  return String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
