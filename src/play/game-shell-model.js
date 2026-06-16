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
import { CHARACTER_ASSETS, WORLD_ASSETS } from './assets.js';
import { listFounderContractOffers, founderTierLabel } from './founder-contracts.js';

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

function normalizeHotspot(h) {
  return {
    id: h.id,
    label: h.label,
    command: h.command,
    preview: h.preview ?? h.description ?? '',
    description: h.description ?? h.preview ?? '',
    risk: h.risk ?? 1,
    possibleEvidence: h.possibleEvidence ?? [],
    icon: h.icon ?? null
  };
}

function buildNpcTopics(agentId) {
  const topics = (_pack?.dialogue ?? [])
    .filter((d) => d.agentId === agentId)
    .map((d) => d.topic)
    .filter(Boolean);
  return topics.length ? topics : ['delivery'];
}

function buildNpcMood(agent, rel) {
  if ((rel.fear ?? 0) > 20) return 'afraid';
  if ((rel.suspicion ?? 0) > 25) return 'guarded';
  if ((rel.trust ?? 0) > 30) return 'trusting';
  return 'neutral';
}

function buildRumorTrail(world, playerKnowledge = {}) {
  const evidenceIds = playerKnowledge.evidenceIds ?? [];
  const rumorIndex = Object.fromEntries((_pack?.rumors ?? []).map((r) => [r.id, r]));
  const knownRumorIds = playerKnowledge.knownRumorIds ?? [];
  const hasSourceEvidence = evidenceIds.includes('rumor_source_nadia');

  return knownRumorIds.map((id) => {
    const meta = rumorIndex[id] ?? {};
    const worldRumor = world?.rumors?.[id];
    const claim = meta.claim ?? worldRumor?.claim ?? id;
    const sourceHidden = Boolean(meta.hiddenSourceEvidenceId) && !evidenceIds.includes(meta.hiddenSourceEvidenceId);
    const traced = evidenceIds.some((e) => e.includes('rumor') || e.includes('market'));
    return {
      id,
      claim,
      spreadRisk: meta.truthLevel === 'false_or_misleading' ? 'high' : 'medium',
      distortion: meta.truthLevel ?? 'unknown',
      trustConfidence: traced ? 'medium' : 'low',
      traceState: traced ? 'partial' : 'untraced',
      knownBy: worldRumor?.knownByAgentIds ?? [],
      sourceRedacted: sourceHidden,
      backfireWarning: !hasSourceEvidence,
      traceCommand: `trace_rumor ${id}`,
      counterCommand: `counter_rumor ${id}`
    };
  });
}

function buildSuspectCards(playerKnowledge = {}) {
  const evidenceIds = playerKnowledge.evidenceIds ?? [];
  const suspects = [
    { id: 'sara', label: 'Sara', role: 'café owner', locked: false },
    { id: 'malik', label: 'Malik', role: 'mechanic', locked: false },
    { id: 'nadia', label: 'Nadia', role: 'rumor source', locked: !evidenceIds.includes('rumor_source_nadia') }
  ];
  return suspects.map((s) => ({
    ...s,
    redacted: s.locked,
    inspectCommand: s.locked ? null : `ask rune ${s.id === 'nadia' ? 'nadia' : s.id}`
  }));
}

