/**
 * TypeScript declarations for the legacy JavaScript runtime modules.
 *
 * These files are still authored in plain ESM JavaScript. The
 * declarations below let `tsc` validate callers that import from
 * them, and they form the basis for the eventual `.ts` migration
 * in a future sprint.
 */

import type {
  AgentId,
  EventRecord,
  LocationId,
  WorldState,
  Relationship,
  MemoryRecord,
  RumorRecord
} from './types.js';

// === memory.js ===
export function scoreMemoryCandidate(candidate: Partial<MemoryRecord> & { importance: number; tick?: number; type?: string }): number;
export function createMemory(world: WorldState, candidate: Partial<MemoryRecord> & { content: string; importance: number; agentId: AgentId; createdAtTick: number }): MemoryRecord;
export function calculateDecayRate(memory: Partial<MemoryRecord> & { importance: number; emotionalWeight?: number }): number;
export function maybeCreateMemory(world: WorldState, candidate: Partial<MemoryRecord> & { content: string; importance: number; agentId: AgentId; createdAtTick: number }): MemoryRecord | null;
export function retrieveMemories(world: WorldState, agentId: AgentId, options?: { targetAgentId?: AgentId; locationId?: LocationId; topic?: string; limit?: number }): MemoryRecord[];
export function processEventMemory(world: WorldState, event: EventRecord): MemoryRecord | null;
export function seedSecretMemories(world: WorldState): void;

// === rumors.js ===
export function createRumor(world: WorldState, options: { claim: string; sourceAgentId: AgentId; targetAgentIds?: AgentId[]; truthLevel?: number; emotionalTone?: string; spreadRate?: number; originEventId?: string }): RumorRecord;
export function spreadRumorTo(world: WorldState, rumorId: string, listenerAgentId: AgentId, sourceAgentId: AgentId): EventRecord | null;
export function propagateRumors(world: WorldState): EventRecord[];
export function counterRumor(world: WorldState, rumorId: string, options: { counterClaim: string; evidenceStrength?: number; actorId?: AgentId }): EventRecord;
export function traceRumor(world: WorldState, rumorId: string, options?: { actorId?: AgentId; evidenceStrength?: number }): EventRecord;

// === actions.js ===
export function validateAction(world: WorldState, request: { actorId: AgentId; actionId: string; targetAgentId?: AgentId; targetLocationId?: LocationId }): { valid: boolean; errors: string[] };
export function executeAction(world: WorldState, request: Record<string, unknown>): EventRecord;
export function helpSaraPeacefully(world: WorldState): EventRecord;
export function acceptTaskScore(world: WorldState, agentId: AgentId, requesterId: AgentId, options?: { taskRisk?: number; reward?: number; taskMatchesGoal?: boolean; factionConflict?: boolean }): number;

// === relationships.js ===
export function calculateInfluence(r: Partial<Relationship> & { trust: number; suspicion: number; respect: number; affection: number; debt?: number; fear?: number }): number;
export function applyRelationshipImpact(world: WorldState, sourceAgentId: AgentId, targetAgentId: AgentId, impact: Partial<Relationship>, reason: string, sourceEventId?: string): void;
export function calculateAcceptance(options: { agent: { relationships: Record<AgentId, Relationship>; stats: { money?: number; stress?: number } }; requesterId: AgentId; taskRisk?: number; reward?: number; taskMatchesGoal?: boolean; factionConflict?: boolean }): number;
export function rumorBeliefChance(relationshipToTarget: Partial<Relationship> & { trust: number; suspicion: number }, rumorTruthLevel: number): number;
export function decayRelationships(world: WorldState): void;

// === economy.js ===
export function updateEconomy(world: WorldState): EventRecord[];

// === incidents.js ===
export function detectIncidents(world: WorldState): EventRecord[];
export function resolveIncident(world: WorldState, incidentId: string, resolutionId: string, actorId?: AgentId): EventRecord;

// === dashboard.js ===
export interface DashboardOptions {
  includeTimeline?: boolean;
  includeSaveBrowser?: boolean;
  includeBranchExplorer?: boolean;
  includeContracts?: boolean;
  includeParseContracts?: boolean;
}
export function generateDashboard(world: WorldState, outDir?: string, options?: DashboardOptions): { path: string };

// === dialogue.js ===
export function generateDialogueReply(world: WorldState, options: { speakerId: AgentId; listenerId?: AgentId; topic?: string; tone?: string }): { text: string };

// === leno.js ===
export interface LenoPolicy {
  role: string;
  capabilities: string[];
  restrictions: string[];
}
export const LENO_MODEL_POLICY: LenoPolicy;
export function lenoSummarize(world: WorldState, options?: { scope?: 'world' | 'agent' | 'incident' }): string;
export function lenoSuggestActions(world: WorldState, options?: { incidentId?: string }): string[];

// Re-export the EventRecord + memory/rumor types for callers that
// want a single import surface.
export type { EventRecord, MemoryRecord, RumorRecord };
