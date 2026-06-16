/**
 * Authoritative TypeScript module — `relationships.ts`.
 *
 * The body of the original `relationships.js` has been promoted
 * here. The sibling `relationships.js` is removed in v0.7.
 */

import { clamp } from './utils.ts';
import type { WorldRuntime } from './state.ts';
import type {
  AgentId,
  Relationship,
  WorldState,
  EventRecord
} from '../contracts/types.ts';

export function calculateInfluence(r: Partial<Relationship> & { trust: number; suspicion: number; respect: number; affection: number; debt?: number; fear?: number }): number {
  const trust = r.trust ?? 0;
  const suspicion = r.suspicion ?? 0;
  const respect = r.respect ?? 0;
  const affection = r.affection ?? 0;
  const debt = r.debt ?? 0;
  const fear = r.fear ?? 0;
  const raw = trust * 0.35 + respect * 0.25 + affection * 0.15 + debt * 0.2 - suspicion * 0.25 - Math.max(0, fear - 50) * 0.2;
  return clamp(raw + 50, 0, 100);
}

export function applyRelationshipImpact(
  world: WorldRuntime,
  sourceAgentId: AgentId,
  targetAgentId: AgentId,
  impact: Partial<Relationship>,
  reason: string,
  sourceEventId?: string
): EventRecord | null {
  const source = world.agents[sourceAgentId];
  if (!source || !source.relationships[targetAgentId]) return null;
  const rel = source.relationships[targetAgentId];
  const oldSnapshot = { ...rel };
  rel.trust = clamp((rel.trust ?? 0) + (impact.trust ?? 0), -100, 100);
  rel.fear = clamp((rel.fear ?? 0) + (impact.fear ?? 0), 0, 100);
  rel.respect = clamp((rel.respect ?? 0) + (impact.respect ?? 0), -100, 100);
  rel.affection = clamp((rel.affection ?? 0) + (impact.affection ?? 0), -100, 100);
  rel.suspicion = clamp((rel.suspicion ?? 0) + (impact.suspicion ?? 0), 0, 100);
  rel.debt = clamp((rel.debt ?? 0) + (impact.debt ?? 0), -100, 100);
  rel.influence = calculateInfluence(rel);
  rel.lastInteractionTick = world.tick;
  const existingTags = (rel.relationshipTags ?? []) as string[];
  rel.relationshipTags = existingTags;
  for (const tag of impact.tags ?? []) {
    if (!existingTags.includes(tag)) existingTags.push(tag);
  }
  const numericImpact = Object.values(impact).filter((v): v is number => typeof v === 'number').reduce((a, b) => a + Math.abs(b), 0);
  const event = world.addEvent({
    type: 'relationship_changed',
    locationId: source.locationId,
    actorIds: [sourceAgentId, targetAgentId],
    description: `${source.name}'s relationship toward ${world.agents[targetAgentId]?.name ?? targetAgentId} changed: ${reason}`,
    public: false,
    visibleToAgentIds: [sourceAgentId],
    causes: sourceEventId ? [sourceEventId] : [],
    consequences: [{ type: 'relationship_impact', sourceAgentId, targetAgentId, impact }],
    importance: Math.max(2, Math.min(5, Math.ceil(numericImpact / 15)))
  });
  world.relationshipEvents.push({
    id: event.id,
    tick: world.tick,
    sourceAgentId,
    targetAgentId,
    changes: impact,
    reason,
    sourceEventId: sourceEventId ?? null,
    oldSnapshot,
    newSnapshot: { ...rel }
  });
  return event;
}

export function calculateAcceptance(options: {
  agent: { relationships: Record<AgentId, Relationship>; personality: { riskTolerance: number; loyalty: number } };
  requesterId: AgentId;
  taskRisk?: number;
  reward?: number;
  taskMatchesGoal?: boolean;
  factionConflict?: boolean;
}): number {
  const { agent, requesterId, taskRisk = 1, reward = 0, taskMatchesGoal = false, factionConflict = false } = options;
  const r = agent.relationships[requesterId];
  if (!r) return -100;
  let score = 0;
  score += r.trust * 0.4;
  score += r.respect * 0.2;
  score += (r.debt ?? 0) * 0.3;
  score -= r.suspicion * 0.4;
  score -= taskRisk * 15;
  score += Math.min(reward / 10, 20);
  if (taskMatchesGoal) score += 25;
  if (factionConflict) score -= 30;
  score += agent.personality.riskTolerance * 0.05;
  score += agent.personality.loyalty * 0.05;
  return score;
}

export function rumorBeliefChance(relationshipToTarget: { trust: number; suspicion: number; fear?: number }, rumorTruthLevel: number): number {
  let chance = rumorTruthLevel;
  chance -= relationshipToTarget.trust * 0.3;
  chance += relationshipToTarget.suspicion * 0.4;
  chance += (relationshipToTarget.fear ?? 0) * 0.1;
  return clamp(chance, 0, 100);
}

export function decayRelationships(world: WorldRuntime): void {
  if (world.tick % 96 !== 0) return;
  for (const agent of Object.values(world.agents)) {
    for (const rel of Object.values(agent.relationships)) {
      rel.trust += rel.trust > 0 ? -1 : rel.trust < 0 ? 1 : 0;
      rel.fear = clamp((rel.fear ?? 0) - 2, 0, 100);
      rel.suspicion = clamp((rel.suspicion ?? 0) - 1, 0, 100);
      rel.affection += rel.affection > 0 ? -1 : rel.affection < 0 ? 1 : 0;
      const debt = rel.debt ?? 0;
      rel.debt = debt + (debt > 0 ? -0.5 : debt < 0 ? 0.5 : 0);
      rel.influence = calculateInfluence(rel);
    }
  }
}
