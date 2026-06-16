/**
 * Authoritative TypeScript module — `dashboard.ts`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { evaluateWorld } from './sim.ts';
import { lenoSummarize, lenoSuggestActions } from './leno.ts';
import { buildTimelineBranchView, diffSnapshots, filterEvents } from '../persistence/timeline.js';
import type { WorldRuntime } from './state.ts';

interface DashboardOptions {
  store?: unknown;
  currentSnapshotId?: string | null;
  compareSnapshotIds?: string[];
  eventFilters?: Record<string, unknown>;
  tickFrom?: number | null;
  tickTo?: number | null;
  actorId?: string | null;
  incidentId?: string | null;
  includeTimeline?: boolean;
  includeSaveBrowser?: boolean;
  includeBranchExplorer?: boolean;
  includeContracts?: boolean;
  includeParseContracts?: boolean;
}

interface DashboardResult {
  htmlPath: string;
  dataPath: string;
}

export function generateDashboard(world: WorldRuntime, outDir = 'static-dashboard', options: DashboardOptions = {}): DashboardResult {
  fs.mkdirSync(outDir, { recursive: true });
  const store = options.store ?? null;
  const evalResult = evaluateWorld(world);
  const snapshots = store ? (store as { listSnapshots: (id: string) => unknown[] }).listSnapshots(world.id) : [];
  const branches = store ? buildTimelineBranchView({ branches: (store as { listTimelineBranches: (id: string) => unknown[] }).listTimelineBranches(world.id), snapshots }) : [];
  const currentSnapshotId = options.currentSnapshotId ?? world.currentSnapshotId ?? (snapshots as { id: string }[]).at(-1)?.id ?? null;
  const currentSnapshot = currentSnapshotId
    ? (snapshots as { id: string }[]).find((snapshot) => snapshot.id === currentSnapshotId) ?? (snapshots as { id: string }[]).at(-1) ?? null
    : (snapshots as { id: string }[]).at(-1) ?? null;
  const compareIds = Array.isArray(options.compareSnapshotIds) && options.compareSnapshotIds.length === 2
    ? options.compareSnapshotIds
    : snapshots.length >= 2
      ? [(snapshots as { id: string }[]).at(-2)!.id, (snapshots as { id: string }[]).at(-1)!.id]
      : [];
  const timelineDiff = compareIds.length === 2 && store
    ? diffSnapshots((store as { loadSnapshot: (id: string) => unknown }).loadSnapshot(compareIds[0]), (store as { loadSnapshot: (id: string) => unknown }).loadSnapshot(compareIds[1]))
    : null;
  const eventFilters = options.eventFilters ?? {
    branchName: world.branchName ?? 'main',
    tickFrom: options.tickFrom ?? null,
    tickTo: options.tickTo ?? null,
    actorId: options.actorId ?? null,
    incidentId: options.incidentId ?? null
  };
  const filteredEvents = filterEvents(world.events, eventFilters as Parameters<typeof filterEvents>[1]);
  const dataPath = path.join(outDir, 'world-state.json');
  fs.writeFileSync(dataPath, JSON.stringify({ world, evalResult, snapshots, branches, currentSnapshot, timelineDiff, eventFilters }, null, 2));

  const snapshotRows = (snapshots as { id: string; worldId: string; branchName?: string; parentSnapshotId?: string; originSnapshotId?: string; tick: number; day: number; time: string; incidentStatus: string; memoryCount: number; eventCount: number; relationshipCount: number; rumorCount: number }[]).length
    ? (snapshots as { id: string; worldId: string; branchName?: string; parentSnapshotId?: string; originSnapshotId?: string; tick: number; day: number; time: string; incidentStatus: string; memoryCount: number; eventCount: number; relationshipCount: number; rumorCount: number }[]).map((snapshot) => `<tr><td><code>${escapeHtml(snapshot.id)}</code></td><td>${escapeHtml(snapshot.worldId)}</td><td>${escapeHtml(snapshot.branchName ?? '')}</td><td>${escapeHtml(snapshot.parentSnapshotId ?? '')}</td><td>${escapeHtml(snapshot.originSnapshotId ?? '')}</td><td>${snapshot.tick}</td><td>${snapshot.day}</td><td>${escapeHtml(snapshot.time)}</td><td>${escapeHtml(snapshot.incidentStatus)}</td><td>${snapshot.memoryCount}</td><td>${snapshot.eventCount}</td><td>${snapshot.relationshipCount}</td><td>${snapshot.rumorCount}</td></tr>`).join('')
    : '<tr><td colspan="13">No snapshots available yet. Run with <code>--persist</code> to populate the save browser.</td></tr>';

  const branchRows = (branches as { name: string; originSnapshotId?: string; parentSnapshotId?: string; currentSnapshotId?: string; currentDay?: number; currentTime?: string; snapshotCount: number; note?: string }[]).length
    ? (branches as { name: string; originSnapshotId?: string; parentSnapshotId?: string; currentSnapshotId?: string; currentDay?: number; currentTime?: string; snapshotCount: number; note?: string }[]).map((branch) => `<tr><td>${escapeHtml(branch.name)}</td><td><code>${escapeHtml(branch.originSnapshotId ?? '')}</code></td><td><code>${escapeHtml(branch.parentSnapshotId ?? '')}</code></td><td><code>${escapeHtml(branch.currentSnapshotId ?? '')}</code></td><td>${escapeHtml(branch.currentDay?.toString() ?? '')}</td><td>${escapeHtml(branch.currentTime ?? '')}</td><td>${branch.snapshotCount}</td><td>${escapeHtml(branch.note ?? '')}</td></tr>`).join('')
    : '<tr><td colspan="8">No branches yet.</td></tr>';

  const eventRows = filteredEvents.slice(-80).reverse().map((event) => `<tr><td>D${event.day} ${event.time}</td><td>${escapeHtml(event.type)}</td><td>${escapeHtml(event.description ?? '')}</td><td>${escapeHtml(event.branchName ?? 'main')}</td><td>${escapeHtml(event.branchOriginSnapshotId ?? event.branchParentSnapshotId ?? 'n/a')}</td><td>${escapeHtml((event.actorIds ?? []).join(', ') || '')}</td></tr>`).join('') || '<tr><td colspan="6">No events match the current filters.</td></tr>';

  const player = world.agents.player;
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
code,pre{background:#0c1117;border-radius:10px;padding:12px;display:block;white-space:pre-wrap;overflow:auto}
.pass{color:#9ff2b5}.fail{color:#ffb4b4}.muted{color:#9cb2c8}
.small{font-size:12px}
</style></head><body>
<h1>WorldMind — v0.3 Save Browser + Timeline UX</h1>
<p class="muted">Static snapshot generated from the simulation core. Event Log is the source of truth.</p>
<div class="grid-3">${overviewCards(world)}</div>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>World Overview</h2><pre>${escapeHtml(JSON.stringify({ day: world.day, time: world.time, tick: world.tick, branchName: (currentSnapshot as { branchName?: string } | null)?.branchName ?? world.branchName ?? 'main', branchOriginSnapshotId: (currentSnapshot as { originSnapshotId?: string } | null)?.originSnapshotId ?? world.branchOriginSnapshotId ?? null, branchParentSnapshotId: (currentSnapshot as { parentSnapshotId?: string } | null)?.parentSnapshotId ?? world.branchParentSnapshotId ?? null, passed: evalResult.passed }, null, 2))}</pre></section>
  <section class="card"><h2>Leno Panel</h2><pre>${escapeHtml(lenoSummarize(world))}</pre><h3>Suggested actions</h3><ul>${lenoSuggestActions(world).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
</div>
<section class="card" style="margin-top:16px;"><h2>Save Browser</h2><table><thead><tr><th>Snapshot</th><th>World</th><th>Branch</th><th>Parent</th><th>Origin</th><th>Tick</th><th>Day</th><th>Time</th><th>Incident</th><th>Memories</th><th>Events</th><th>Relationships</th><th>Rumors</th></tr></thead><tbody>${snapshotRows}</tbody></table></section>
<section class="card" style="margin-top:16px;"><h2>Timeline Branches</h2><table><thead><tr><th>Branch</th><th>Origin Snapshot</th><th>Parent Snapshot</th><th>Current Snapshot</th><th>Current Day</th><th>Current Time</th><th>Snapshots</th><th>Note</th></tr></thead><tbody>${branchRows}</tbody></table></section>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>Snapshot Details</h2><pre>${escapeHtml(JSON.stringify(currentSnapshot ?? { branchName: world.branchName ?? 'main', currentSnapshotId: world.currentSnapshotId ?? null, tick: world.tick, day: world.day, time: world.time }, null, 2))}</pre></section>
  <section class="card"><h2>Timeline Diff</h2><pre>${escapeHtml(timelineDiff ? JSON.stringify(timelineDiff, null, 2) : 'Save at least two snapshots to compare timelines.')}</pre></section>
</div>
<section class="card" style="margin-top:16px;"><h2>Branch-aware Event Log</h2><p class="muted">Filters: ${escapeHtml(JSON.stringify(eventFilters))}</p><table><thead><tr><th>Time</th><th>Type</th><th>Description</th><th>Branch</th><th>Origin Snapshot</th><th>Actors</th></tr></thead><tbody>${eventRows}</tbody></table></section>
<section class="card" style="margin-top:16px;"><h2>Continue from snapshot</h2><pre>npm run saves:list
node src/cli/simulate.js --list-snapshots --persist
node src/cli/simulate.js --load-snapshot snapshot_00001 --days 7 --persist --save-snapshot
node src/cli/simulate.js --branch-from-snapshot snapshot_00001 --branch-name alt-path --branch-only --persist</pre></section>
<section class="card" style="margin-top:16px;"><h2>Agent Profile — Player</h2><table><tbody>
  <tr><th>Name</th><td>${escapeHtml(player.name)}</td><th>Role</th><td>${escapeHtml(player.role)}</td></tr>
  <tr><th>Location</th><td>${escapeHtml(world.locations[player.locationId]?.name ?? player.locationId)}</td><th>Current intent</th><td>${escapeHtml(player.currentIntent ?? '')}</td></tr>
  <tr><th>Money</th><td>${player.stats.money ?? ''}</td><th>Stress</th><td>${player.stats.stress ?? ''}</td></tr>
  <tr><th>Memories</th><td>${player.memoryIds.length}</td><th>Known incidents</th><td>${world.playerKnowledge.knownIncidentIds.length}</td></tr>
</tbody></table></section>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>Agent List</h2><table><thead><tr><th>Name</th><th>Role</th><th>Location</th><th>Intent</th><th>Memories</th></tr></thead><tbody>${agentRows(world)}</tbody></table></section>
  <section class="card"><h2>Location View</h2><table><thead><tr><th>Location</th><th>Type</th><th>Zone</th><th>Agents Present</th><th>Objects</th></tr></thead><tbody>${locationRows(world)}</tbody></table></section>
</div>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>Rumor Board</h2><table><thead><tr><th>ID</th><th>Claim</th><th>Source</th><th>Truth</th><th>Known By</th></tr></thead><tbody>${rumorRows(world)}</tbody></table></section>
  <section class="card"><h2>Relationship Graph</h2><table><thead><tr><th>Target</th><th>Trust</th><th>Suspicion</th><th>Respect</th><th>Affection</th><th>Influence</th></tr></thead><tbody>${relationshipRows(world)}</tbody></table></section>
</div>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>Incident View</h2><ul>${incidentRows(world)}</ul></section>
  <section class="card"><h2>Raw Timeline Snapshot</h2><pre>${escapeHtml(JSON.stringify(currentSnapshot ?? {}, null, 2))}</pre></section>
</div>
<section class="card" style="margin-top:16px;"><h2>Eval</h2><pre class="${evalResult.passed ? 'pass' : 'fail'}">${escapeHtml(JSON.stringify(evalResult, null, 2))}</pre></section>
<p class="small muted">Raw world state: <a href="world-state.json">world-state.json</a></p></body></html>`;
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  return { htmlPath: path.join(outDir, 'index.html'), dataPath };
}

function overviewCards(world: WorldRuntime): string {
  return [
    ['Day / Time', `${world.day} / ${world.time}`],
    ['Agents', String(Object.keys(world.agents).length)],
    ['Locations', String(Object.keys(world.locations).length)],
    ['Memories', String(Object.keys(world.memories).length)],
    ['Rumors', String(Object.keys(world.rumors).length)],
    ['Incidents', String(Object.keys(world.incidents).length)],
    ['Food price', String(world.agents.yasin?.stats.foodPrice ?? '')],
    ['Economy pressure', String(world.economy.foodScarcity ?? '')]
  ].map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function agentRows(world: WorldRuntime): string {
  return Object.values(world.agents).map((agent) => `<tr><td>${escapeHtml(agent.name)}</td><td>${escapeHtml(agent.role)}</td><td>${escapeHtml(world.locations[agent.locationId]?.name ?? agent.locationId)}</td><td>${escapeHtml(agent.currentIntent ?? '')}</td><td>${agent.memoryIds.length}</td></tr>`).join('');
}

function locationRows(world: WorldRuntime): string {
  return Object.values(world.locations).map((location) => `<tr><td>${escapeHtml(location.name)}</td><td>${escapeHtml(location.type)}</td><td>${escapeHtml(location.zoneType)}</td><td>${escapeHtml((location.agentsPresent ?? []).map((id) => world.agents[id]?.name ?? id).join(', ') || 'none')}</td><td>${escapeHtml((location.objects ?? []).join(', ') || 'none')}</td></tr>`).join('');
}

function rumorRows(world: WorldRuntime): string {
  return Object.values(world.rumors).slice().reverse().map((rumor) => `<tr><td>${escapeHtml(rumor.id)}</td><td>${escapeHtml(rumor.claim)}</td><td>${escapeHtml(world.agents[rumor.sourceAgentId]?.name ?? rumor.sourceAgentId ?? 'unknown')}</td><td>${rumor.truthLevel}</td><td>${(rumor.knownByAgentIds ?? []).length}</td></tr>`).join('') || '<tr><td colspan="5">No rumors yet.</td></tr>';
}

function relationshipRows(world: WorldRuntime): string {
  return Object.entries(world.agents.player.relationships).map(([targetId, rel]) => `<tr><td>${escapeHtml(world.agents[targetId]?.name ?? targetId)}</td><td>${rel.trust}</td><td>${rel.suspicion}</td><td>${rel.respect}</td><td>${rel.affection}</td><td>${rel.influence?.toFixed?.(1) ?? rel.influence ?? ''}</td></tr>`).join('');
}

function incidentRows(world: WorldRuntime): string {
  return Object.values(world.incidents).map((incident) => `<li><b>${escapeHtml(incident.title)}</b> — ${escapeHtml(incident.status)}. Known facts: ${escapeHtml((incident.knownFacts ?? []).join(' / '))}${incident.status === 'resolved' ? ` · Resolution: ${escapeHtml(incident.resolutionState ?? '')}` : ''}</li>`).join('') || '<li>No incidents.</li>';
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
