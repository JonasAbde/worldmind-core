/**
 * Authoritative TypeScript module — `memory.ts`.
 */

import { MEMORY_CREATE_THRESHOLD } from './constants.js';
import type { WorldRuntime } from './state.ts';
import { applyRelationshipImpact } from './relationships.ts';
import type {
  AgentId,
  EventRecord,
  MemoryRecord,
  WorldState
} from '../contracts/types.ts';

interface MemoryCandidate {
  agentId: AgentId;
  type?: string;
  content: string;
  sourceEventId?: string;
  sourceAgentId?: AgentId;
  relatedAgentIds?: AgentId[];
  relatedLocationIds?: string[];
  relatedItemIds?: string[];
  emotionalWeight?: number;
  confidence?: number;
  importance?: number;
  sentiment?: string;
  visibility?: 'public' | 'private' | 'secret' | 'faction' | 'agent';
  decayRate?: number;
  locked?: boolean;
  relationshipImpactScore?: number;
  directInvolvement?: boolean;
  relationshipImpact?: Record<string, number>;
}

export function scoreMemoryCandidate(candidate: MemoryCandidate): number {
  let score = (candidate.importance ?? 3) * 20;
  score += (candidate.emotionalWeight ?? 30) * 0.5;
  score += candidate.relationshipImpactScore ?? 0;
  score += candidate.directInvolvement ? 15 : 0;
  score += candidate.visibility === 'secret' ? 15 : 0;
  return score;
}

export function createMemory(world: WorldRuntime, candidate: MemoryCandidate): MemoryRecord {
  const memory: MemoryRecord = {
    id: world.nextId('mem'),
    agentId: candidate.agentId,
    type: candidate.type ?? 'episodic',
    content: candidate.content,
    sourceEventId: candidate.sourceEventId,
    sourceAgentId: candidate.sourceAgentId,
    relatedAgentIds: candidate.relatedAgentIds ?? [],
    relatedLocationIds: candidate.relatedLocationIds ?? [],
    relatedItemIds: candidate.relatedItemIds ?? [],
    emotionalWeight: candidate.emotionalWeight ?? 30,
    confidence: candidate.confidence ?? 80,
    importance: candidate.importance ?? 3,
    sentiment: candidate.sentiment ?? 'neutral',
    visibility: candidate.visibility ?? 'private',
    createdAtTick: world.tick,
    lastAccessedTick: undefined,
    decayRate: candidate.decayRate ?? calculateDecayRate(candidate),
    locked: Boolean(candidate.locked),
    day: world.day,
    time: world.time,
    tick: world.tick,
    public: candidate.visibility === 'public'
  };
  world.memories[memory.id] = memory;
  world.agents[memory.agentId]?.memoryIds.push(memory.id);
  return memory;
}

export function calculateDecayRate(memory: { locked?: boolean; importance?: number; emotionalWeight?: number }): number {
  if (memory.locked) return 0;
  const base = 10;
  const importanceReduction = (memory.importance ?? 3) * 2;
  const emotionalReduction = (memory.emotionalWeight ?? 30) / 20;
  return Math.max(1, base - importanceReduction - emotionalReduction);
}

export function maybeCreateMemory(world: WorldRuntime, candidate: MemoryCandidate): MemoryRecord | null {
  const score = scoreMemoryCandidate(candidate);
  if (score < MEMORY_CREATE_THRESHOLD) return null;
  const memory = createMemory(world, candidate);
  if (candidate.relationshipImpact && candidate.sourceAgentId) {
    applyRelationshipImpact(world, candidate.agentId, candidate.sourceAgentId, candidate.relationshipImpact, `memory: ${memory.content}`, candidate.sourceEventId);
  }
  return memory;
}

export function retrieveMemories(
  world: WorldRuntime,
  agentId: AgentId,
  options: { targetAgentId?: AgentId; locationId?: string; topic?: string; limit?: number } = {}
): MemoryRecord[] {
  const { targetAgentId, locationId, topic, limit = 5 } = options;
  const agent = world.agents[agentId];
  if (!agent) return [];
  return agent.memoryIds
    .map((id: string) => world.memories[id])
    .filter((m): m is MemoryRecord => Boolean(m))
    .map((memory) => ({ memory, score: scoreRetrievedMemory(world, memory, { targetAgentId, locationId, topic }) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => ({ ...x.memory, lastAccessedTick: world.tick }));
}

function scoreRetrievedMemory(world: WorldRuntime, memory: MemoryRecord, options: { targetAgentId?: AgentId; locationId?: string; topic?: string } = {}): number {
  const { targetAgentId, locationId, topic } = options;
  let score = memory.importance * 20 + memory.emotionalWeight * 0.5 + memory.confidence * 0.2;
  if (targetAgentId && memory.relatedAgentIds.includes(targetAgentId)) score += 30;
  if (locationId && memory.relatedLocationIds.includes(locationId)) score += 15;
  if (topic && memory.content.toLowerCase().includes(topic.toLowerCase())) score += 20;
  const age = world.tick - memory.createdAtTick;
  score -= age * memory.decayRate * 0.01;
  return score;
}

export function processEventMemory(world: WorldRuntime, event: EventRecord): MemoryRecord | null {
  const participants = event.actorIds ?? [];
  const observers = event.visibleToAgentIds ?? [];
  const all = [...new Set([...participants, ...observers])].filter((id): id is AgentId => Boolean(world.agents[id]));
  for (const agentId of all) {
    if (event.type === 'relationship_changed') continue;
    const direct = participants.includes(agentId);
    const emotionalWeight = direct ? 55 : 35;
    const candidate: MemoryCandidate = {
      agentId,
      type: event.type.includes('rumor') ? 'rumor' : event.public ? 'public' : 'episodic',
      content: event.description ?? event.type,
      sourceEventId: event.id,
      relatedAgentIds: event.actorIds.filter((id) => id !== agentId),
      relatedLocationIds: event.locationId ? [event.locationId] : [],
      emotionalWeight,
      confidence: event.type.includes('rumor') ? 55 : 85,
      importance: event.importance,
      sentiment: inferSentiment(event),
      visibility: event.public ? 'public' : 'private',
      directInvolvement: direct
    };
    maybeCreateMemory(world, candidate);
  }
  return null;
}

function inferSentiment(event: EventRecord): string {
  if (event.type.includes('failed') || event.type.includes('rumor')) return 'suspicion';
  if (event.type.includes('help') || event.type.includes('resolved')) return 'hope';
  if (event.type.includes('threat')) return 'fear';
  return 'neutral';
}

export function seedSecretMemories(world: WorldRuntime): void {
  createMemory(world, {
    agentId: 'nadia', type: 'secret', content: 'I planted the rumor that damaged trust between Sara and Malik.',
    relatedAgentIds: ['sara', 'malik'], relatedLocationIds: ['market', 'workshop'], emotionalWeight: 40, confidence: 100, importance: 4,
    sentiment: 'neutral', visibility: 'secret', locked: true
  });
  createMemory(world, {
    agentId: 'rune', type: 'episodic', content: 'I saw Nadia speaking with Malik before he refused Sara\u2019s delivery.',
    relatedAgentIds: ['nadia', 'malik', 'sara'], relatedLocationIds: ['market', 'workshop'], emotionalWeight: 45, confidence: 85, importance: 3,
    sentiment: 'suspicion', visibility: 'private'
  });
}
