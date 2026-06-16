import { deepClone } from '../simulation/utils.ts';

const relationshipFields = ['trust', 'suspicion', 'respect', 'affection', 'influence'];

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function unionKeys(...collections) {
  return [...new Set(collections.flatMap(collection => Object.keys(asObject(collection))))];
}

function relationKey(sourceAgentId, targetAgentId) {
  return `${sourceAgentId}::${targetAgentId}`;
}

function extractRelationshipMap(world) {
  const map = new Map();
  for (const agent of Object.values(asObject(world.agents))) {
    for (const [targetKey, relation] of Object.entries(asObject(agent.relationships))) {
      const targetAgentId = relation?.targetAgentId ?? relation?.target_agent_id ?? relation?.targetId ?? targetKey;
      if (!targetAgentId) continue;
      map.set(relationKey(agent.id, targetAgentId), {
        sourceAgentId: agent.id,
        targetAgentId,
        ...deepClone(relation)
      });
    }
  }
  return map;
}

function extractMapById(collection) {
  const map = new Map();
  for (const entry of Object.values(asObject(collection))) {
    if (entry?.id) map.set(entry.id, deepClone(entry));
  }
  return map;
}

function pickFields(entry, fields) {
  const picked = {};
  for (const field of fields) picked[field] = entry?.[field] ?? null;
  return picked;
}

function normalizedSnapshotId(snapshot) {
  return snapshot?.currentSnapshotId ?? snapshot?.snapshotId ?? snapshot?.id ?? null;
}

export function filterEvents(events, filters = {}) {
  const {
    branchName = null,
    branchOriginSnapshotId = null,
    branchParentSnapshotId = null,
    tickFrom = null,
    tickTo = null,
    actorId = null,
    incidentId = null,
    type = null
  } = filters;

  return (Array.isArray(events) ? events : []).filter(event => {
    if (branchName && event.branchName !== branchName) return false;
    if (branchOriginSnapshotId && event.branchOriginSnapshotId !== branchOriginSnapshotId) return false;
    if (branchParentSnapshotId && event.branchParentSnapshotId !== branchParentSnapshotId) return false;
    if (type && event.type !== type) return false;
    if (tickFrom !== null && tickFrom !== undefined && event.tick < tickFrom) return false;
    if (tickTo !== null && tickTo !== undefined && event.tick > tickTo) return false;
    if (actorId && !(Array.isArray(event.actorIds) && event.actorIds.includes(actorId))) return false;
    if (incidentId) {
      const related = event.incidentId
        ?? event.payload?.incidentId
        ?? event.payload?.resolutionIncidentId
        ?? (Array.isArray(event.causes) && event.causes.includes(incidentId) ? incidentId : null);
      if (related !== incidentId) return false;
    }
    return true;
  });
}

