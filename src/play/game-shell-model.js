/**
 * Gameplay shell view-model builder.
 *
 * Centralizes hotspot, case-board, rumor-trail, decision, and founder
 * unlock shaping so renderer logic does not hardcode gameplay data.
 */

const LOCATION_SCENES = Object.freeze({
  cafe: 'assets/locations/cafe.png',
  market: 'assets/locations/market.png',
  workshop: 'assets/locations/workshop.png',
  apartment: 'assets/locations/apartment.png',
  district_square: 'assets/locations/district-square.png'
});

const HOTSPOT_TEMPLATES = Object.freeze({
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
});

const MAJOR_DECISIONS = Object.freeze([
  'expose_nadia',
  'protect_sara_privately',
  'sell_info_registry',
  'negotiate_malik',
  'start_delivery_workflow'
]);

export function buildGameplayShellModel(world, payload = {}) {
  const playerLocationId = world?.agents?.player?.locationId ?? null;
  const playerKnowledge = payload?.playerKnowledge ?? world?.playerKnowledge ?? {};
  const incident = Object.values(world?.incidents ?? {}).find((i) => i?.id === 'missing_delivery') ?? null;
  const founderUnlocked = Boolean(
    incident?.status === 'resolved' || incident?.resolutionState === 'founder_negotiation'
  );

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
      scene: LOCATION_SCENES[playerLocationId] ?? null,
      hotspots: HOTSPOT_TEMPLATES[playerLocationId] ?? []
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
