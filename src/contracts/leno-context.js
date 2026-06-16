import { validateLenoContext } from './validators.js';

function pickRecentEvents(events, limit = 8) {
  return events
    .slice()
    .sort((a, b) => (b.tick ?? 0) - (a.tick ?? 0))
    .slice(0, limit)
    .map(event => ({
      id: event.id,
      type: event.type,
      description: event.description,
      day: event.day,
      time: event.time
    }));
}

function summarizeIncidents(incidents) {
  const open = [];
  const resolved = [];
  for (const incident of Object.values(incidents ?? {})) {
    if (incident.status === 'resolved') {
      resolved.push({
        id: incident.id,
        title: incident.title,
        knownFacts: incident.knownFacts ?? [],
        resolutionState: incident.resolutionState ?? null
      });
    } else {
      open.push({
        id: incident.id,
        title: incident.title,
        status: incident.status,
        knownFacts: incident.knownFacts ?? [],
        resolutionState: incident.resolutionState ?? null
      });
    }
  }
  return { open, resolved };
}

export function buildLenoContext(world, { includeHiddenCause = false, evidenceIds = world?.playerKnowledge?.evidenceIds ?? [] } = {}) {
  const { open, resolved } = summarizeIncidents(world.incidents);
  const hasEvidence = evidenceIds.length > 0;
  const context = {
    worldId: world.id,
    day: world.day,
    time: world.time,
    agentCount: Object.keys(world.agents ?? {}).length,
    memoryCount: Object.keys(world.memories ?? {}).length,
    rumorCount: Object.keys(world.rumors ?? {}).length,
    incidentCount: open.length + resolved.length,
    openIncidents: open,
    resolvedIncidents: resolved,
    recentEvents: pickRecentEvents(world.events ?? []),
    evidence: {
      evidenceIds: [...evidenceIds],
      knownRumorIds: [...(world.playerKnowledge?.knownRumorIds ?? [])],
      knownIncidentIds: [...(world.playerKnowledge?.knownIncidentIds ?? [])],
      knownAgentIds: [...(world.playerKnowledge?.knownAgentIds ?? [])]
    },
    hiddenCause: null,
    includeHiddenCause: Boolean(includeHiddenCause && hasEvidence)
  };
  const result = validateLenoContext(context);
  if (!result.valid) {
    throw new Error(`Invalid Leno context: ${result.errors.join('; ')}`);
  }
  return context;
}
