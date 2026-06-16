/**
 * Authoritative TypeScript module — `sim.ts`.
 *
 * The body of the original `sim.js` has been promoted here. The
 * sibling `sim.js` is now a thin re-export shim that exists for
 * callers that have not yet been migrated to the TypeScript import
 * path.
 */

import { TICKS_PER_DAY } from './constants.js';
import { createWorld } from './world.ts';
import { executeAction } from './actions.ts';
import { ACTIONS } from './constants.js';
import { seedSecretMemories, processEventMemory } from './memory.ts';
import { spreadRumorTo, propagateRumors } from './rumors.ts';
import { applyRelationshipImpact, decayRelationships } from './relationships.ts';
import { updateEconomy } from './economy.ts';
import { detectIncidents } from './incidents.ts';
import { lenoSummarize, lenoTickPayload } from './leno.ts';
import { loadScenarioFile } from './scenario-loader.ts';
import type { ScenarioContract } from '../contracts/types.ts';
import type { WorldRuntime } from './state.ts';

export type { WorldRuntime } from './state.ts';

export interface WorldEvaluation {
  agentsActive: boolean;
  locationChanges: number;
  memoryCount: number;
  relationshipChanges: number;
  rumorSpreadCount: number;
  economyChanges: number;
  incidentDetected: boolean;
  possibleQuestResolutions: number;
  agentChangedBehavior: boolean;
  passed: boolean;
}

export interface InitializeScenarioOptions {
  seed?: number;
  scenario?: ScenarioContract | null;
  scenarioPath?: string | null;
}

export interface RunSimulationOptions extends InitializeScenarioOptions {
  days?: number;
  world?: WorldRuntime | null;
}

export function initializeScenario(options: InitializeScenarioOptions = {}): WorldRuntime {
  const seed = options.seed ?? 42;
  const loadedScenario = options.scenario ?? (options.scenarioPath ? loadScenarioFile(options.scenarioPath) : null);
  const world = loadedScenario
    ? createWorld({ seed, scenario: loadedScenario })
    : createWorld({ seed });
  if (!loadedScenario) seedSecretMemories(world);
  return world;
}

export function runSimulation(options: RunSimulationOptions = {}): WorldRuntime {
  const days = options.days ?? 7;
  const seed = options.seed ?? 42;
  const activeWorld = options.world ?? initializeScenario({ seed, scenario: options.scenario ?? null, scenarioPath: options.scenarioPath ?? null });
  const totalTicks = days * TICKS_PER_DAY;
  for (let i = 0; i < totalTicks; i++) tickWorld(activeWorld);
  return activeWorld;
}

export function tickWorld(world: WorldRuntime): WorldRuntime {
  if (world.tick === 4) {
    const e = executeAction(world, { actorId: 'nadia', actionId: ACTIONS.SPREAD_RUMOR, claim: 'Sara may be cooperating with Registry.', targetAgentIds: ['sara'], truthLevel: 70, emotionalTone: 'suspicion' });
    const rumorId = (e.payload as { rumorId: string }).rumorId;
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
    const e = world.addEvent({ type: 'delivery_restored', locationId: 'cafe', actorIds: ['player', 'sara', 'malik'], description: 'The delivery relationship between Sara and Malik was partially restored.', public: true, visibleToAgentIds: Object.keys(world.agents), importance: 4, payload: { fromLocationId: 'market', toLocationId: 'cafe' } });
    processEventMemory(world, e);
    const incident = world.incidents.missing_delivery;
    if (incident) {
      incident.status = 'resolved';
      incident.resolutionState = 'investigation_and_counter_rumor';
    }
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
        agentCount: Object.keys(world.agents).length,
        memoryCount: Object.keys(world.memories).length,
        rumorCount: Object.keys(world.rumors).length,
        incidentCount: Object.keys(world.incidents).length
      }
    });
    const summary = lenoSummarize(world);
    const summaryLine = summary.split('\n')[0];
    const lenoPayload = lenoTickPayload(world, summary);
    world.addEvent({ type: 'leno_summary_tick', locationId: 'apartment', actorIds: ['player'], description: summaryLine, public: false, visibleToAgentIds: ['player'], importance: 2, payload: lenoPayload });
  }
  decayRelationships(world);
  world.advanceTick();
  return world;
}

export function evaluateWorld(world: WorldRuntime): WorldEvaluation {
  const locationChanges = new Set(world.events.filter((e) => e.locationId).map((e) => e.locationId)).size;
  const rumorSpreadCount = world.events.filter((e) => e.type === 'rumor_spread').length;
  const economyChanges = world.events.filter((e) => e.type === 'economy_pressure').length;
  const relationshipChanges = world.relationshipEvents.length;
  const goalChanged = world.events.some((e) => e.type === 'goal_changed') || world.agents.nadia.relationships.player?.relationshipTags?.includes('rival');
  const incident = world.incidents.missing_delivery;
  return {
    agentsActive: Object.keys(world.agents).length >= 11,
    locationChanges,
    memoryCount: Object.keys(world.memories).length,
    relationshipChanges,
    rumorSpreadCount,
    economyChanges,
    incidentDetected: Boolean(incident),
    possibleQuestResolutions: incident?.possibleResolutions?.length ?? 0,
    agentChangedBehavior: Boolean(goalChanged || incident?.status === 'resolved'),
    passed: Object.keys(world.agents).length >= 11 && locationChanges >= 4 && Object.keys(world.memories).length >= 20 && relationshipChanges >= 10 && rumorSpreadCount >= 5 && economyChanges >= 3 && Boolean(incident) && (incident?.possibleResolutions?.length ?? 0) >= 3
  };
}
