/**
 * Authoritative TypeScript module — `dashboard.ts`.
 *
 * v1.0-rc3: visual save browser + branch diff + state inspector +
 * incident flow. Generates a single self-contained HTML page at
 * `<outDir>/index.html` plus a `world-state.json` data file.
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

  // v1.0-rc3: visual timeline tree (ASCII-art style, branch + origin arrows)
  const timelineTree = renderTimelineTree(branches as { name: string; originSnapshotId?: string; parentSnapshotId?: string; currentSnapshotId?: string; snapshotCount: number; note?: string }[]);

  // v1.0-rc3: state inspector (rich card view of current snapshot)
  const stateInspector = renderStateInspector(world);

  // v1.0-rc3: incident flow (The Missing Delivery, step-by-step)
  const incidentFlow = renderIncidentFlow(world);

  // v1.0-rc3: visual diff panel (parse timelineDiff into readable form)
  const visualDiff = renderVisualDiff(timelineDiff, compareIds);

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
code,pre{background:#0c1117;border-radius:10px;padding:12px;display:block;white-space:pre-wrap;overflow:auto;font-size:12px}
.pass{color:#9ff2b5}.fail{color:#ffb4b4}.muted{color:#9cb2c8}
.small{font-size:12px}
.tree{font-family:'Cascadia Code','JetBrains Mono',monospace;white-space:pre;color:#b8e0ff;background:#0c1117;border-radius:10px;padding:16px;overflow:auto}
.flow-step{display:flex;gap:12px;margin-bottom:10px;padding:10px;background:#0c1117;border-radius:10px;border-left:3px solid #4a7caa}
.flow-step.resolved{border-left-color:#9ff2b5}
.flow-step.active{border-left-color:#ffb4b4}
.flow-step .step-icon{flex:0 0 28px;height:28px;border-radius:50%;background:#243445;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold}
.flow-step .step-body{flex:1}
.flow-step .step-title{font-weight:600;color:#b8e0ff;margin-bottom:4px}
.flow-step .step-meta{font-size:11px;color:#9cb2c8}
.diff-section{margin-bottom:12px;padding:10px;background:#0c1117;border-radius:10px}
.diff-section h4{margin:0 0 6px 0;font-size:14px;color:#b8e0ff}
.diff-item{padding:4px 0;border-bottom:1px solid #243445;font-size:12px}
.diff-item:last-child{border-bottom:none}
.diff-item.added{color:#9ff2b5}
.diff-item.removed{color:#ffb4b4}
.diff-item.changed{color:#ffd97a}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}
.kpi{background:#0c1117;border-radius:8px;padding:8px;text-align:center}
.kpi .label{font-size:10px;color:#9cb2c8;text-transform:uppercase}
.kpi .value{font-size:16px;font-weight:bold;color:#b8e0ff}
.badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600}
.badge-main{background:#1a3a5a;color:#b8e0ff}
.badge-experiment{background:#5a3a1a;color:#ffd9a8}
.badge-resolved{background:#1a4a2a;color:#9ff2b5}
.badge-active{background:#5a1a1a;color:#ffb4b4}
</style></head><body>
<h1>WorldMind — v1.0-rc3 Visual Save Browser + QA Inspector</h1>
<p class="muted">Static snapshot generated from the simulation core. Event Log is the source of truth.</p>
<div class="grid-3">${overviewCards(world)}</div>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>World Overview</h2><pre>${escapeHtml(JSON.stringify({ day: world.day, time: world.time, tick: world.tick, branchName: (currentSnapshot as { branchName?: string } | null)?.branchName ?? world.branchName ?? 'main', branchOriginSnapshotId: (currentSnapshot as { originSnapshotId?: string } | null)?.originSnapshotId ?? world.branchOriginSnapshotId ?? null, branchParentSnapshotId: (currentSnapshot as { parentSnapshotId?: string } | null)?.parentSnapshotId ?? world.branchParentSnapshotId ?? null, passed: evalResult.passed }, null, 2))}</pre></section>
  <section class="card"><h2>Leno Panel</h2><pre>${escapeHtml(lenoSummarize(world))}</pre><h3>Suggested actions</h3><ul>${lenoSuggestActions(world).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
</div>
<section class="card" style="margin-top:16px;"><h2>Save Browser</h2><p class="muted small">v1.0-rc3: snapshot ids, branches, parent/origin, incident status. Run <code>npm run saves:list</code> for the CLI view.</p><table><thead><tr><th>Snapshot</th><th>World</th><th>Branch</th><th>Parent</th><th>Origin</th><th>Tick</th><th>Day</th><th>Time</th><th>Incident</th><th>Memories</th><th>Events</th><th>Relationships</th><th>Rumors</th></tr></thead><tbody>${snapshotRows}</tbody></table></section>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>Visual Timeline Tree</h2><p class="muted small">v1.0-rc3: branches with origin chain. <span class="badge badge-main">main</span> vs <span class="badge badge-experiment">experiment</span>.</p><div class="tree">${timelineTree}</div></section>
  <section class="card"><h2>Timeline Branches (Table)</h2><table><thead><tr><th>Branch</th><th>Origin</th><th>Parent</th><th>Current</th><th>Day</th><th>Time</th><th>Snapshots</th><th>Note</th></tr></thead><tbody>${branchRows}</tbody></table></section>
</div>
<section class="card" style="margin-top:16px;"><h2>State Inspector</h2><p class="muted small">v1.0-rc3: rich view of the current snapshot. Click <code>world-state.json</code> below for the raw payload.</p>${stateInspector}</section>
<section class="card" style="margin-top:16px;"><h2>Incident Flow — The Missing Delivery</h2><p class="muted small">v1.0-rc3: step-by-step incident trace from creation to resolution. Evidence level reflects the strict evidence guard.</p>${incidentFlow}</section>
<section class="card" style="margin-top:16px;"><h2>Visual Diff Panel</h2><p class="muted small">v1.0-rc3: structured diff between two snapshots. CLI: <code>npm run saves:diff snapshot_A snapshot_B --db=...</code></p>${visualDiff}</section>
<div class="grid" style="margin-top:16px;">
  <section class="card"><h2>Snapshot Details (current)</h2><pre>${escapeHtml(JSON.stringify(currentSnapshot ?? { branchName: world.branchName ?? 'main', currentSnapshotId: world.currentSnapshotId ?? null, tick: world.tick, day: world.day, time: world.time }, null, 2))}</pre></section>
  <section class="card"><h2>Timeline Diff (raw)</h2><pre>${escapeHtml(timelineDiff ? JSON.stringify(timelineDiff, null, 2) : 'Save at least two snapshots to compare timelines.')}</pre></section>
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

/**
 * v1.0-rc3: visual timeline tree. Renders branches as an ASCII-art
 * tree with origin arrows so founder/QA can see where the timeline
 * splits at a glance.
 */
