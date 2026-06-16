/**
 * Gameplay shell view-model builder.
 *
 * Centralizes hotspot, case-board, rumor-trail, decision, and founder
 * unlock shaping so renderer logic does not hardcode gameplay data.
 *
 * Hotspot and location scene data is loaded from the authored content pack
 * (content/worldmind/content-pack-v1.json) so game designers can edit
 * scenario data without touching renderer code.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadContentPack() {
  try {
    const packPath = join(__dirname, '../../content/worldmind/content-pack-v1.json');
    return JSON.parse(readFileSync(packPath, 'utf8'));
  } catch {
    return null;
  }
}

const _pack = loadContentPack();

// Build location index keyed by location id from authored content pack.
// Falls back to hardcoded values if pack cannot be read.
const LOCATION_INDEX = (() => {
  if (_pack?.locations) {
    return Object.fromEntries(_pack.locations.map((loc) => [loc.id, loc]));
  }
  return {
    cafe: { scene: 'assets/locations/cafe.png', hotspots: [
      { id: 'cafe_delivery_crate', label: 'Delivery crate', command: 'inspect cafe', preview: 'Inspect missing delivery crate', risk: 1 },
      { id: 'cafe_stock_shelf', label: 'Stock shelf', command: 'inspect cafe', preview: 'Inspect low stock indicators', risk: 1 }
    ]},
    market: { scene: 'assets/locations/market.png', hotspots: [
      { id: 'market_rumor_corner', label: 'Rumor corner', command: 'listen_rumors market', preview: 'Hear local rumor trail', risk: 2 }
    ]},
    workshop: { scene: 'assets/locations/workshop.png', hotspots: [
      { id: 'workshop_repair_bench', label: 'Repair bench', command: 'inspect workshop', preview: 'Inspect repair flow and costs', risk: 2 },
      { id: 'courier_route_marker', label: 'Courier route marker', command: 'inspect workshop', preview: 'Inspect route bottlenecks', risk: 2 }
    ]},
    apartment: { scene: 'assets/locations/apartment.png', hotspots: [
      { id: 'registry_kiosk', label: 'Registry kiosk feed', command: 'inspect apartment', preview: 'Inspect registry pressure', risk: 2 }
    ]},
    district_square: { scene: 'assets/locations/district-square.png', hotspots: [
      { id: 'district_square_mediator_spot', label: 'Mediator spot', command: 'ask amina mediation', preview: 'Open peaceful resolution path', risk: 1 }
    ]}
  };
})();

// Major decision ids — authored in quest resolution paths.
const MAJOR_DECISIONS = (() => {
  const fromPack = _pack?.quests
    ?.flatMap((q) => q.resolutionPaths ?? [])
    .map((p) => p.id)
    .filter(Boolean);
  return Object.freeze(fromPack?.length ? fromPack : [
    'expose_nadia',
    'protect_sara_privately',
    'sell_info_registry',
    'negotiate_malik',
    'start_delivery_workflow'
  ]);
})();

export function buildGameplayShellModel(world, payload = {}) {
  const playerLocationId = world?.agents?.player?.locationId ?? null;
  const playerKnowledge = payload?.playerKnowledge ?? world?.playerKnowledge ?? {};
  const incident = Object.values(world?.incidents ?? {}).find((i) => i?.id === 'missing_delivery') ?? null;
  const founderUnlocked = Boolean(
    incident?.status === 'resolved' || incident?.resolutionState === 'founder_negotiation'
  );

  const locEntry = LOCATION_INDEX[playerLocationId] ?? {};

  const npcCards = Object.values(world?.agents ?? {})
    .filter((a) => a?.id && a.id !== 'player')
    .map((a) => {
      const rel = a.relationships?.player ?? { trust: 0, suspicion: 0, fear: 0 };
      return {
        id: a.id,
        name: a.name ?? a.id,
        role: a.role ?? '',
        locationName: world?.locations?.[a.locationId]?.name ?? a.locationId ?? '?',
        avatar: a.assets?.avatar ?? `assets/characters/${a.id}/avatar.png`,
        trust: rel.trust ?? 0,
        suspicion: rel.suspicion ?? 0,
        fear: rel.fear ?? 0,
        actions: [
          { label: 'Talk', command: `talk ${a.id}` },
          { label: 'Ask', command: `ask ${a.id} delivery` },
          { label: 'Ask Leno', command: 'ask_leno' },
          { label: 'Negotiate', command: `pay ${a.id} 5` }
        ]
      };
    });

  const knownRumorIds = playerKnowledge.knownRumorIds ?? [];
  const rumorTrail = knownRumorIds.map((id) => ({
    id,
    spreadRisk: 'medium',
    traceCommand: `trace_rumor ${id}`,
    counterCommand: `counter_rumor ${id}`
  }));

  return {
    topbar: {
      day: world?.day ?? '?',
      time: world?.time ?? '?',
      money: world?.agents?.player?.stats?.money ?? 0,
      lenoStatus: payload?.leno?.summary ? 'online' : 'standby'
    },
    location: {
      id: playerLocationId,
      scene: locEntry.scene ?? null,
      hotspots: locEntry.hotspots ?? []
    },
    npcCards,
    caseBoard: {
      evidenceCards: playerKnowledge.evidenceIds ?? [],
      rumorCards: knownRumorIds,
      unresolvedQuestions: playerKnowledge.unresolvedQuestions ?? []
    },
    rumorTrail,
    founder: {
      unlocked: founderUnlocked,
      unlockText: founderUnlocked
        ? 'Founder loop unlocked.'
        : 'Resolve The Missing Delivery to unlock founder loop.'
    },
    majorDecisions: MAJOR_DECISIONS
  };
}
