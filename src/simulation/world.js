import { createId, deepClone, makeRng, tickToDayTime } from './utils.js';
import { createInitialAgents, createInitialFactions, createInitialItems, createInitialLocations, createInitialRelationships } from './seed.js';
import { scenarioToWorldState } from './state.js';

function attachWorldMethods(world, { seed = 42, state = null } = {}) {
  const counters = deepClone(state?.idCounters ?? {});
  world.idCounters = counters;
  const rngState = state?.rngState ?? null;
  world.rng = makeRng(seed, typeof rngState === 'object' && rngState !== null ? rngState.state ?? seed : rngState);
  world.nextId = prefix => {
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    return createId(prefix, counters[prefix]);
  };
  world.addEvent = event => {
    const dt = tickToDayTime(world.tick);
    const full = {
      id: event.id ?? world.nextId('evt'),
      tick: world.tick,
      day: dt.day,
      time: dt.time,
      public: false,
      visibleToAgentIds: [],
      causes: [],
      consequences: [],
      importance: 2,
      payload: {},
      branchOriginSnapshotId: world.branchOriginSnapshotId ?? null,
      branchParentSnapshotId: world.branchParentSnapshotId ?? null,
      branchName: world.branchName ?? null,
      branchNote: world.branchNote ?? null,
      ...event
    };
    world.events.push(full);
    return full;
  };
  world.advanceTick = () => {
    world.tick += 1;
    const dt = tickToDayTime(world.tick);
    world.day = dt.day;
    world.time = dt.time;
  };
  return world;
}

function createSeedWorld({ seed = 42 } = {}) {
  const agents = createInitialRelationships(createInitialAgents());
  const world = {
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
    economy: { foodPriceIndex: 1.0, foodScarcity: 0, laborDemand: 0.2, trustPressure: 0 }
  };
  attachWorldMethods(world, { seed });
  world.addEvent({ type: 'world_started', locationId: 'apartment', actorIds: ['player'], description: 'WorldMind simulation started in New Aarhus District 01.', public: true, importance: 3 });
  return world;
}

function createWorldFromState(state, { seed = 42 } = {}) {
  const normalized = scenarioToWorldState(state);
  const world = {
    id: normalized.id,
    name: normalized.name,
    tick: normalized.tick,
    day: normalized.day,
    time: normalized.time,
    seed,
    branchOriginSnapshotId: normalized.branchOriginSnapshotId,
    branchParentSnapshotId: normalized.branchParentSnapshotId,
    branchName: normalized.branchName,
    branchNote: normalized.branchNote,
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
    economy: normalized.economy
  };
  attachWorldMethods(world, { seed, state: normalized });
  return world;
}

export function createWorld({ seed = 42, state = null, scenario = null } = {}) {
  if (scenario) return createWorldFromState(scenario, { seed });
  if (state) return createWorldFromState(state, { seed });
  return createSeedWorld({ seed });
}