function renderTimelineTree(branches: { name: string; originSnapshotId?: string; parentSnapshotId?: string; currentSnapshotId?: string; snapshotCount: number; note?: string }[]): string {
  if (!branches.length) return '(no branches yet — run with --persist --save-snapshot)';
  // Group branches by their origin so we can draw a tree.
  const byOrigin = new Map<string, typeof branches>();
  for (const branch of branches) {
    const origin = branch.originSnapshotId ?? '(no origin)';
    if (!byOrigin.has(origin)) byOrigin.set(origin, []);
    byOrigin.get(origin)!.push(branch);
  }
  const lines: string[] = [];
  let originIdx = 0;
  for (const [origin, group] of byOrigin) {
    const isFirst = originIdx === 0;
    const prefix = isFirst ? '' : '│\n';
    lines.push(prefix);
    lines.push(`┌─ origin: ${origin}`);
    group.forEach((branch, branchIdx) => {
      const isLast = branchIdx === group.length - 1;
      const connector = isLast ? '└─' : '├─';
      const badge = branch.name === 'main' ? 'badge-main' : 'badge-experiment';
      const parent = branch.parentSnapshotId && branch.parentSnapshotId !== branch.originSnapshotId
        ? ` ← parent: ${branch.parentSnapshotId}`
        : '';
      lines.push(`${connector} <span class="badge ${badge}">${escapeHtml(branch.name)}</span> — ${branch.snapshotCount} snapshot(s), current=${branch.currentSnapshotId ?? 'none'}${parent}`);
      if (!isLast) lines.push('│');
    });
    if (originIdx < byOrigin.size - 1) lines.push('│');
    originIdx += 1;
  }
  return lines.join('\n');
}

/**
 * v1.0-rc3: state inspector. Rich card view of the current snapshot
 * with KPI tiles for the major entity counts and a roster of every
 * agent/location/rumor/incident.
 */
