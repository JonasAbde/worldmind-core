/**
 * Authoritative TypeScript module — `rumors.ts`.
 */

import { clamp, unique } from './utils.ts';
import type { WorldRuntime } from './state.ts';
import { rumorBeliefChance, applyRelationshipImpact } from './relationships.ts';
import type {
  AgentId,
  EventRecord,
  RumorRecord,
  WorldState
} from '../contracts/types.ts';

interface CreateRumorOptions {
  claim: string;
  sourceAgentId: AgentId;
  targetAgentIds?: AgentId[];
  truthLevel?: number;
  emotionalTone?: string;
  spreadRate?: number;
  originEventId?: string;
}

export function syncRumorRuntimeFields(rumor: RumorRecord): void {
  const spread = clamp(rumor.spreadRate ?? 30, 0, 100);
  const distortion = clamp(rumor.distortionLevel ?? 0, 0, 100);
  rumor.spreadRate = spread;
  rumor.spreadRisk = clamp(rumor.spreadRisk ?? spread, 0, 100);
  rumor.distortionLevel = distortion;
  rumor.sourceConfidence = clamp(rumor.sourceConfidence ?? rumor.truthLevel, 0, 100);
  rumor.knownBy = [...(rumor.knownByAgentIds ?? [])];
}

export function createRumor(world: WorldRuntime, options: CreateRumorOptions): RumorRecord {
  const { claim, sourceAgentId, targetAgentIds = [], truthLevel = 50, emotionalTone = 'suspicion', spreadRate = 30, originEventId } = options;
  const rumor: RumorRecord = {
    id: world.nextId('rumor'),
    claim,
    sourceAgentId,
    targetAgentIds,
    truthLevel: clamp(truthLevel, 0, 100),
    emotionalTone,
    spreadRate: clamp(spreadRate, 0, 100),
    knownByAgentIds: sourceAgentId ? [sourceAgentId] : [],
    originEventId,
    createdAtTick: world.tick,
    distortionLevel: 0,
    active: true
  };
  syncRumorRuntimeFields(rumor);
  world.rumors[rumor.id] = rumor;
  return rumor;
}

export function spreadRumorTo(world: WorldRuntime, rumorId: string, listenerAgentId: AgentId, sourceAgentId: AgentId): EventRecord | null {
  const rumor = world.rumors[rumorId];
  if (!rumor || !world.agents[listenerAgentId]) return null;
  if (rumor.knownByAgentIds.includes(listenerAgentId)) return null;
  const target = (rumor.targetAgentIds ?? [])[0];
  const relToTarget = target ? world.agents[listenerAgentId].relationships[target] : undefined;
  const belief = relToTarget ? rumorBeliefChance(relToTarget, rumor.truthLevel) : rumor.truthLevel;
  rumor.knownByAgentIds.push(listenerAgentId);
  syncRumorRuntimeFields(rumor);
  if (target && belief > 50) {
    applyRelationshipImpact(world, listenerAgentId, target, { suspicion: 12, trust: -8 }, `believed rumor: ${rumor.claim}`, rumor.originEventId);
  }
  return world.addEvent({
    type: 'rumor_spread',
    locationId: world.agents[listenerAgentId].locationId,
    actorIds: unique([sourceAgentId, listenerAgentId].filter((x): x is AgentId => Boolean(x))),
    description: `${world.agents[listenerAgentId].name} heard rumor: ${rumor.claim}`,
    public: false,
    visibleToAgentIds: [listenerAgentId, sourceAgentId].filter((x): x is AgentId => Boolean(x)),
    causes: rumor.originEventId ? [rumor.originEventId] : [],
    consequences: [{ type: 'rumor_known', rumorId, listenerAgentId, belief }],
    importance: belief > 60 ? 4 : 3,
    payload: { rumorId, claim: rumor.claim, emotionalTone: rumor.emotionalTone, belief }
  });
}

