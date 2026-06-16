/**
 * Authoritative TypeScript module — `incidents.ts`.
 */

import type { AgentId, EventRecord } from '../contracts/types.ts';
import type { WorldRuntime } from './state.ts';

export function detectIncidents(world: WorldRuntime): EventRecord[] {
  const created: EventRecord[] = [];
  const hasMissingDelivery = Boolean(world.incidents.missing_delivery);
  const deliveryFailed = world.events.some((e) => e.type === 'delivery_failed');
  const saraStockLow = (world.agents.sara?.stats.stock ?? 100) <= 25;
  const saraRumor = Object.values(world.rumors).find((r) => r.claim.toLowerCase().includes('sara') && r.claim.toLowerCase().includes('registry'));
  const malikSuspicion = world.agents.malik.relationships.sara.suspicion;
  if (!hasMissingDelivery && deliveryFailed && saraStockLow && saraRumor && malikSuspicion >= 50) {
    const incident = {
      id: 'missing_delivery',
      title: 'The Missing Delivery',
      status: 'active' as const,
      createdAtTick: world.tick,
      visibleProblem: "Sara's Caf\u00e9 is missing supplies and may close early.",
      hiddenCause: 'Nadia planted a false rumor that Sara works with Registry.',
      involvedAgentIds: ['sara', 'malik', 'nadia', 'rune'] as AgentId[],
      knownFacts: ['Sara is low on supplies.', 'Malik refused delivery.', 'A rumor connects Sara to Registry.'],
      possibleResolutions: [
        'restore_trust_between_sara_and_malik',
        'find_evidence_against_nadia',
        'pay_rune_for_alternative_delivery',
        'counter_the_false_rumor',
        'report_illegal_skill_trading',
        'start_player_delivery_workflow'
      ],
      resolutionState: 'unresolved'
    };
    world.incidents[incident.id] = incident;
    world.playerKnowledge.knownIncidentIds.push(incident.id);
    const event = world.addEvent({
      type: 'incident_detected',
      locationId: 'cafe',
      actorIds: ['sara', 'malik'],
      description: 'Incident detected: The Missing Delivery.',
      public: false,
      visibleToAgentIds: ['player'],
      causes: saraRumor.originEventId ? [saraRumor.originEventId] : [],
      consequences: [{ type: 'incident_created', incidentId: incident.id }],
      importance: 4,
      payload: { incidentId: incident.id }
    });
    created.push(event);
  }
  return created;
}

export function resolveIncident(world: WorldRuntime, incidentId: string, resolutionId: string, actorId: AgentId = 'player'): EventRecord {
  const incident = world.incidents[incidentId];
  if (!incident) throw new Error(`Incident not found: ${incidentId}`);
  incident.status = 'resolved';
  incident.resolutionState = resolutionId;
  incident.resolvedAtTick = world.tick;
  return world.addEvent({
    type: 'incident_resolved',
    locationId: 'cafe',
    actorIds: [actorId, ...incident.involvedAgentIds],
    description: `Incident resolved with path: ${resolutionId}.`,
    public: true,
    visibleToAgentIds: Object.keys(world.agents),
    causes: [],
    consequences: [{ type: 'incident_resolved', incidentId, resolutionId }],
    importance: 5,
    payload: { incidentId, resolutionId, resolvedAtTick: world.tick }
  });
}
