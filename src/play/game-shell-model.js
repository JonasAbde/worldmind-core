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

import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { CHARACTER_ASSETS, WORLD_ASSETS } from './assets.js';
import {
  listFounderContractOffers,
  founderTierLabel,
  founderBaseLevelForContracts,
  FOUNDER_CONTRACT_CATALOG
} from './founder-contracts.js';
import { buildQuestProgressView } from './quest-progress.js';
import {
  getCapabilities,
  getNextUnlock,
  summarizeProgression
} from './progression.js';
import { getContentPack, hotspotCommandText } from './content-pack-runtime.js';
import { lenoSuggestActions } from '../simulation/leno.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const _pack = getContentPack();

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
    command: hotspotCommandText(h),
    preview: h.preview ?? h.description ?? '',
    description: h.description ?? h.preview ?? '',
    risk: h.risk ?? 1,
    possibleEvidence: h.possibleEvidence ?? [],
    icon: h.icon ?? null,
    inspectFocus: h.inspectFocus ?? h.id
  };
}

/** Categorized aftermath panel from resolveCommand consequence envelope. */
export function buildConsequenceBeat(consequence) {
  if (!consequence || typeof consequence !== 'object') return null;
  const bullets = [];

  for (const id of consequence.evidenceDelta ?? []) {
    bullets.push({ category: 'evidence', text: `Evidence discovered: ${id}` });
  }
  if (consequence.moneyDelta) {
    bullets.push({ category: 'economy', text: `Money ${consequence.moneyDelta > 0 ? '+' : ''}${consequence.moneyDelta}` });
  }
  if (consequence.reputationDelta) {
    bullets.push({ category: 'reputation', text: `Reputation ${consequence.reputationDelta > 0 ? '+' : ''}${consequence.reputationDelta}` });
  }
  if (consequence.energyDelta) {
    bullets.push({ category: 'energy', text: `Energy ${consequence.energyDelta}` });
  }
  for (const r of consequence.rumorDelta ?? []) {
    bullets.push({
      category: 'rumors',
      text: `Rumor truth ${r.before ?? '?'} → ${r.after ?? '?'}${r.backfire ? ' (backfire)' : ''}`
    });
  }
  for (const ch of consequence.relationshipDelta?.changes ?? consequence.relationships ?? []) {
    if (ch.trustDelta) bullets.push({ category: 'relationships', text: `Trust with ${ch.targetId ?? ch.agentId}: ${ch.trustDelta > 0 ? '+' : ''}${ch.trustDelta}` });
  }
  for (const ch of consequence.incidentDelta ?? []) {
    bullets.push({ category: 'incident', text: `Incident ${ch.incidentId}: ${ch.beforeStatus} → ${ch.afterStatus}` });
  }
  for (const u of consequence.unlocks ?? []) {
    bullets.push({ category: 'unlocks', text: `Unlocked: ${u}` });
  }
  if (consequence.founderDelta?.contractsCompleted) {
    bullets.push({ category: 'founder', text: `Contracts completed +${consequence.founderDelta.contractsCompleted}` });
  }
  if (consequence.lastEvent?.description) {
    bullets.push({ category: 'event', text: consequence.lastEvent.description });
  }

  if (!bullets.length) return null;
  const categories = [...new Set(bullets.map((b) => b.category))];
  return {
    categories,
    bullets,
    summary: bullets.map((b) => b.text).join(' · ')
  };
}

function buildNpcTopics(agentId, rel = {}) {
  const trust = rel.trust ?? 0;
  const topics = (_pack?.dialogue ?? [])
    .filter((d) => d.agentId === agentId)
    .filter((d) => trust >= (d.requiredRelationship?.trust ?? 0))
    .map((d) => d.topic)
    .filter(Boolean);
  return topics.length ? topics : ['delivery'];
}

