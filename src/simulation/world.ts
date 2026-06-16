/**
 * Authoritative TypeScript module — `world.ts`.
 *
 * The body of the original `world.js` has been promoted here. The
 * sibling `world.js` is now a thin re-export shim that exists for
 * callers that have not yet been migrated to the TypeScript import
 * path.
 */

import { createId, deepClone, makeRng, tickToDayTime } from './utils.js';
import { createInitialAgents, createInitialFactions, createInitialItems, createInitialLocations, createInitialRelationships } from './seed.js';
import { scenarioToWorldState } from './state.ts';
import type { EventRecord, WorldState, ScenarioContract } from '../contracts/types.ts';
import type { WorldRuntime } from './state.ts';

export type { WorldRuntime } from './state.ts';
export type { WorldState, ScenarioContract } from '../contracts/types.ts';

function attachWorldMethods(world: WorldRuntime, options: { seed?: number; state?: WorldState | null } = {}): WorldRuntime {
  const seed = options.seed ?? 42;
  const counters = deepClone((options.state?.idCounters as Record<string, number> | undefined) ?? {});
  (world as { idCounters: Record<string, number> }).idCounters = counters;
  const rngState = options.state?.rngState ?? null;
  const initialRngState = typeof rngState === 'object' && rngState !== null
    ? (rngState.state ?? seed)
    : rngState;
  (world as unknown as { rng: ReturnType<typeof makeRng> }).rng = makeRng(seed, (initialRngState ?? undefined) as number | null | undefined) as ReturnType<typeof makeRng>;
  (world as { nextId: (prefix: string) => string }).nextId = (prefix: string): string => {
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    return createId(prefix, counters[prefix]);
  };
  (world as { addEvent: (event: Partial<EventRecord>) => EventRecord }).addEvent = (event: Partial<EventRecord>) => {
    const dt = tickToDayTime(world.tick);
    const full: EventRecord = {
      id: event.id ?? world.nextId('evt'),
      type: event.type ?? 'unknown',
      tick: world.tick,
      day: dt.day,
      time: dt.time,
      public: event.public ?? false,
      visibleToAgentIds: event.visibleToAgentIds ?? [],
      causes: event.causes ?? [],
      consequences: event.consequences ?? [],
      importance: event.importance ?? 2,
      payload: event.payload ?? {},
      branchOriginSnapshotId: world.branchOriginSnapshotId ?? null,
      branchParentSnapshotId: world.branchParentSnapshotId ?? null,
      branchName: world.branchName ?? null,
      branchNote: world.branchNote ?? null,
      locationId: event.locationId,
      actorIds: event.actorIds ?? [],
      description: event.description,
      source: event.source
    };
    world.events.push(full);
    return full;
  };
  (world as { advanceTick: () => void }).advanceTick = () => {
    world.tick += 1;
    const dt = tickToDayTime(world.tick);
    world.day = dt.day;
    world.time = dt.time;
  };
  return world;
}

function createSeedWorld(options: { seed?: number } = {}): WorldRuntime {
  const seed = options.seed ?? 42;
  const agents = createInitialRelationships(createInitialAgents());
  const world: WorldRuntime = {
    kind: 'world_state',
    version: 2,
    id: 'new_aarhus_district_01',
    name: 'New Aarhus District 01',
    tick: 0,
    day: 1,
    time: '00:00',
    seed,
    branchOriginSnapshotId: null,
    branchParentSnapshotId: null,
    branchName: null,
    branchNote: null,
    currentSnapshotId: null,
    agents,
    locations: createInitialLocations(),
    items: createInitialItems(),
    factions: createInitialFactions(),
    memories: {},
    rumors: {},
    incidents: {},
    tasks: {},
    events: [],
    relationshipEvents: [],
    playerKnowledge: { evidenceIds: [], knownRumorIds: [], knownIncidentIds: [], knownAgentIds: ['sara', 'malik', 'rune', 'amina', 'elias'] },
    economy: { foodPriceIndex: 1.0, foodScarcity: 0, laborDemand: 0.2, trustPressure: 0 },
    rng: makeRng(seed) as ReturnType<typeof makeRng>,
    advanceTick: () => undefined,
    addEvent: () => ({}) as never,
    nextId: () => '',
    idCounters: {}
  };
  attachWorldMethods(world, { seed });
  world.addEvent({ type: 'world_started', locationId: 'apartment', actorIds: ['player'], description: 'WorldMind simulation started in New Aarhus District 01.', public: true, importance: 3 });
  return world;
}

function createWorldFromState(state: WorldState | ScenarioContract, options: { seed?: number } = {}): WorldRuntime {
  const seed = options.seed ?? 42;
  const normalized = scenarioToWorldState(state as ScenarioContract);
  const world: WorldRuntime = {
    kind: 'world_state',
    version: 2,
    id: normalized.id,
    name: normalized.name,
    worldId: normalized.worldId ?? normalized.id,
    tick: normalized.tick,
    day: normalized.day,
    time: normalized.time,
    seed,
    branchOriginSnapshotId: normalized.branchOriginSnapshotId ?? null,
    branchParentSnapshotId: normalized.branchParentSnapshotId ?? null,
    branchName: normalized.branchName ?? null,
    branchNote: normalized.branchNote ?? null,
    currentSnapshotId: normalized.currentSnapshotId ?? null,
    agents: normalized.agents,
    locations: normalized.locations,
    items: normalized.items,
    factions: normalized.factions,
    memories: normalized.memories,
    rumors: normalized.rumors,
    incidents: normalized.incidents,
    tasks: normalized.tasks,
    events: normalized.events,
    relationshipEvents: normalized.relationshipEvents,
    playerKnowledge: normalized.playerKnowledge,
    economy: normalized.economy,
    rng: makeRng(seed) as ReturnType<typeof makeRng>,
    advanceTick: () => undefined,
    addEvent: () => ({}) as never,
    nextId: () => '',
    idCounters: {}
  };
  attachWorldMethods(world, { seed, state: normalized });
  return world;
}

export function createWorld(options: { seed?: number; state?: WorldState | null; scenario?: ScenarioContract | null } = {}): WorldRuntime {
  if (options.scenario) return createWorldFromState(options.scenario, { seed: options.seed });
  if (options.state) return createWorldFromState(options.state, { seed: options.seed });
  return createSeedWorld({ seed: options.seed });
}
