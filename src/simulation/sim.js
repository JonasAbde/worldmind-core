import { TICKS_PER_DAY } from './constants.js';
import { createWorld } from './world.js';
import { executeAction } from './actions.js';
import { ACTIONS } from './constants.js';
import { seedSecretMemories, processEventMemory } from './memory.js';
import { spreadRumorTo, propagateRumors } from './rumors.js';
import { applyRelationshipImpact, decayRelationships } from './relationships.js';
import { updateEconomy } from './economy.js';
import { detectIncidents } from './incidents.js';
import { lenoSummarize } from './leno.js';

export function initializeScenario({ seed = 42 } = {}) {
  const world = createWorld({ seed });
  seedSecretMemories(world);
  return world;
}

export function runSimulation({ days = 7, seed = 42 } = {}) {
  const world = initializeScenario({ seed });
  const totalTicks = days * TICKS_PER_DAY;
  for (let i = 0; i < totalTicks; i++) tickWorld(world);
  return world;
}

export function tickWorld(world) {
  if (world.tick === 4) {
    const e = executeAction(world, { actorId: 'nadia', actionId: ACTIONS.SPREAD_RUMOR, claim: 'Sara may be cooperating with Registry.', targetAgentIds: ['sara'], truthLevel: 70, emotionalTone: 'suspicion' });
    const rumorId = e.payload.rumorId;
    world.playerKnowledge.knownRumorIds.push(rumorId);
  }
  if (world.tick === 8) {
    const rumorId = Object.keys(world.rumors)[0];
    if (rumorId) {
      const e = spreadRumorTo(world, rumorId, 'malik', 'nadia');
      if (e) processEventMemory(world, e);
      applyRelationshipImpact(world, 'malik', 'sara', { trust: -25, suspicion: 55, tags: ['manipulated'] }, 'believed Nadia rumor about Registry', e?.id);
    }
  }
  if (world.tick === 12) {
    const e = executeAction(world, { actorId: 'malik', actionId: ACTIONS.DELIVER_GOODS, fromLocationId: 'workshop', toLocationId: 'cafe', itemIds: ['delivery_crate'] });
    processEventMemory(world, e);
  }
  const econEvents = updateEconomy(world);
  for (const e of econEvents) processEventMemory(world, e);
  const rumorEvents = propagateRumors(world);
  for (const e of rumorEvents) processEventMemory(world, e);
  const incidentEvents = detectIncidents(world);
  for (const e of incidentEvents) processEventMemory(world, e);
  if (world.tick === 18 && world.incidents.missing_delivery) {
    const e1 = executeAction(world, { actorId: 'player', actionId: ACTIONS.OFFER_HELP, targetAgentId: 'sara', problemId: 'missing_delivery', offer: 'investigate delivery failure' });
    processEventMemory(world, e1);
    const e2 = executeAction(world, { actorId: 'player', actionId: ACTIONS.INSPECT_LOCATION, targetLocationId: 'cafe', focus: 'stock' });
    processEventMemory(world, e2);
  }
  if (world.tick === 22 && world.incidents.missing_delivery) {
    const e = executeAction(world, { actorId: 'player', actionId: ACTIONS.PAY_AGENT, targetAgentId: 'rune', amount: 50, reason: 'information about Nadia and delivery' });
    processEventMemory(world, e);
  }
  if (world.tick === 23 && world.incidents.missing_delivery) {
    const e = executeAction(world, { actorId: 'player', actionId: ACTIONS.ASK_ABOUT_TOPIC, targetAgentId: 'rune', topic: 'Nadia near workshop', tone: 'business' });
    processEventMemory(world, e);
  }
  if (world.tick === 24 && world.incidents.missing_delivery) {
    const rumorId = Object.keys(world.rumors)[0];
    if (rumorId) {
      const e = executeAction(world, { actorId: 'player', actionId: ACTIONS.TRACE_RUMOR, rumorId, evidenceStrength: 80 });
      processEventMemory(world, e);
    }
  }
  if (world.tick === 28 && world.incidents.missing_delivery && world.incidents.missing_delivery.status === 'active') {
    const rumorId = Object.keys(world.rumors)[0];
    if (rumorId) executeAction(world, { actorId: 'player', actionId: ACTIONS.COUNTER_RUMOR, rumorId, counterClaim: 'Sara was not working with Registry; the rumor was planted.', evidenceStrength: 80 });
    applyRelationshipImpact(world, 'malik', 'sara', { trust: 20, suspicion: -35 }, 'evidence weakened false rumor');
    applyRelationshipImpact(world, 'sara', 'player', { trust: 25, respect: 10, debt: 20, tags: ['trusted', 'saved_me'] }, 'player helped with supply crisis');
    const e = world.addEvent({ type: 'delivery_restored', locationId: 'cafe', actorIds: ['player', 'sara', 'malik'], description: 'The delivery relationship between Sara and Malik was partially restored.', public: true, visibleToAgentIds: Object.keys(world.agents), importance: 4 });
    processEventMemory(world, e);
    world.incidents.missing_delivery.status = 'resolved';
    world.incidents.missing_delivery.resolutionState = 'investigation_and_counter_rumor';
  }
  if (world.tick % 24 === 0) {
    world.addEvent({
      type: 'daily_checkpoint',
      locationId: 'apartment',
      actorIds: ['player'],
      description: `Daily checkpoint: ${Object.keys(world.agents).length} agents, ${Object.keys(world.memories).length} memories, ${Object.keys(world.rumors).length} rumors, ${Object.keys(world.incidents).length} incidents.`,
      public: true,
      visibleToAgentIds: Object.keys(world.agents),
      importance: 2,
      payload: {
        agents: Object.keys(world.agents).length,
        memories: Object.keys(world.memories).length,
        rumors: Object.keys(world.rumors).length,
        incidents: Object.keys(world.incidents).length
      }
    });
    world.addEvent({ type: 'leno_summary_tick', locationId: 'apartment', actorIds: ['player'], description: lenoSummarize(world).split('\n')[0], public: false, visibleToAgentIds: ['player'], importance: 2 });
  }
  decayRelationships(world);
  world.advanceTick();
  return world;
}

export function evaluateWorld(world) {
  const locationChanges = new Set(world.events.filter(e => e.locationId).map(e => e.locationId)).size;
  const rumorSpreadCount = world.events.filter(e => e.type === 'rumor_spread').length;
  const economyChanges = world.events.filter(e => e.type === 'economy_pressure').length;
  const relationshipChanges = world.relationshipEvents.length;
  const goalChanged = world.events.some(e => e.type === 'goal_changed') || world.agents.nadia.relationships.player?.relationshipTags?.includes('rival');
  return {
    agentsActive: Object.keys(world.agents).length >= 11,
    locationChanges,
    memoryCount: Object.keys(world.memories).length,
    relationshipChanges,
    rumorSpreadCount,
    economyChanges,
    incidentDetected: Boolean(world.incidents.missing_delivery),
    possibleQuestResolutions: world.incidents.missing_delivery?.possibleResolutions?.length ?? 0,
    agentChangedBehavior: Boolean(goalChanged || world.incidents.missing_delivery?.status === 'resolved'),
    passed: Object.keys(world.agents).length >= 11 && locationChanges >= 4 && Object.keys(world.memories).length >= 20 && relationshipChanges >= 10 && rumorSpreadCount >= 5 && economyChanges >= 3 && Boolean(world.incidents.missing_delivery) && (world.incidents.missing_delivery?.possibleResolutions?.length ?? 0) >= 3
  };
}