function buildNpcLockedTopics(agentId, rel = {}) {
  const trust = rel.trust ?? 0;
  return (_pack?.dialogue ?? [])
    .filter((d) => d.agentId === agentId)
    .filter((d) => trust < (d.requiredRelationship?.trust ?? 0))
    .map((d) => ({
      topic: d.topic,
      minTrust: d.requiredRelationship?.trust ?? 0
    }));
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
      truthLevel: meta.truthLevel ?? 'unknown',
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

const FOUNDER_TIER_MILESTONES = [
  { level: 0, label: 'Starter runner', contractsRequired: 0 },
  { level: 1, label: 'District courier', contractsRequired: 3 },
  { level: 2, label: 'Established operator', contractsRequired: 6 }
];

function normalizeActiveFounderContract(active) {
  if (!active || typeof active !== 'object') return null;
  return {
    id: active.id ?? null,
    templateId: active.templateId ?? active.id ?? null,
    label: active.label ?? active.templateId ?? active.id ?? 'Active contract',
    customer: active.customer ?? null,
    payout: active.payout ?? null,
    upfrontCost: active.upfrontCost ?? 0,
    reputationGain: active.reputationGain ?? null,
    status: active.status ?? 'active',
    deliveryStage: active.status === 'active' ? 'ready_to_deliver' : 'idle'
  };
}

function buildFounderDeliveryProgress(founder = {}) {
  const contractsCompleted = founder.contractsCompleted ?? 0;
  const baseLevel = founder.baseLevel ?? founderBaseLevelForContracts(contractsCompleted);
  const active = normalizeActiveFounderContract(founder.activeContract);
  const nextTier = FOUNDER_TIER_MILESTONES.find((t) => t.level === baseLevel + 1) ?? null;
  const contractsToNextTier = nextTier
    ? Math.max(0, nextTier.contractsRequired - contractsCompleted)
    : 0;

  const tierMilestones = FOUNDER_TIER_MILESTONES.map((tier) => ({
    id: `tier_${tier.level}`,
    label: tier.label,
    level: tier.level,
    contractsRequired: tier.contractsRequired,
    reached: baseLevel >= tier.level,
    current: baseLevel === tier.level
  }));

  const workflowSteps = active
    ? [
        { id: 'accept', label: 'Contract accepted', done: true },
        { id: 'upfront', label: 'Upfront paid', done: true },
        { id: 'deliver', label: 'Run delivery', done: false, current: true },
        { id: 'payout', label: 'Collect payout', done: false }
      ]
    : [];

  return {
    contractsCompleted,
    baseLevel,
    nextTierLabel: nextTier?.label ?? null,
    contractsToNextTier,
    hasActiveDelivery: Boolean(active),
    activeTemplateId: active?.templateId ?? null,
    tierMilestones,
    workflowSteps
  };
}

function buildSuspectCards(playerKnowledge = {}) {
  const evidenceIds = playerKnowledge.evidenceIds ?? [];
  const fromPack = _pack?.suspectCards ?? [];
  if (fromPack.length) {
    return fromPack.map((entry) => {
      const required = entry.requiredEvidence ?? [];
      const locked = required.length > 0 && !required.every((id) => evidenceIds.includes(id));
      const characterId = entry.characterId ?? entry.id;
      return {
        id: characterId,
        label: entry.label ?? characterId,
        role: entry.role ?? '',
        locked,
        redacted: locked,
        inspectCommand: locked ? null : (characterId === 'nadia' ? 'ask rune nadia' : `talk ${characterId}`)
      };
    });
  }

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
      return args.focus ? `inspect ${args.target ?? ''} ${args.focus}`.trim() : `inspect ${args.target ?? ''}`;
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

function buildMajorDecisions(playerKnowledge = {}, { questProgress = null, includeGated = false } = {}) {
  const evidenceIds = playerKnowledge.evidenceIds ?? [];
  const resolvedPathId = questProgress?.resolvedPathId ?? null;
  const pathIds = new Set((_pack?.quests ?? []).flatMap((q) => (q.resolutionPaths ?? []).map((p) => p.id)));
  const fromQuest = _pack?.quests?.flatMap((q) => q.majorDecisions ?? []) ?? [];
  if (fromQuest.length) {
    return fromQuest
      .filter((d) => {
        if (resolvedPathId && pathIds.has(d.id)) return false;
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

function findAuthoredMajorDecision(commandText, playerKnowledge, { questProgress = null, includeGated = false } = {}) {
  const normalized = String(commandText ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return buildMajorDecisions(playerKnowledge, { questProgress, includeGated }).find((d) => {
    const cmd = String(d.command ?? '').trim().toLowerCase();
    return cmd && normalized === cmd;
  }) ?? null;
}

function detectConsequentialPayDecision(commandText, playerKnowledge, questProgress = null) {
  const normalized = String(commandText ?? '').trim().toLowerCase();
  const payMatch = normalized.match(/^pay\s+(\S+)\s+(\d+(?:\.\d+)?)$/);
  if (!payMatch) return null;
  const amount = Number(payMatch[2]);
  if (!Number.isFinite(amount) || amount < 15) return null;

  const authored = findAuthoredMajorDecision(commandText, playerKnowledge, { questProgress })
    ?? buildMajorDecisions(playerKnowledge, { questProgress, includeGated: true }).find((d) => {
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

function detectConsequentialCounterRumorDecision(commandText, playerKnowledge, questProgress = null) {
  const normalized = String(commandText ?? '').trim().toLowerCase();
  if (!normalized.startsWith('counter_rumor')) return null;

  const exact = findAuthoredMajorDecision(commandText, playerKnowledge, { questProgress });
  if (exact) return formatMajorDecisionPrompt(exact, commandText, 'counter_rumor');

  const gated = buildMajorDecisions(playerKnowledge, { questProgress, includeGated: true }).find((d) => {
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

export function detectMajorDecisionFromCommand(commandText, playerKnowledge = {}, questProgress = null) {
  const normalized = String(commandText ?? '').trim().toLowerCase();
  if (!normalized) return null;

  const exact = findAuthoredMajorDecision(commandText, playerKnowledge, { questProgress });
  if (exact) return formatMajorDecisionPrompt(exact, commandText, 'authored_decision');

  return detectConsequentialPayDecision(commandText, playerKnowledge, questProgress)
    ?? detectConsequentialCounterRumorDecision(commandText, playerKnowledge, questProgress);
}

/**
 * Resolve majorDecisionPrompt from command text and/or post-command consequences.
 */
export function resolveMajorDecisionPrompt({
  commandText,
  command,
  args = {},
  playerKnowledge = {},
  questProgress = null,
  consequence = null
} = {}) {
  const text = commandText ?? buildCommandText(command, args);
  const fromCommand = detectMajorDecisionFromCommand(text, playerKnowledge, questProgress);
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
    (_pack?.characters ?? []).map((c) => {
      const rel = world?.agents?.[c.id]?.relationships?.player ?? {};
      return [c.id, buildNpcTopics(c.id, rel)];
    })
  );

  const npcCards = Object.values(world?.agents ?? {})
    .filter((a) => a?.id && a.id !== 'player')
    .map((a) => {
      const rel = a.relationships?.player ?? { trust: 0, suspicion: 0, fear: 0 };
      const assets = CHARACTER_ASSETS[a.id] ?? {};
      const topics = topicsByAgent[a.id] ?? buildNpcTopics(a.id, rel);
      const lockedTopics = buildNpcLockedTopics(a.id, rel);
      const primaryTopic = topics[0] ?? 'delivery';
      const atLocation = a.locationId === playerLocationId;
      return {
        id: a.id,
        name: a.name ?? a.id,
        role: a.role ?? '',
        mood: buildNpcMood(a, rel),
        locationId: a.locationId ?? null,
        locationName: world?.locations?.[a.locationId]?.name ?? a.locationId ?? '?',
        atPlayerLocation: atLocation,
        avatar: a.assets?.avatar ?? assets.avatar ?? `assets/characters/${a.id}/avatar.png`,
        portrait: a.assets?.portrait ?? assets.portrait ?? `assets/characters/${a.id}/portrait.png`,
        topics,
        lockedTopics,
        trust: rel.trust ?? 0,
        suspicion: rel.suspicion ?? 0,
        fear: rel.fear ?? 0,
        actions: [
          { label: 'Talk', command: `talk ${a.id}` },
          ...(topics.length
            ? [{ label: `Ask: ${primaryTopic}`, command: `ask ${a.id} ${primaryTopic}` }]
            : []),
          { label: 'Offer help', command: `talk ${a.id}` },
          { label: 'Negotiate', command: `pay ${a.id} 5` },
          { label: 'Ask Leno', command: 'ask_leno' },
          { label: 'Profile', command: `inspect ${a.locationId ?? 'cafe'}` }
        ]
      };
    });

  const rumorTrail = buildRumorTrail(world, playerKnowledge);
  const questProgress = buildQuestProgressView(world);
  const lenoSuggestions = (payload?.leno?.suggestions
    ?? (world?.playerKnowledge
      ? lenoSuggestActions(world, { incidentId: 'missing_delivery' })
      : []))
    .slice(0, 3);

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
    questProgress,
    leno: {
      summary: payload?.leno?.summary ?? null,
      suggestions: lenoSuggestions
    },
    founder: (() => {
      const founderState = world?.founder ?? {};
      const baseLevel = founderState.baseLevel ?? founderBaseLevelForContracts(founderState.contractsCompleted ?? 0);
      const contracts = listFounderContractOffers(founderState);
      const deliveryProgress = buildFounderDeliveryProgress({ ...founderState, baseLevel });
      const hasDeliveryContracts = contracts.some((c) => c.isDelivery);
      return {
        unlocked: founderUnlocked,
        baseLevel,
        tierLabel: founderTierLabel(baseLevel),
        contractsCompleted: founderState.contractsCompleted ?? 0,
        activeContract: normalizeActiveFounderContract(founderState.activeContract),
        contracts,
        reputation: founderState.reputation ?? player?.stats?.reputation ?? 0,
        money: player?.stats?.money ?? 0,
        unlockText: founderUnlocked
          ? 'Founder loop unlocked.'
          : 'Resolve The Missing Delivery to unlock founder loop.',
        deliveryProgress: hasDeliveryContracts ? deliveryProgress : null,
        catalogSize: FOUNDER_CONTRACT_CATALOG.length
      };
    })(),
    majorDecisions: buildMajorDecisions(playerKnowledge, { questProgress }),
    progression: {
      ...summarizeProgression(world?.progression),
      nextUnlock: getNextUnlock(world?.progression),
      capabilities: getCapabilities(world?.progression)
    },
    assets: {
      lenoOverlay: WORLD_ASSETS.ui.lenoOverlay,
      evidenceIcon: WORLD_ASSETS.ui.evidenceCard,
      rumorIcon: WORLD_ASSETS.ui.rumorCard,
      incidentIcon: WORLD_ASSETS.ui.incidentAlert,
      commandButton: WORLD_ASSETS.ui.commandButton,
      founderAction: WORLD_ASSETS.ui.commandButton
    }
  };
}
