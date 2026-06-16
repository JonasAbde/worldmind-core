/**
 * Authoritative TypeScript module — `state.ts`.
 */

import { deepClone } from './utils.js';
import type {
  ScenarioContract,
  WorldState,
  EventRecord
} from '../contracts/types.ts';

export type { WorldState, ScenarioContract, EventRecord } from '../contracts/types.ts';

export type WorldRuntime = WorldState & {
  rng: { (): number; getState: () => number | { state: number } | null; setState: (nextState: number | null | undefined) => number; snapshot: () => { seed: number; state: number } };
  addEvent: (event: Partial<EventRecord>) => EventRecord;
  nextId: (prefix: string) => string;
  advanceTick: () => void;
};

// Type-guard helper that re-exposes the WorldRuntime type for
// `import type { WorldRuntime }` callers. The export value is
// unused at runtime; it exists only so the TypeScript compiler
// treats the symbol as reachable in module-resolution.
export const __WORLD_RUNTIME_TYPE__: WorldRuntime = {} as WorldRuntime;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const requiredTopLevelKeys: Array<keyof ScenarioContract> = [
  'id',
  'name',
  'tick',
  'day',
  'time',
  'agents',
  'locations',
  'items',
  'factions',
  'memories',
  'rumors',
  'incidents',
  'tasks',
  'events',
  'relationshipEvents',
  'playerKnowledge',
  'economy'
];

function normalizeCollection<T>(value: unknown, fallback: T): T {
  return value && typeof value === 'object' ? (JSON.parse(JSON.stringify(value)) as T) : fallback;
}

function normalizeArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (JSON.parse(JSON.stringify(value)) as T[]) : fallback;
}

export function validateScenarioSchema(scenario: unknown): ValidationResult {
  const errors: string[] = [];
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
    return { valid: false, errors: ['scenario must be an object'] };
  }
  const sc = scenario as Record<string, unknown>;
  for (const key of requiredTopLevelKeys) {
    if (!(key in sc)) errors.push(`missing ${key}`);
  }
  if (sc.id !== 'new_aarhus_district_01') errors.push('id must be new_aarhus_district_01');
  if (sc.name !== 'New Aarhus District 01') errors.push('name must be New Aarhus District 01');
  if (!sc.agents || typeof sc.agents !== 'object' || Array.isArray(sc.agents)) errors.push('agents must be an object');
  if (!sc.locations || typeof sc.locations !== 'object' || Array.isArray(sc.locations)) errors.push('locations must be an object');
  if (!sc.items || typeof sc.items !== 'object' || Array.isArray(sc.items)) errors.push('items must be an object');
  if (!sc.factions || typeof sc.factions !== 'object' || Array.isArray(sc.factions)) errors.push('factions must be an object');
  if (!sc.playerKnowledge || typeof sc.playerKnowledge !== 'object' || Array.isArray(sc.playerKnowledge)) errors.push('playerKnowledge must be an object');
  if (!sc.economy || typeof sc.economy !== 'object' || Array.isArray(sc.economy)) errors.push('economy must be an object');
  if (!Array.isArray(sc.events)) errors.push('events must be an array');
  if (!Array.isArray(sc.relationshipEvents)) errors.push('relationshipEvents must be an array');
  return { valid: errors.length === 0, errors };
}

export function scenarioToWorldState(scenario: ScenarioContract): WorldState {
  const validation = validateScenarioSchema(scenario);
  if (!validation.valid) {
    throw new Error(`Invalid scenario schema: ${validation.errors.join('; ')}`);
  }
  return {
    kind: 'world_state',
    version: 2,
    id: scenario.id,
    name: scenario.name,
    worldId: scenario.worldId ?? scenario.id,
    tick: scenario.tick ?? 0,
    day: scenario.day ?? 1,
    time: scenario.time ?? '00:00',
    rngState: scenario.rngState ?? null,
    idCounters: normalizeCollection(scenario.idCounters, {}),
    agents: normalizeCollection(scenario.agents, {}),
    locations: normalizeCollection(scenario.locations, {}),
    items: normalizeCollection(scenario.items, {}),
    factions: normalizeCollection(scenario.factions, {}),
    memories: normalizeCollection(scenario.memories, {}),
    rumors: normalizeCollection(scenario.rumors, {}),
    incidents: normalizeCollection(scenario.incidents, {}),
    tasks: normalizeCollection(scenario.tasks, {}),
    events: normalizeArray(scenario.events, []),
    relationshipEvents: normalizeArray(scenario.relationshipEvents, []),
    playerKnowledge: normalizeCollection(scenario.playerKnowledge, { evidenceIds: [], knownRumorIds: [], knownIncidentIds: [], knownAgentIds: [] }),
    economy: normalizeCollection(scenario.economy, { foodPriceIndex: 1, foodScarcity: 0, laborDemand: 0.2, trustPressure: 0 }),
    branchOriginSnapshotId: scenario.branchOriginSnapshotId ?? null,
    branchParentSnapshotId: scenario.branchParentSnapshotId ?? null,
    branchName: scenario.branchName ?? null,
    branchNote: scenario.branchNote ?? null,
    currentSnapshotId: scenario.currentSnapshotId ?? null,
    source: scenario.source ?? 'scenario'
  };
}

export function serializeWorldState(world: WorldRuntime, meta: Record<string, unknown> = {}): WorldState {
  return {
    kind: 'world_state',
    version: 2,
    id: world.id,
    name: world.name,
    worldId: world.id,
    tick: world.tick,
    day: world.day,
    time: world.time,
    rngState: world.rng?.getState?.() ?? null,
    idCounters: deepClone(world.idCounters ?? {}),
    agents: deepClone(world.agents),
    locations: deepClone(world.locations),
    items: deepClone(world.items),
    factions: deepClone(world.factions),
    memories: deepClone(world.memories),
    rumors: deepClone(world.rumors),
    incidents: deepClone(world.incidents),
    tasks: deepClone(world.tasks),
    events: deepClone(world.events),
    relationshipEvents: deepClone(world.relationshipEvents),
    playerKnowledge: deepClone(world.playerKnowledge),
    economy: deepClone(world.economy),
    branchOriginSnapshotId: (meta.branchOriginSnapshotId as string | null) ?? world.branchOriginSnapshotId ?? null,
    branchParentSnapshotId: (meta.branchParentSnapshotId as string | null) ?? world.branchParentSnapshotId ?? null,
    branchName: (meta.branchName as string | null) ?? world.branchName ?? null,
    branchNote: (meta.branchNote as string | null) ?? world.branchNote ?? null,
    currentSnapshotId: world.currentSnapshotId ?? null,
    source: (meta.source as 'scenario' | 'snapshot' | 'runtime' | undefined) ?? 'snapshot',
    createdAtTick: world.tick
  };
}

export function snapshotEntityCollections(world: WorldRuntime): Record<string, unknown> {
  return {
    agents: deepClone(world.agents),
    memories: deepClone(world.memories),
    relationships: deepClone(world.agents),
    rumors: deepClone(world.rumors),
    incidents: deepClone(world.incidents),
    events: deepClone(world.events),
    economy: deepClone(world.economy)
  };
}