export function propagateRumors(world: WorldRuntime): EventRecord[] {
  const events: EventRecord[] = [];
  for (const rumor of Object.values(world.rumors)) {
    if (!rumor.active) continue;
    if (world.tick - (rumor.createdAtTick ?? 0) > 96 * 4) rumor.spreadRate = Math.max(5, (rumor.spreadRate ?? 0) - 5);
    for (const knownAgentId of [...rumor.knownByAgentIds]) {
      const source = world.agents[knownAgentId];
      if (!source) continue;
      const sameLocationAgents = Object.values(world.agents).filter((a) => a.locationId === source.locationId && a.id !== knownAgentId);
      for (const listener of sameLocationAgents) {
        if (rumor.knownByAgentIds.includes(listener.id)) continue;
        const chance = (rumor.spreadRate ?? 0) + ((source.personality?.warmth ?? 50) - 50) * 0.1 + ((source.personality?.ambition ?? 50) - 50) * 0.1;
        if (world.rng() * 100 < chance * 0.10) {
          const event = spreadRumorTo(world, rumor.id, listener.id, knownAgentId);
          if (event) events.push(event);
        }
      }
    }
  }
  return events;
}

interface CounterRumorOptions {
  counterClaim: string;
  evidenceStrength?: number;
  actorId?: AgentId;
}

export function counterRumor(world: WorldRuntime, rumorId: string, options: CounterRumorOptions): EventRecord {
  const { counterClaim, evidenceStrength = 0, actorId = 'player' } = options;
  const rumor = world.rumors[rumorId];
  if (!rumor) throw new Error(`Rumor not found: ${rumorId}`);
  const reduction = 10 + evidenceStrength * 0.5;
  rumor.truthLevel = clamp(rumor.truthLevel - reduction, 0, 100);
  rumor.spreadRate = clamp((rumor.spreadRate ?? 0) - reduction * 0.5, 0, 100);
  syncRumorRuntimeFields(rumor);
  return world.addEvent({
    type: 'counter_rumor',
    locationId: world.agents[actorId]?.locationId ?? 'market',
    actorIds: [actorId],
    description: `Counter-rumor introduced: ${counterClaim}`,
    public: false,
    visibleToAgentIds: Object.keys(world.agents).filter((id) => rumor.knownByAgentIds.includes(id)),
    causes: [rumor.originEventId].filter((x): x is string => Boolean(x)),
    consequences: [{ type: 'rumor_weakened', rumorId, reduction }],
    importance: evidenceStrength > 50 ? 4 : 3,
    payload: { rumorId, counterClaim, evidenceStrength, reduction, spreadRate: rumor.spreadRate, truthLevel: rumor.truthLevel }
  });
}

interface TraceRumorOptions {
  actorId?: AgentId;
  evidenceStrength?: number;
}

export function traceRumor(world: WorldRuntime, rumorId: string, options: TraceRumorOptions = {}): EventRecord {
  const { actorId = 'player', evidenceStrength = 0 } = options;
  const rumor = world.rumors[rumorId];
  if (!rumor) throw new Error(`Rumor not found: ${rumorId}`);
  const canRevealSource = evidenceStrength >= 75 || world.playerKnowledge.evidenceIds.includes('rune_statement_nadia_workshop');
  const description = canRevealSource
    ? `Trace found probable rumor source: ${world.agents[rumor.sourceAgentId]?.name ?? rumor.sourceAgentId}.`
    : 'Trace found weak pattern but not enough evidence to identify a source.';
  if (canRevealSource && !world.playerKnowledge.evidenceIds.includes(`rumor_source_${rumor.sourceAgentId}`)) {
    world.playerKnowledge.evidenceIds.push(`rumor_source_${rumor.sourceAgentId}`);
  }
  return world.addEvent({
    type: 'rumor_traced',
    locationId: world.agents[actorId]?.locationId ?? 'market',
    actorIds: [actorId],
    description,
    public: false,
    visibleToAgentIds: [actorId],
    causes: [rumor.originEventId].filter((x): x is string => Boolean(x)),
    consequences: [{ type: 'rumor_trace', rumorId, sourceRevealed: canRevealSource }],
    importance: canRevealSource ? 4 : 3,
    payload: { rumorId, sourceRevealed: canRevealSource }
  });
}