function renderStateInspector(world: WorldRuntime): string {
  const agentCount = Object.keys(world.agents).length;
  const locationCount = Object.keys(world.locations).length;
  const memoryCount = Object.keys(world.memories).length;
  const relationshipCount = Object.values(world.agents).reduce((sum, agent) => sum + Object.keys(agent.relationships ?? {}).length, 0) / 2;
  const rumorCount = Object.keys(world.rumors).length;
  const incidentCount = Object.keys(world.incidents).length;
  const eventCount = world.events.length;
  const kpis = [
    ['Agents', agentCount],
    ['Locations', locationCount],
    ['Memories', memoryCount],
    ['Relationships', Math.floor(relationshipCount)],
    ['Rumors', rumorCount],
    ['Incidents', incidentCount],
    ['Events', eventCount],
    ['Tick', world.tick]
  ];
  const kpiGrid = `<div class="kpi-grid">${kpis.map(([label, value]) => `<div class="kpi"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(String(value))}</div></div>`).join('')}</div>`;
  // Top 3 memories by recency.
  const recentMemories = Object.values(world.memories).slice(-3).reverse().map((memory) => `<div class="diff-item">· ${escapeHtml(memory.content ?? memory.id)} <span class="muted">@${escapeHtml(String(memory.createdAtTick ?? '?'))}</span></div>`).join('') || '<div class="muted small">(no memories)</div>';
  // Top 3 rumors by truth.
  const rumors = Object.values(world.rumors).slice(0, 3).map((rumor) => `<div class="diff-item">· ${escapeHtml(rumor.claim)} <span class="muted">truth=${rumor.truthLevel}, known=${(rumor.knownByAgentIds ?? []).length}</span></div>`).join('') || '<div class="muted small">(no rumors)</div>';
  return `${kpiGrid}
<div class="grid" style="margin-top:12px;">
  <div><h4 class="muted small">Recent memories</h4>${recentMemories}</div>
  <div><h4 class="muted small">Top rumors</h4>${rumors}</div>
</div>`;
}

/**
 * v1.0-rc3: incident flow. Traces The Missing Delivery from creation
 * to resolution by filtering the event log for incident-related
 * events and laying them out as a step-by-step timeline.
 */
function renderIncidentFlow(world: WorldRuntime): string {
  const incident = world.incidents.missing_delivery;
  if (!incident) return '<p class="muted small">No incident "missing_delivery" yet. Run the simulation to trigger it.</p>';
  const status = incident.status;
  const steps: { icon: string; title: string; meta: string; cls: string }[] = [];
  // Step 1: created
  const createdEvent = world.events.find((e) => e.type === 'incident_detected');
  if (createdEvent) {
    steps.push({
      icon: '1',
      title: 'Incident detected: The Missing Delivery',
      meta: `tick ${createdEvent.tick}, day ${createdEvent.day} ${createdEvent.time} — ${createdEvent.description ?? ''}`,
      cls: 'active'
    });
  }
  // Step 2: evidence discovered (look for rumor_traced with sourceRevealed)
  const traceEvent = world.events.find((e) => e.type === 'rumor_traced' && e.payload?.sourceRevealed === true);
  if (traceEvent) {
    steps.push({
      icon: '2',
      title: 'Evidence discovered: rumor source traced',
      meta: `tick ${traceEvent.tick}, day ${traceEvent.day} ${traceEvent.time} — ${traceEvent.description ?? ''}`,
      cls: ''
    });
  }
  // Step 3: counter_rumor
  const counterEvent = world.events.find((e) => e.type === 'counter_rumor');
  if (counterEvent) {
    steps.push({
      icon: '3',
      title: 'Counter-rumor published',
      meta: `tick ${counterEvent.tick}, day ${counterEvent.day} ${counterEvent.time} — ${counterEvent.description ?? ''}`,
      cls: ''
    });
  }
  // Step 4: delivery restored
  const restoredEvent = world.events.find((e) => e.type === 'delivery_restored');
  if (restoredEvent) {
    steps.push({
      icon: '4',
      title: 'Delivery restored',
      meta: `tick ${restoredEvent.tick}, day ${restoredEvent.day} ${restoredEvent.time} — ${restoredEvent.description ?? ''}`,
      cls: 'resolved'
    });
  }
  // Step 5: resolved
  if (status === 'resolved') {
    steps.push({
      icon: '✓',
      title: 'Resolved',
      meta: `Resolution path: ${incident.resolutionState ?? 'unspecified'}`,
      cls: 'resolved'
    });
  }
  // Evidence level
  const evidenceLevel = world.playerKnowledge.evidenceIds.includes('rumor_source_nadia')
    ? '<span class="badge badge-resolved">evidence-backed</span>'
    : '<span class="badge badge-active">insufficient evidence</span>';
  const header = `<p class="small">${evidenceLevel} · Known facts: ${escapeHtml((incident.knownFacts ?? []).join(' · '))}</p>`;
  if (!steps.length) {
    return header + '<p class="muted small">Incident exists but no flow events found yet.</p>';
  }
  return header + steps.map((s) => `<div class="flow-step ${s.cls}"><div class="step-icon">${s.icon}</div><div class="step-body"><div class="step-title">${escapeHtml(s.title)}</div><div class="step-meta">${escapeHtml(s.meta)}</div></div></div>`).join('');
}

