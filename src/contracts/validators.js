import { ACTIONS } from '../simulation/constants.js';

const requiredScenarioTopLevel = [
  'id',
  'name',
  'tick',
  'day',
  'time',
  'agents',
  'locations',
  'items',
  'factions',
  'playerKnowledge',
  'economy'
];

const requiredWorldTopLevel = [
  ...requiredScenarioTopLevel,
  'memories',
  'rumors',
  'incidents',
  'tasks',
  'events',
  'relationshipEvents'
];

const requiredAgentFields = ['id', 'name', 'role', 'locationId', 'permissions', 'memoryIds', 'relationships', 'stats'];
const requiredLocationFields = ['id', 'name', 'type', 'zoneType', 'agentsPresent'];
const requiredRelationshipFields = ['sourceAgentId', 'targetAgentId', 'trust', 'suspicion', 'respect', 'affection'];
const requiredMemoryFields = ['id', 'agentId', 'content', 'createdAtTick'];
const requiredRumorFields = ['id', 'claim', 'sourceAgentId', 'truthLevel', 'knownByAgentIds'];
const requiredIncidentFields = ['id', 'title', 'status', 'knownFacts', 'involvedAgentIds'];
const requiredEventFields = ['id', 'type', 'tick', 'day', 'time', 'actorIds', 'description'];
const requiredBranchFields = ['id', 'worldId', 'name', 'originSnapshotId', 'parentSnapshotId'];
const requiredSnapshotFields = ['id', 'worldId', 'tick', 'day', 'time', 'agents', 'events'];
const allowedIncidentStatuses = new Set(['active', 'investigating', 'resolved', 'open']);
const knownActionIds = new Set(Object.values(ACTIONS));
const targetAgentActions = new Set([
  ACTIONS.TALK_TO_AGENT,
  ACTIONS.ASK_ABOUT_TOPIC,
  ACTIONS.OFFER_HELP,
  ACTIONS.ASK_FAVOR,
  ACTIONS.FOLLOW_AGENT,
  ACTIONS.PAY_AGENT,
  ACTIONS.NEGOTIATE_DEAL,
  ACTIONS.ASSIGN_TASK,
  ACTIONS.REPAIR_ITEM
]);
const targetLocationActions = new Set([
  ACTIONS.MOVE_TO_LOCATION,
  ACTIONS.INSPECT_LOCATION,
  ACTIONS.LISTEN_FOR_RUMORS
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function ensureObject(value, name, errors) {
  if (!asObject(value)) errors.push(`${name} must be an object`);
  return asObject(value);
}

function ensureArray(value, name, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${name} must be an array`);
    return null;
  }
  return value;
}

function ensureString(value, name, errors) {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${name} must be a non-empty string`);
    return null;
  }
  return value;
}

function validateAgent(agent, errors) {
  if (!asObject(agent)) {
    errors.push('agent must be an object');
    return;
  }
  for (const field of requiredAgentFields) {
    if (!(field in agent)) errors.push(`agent.${field} is required`);
  }
  if (!Array.isArray(agent.permissions)) errors.push('agent.permissions must be an array');
  if (!Array.isArray(agent.memoryIds)) errors.push('agent.memoryIds must be an array');
  if (!asObject(agent.relationships)) errors.push('agent.relationships must be an object');
  if (!asObject(agent.stats)) errors.push('agent.stats must be an object');
}

function validateLocation(location, errors) {
  if (!asObject(location)) {
    errors.push('location must be an object');
    return;
  }
  for (const field of requiredLocationFields) {
    if (!(field in location)) errors.push(`location.${field} is required`);
  }
  if (!Array.isArray(location.agentsPresent)) errors.push('location.agentsPresent must be an array');
}

export function validateRelationship(relationship) {
  return validateRelationshipInternal(relationship);
}

function validateRelationshipInternal(relationship) {
  const errors = [];
  if (!asObject(relationship)) {
    return { valid: false, errors: ['relationship must be an object'] };
  }
  for (const field of requiredRelationshipFields) {
    if (!(field in relationship)) errors.push(`relationship.${field} is required`);
  }
  if (relationship.sourceAgentId === relationship.targetAgentId) errors.push('relationship.sourceAgentId and targetAgentId must differ');
  return { valid: errors.length === 0, errors };
}

function validateMemoryRecord(memory) {
  const errors = [];
  if (!asObject(memory)) return { valid: false, errors: ['memory must be an object'] };
  for (const field of requiredMemoryFields) {
    if (!(field in memory)) errors.push(`memory.${field} is required`);
  }
  if (typeof memory.createdAtTick !== 'number' || memory.createdAtTick < 0) errors.push('memory.createdAtTick must be a non-negative number');
  if (memory.tick !== undefined && (typeof memory.tick !== 'number' || memory.tick < 0)) errors.push('memory.tick must be a non-negative number when provided');
  if (memory.day !== undefined && (typeof memory.day !== 'number' || memory.day < 1)) errors.push('memory.day must be a positive number when provided');
  if (memory.time !== undefined && typeof memory.time !== 'string') errors.push('memory.time must be a string when provided');
  return { valid: errors.length === 0, errors };
}

