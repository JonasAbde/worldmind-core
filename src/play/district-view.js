/**
 * 2D district-view foundation.
 *
 * Creates a deterministic, browser-friendly graph/layout from WorldState.
 * This is intentionally not a 3D client and not a canvas engine yet. It is
 * the data + SVG/HTML layer needed to make the world feel spatial.
 */

const DEFAULT_LAYOUT = Object.freeze({
  apartment: { x: 18, y: 18, zone: 'residential' },
  cafe: { x: 42, y: 36, zone: 'social' },
  market: { x: 68, y: 34, zone: 'commerce' },
  workshop: { x: 58, y: 70, zone: 'industrial' },
  district_square: { x: 34, y: 64, zone: 'civic' }
});

const DEFAULT_EDGES = Object.freeze([
  ['apartment', 'cafe'],
  ['cafe', 'market'],
  ['market', 'workshop'],
  ['workshop', 'district_square'],
  ['district_square', 'cafe']
]);

export function buildDistrictView(world) {
  const locations = Object.values(world?.locations || {});
  const agents = Object.values(world?.agents || {});
  const incidents = Object.values(world?.incidents || {});

  const nodes = locations.map((loc, index) => {
    const fallback = { x: 20 + ((index * 19) % 70), y: 24 + ((index * 23) % 62), zone: 'unknown' };
    const layout = DEFAULT_LAYOUT[loc.id] || fallback;
    const agentsHere = agents
      .filter((agent) => agent.locationId === loc.id)
      .map((agent) => ({ id: agent.id, name: agent.name, role: agent.role, asset: agent.assets?.avatar || agent.assets?.portrait || null }));
    const activeIncidents = incidents
      .filter((incident) => (incident.locationId || incident.primaryLocationId || 'cafe') === loc.id)
      .map((incident) => ({ id: incident.id, title: incident.title, status: incident.status, resolutionState: incident.resolutionState || null }));
    return {
      id: loc.id,
      name: loc.name,
      zone: layout.zone,
      x: layout.x,
      y: layout.y,
      asset: loc.assets?.scene || loc.assets?.card || null,
      icon: loc.assets?.icon || null,
      agentsHere,
      activeIncidents
    };
  });

  const locationIds = new Set(nodes.map((n) => n.id));
  const edges = DEFAULT_EDGES
    .filter(([from, to]) => locationIds.has(from) && locationIds.has(to))
    .map(([from, to]) => ({ from, to }));

  return {
    kind: 'worldmind_district_view',
    version: 1,
    worldId: world?.id || 'unknown_world',
    title: `${world?.name || 'WorldMind'} — District View`,
    nodes,
    edges,
    playerLocationId: world?.agents?.player?.locationId || null,
    generatedAtTick: world?.tick ?? 0
  };
}

function nodeById(view, id) {
  return (view.nodes || []).find((n) => n.id === id);
}

export function renderDistrictSvg(view) {
  const edges = (view.edges || []).map((edge) => {
    const from = nodeById(view, edge.from);
    const to = nodeById(view, edge.to);
    if (!from || !to) return '';
    return `<line class="wm-map-edge" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`;
  }).join('');

  const nodes = (view.nodes || []).map((node) => {
    const isPlayer = node.id === view.playerLocationId;
    const incidentClass = node.activeIncidents.length ? ' wm-map-node-incident' : '';
    const playerClass = isPlayer ? ' wm-map-node-player' : '';
    return `<g class="wm-map-node${incidentClass}${playerClass}" data-location-id="${escapeXml(node.id)}">
      <circle cx="${node.x}" cy="${node.y}" r="5" />
      <text x="${node.x + 7}" y="${node.y + 2}">${escapeXml(node.name)}</text>
    </g>`;
  }).join('');

  return `<svg class="wm-district-svg" viewBox="0 0 100 100" role="img" aria-label="${escapeXml(view.title)}">
    <rect x="0" y="0" width="100" height="100" rx="4" />
    ${edges}
    ${nodes}
  </svg>`;
}

export function renderDistrictPanel(view) {
  const nodeCards = (view.nodes || []).map((node) => `<li class="wm-map-card" data-location-id="${escapeXml(node.id)}">
    <strong>${escapeXml(node.name)}</strong>
    <span>${escapeXml(node.zone)}</span>
    <small>${node.agentsHere.length} agent(s), ${node.activeIncidents.length} incident(s)</small>
  </li>`).join('');
  return `<section class="wm-section wm-district" id="wm-district-view">
    <h2>2D District View</h2>
    ${renderDistrictSvg(view)}
    <ul class="wm-map-cards">${nodeCards}</ul>
  </section>`;
}

export function validateDistrictView(view) {
  const errors = [];
  if (view?.kind !== 'worldmind_district_view') errors.push('kind must be worldmind_district_view');
  if (!Array.isArray(view?.nodes) || view.nodes.length < 4) errors.push('district view must include at least 4 nodes');
  if (!Array.isArray(view?.edges) || view.edges.length < 3) errors.push('district view must include at least 3 edges');
  for (const node of view?.nodes || []) {
    if (!node.id) errors.push('node missing id');
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) errors.push(`node ${node.id || '?'} missing numeric coordinates`);
  }
  return { ok: errors.length === 0, errors };
}

function escapeXml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