function buildCaseBoard(playerKnowledge = {}) {
  const evidenceIds = playerKnowledge.evidenceIds ?? [];
  const knownRumorIds = playerKnowledge.knownRumorIds ?? [];
  const evidenceIndex = Object.fromEntries((_pack?.evidence ?? []).map((e) => [e.id, e]));
  const rumorIndex = Object.fromEntries((_pack?.rumors ?? []).map((r) => [r.id, r]));

  const evidenceCards = evidenceIds.map((id) => {
    const meta = evidenceIndex[id] ?? {};
    return {
      id,
      label: meta.label ?? id,
      type: meta.type ?? 'evidence',
      locationId: meta.locationId ?? null,
      inspectCommand: meta.locationId ? `inspect ${meta.locationId}` : null,
      redacted: false,
      locked: false
    };
  });

  const rumorCards = knownRumorIds.map((id) => {
    const meta = rumorIndex[id] ?? {};
    const sourceHidden = Boolean(meta.hiddenSourceEvidenceId) && !evidenceIds.includes(meta.hiddenSourceEvidenceId);
    return {
      id,
      label: meta.claim ?? id,
      truthLevel: meta.truthLevel ?? 'unknown',
      sourceRedacted: sourceHidden,
      locked: false,
      traceCommand: `trace_rumor ${id}`,
      counterCommand: `counter_rumor ${id}`
    };
  });

  const visibleIds = new Set([...evidenceIds, ...knownRumorIds]);
  const links = (_pack?.caseLinks ?? [])
    .filter((link) => visibleIds.has(link.from) && visibleIds.has(link.to))
    .map((link) => ({
      from: link.from,
      to: link.to,
      relation: link.relation,
      redacted: link.relation === 'reveals_source' && !evidenceIds.includes('rumor_source_nadia')
    }));

  return {
    evidenceCards,
    rumorCards,
    links,
    suspectCards: buildSuspectCards(playerKnowledge),
    unresolvedQuestions: playerKnowledge.unresolvedQuestions ?? []
  };
}

export function buildCommandText(command, args = {}) {
  switch (command) {
    case 'pay':
      return `pay ${args.target ?? ''} ${args.amount ?? ''}`.trim();
    case 'talk':
      return args.message ? `talk ${args.target} ${args.message}` : `talk ${args.target ?? ''}`;
    case 'ask':
      return args.topic ? `ask ${args.target} ${args.topic}` : `ask ${args.target ?? ''}`;
    case 'inspect':
      return `inspect ${args.target ?? ''}`;
    case 'move':
      return `move ${args.target ?? ''}`;
    case 'listen_rumors':
      return `listen_rumors ${args.target ?? ''}`;
    case 'trace_rumor':
      return args.rumor ? `trace_rumor ${args.rumor}` : 'trace_rumor';
    case 'counter_rumor':
      return args.rumor ? `counter_rumor ${args.rumor}` : 'counter_rumor';
    default:
      return command;
  }
}

function normalizeMajorDecisionEntry(d) {
  return {
    id: d.id,
    label: d.label ?? d.id,
    command: d.command ?? d.decisionCommand ?? d.id,
    branchSuggested: d.branchSuggested !== false,
    requiredEvidence: d.requiredEvidence ?? []
  };
}

function buildMajorDecisions(playerKnowledge = {}, { includeGated = false } = {}) {
  const evidenceIds = playerKnowledge.evidenceIds ?? [];
  const fromQuest = _pack?.quests?.flatMap((q) => q.majorDecisions ?? []) ?? [];
  if (fromQuest.length) {
    return fromQuest
      .filter((d) => {
        if (includeGated) return true;
        const required = d.requiredEvidence ?? [];
        return required.every((id) => evidenceIds.includes(id));
      })
      .map(normalizeMajorDecisionEntry);
  }

  const fromPaths = _pack?.quests
    ?.flatMap((q) => q.resolutionPaths ?? [])
    .map((p) => normalizeMajorDecisionEntry({
      id: p.id,
      label: p.label ?? p.id,
      command: p.decisionCommand ?? p.steps?.[p.steps.length - 1] ?? p.id,
      branchSuggested: true
    })) ?? [];

  if (fromPaths.length) return fromPaths;

  return [
    { id: 'expose_nadia', label: 'Expose Nadia', command: 'counter_rumor', branchSuggested: true },
    { id: 'protect_sara_privately', label: 'Protect Sara privately', command: 'talk sara', branchSuggested: true },
    { id: 'sell_info_registry', label: 'Sell info to Registry', command: 'inspect apartment', branchSuggested: true },
    { id: 'negotiate_malik', label: 'Negotiate with Malik', command: 'pay malik 15', branchSuggested: true },
    { id: 'start_delivery_workflow', label: 'Start delivery workflow', command: 'start_delivery_workflow', branchSuggested: true }
  ].map(normalizeMajorDecisionEntry);
}

function formatMajorDecisionPrompt(decision, commandText, reason) {
  return {
    id: decision.id,
    label: decision.label ?? decision.id,
    command: commandText || decision.command,
    branchSuggested: decision.branchSuggested !== false,
    requiredEvidence: decision.requiredEvidence ?? [],
    reason: reason ?? decision.reason ?? 'authored_decision'
  };
}