function validateRumorRecord(rumor) {
  const errors = [];
  if (!asObject(rumor)) return { valid: false, errors: ['rumor must be an object'] };
  for (const field of requiredRumorFields) {
    if (!(field in rumor)) errors.push(`rumor.${field} is required`);
  }
  if (typeof rumor.claim === 'string' && rumor.claim.length === 0) errors.push('rumor.claim must be a non-empty string');
  if (typeof rumor.truthLevel !== 'number') errors.push('rumor.truthLevel must be a number');
  if (!Array.isArray(rumor.knownByAgentIds)) errors.push('rumor.knownByAgentIds must be an array');
  return { valid: errors.length === 0, errors };
}

function validateIncidentRecord(incident) {
  const errors = [];
  if (!asObject(incident)) return { valid: false, errors: ['incident must be an object'] };
  for (const field of requiredIncidentFields) {
    if (!(field in incident)) errors.push(`incident.${field} is required`);
  }
  if (!allowedIncidentStatuses.has(incident.status)) {
    errors.push(`incident.status must be one of ${[...allowedIncidentStatuses].join(', ')}`);
  }
  if (!Array.isArray(incident.knownFacts)) errors.push('incident.knownFacts must be an array');
  if (!Array.isArray(incident.involvedAgentIds)) errors.push('incident.involvedAgentIds must be an array');
  if (incident.status === 'resolved' && !incident.resolutionState) {
    errors.push('incident.resolutionState is required when status is resolved');
  }
  if (incident.hiddenCause && !Array.isArray(incident.knownFacts)) {
    errors.push('incident.knownFacts must be present when hiddenCause is set');
  }
  return { valid: errors.length === 0, errors };
}

function validateEventRecord(event) {
  const errors = [];
  if (!asObject(event)) return { valid: false, errors: ['event must be an object'] };
  for (const field of requiredEventFields) {
    if (!(field in event)) errors.push(`event.${field} is required`);
  }
  if (!Array.isArray(event.actorIds)) errors.push('event.actorIds must be an array');
  if (event.payload !== undefined && (typeof event.payload !== 'object' || event.payload === null || Array.isArray(event.payload))) {
    errors.push('event.payload must be an object');
  }
  // Per-type payload validation (v0.9). The generic shape check above
  // runs first; if the generic shape is fine we then assert the
  // type-specific required payload fields.
  if (errors.length === 0) {
    const typeErrors = validateEventPayloadByType(event);
    if (typeErrors.length > 0) errors.push(...typeErrors);
  }
  return { valid: errors.length === 0, errors };
}

// v0.9: per-event-type payload schema. Each event type has its own
// required fields. Returns an array of error messages (empty if OK).
export function validateEventPayloadByType(event) {
  const errors = [];
  const type = event.type;
  const payload = event.payload;
  const ensurePayloadField = (name) => {
    if (!payload || typeof payload !== 'object' || !(name in payload)) {
      errors.push(`event.type=${type} requires payload.${name}`);
    }
  };
  switch (type) {
    case 'rumor_created':
    case 'rumor_spread':
    case 'rumor_traced':
    case 'counter_rumor':
      ensurePayloadField('rumorId');
      break;
    case 'incident_detected':
    case 'incident_resolved':
    case 'incident_advanced':
      ensurePayloadField('incidentId');
      break;
    case 'relationship_changed':
      ensurePayloadField('sourceAgentId');
      ensurePayloadField('targetAgentId');
      break;
    case 'daily_checkpoint':
      ensurePayloadField('agentCount');
      ensurePayloadField('memoryCount');
      ensurePayloadField('rumorCount');
      ensurePayloadField('incidentCount');
      break;
    case 'leno_summary_tick':
      ensurePayloadField('includeHiddenCause');
      ensurePayloadField('hiddenCause');
      break;
    case 'economy_pressure':
      ensurePayloadField('foodPrice');
      break;
    case 'delivery_completed':
    case 'delivery_failed':
    case 'delivery_restored':
      ensurePayloadField('fromLocationId');
      ensurePayloadField('toLocationId');
      break;
    // Events without a strict payload contract (world_started,
    // help_offered, location_inspected, payment_made, topic_discussed,
    // agent_moved, dialogue, etc.) skip the per-type check.
    default:
      break;
  }
  return errors;
}