/**
 * v1.0-rc3: visual diff panel. Parses the timelineDiff into readable
 * sections (added/removed/changed) instead of dumping raw JSON.
 */
function renderVisualDiff(timelineDiff: unknown, compareIds: string[]): string {
  if (!timelineDiff) return '<p class="muted small">Save at least two snapshots to compare timelines. CLI: <code>npm run saves:diff snapshot_a snapshot_b --db=...</code></p>';
  const d = timelineDiff as {
    summary?: Record<string, number>;
    agentLocationChanges?: { agentId: string; beforeLocationId: string | null; afterLocationId: string | null }[];
    relationshipChanges?: { sourceAgentId: string; targetAgentId: string; before: Record<string, number | null>; after: Record<string, number | null> }[];
    newMemories?: { id: string; content?: string; createdAtTick?: number }[];
    newRumors?: { id: string; claim?: string; truthLevel?: number }[];
    economyChanges?: { field: string; before: unknown; after: unknown }[];
    incidentChanges?: { incidentId: string; beforeStatus?: string; afterStatus?: string; afterResolutionState?: string | null }[];
    eventCountDelta?: number;
    tickDelta?: number;
  };
  const ids = compareIds.length === 2 ? compareIds : ['(from)', '(to)'];
  const header = `<p class="small"><code>${escapeHtml(ids[0])}</code> → <code>${escapeHtml(ids[1])}</code>${typeof d.eventCountDelta === 'number' ? ` · eventCountΔ ${d.eventCountDelta}` : ''}${typeof d.tickDelta === 'number' ? ` · tickΔ ${d.tickDelta}` : ''}</p>`;
  const sections: string[] = [];
  if (d.agentLocationChanges?.length) {
    sections.push(`<div class="diff-section"><h4>Agent Location Changes (${d.agentLocationChanges.length})</h4>${d.agentLocationChanges.map((c) => `<div class="diff-item changed">· ${escapeHtml(c.agentId)}: ${escapeHtml(c.beforeLocationId ?? 'none')} → ${escapeHtml(c.afterLocationId ?? 'none')}</div>`).join('')}</div>`);
  }
  if (d.relationshipChanges?.length) {
    sections.push(`<div class="diff-section"><h4>Relationship Changes (${d.relationshipChanges.length})</h4>${d.relationshipChanges.map((c) => `<div class="diff-item changed">· ${escapeHtml(c.sourceAgentId)} → ${escapeHtml(c.targetAgentId)}: trust ${escapeHtml(String(c.before.trust ?? '?'))} → ${escapeHtml(String(c.after.trust ?? '?'))}</div>`).join('')}</div>`);
  }
  if (d.newMemories?.length) {
    sections.push(`<div class="diff-section"><h4>New Memories (${d.newMemories.length})</h4>${d.newMemories.slice(0, 5).map((m) => `<div class="diff-item added">+ ${escapeHtml(m.content ?? m.id)}</div>`).join('')}${d.newMemories.length > 5 ? `<div class="diff-item muted">… and ${d.newMemories.length - 5} more</div>` : ''}</div>`);
  }
  if (d.newRumors?.length) {
    sections.push(`<div class="diff-section"><h4>New Rumors (${d.newRumors.length})</h4>${d.newRumors.map((r) => `<div class="diff-item added">+ ${escapeHtml(r.claim ?? r.id)} (truth=${escapeHtml(String(r.truthLevel ?? '?'))})</div>`).join('')}</div>`);
  }
  if (d.economyChanges?.length) {
    sections.push(`<div class="diff-section"><h4>Economy Changes (${d.economyChanges.length})</h4>${d.economyChanges.map((e) => `<div class="diff-item changed">· ${escapeHtml(e.field)}: ${escapeHtml(String(e.before ?? 'none'))} → ${escapeHtml(String(e.after ?? 'none'))}</div>`).join('')}</div>`);
  }
  if (d.incidentChanges?.length) {
    sections.push(`<div class="diff-section"><h4>Incident Changes (${d.incidentChanges.length})</h4>${d.incidentChanges.map((i) => `<div class="diff-item ${i.afterStatus === 'resolved' ? 'added' : 'changed'}">· ${escapeHtml(i.incidentId)}: ${escapeHtml(i.beforeStatus ?? 'new')} → ${escapeHtml(i.afterStatus ?? '?')}${i.afterResolutionState ? ` (resolution: ${escapeHtml(i.afterResolutionState)})` : ''}</div>`).join('')}</div>`);
  }
  if (!sections.length) {
    return header + '<p class="muted small">No structural changes between these two snapshots.</p>';
  }
  return header + sections.join('');
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