function findAuthoredMajorDecision(commandText, playerKnowledge, { includeGated = false } = {}) {
  const normalized = String(commandText ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return buildMajorDecisions(playerKnowledge, { includeGated }).find((d) => {
    const cmd = String(d.command ?? '').trim().toLowerCase();
    return cmd && normalized === cmd;
  }) ?? null;
}

function detectConsequentialPayDecision(commandText, playerKnowledge) {
  const normalized = String(commandText ?? '').trim().toLowerCase();
  const payMatch = normalized.match(/^pay\s+(\S+)\s+(\d+(?:\.\d+)?)$/);
  if (!payMatch) return null;
  const amount = Number(payMatch[2]);
  if (!Number.isFinite(amount) || amount < 15) return null;

  const authored = findAuthoredMajorDecision(commandText, playerKnowledge)
    ?? buildMajorDecisions(playerKnowledge, { includeGated: true }).find((d) => {
      const cmd = String(d.command ?? '').trim().toLowerCase();
      return cmd.startsWith('pay ') && Number(cmd.split(/\s+/).pop()) >= 15;
    })
    ?? normalizeMajorDecisionEntry({
      id: 'major_payment',
      label: 'Major payment',
      command: commandText,
      branchSuggested: true
    });

  return formatMajorDecisionPrompt(authored, commandText, 'pay_threshold');
}

function detectConsequentialCounterRumorDecision(commandText, playerKnowledge) {
  const normalized = String(commandText ?? '').trim().toLowerCase();
  if (!normalized.startsWith('counter_rumor')) return null;

  const exact = findAuthoredMajorDecision(commandText, playerKnowledge);
  if (exact) return formatMajorDecisionPrompt(exact, commandText, 'counter_rumor');

  const gated = buildMajorDecisions(playerKnowledge, { includeGated: true }).find((d) => {
    const cmd = String(d.command ?? '').trim().toLowerCase();
    return cmd === 'counter_rumor' || cmd.startsWith('counter_rumor ');
  });
  if (gated) return formatMajorDecisionPrompt(gated, commandText, 'counter_rumor');

  return formatMajorDecisionPrompt(
    normalizeMajorDecisionEntry({
      id: 'counter_rumor',
      label: 'Counter rumor',
      command: commandText,
      branchSuggested: true
    }),
    commandText,
    'counter_rumor'
  );
}

function detectMajorDecisionFromConsequence(consequence, commandText) {
  const unlocks = consequence?.unlocks ?? [];
  const tierUnlock = unlocks.find((u) => String(u).startsWith('founder_tier_'));
  if (!tierUnlock) return null;
  const tier = Number(String(tierUnlock).replace('founder_tier_', ''));
  return formatMajorDecisionPrompt(
    normalizeMajorDecisionEntry({
      id: 'founder_tier_unlock',
      label: `Founder tier unlocked: ${founderTierLabel(tier)}`,
      command: commandText,
      branchSuggested: true
    }),
    commandText,
    'founder_tier_unlock'
  );
}

export function detectMajorDecisionFromCommand(commandText, playerKnowledge = {}) {
  const normalized = String(commandText ?? '').trim().toLowerCase();
  if (!normalized) return null;

  const exact = findAuthoredMajorDecision(commandText, playerKnowledge);
  if (exact) return formatMajorDecisionPrompt(exact, commandText, 'authored_decision');

  return detectConsequentialPayDecision(commandText, playerKnowledge)
    ?? detectConsequentialCounterRumorDecision(commandText, playerKnowledge);
}

/**
 * Resolve majorDecisionPrompt from command text and/or post-command consequences.
 */
export function resolveMajorDecisionPrompt({
  commandText,
  command,
  args = {},
  playerKnowledge = {},
  consequence = null
} = {}) {
  const text = commandText ?? buildCommandText(command, args);
  const fromCommand = detectMajorDecisionFromCommand(text, playerKnowledge);
  if (fromCommand?.branchSuggested) return fromCommand;
  return detectMajorDecisionFromConsequence(consequence, text);
}

export function buildGameplayShellModel(world, payload = {}) {
  const playerLocationId = world?.agents?.player?.locationId ?? null;
  const playerKnowledge = payload?.playerKnowledge ?? world?.playerKnowledge ?? {};
  const incident = Object.values(world?.incidents ?? {}).find((i) => i?.id === 'missing_delivery') ?? null;
  const founderUnlocked = Boolean(
    incident?.status === 'resolved' || incident?.resolutionState === 'founder_negotiation'
  );

  const locEntry = LOCATION_INDEX[playerLocationId] ?? {};
  const player = world?.agents?.player;
  const topicsByAgent = Object.fromEntries(
    (_pack?.characters ?? []).map((c) => [c.id, buildNpcTopics(c.id)])
  );

  const npcCards = Object.values(world?.agents ?? {})
    .filter((a) => a?.id && a.id !== 'player')
    .map((a) => {
      const rel = a.relationships?.player ?? { trust: 0, suspicion: 0, fear: 0 };
      const assets = CHARACTER_ASSETS[a.id] ?? {};
      const topics = topicsByAgent[a.id] ?? buildNpcTopics(a.id);
      const primaryTopic = topics[0] ?? 'delivery';
      return {
        id: a.id,
        name: a.name ?? a.id,
        role: a.role ?? '',
        mood: buildNpcMood(a, rel),
        locationName: world?.locations?.[a.locationId]?.name ?? a.locationId ?? '?',
        avatar: a.assets?.avatar ?? assets.avatar ?? `assets/characters/${a.id}/avatar.png`,
        portrait: a.assets?.portrait ?? assets.portrait ?? `assets/characters/${a.id}/portrait.png`,
        topics,
        trust: rel.trust ?? 0,
        suspicion: rel.suspicion ?? 0,
        fear: rel.fear ?? 0,
        actions: [
          { label: 'Talk', command: `talk ${a.id}` },
          { label: `Ask: ${primaryTopic}`, command: `ask ${a.id} ${primaryTopic}` },
          { label: 'Offer help', command: `talk ${a.id}` },
          { label: 'Negotiate', command: `pay ${a.id} 5` },
          { label: 'Ask Leno', command: 'ask_leno' },
          { label: 'Profile', command: `inspect ${a.locationId ?? 'cafe'}` }
        ]
      };
    });

  const rumorTrail = buildRumorTrail(world, playerKnowledge);

  return {
    topbar: {
      worldName: world?.name ?? 'New Aarhus District',
      day: world?.day ?? '?',
      time: world?.time ?? '?',
      money: player?.stats?.money ?? 0,
      reputation: player?.stats?.reputation ?? 0,
      energy: player?.stats?.energy ?? 0,
      branchName: world?.branchName ?? 'main',
      lenoStatus: payload?.leno?.summary ? 'online' : 'standby'
    },
    location: {
      id: playerLocationId,
      name: world?.locations?.[playerLocationId]?.name ?? playerLocationId,
      mood: locEntry.mood ?? '',
      scene: locEntry.scene ?? null,
      hotspots: (locEntry.hotspots ?? []).map(normalizeHotspot)
    },
    npcCards,
    caseBoard: buildCaseBoard(playerKnowledge),
    rumorTrail,
    founder: {
      unlocked: founderUnlocked,
      baseLevel: world?.founder?.baseLevel ?? 0,
      tierLabel: founderTierLabel(world?.founder?.baseLevel ?? 0),
      contractsCompleted: world?.founder?.contractsCompleted ?? 0,
      activeContract: world?.founder?.activeContract ?? null,
      contracts: listFounderContractOffers(world?.founder ?? {}),
      reputation: world?.founder?.reputation ?? player?.stats?.reputation ?? 0,
      money: player?.stats?.money ?? 0,
      unlockText: founderUnlocked
        ? 'Founder loop unlocked.'
        : 'Resolve The Missing Delivery to unlock founder loop.'
    },
    majorDecisions: buildMajorDecisions(playerKnowledge),
    assets: {
      lenoOverlay: WORLD_ASSETS.ui.lenoOverlay,
      evidenceIcon: WORLD_ASSETS.ui.evidenceCard,
      rumorIcon: WORLD_ASSETS.ui.rumorCard,
      incidentIcon: WORLD_ASSETS.ui.incidentAlert
    }
  };
}