export { validateEventRecord };

export function validateScenario(scenario) {
  const errors = [];
  const object = asObject(scenario);
  if (!object) return { valid: false, errors: ['scenario must be an object'] };
  for (const key of requiredScenarioTopLevel) {
    if (!(key in object)) errors.push(`missing ${key}`);
  }
  if (object.id !== 'new_aarhus_district_01') errors.push('id must be new_aarhus_district_01');
  if (object.name !== 'New Aarhus District 01') errors.push('name must be New Aarhus District 01');
  if (!Array.isArray(object.events) && 'events' in object) errors.push('events must be an array when present');
  if (!Array.isArray(object.relationshipEvents) && 'relationshipEvents' in object) errors.push('relationshipEvents must be an array when present');
  ensureObject(object.agents, 'agents', errors);
  ensureObject(object.locations, 'locations', errors);
  ensureObject(object.items, 'items', errors);
  ensureObject(object.factions, 'factions', errors);
  ensureObject(object.playerKnowledge, 'playerKnowledge', errors);
  ensureObject(object.economy, 'economy', errors);
  for (const [id, agent] of Object.entries(object.agents ?? {})) {
    if (agent?.id !== id) errors.push(`agent id mismatch at ${id}`);
    validateAgent(agent, errors);
  }
  for (const location of Object.values(object.locations ?? {})) {
    validateLocation(location, errors);
  }
  for (const [sourceId, source] of Object.entries(object.agents ?? {})) {
    for (const [targetId, relationship] of Object.entries(source.relationships ?? {})) {
      const result = validateRelationshipInternal({ ...relationship, sourceAgentId: sourceId, targetAgentId: targetId });
      if (!result.valid) errors.push(...result.errors);
    }
  }
  for (const memory of Object.values(object.memories ?? {})) {
    const result = validateMemoryRecord(memory);
    if (!result.valid) errors.push(...result.errors);
  }
  for (const rumor of Object.values(object.rumors ?? {})) {
    const result = validateRumorRecord(rumor);
    if (!result.valid) errors.push(...result.errors);
  }
  for (const incident of Object.values(object.incidents ?? {})) {
    const result = validateIncidentRecord(incident);
    if (!result.valid) errors.push(...result.errors);
  }
  for (const event of object.events ?? []) {
    const result = validateEventRecord(event);
    if (!result.valid) errors.push(...result.errors);
  }
  return { valid: errors.length === 0, errors };
}

export function validateWorldState(world) {
  const errors = [];
  const object = asObject(world);
  if (!object) return { valid: false, errors: ['world must be an object'] };
  for (const key of requiredWorldTopLevel) {
    if (!(key in object)) errors.push(`missing ${key}`);
  }
  if (object.kind && object.kind !== 'world_state') errors.push('kind must be world_state');
  for (const agent of Object.values(object.agents ?? {})) {
    validateAgent(agent, errors);
  }
  for (const memory of Object.values(object.memories ?? {})) {
    const result = validateMemoryRecord(memory);
    if (!result.valid) errors.push(...result.errors);
  }
  return { valid: errors.length === 0, errors };
}

export function validateSnapshot(snapshot) {
  const errors = [];
  const object = asObject(snapshot);
  if (!object) return { valid: false, errors: ['snapshot must be an object'] };
  for (const key of requiredSnapshotFields) {
    if (!(key in object)) errors.push(`missing ${key}`);
  }
  if (typeof object.tick !== 'number' || object.tick < 0) errors.push('snapshot.tick must be a non-negative number');
  if (typeof object.day !== 'number' || object.day < 1) errors.push('snapshot.day must be a positive number');
  if (typeof object.time !== 'string' || object.time.length === 0) errors.push('snapshot.time must be a non-empty string');
  if (!Array.isArray(object.events)) errors.push('snapshot.events must be an array');
  ensureObject(object.agents, 'snapshot.agents', errors);
  if ('branchName' in object && object.branchName !== null && object.branchName !== undefined && (typeof object.branchName !== 'string' || object.branchName.length === 0)) errors.push('snapshot.branchName must be a non-empty string when set');
  if ('originSnapshotId' in object && object.originSnapshotId !== null && typeof object.originSnapshotId !== 'string') errors.push('snapshot.originSnapshotId must be a string or null');
  if ('parentSnapshotId' in object && object.parentSnapshotId !== null && typeof object.parentSnapshotId !== 'string') errors.push('snapshot.parentSnapshotId must be a string or null');
  if ('currentSnapshotId' in object && object.currentSnapshotId !== null && typeof object.currentSnapshotId !== 'string') errors.push('snapshot.currentSnapshotId must be a string or null');
  for (const memory of Object.values(object.memories ?? {})) {
    const result = validateMemoryRecord(memory);
    if (!result.valid) errors.push(...result.errors);
  }
  return { valid: errors.length === 0, errors };
}

