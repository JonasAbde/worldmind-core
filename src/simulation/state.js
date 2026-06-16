import { deepClone } from './utils.js';

const requiredTopLevelKeys = [
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

function normalizeCollection(value, fallback) {
  return value && typeof value === 'object' ? deepClone(value) : fallback;
}

function normalizeArray(value, fallback) {
  return Array.isArray(value) ? deepClone(value) : fallback;
}

export function validateScenarioSchema(scenario) {
  const errors = [];
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
    return { valid: false, errors: ['scenario must be an object'] };
  }
  for (const key of requiredTopLevelKeys) {
    if (!(key in scenario)) errors.push(`missing ${key}`);
  }
  if (scenario.id !== 'new_aarhus_district_01') errors.push('id must be new_aarhus_district_01');
  if (scenario.name !== 'New Aarhus District 01') errors.push('name must be New Aarhus District 01');
  if (!scenario.agents || typeof scenario.agents !== 'object' || Array.isArray(scenario.agents)) errors.push('agents must be an object');
  if (!scenario.locations || typeof scenario.locations !== 'object' || Array.isArray(scenario.locations)) errors.push('locations must be an object');
  if (!scenario.items || typeof scenario.items !== 'object' || Array.isArray(scenario.items)) errors.push('items must be an object');
  if (!scenario.factions || typeof scenario.factions !== 'object' || Array.isArray(scenario.factions)) errors.push('factions must be an object');
  if (!scenario.playerKnowledge || typeof scenario.playerKnowledge !== 'object' || Array.isArray(scenario.playerKnowledge)) errors.push('playerKnowledge must be an object');
  if (!scenario.economy || typeof scenario.economy !== 'object' || Array.isArray(scenario.economy)) errors.push('economy must be an object');
  if (!Array.isArray(scenario.events)) errors.push('events must be an array');
  if (!Array.isArray(scenario.relationshipEvents)) errors.push('relationshipEvents must be an array');
  return { valid: errors.length === 0, errors };
}

export function scenarioToWorldState(scenario) {
  const validation = validateScenarioSchema(scenario);
  if (!validation.valid) {
    throw new Error(`Invalid scenario schema: ${validation.errors.join('; ')}`);
  }
  return {
    kind: 'world_state',
    version: 2,
    id: scenario.id,
    name: scenario.name,
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

export function serializeWorldState(world, meta = {}) {
  return {
    kind: 'world_state',
    version: 2,
    id: world.id,
    name: world.name,
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
    branchOriginSnapshotId: meta.branchOriginSnapshotId ?? world.branchOriginSnapshotId ?? null,
    branchParentSnapshotId: meta.branchParentSnapshotId ?? world.branchParentSnapshotId ?? null,
    branchName: meta.branchName ?? world.branchName ?? null,
    branchNote: meta.branchNote ?? world.branchNote ?? null,
    currentSnapshotId: world.currentSnapshotId ?? null,
    source: meta.source ?? 'snapshot',
    createdAtTick: world.tick
  };
}

export function snapshotEntityCollections(world) {
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