export function diffSnapshots(before, after) {
  const beforeAgents = asObject(before?.agents);
  const afterAgents = asObject(after?.agents);
  const beforeMemories = extractMapById(before?.memories);
  const afterMemories = extractMapById(after?.memories);
  const beforeRumors = extractMapById(before?.rumors);
  const afterRumors = extractMapById(after?.rumors);
  const beforeIncidents = extractMapById(before?.incidents);
  const afterIncidents = extractMapById(after?.incidents);
  const beforeRelationships = extractRelationshipMap(before ?? {});
  const afterRelationships = extractRelationshipMap(after ?? {});

  const agentLocationChanges = [];
  for (const agentId of unionKeys(beforeAgents, afterAgents)) {
    const beforeAgent = beforeAgents[agentId];
    const afterAgent = afterAgents[agentId];
    const beforeLocationId = beforeAgent?.locationId ?? null;
    const afterLocationId = afterAgent?.locationId ?? null;
    if (beforeLocationId !== afterLocationId) {
      agentLocationChanges.push({
        agentId,
        beforeLocationId,
        afterLocationId
      });
    }
  }

  const relationshipChanges = [];
  for (const key of new Set([...beforeRelationships.keys(), ...afterRelationships.keys()])) {
    const beforeRel = beforeRelationships.get(key);
    const afterRel = afterRelationships.get(key);
    const beforeValues = pickFields(beforeRel, relationshipFields);
    const afterValues = pickFields(afterRel, relationshipFields);
    const changed = relationshipFields.some(field => beforeValues[field] !== afterValues[field]);
    if (changed) {
      relationshipChanges.push({
        sourceAgentId: afterRel?.sourceAgentId ?? beforeRel?.sourceAgentId ?? key.split('::')[0],
        targetAgentId: afterRel?.targetAgentId ?? beforeRel?.targetAgentId ?? key.split('::')[1],
        before: beforeValues,
        after: afterValues
      });
    }
  }

  const newMemories = [];
  for (const [memoryId, memory] of afterMemories.entries()) {
    if (!beforeMemories.has(memoryId)) newMemories.push(deepClone(memory));
  }

  const newRumors = [];
  for (const [rumorId, rumor] of afterRumors.entries()) {
    if (!beforeRumors.has(rumorId)) newRumors.push(deepClone(rumor));
  }

  const economyChanges = [];
  const beforeEconomy = asObject(before?.economy);
  const afterEconomy = asObject(after?.economy);
  for (const key of unionKeys(beforeEconomy, afterEconomy)) {
    if ((beforeEconomy[key] ?? null) !== (afterEconomy[key] ?? null)) {
      economyChanges.push({ field: key, before: beforeEconomy[key] ?? null, after: afterEconomy[key] ?? null });
    }
  }

  const incidentChanges = [];
  for (const incidentId of new Set([...beforeIncidents.keys(), ...afterIncidents.keys()])) {
    const beforeIncident = beforeIncidents.get(incidentId);
    const afterIncident = afterIncidents.get(incidentId);
    if (!beforeIncident || !afterIncident) {
      incidentChanges.push({ incidentId, beforeStatus: beforeIncident?.status ?? null, afterStatus: afterIncident?.status ?? null, beforeResolutionState: beforeIncident?.resolutionState ?? null, afterResolutionState: afterIncident?.resolutionState ?? null });
      continue;
    }
    if (beforeIncident.status !== afterIncident.status || beforeIncident.resolutionState !== afterIncident.resolutionState) {
      incidentChanges.push({
        incidentId,
        beforeStatus: beforeIncident.status ?? null,
        afterStatus: afterIncident.status ?? null,
        beforeResolutionState: beforeIncident.resolutionState ?? null,
        afterResolutionState: afterIncident.resolutionState ?? null
      });
    }
  }

  return {
    beforeSnapshotId: normalizedSnapshotId(before),
    afterSnapshotId: normalizedSnapshotId(after),
    agentLocationChanges,
    relationshipChanges,
    newMemories,
    newRumors,
    economyChanges,
    incidentChanges,
    summary: {
      agentLocationChanges: agentLocationChanges.length,
      relationshipChanges: relationshipChanges.length,
      newMemories: newMemories.length,
      newRumors: newRumors.length,
      economyChanges: economyChanges.length,
      incidentChanges: incidentChanges.length
    }
  };
}

export function buildTimelineBranchView({ branches = [], snapshots = [] } = {}) {
  const snapshotsByBranchId = new Map();
  for (const snapshot of snapshots) {
    const branchId = snapshot.branchId ?? snapshot.branch_id ?? 'main';
    if (!snapshotsByBranchId.has(branchId)) snapshotsByBranchId.set(branchId, []);
    snapshotsByBranchId.get(branchId).push(snapshot);
  }
  return branches.map(branch => {
    const branchSnapshots = (snapshotsByBranchId.get(branch.id) ?? []).slice().sort((a, b) => {
      if ((a.tick ?? 0) !== (b.tick ?? 0)) return (a.tick ?? 0) - (b.tick ?? 0);
      return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
    });
    const currentSnapshot = branchSnapshots.at(-1) ?? null;
    return {
      ...branch,
      snapshotCount: branchSnapshots.length,
      currentSnapshotId: currentSnapshot?.id ?? null,
      currentTick: currentSnapshot?.tick ?? null,
      currentDay: currentSnapshot?.day ?? null,
      currentTime: currentSnapshot?.time ?? null
    };
  });
}