export function validateBranch(branch) {
  const errors = [];
  const object = asObject(branch);
  if (!object) return { valid: false, errors: ['branch must be an object'] };
  for (const field of requiredBranchFields) {
    if (!(field in object)) errors.push(`branch.${field} is required`);
  }
  for (const field of requiredBranchFields) {
    const value = object[field];
    if (typeof value !== 'string' || value.length === 0) errors.push(`branch.${field} must be a non-empty string`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateMemory(memory) {
  return validateMemoryRecord(memory);
}

export function validateRelationshipPublic(relationship) {
  return validateRelationship(relationship);
}

export function validateRumor(rumor) {
  return validateRumorRecord(rumor);
}

export function validateIncident(incident) {
  return validateIncidentRecord(incident);
}

export function validateActionRequest(request, world) {
  const errors = [];
  if (!asObject(request)) return { valid: false, errors: ['action request must be an object'] };
  const actorId = request.actorId;
  if (typeof actorId !== 'string' || actorId.length === 0) errors.push('action.actorId is required');
  const actionId = request.actionId;
  if (typeof actionId !== 'string' || actionId.length === 0) errors.push('action.actionId is required');
  else if (!knownActionIds.has(actionId)) errors.push(`action.actionId ${actionId} is not a known action`);
  const actor = actorId && asObject(world?.agents)?.[actorId];
  if (!actor) errors.push(`action.actorId ${actorId} not found in world`);
  if (targetAgentActions.has(actionId) && typeof request.targetAgentId !== 'string') {
    errors.push(`action.targetAgentId is required for ${actionId}`);
  }
  if (targetLocationActions.has(actionId) && typeof request.targetLocationId !== 'string') {
    errors.push(`action.targetLocationId is required for ${actionId}`);
  }
  if (typeof request.targetAgentId === 'string' && request.targetAgentId !== '' && !world?.agents?.[request.targetAgentId]) {
    errors.push(`action.targetAgentId ${request.targetAgentId} not found in world`);
  }
  if (typeof request.targetLocationId === 'string' && request.targetLocationId !== '' && !world?.locations?.[request.targetLocationId]) {
    errors.push(`action.targetLocationId ${request.targetLocationId} not found in world`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateDiff(diff) {
  const errors = [];
  const object = asObject(diff);
  if (!object) return { valid: false, errors: ['diff must be an object'] };
  for (const key of ['agentLocationChanges', 'relationshipChanges', 'newMemories', 'newRumors', 'economyChanges', 'incidentChanges']) {
    if (!Array.isArray(object[key])) errors.push(`diff.${key} must be an array`);
  }
  if (object.version !== 1) errors.push('diff.version must be 1');
  return { valid: errors.length === 0, errors };
}

export function validateLenoContext(context) {
  const errors = [];
  const object = asObject(context);
  if (!object) return { valid: false, errors: ['leno context must be an object'] };
  if (object.hiddenCause !== null) errors.push('leno context.hiddenCause must be null until evidence permits it');
  if (object.includeHiddenCause !== false && object.includeHiddenCause !== true) errors.push('leno context.includeHiddenCause must be a boolean');
  if (!Array.isArray(object.openIncidents)) errors.push('leno context.openIncidents must be an array');
  if (!Array.isArray(object.resolvedIncidents)) errors.push('leno context.resolvedIncidents must be an array');
  if (!Array.isArray(object.recentEvents)) errors.push('leno context.recentEvents must be an array');
  if (!asObject(object.evidence)) errors.push('leno context.evidence must be an object');
  for (const incident of object.openIncidents ?? []) {
    if (incident.hiddenCause) errors.push('leno context.openIncidents must not include hiddenCause');
    if (!Array.isArray(incident.knownFacts)) errors.push('leno context.openIncidents items must include knownFacts');
  }
  for (const incident of object.resolvedIncidents ?? []) {
    if (!incident.resolutionState) errors.push('leno context.resolvedIncidents items must include resolutionState');
  }
  return { valid: errors.length === 0, errors };
}

const diffContractExpectedSections = new Set([
  'agentLocationChanges',
  'relationshipChanges',
  'newMemories',
  'newRumors',
  'economyChanges',
  'incidentChanges'
]);

export function diffContracts(contract) {
  const errors = [];
  if (!asObject(contract)) return { valid: false, errors: ['contract must be an object'] };
  if (contract.version !== 1) errors.push('contract.version must be 1');
  for (const section of contract.sections ?? []) {
    if (!diffContractExpectedSections.has(section)) {
      errors.push(`unexpected diff section ${section}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
