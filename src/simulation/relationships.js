import { clamp } from './utils.js';

export function calculateInfluence(r) {
  const raw = r.trust * 0.35 + r.respect * 0.25 + r.affection * 0.15 + r.debt * 0.2 - r.suspicion * 0.25 - Math.max(0, r.fear - 50) * 0.2;
  return clamp(raw + 50, 0, 100);
}

export function applyRelationshipImpact(world, sourceAgentId, targetAgentId, impact, reason, sourceEventId) {
  const source = world.agents[sourceAgentId];
  if (!source || !source.relationships[targetAgentId]) return null;
  const rel = source.relationships[targetAgentId];
  const oldSnapshot = { ...rel };
  rel.trust = clamp(rel.trust + (impact.trust ?? 0), -100, 100);
  rel.fear = clamp(rel.fear + (impact.fear ?? 0), 0, 100);
  rel.respect = clamp(rel.respect + (impact.respect ?? 0), -100, 100);
  rel.affection = clamp(rel.affection + (impact.affection ?? 0), -100, 100);
  rel.suspicion = clamp(rel.suspicion + (impact.suspicion ?? 0), 0, 100);
  rel.debt = clamp(rel.debt + (impact.debt ?? 0), -100, 100);
  rel.influence = calculateInfluence(rel);
  rel.lastInteractionTick = world.tick;
  for (const tag of impact.tags ?? []) if (!rel.relationshipTags.includes(tag)) rel.relationshipTags.push(tag);
  const numericImpact = Object.values(impact).filter(v => typeof v === 'number').reduce((a, b) => a + Math.abs(b), 0);
  const event = world.addEvent({
    type: 'relationship_changed', locationId: source.locationId, actorIds: [sourceAgentId, targetAgentId],
    description: `${source.name}'s relationship toward ${world.agents[targetAgentId]?.name ?? targetAgentId} changed: ${reason}`,
    public: false, visibleToAgentIds: [sourceAgentId], causes: sourceEventId ? [sourceEventId] : [],
    consequences: [{ type: 'relationship_impact', sourceAgentId, targetAgentId, impact }],
    importance: Math.max(2, Math.min(5, Math.ceil(numericImpact / 15)))
  });
  world.relationshipEvents.push({ id: event.id, tick: world.tick, sourceAgentId, targetAgentId, changes: impact, reason, sourceEventId, oldSnapshot, newSnapshot: { ...rel } });
  return event;
}

export function calculateAcceptance({ agent, requesterId, taskRisk = 1, reward = 0, taskMatchesGoal = false, factionConflict = false }) {
  const r = agent.relationships[requesterId];
  if (!r) return -100;
  let score = 0;
  score += r.trust * 0.4;
  score += r.respect * 0.2;
  score += r.debt * 0.3;
  score -= r.suspicion * 0.4;
  score -= taskRisk * 15;
  score += Math.min(reward / 10, 20);
  if (taskMatchesGoal) score += 25;
  if (factionConflict) score -= 30;
  score += agent.personality.riskTolerance * 0.05;
  score += agent.personality.loyalty * 0.05;
  return score;
}

export function rumorBeliefChance(relationshipToTarget, rumorTruthLevel) {
  let chance = rumorTruthLevel;
  chance -= relationshipToTarget.trust * 0.3;
  chance += relationshipToTarget.suspicion * 0.4;
  chance += relationshipToTarget.fear * 0.1;
  return clamp(chance, 0, 100);
}

export function decayRelationships(world) {
  if (world.tick % 96 !== 0) return;
  for (const agent of Object.values(world.agents)) {
    for (const rel of Object.values(agent.relationships)) {
      rel.trust += rel.trust > 0 ? -1 : rel.trust < 0 ? 1 : 0;
      rel.fear = clamp(rel.fear - 2, 0, 100);
      rel.suspicion = clamp(rel.suspicion - 1, 0, 100);
      rel.affection += rel.affection > 0 ? -1 : rel.affection < 0 ? 1 : 0;
      rel.debt += rel.debt > 0 ? -0.5 : rel.debt < 0 ? 0.5 : 0;
      rel.influence = calculateInfluence(rel);
    }
  }
}
