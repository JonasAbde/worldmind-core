/**
 * Authoritative TypeScript module — `actions.ts`.
 */

import { ACTION_RISK_LIMIT_MVP, ACTIONS, PERMISSIONS, RISK } from './constants.js';
import { applyRelationshipImpact, calculateAcceptance } from './relationships.ts';
import { maybeCreateMemory, processEventMemory } from './memory.ts';
import { counterRumor, createRumor, traceRumor, syncRumorRuntimeFields } from './rumors.ts';
import { resolveIncident } from './incidents.ts';
import type { AgentId, EventRecord } from '../contracts/types.ts';
import type { WorldRuntime } from './state.ts';

interface ActionRequest {
  actorId: AgentId;
  actionId: string;
  targetAgentId?: AgentId;
  targetLocationId?: string;
  targetObjectId?: string;
  objectType?: string;
  interaction?: string;
  stateBefore?: string;
  stateAfter?: string;
  message?: string;
  tone?: 'direct' | 'friendly' | 'threatening' | string;
  focus?: string;
  problemId?: string;
  offer?: string;
  topic?: string;
  claim?: string;
  targetAgentIds?: AgentId[];
  truthLevel?: number;
  emotionalTone?: string;
  amount?: number;
  reason?: string;
  fromLocationId?: string;
  toLocationId?: string;
  itemIds?: string[];
  rumorId?: string;
  counterClaim?: string;
  evidenceStrength?: number;
  [key: string]: unknown;
}

interface ActionSpec {
  permission: string;
  risk: number;
}

const registry: Record<string, ActionSpec> = {
  [ACTIONS.MOVE_TO_LOCATION]: { permission: PERMISSIONS.MOVE, risk: RISK.OBSERVE },
  [ACTIONS.TALK_TO_AGENT]: { permission: PERMISSIONS.TALK, risk: RISK.SMALL_SOCIAL },
  [ACTIONS.ASK_ABOUT_TOPIC]: { permission: PERMISSIONS.TALK, risk: RISK.SMALL_SOCIAL },
  [ACTIONS.OFFER_HELP]: { permission: PERMISSIONS.TALK, risk: RISK.SMALL_SOCIAL },
  [ACTIONS.ASK_FAVOR]: { permission: PERMISSIONS.TALK, risk: RISK.MEDIUM_SOCIAL },
  [ACTIONS.INSPECT_LOCATION]: { permission: PERMISSIONS.INSPECT, risk: RISK.OBSERVE },
  [ACTIONS.INSPECT_OBJECT]: { permission: PERMISSIONS.INSPECT, risk: RISK.SMALL_SOCIAL },
  [ACTIONS.FOLLOW_AGENT]: { permission: PERMISSIONS.MOVE, risk: RISK.MEDIUM_SOCIAL },
  [ACTIONS.LISTEN_FOR_RUMORS]: { permission: PERMISSIONS.OBSERVE, risk: RISK.OBSERVE },
  [ACTIONS.SPREAD_RUMOR]: { permission: PERMISSIONS.INFLUENCE, risk: RISK.RUMOR },
  [ACTIONS.COUNTER_RUMOR]: { permission: PERMISSIONS.INFLUENCE, risk: RISK.MEDIUM_SOCIAL },
  [ACTIONS.TRACE_RUMOR]: { permission: PERMISSIONS.INSPECT, risk: RISK.MEDIUM_SOCIAL },
  [ACTIONS.TRADE_ITEM]: { permission: PERMISSIONS.TRADE, risk: RISK.SMALL_SOCIAL },
  [ACTIONS.PAY_AGENT]: { permission: PERMISSIONS.TRADE, risk: RISK.SMALL_SOCIAL },
  [ACTIONS.NEGOTIATE_DEAL]: { permission: PERMISSIONS.TRADE, risk: RISK.MEDIUM_SOCIAL },
  [ACTIONS.ASSIGN_TASK]: { permission: PERMISSIONS.TASK_ASSIGN, risk: RISK.MEDIUM_SOCIAL },
  [ACTIONS.REPAIR_ITEM]: { permission: PERMISSIONS.REPAIR, risk: RISK.SMALL_SOCIAL },
  [ACTIONS.DELIVER_GOODS]: { permission: PERMISSIONS.DELIVER, risk: RISK.MEDIUM_SOCIAL },
  [ACTIONS.ASK_LENO]: { permission: PERMISSIONS.LENO_ACCESS, risk: RISK.OBSERVE }
};

const targetAgentRequired = new Set<string>([
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

const targetLocationRequired = new Set<string>([
  ACTIONS.MOVE_TO_LOCATION,
  ACTIONS.INSPECT_LOCATION,
  ACTIONS.LISTEN_FOR_RUMORS
]);

const targetObjectRequired = new Set<string>([ACTIONS.INSPECT_OBJECT]);

export function validateAction(world: WorldRuntime, request: ActionRequest): true {
  const { actorId, actionId, targetAgentId, targetLocationId } = request;
  const actor = world.agents[actorId];
  if (!actor) throw new Error(`Actor not found: ${actorId}`);
  const spec = registry[actionId];
  if (!spec) throw new Error(`Unknown action: ${actionId}`);
  if (spec.risk > ACTION_RISK_LIMIT_MVP) throw new Error(`Action risk ${spec.risk} is disabled in MVP v0.1`);
  if (!actor.permissions.includes(spec.permission)) throw new Error(`${actor.name} lacks permission: ${spec.permission}`);
  if (targetAgentRequired.has(actionId) && !targetAgentId) throw new Error(`${actionId} requires targetAgentId`);
  if (targetLocationRequired.has(actionId) && !targetLocationId) throw new Error(`${actionId} requires targetLocationId`);
  if (targetObjectRequired.has(actionId) && !request.targetObjectId) throw new Error(`${actionId} requires targetObjectId`);
  if (targetAgentId && !world.agents[targetAgentId]) throw new Error(`Target agent not found: ${targetAgentId}`);
  if (targetLocationId && !world.locations[targetLocationId]) throw new Error(`Target location not found: ${targetLocationId}`);
  return true;
}

export function executeAction(world: WorldRuntime, request: ActionRequest): EventRecord {
  validateAction(world, request);
  const { actionId, actorId } = request;
  let event: EventRecord;
  switch (actionId) {
    case ACTIONS.MOVE_TO_LOCATION: event = moveToLocation(world, request); break;
    case ACTIONS.TALK_TO_AGENT: event = talkToAgent(world, request); break;
    case ACTIONS.ASK_ABOUT_TOPIC: event = askAboutTopic(world, request); break;
    case ACTIONS.OFFER_HELP: event = offerHelp(world, request); break;
    case ACTIONS.INSPECT_LOCATION: event = inspectLocation(world, request); break;
    case ACTIONS.INSPECT_OBJECT: event = inspectObject(world, request); break;
    case ACTIONS.LISTEN_FOR_RUMORS: event = listenForRumors(world, request); break;
    case ACTIONS.SPREAD_RUMOR: event = spreadRumor(world, request); break;
    case ACTIONS.COUNTER_RUMOR: event = counterRumor(world, request.rumorId as string, { actorId, counterClaim: request.counterClaim as string, evidenceStrength: request.evidenceStrength ?? 0 }); break;
    case ACTIONS.TRACE_RUMOR: event = traceRumor(world, request.rumorId as string, { actorId, evidenceStrength: request.evidenceStrength ?? 0 }); break;
    case ACTIONS.PAY_AGENT: event = payAgent(world, request); break;
    case ACTIONS.DELIVER_GOODS: event = deliverGoods(world, request); break;
    default:
      event = world.addEvent({ type: actionId, locationId: world.agents[actorId].locationId, actorIds: [actorId], description: `Action executed: ${actionId}`, importance: 2 });
  }
  processEventMemory(world, event);
  return event;
}

function moveToLocation(world: WorldRuntime, { actorId, targetLocationId }: ActionRequest): EventRecord {
  const actor = world.agents[actorId];
  const old = actor.locationId;
  world.locations[old].agentsPresent = world.locations[old].agentsPresent.filter((id) => id !== actorId);
  actor.locationId = targetLocationId as string;
  world.locations[targetLocationId as string].agentsPresent.push(actorId);
  return world.addEvent({ type: 'agent_moved', locationId: targetLocationId as string, actorIds: [actorId], description: `${actor.name} moved to ${world.locations[targetLocationId as string].name}.`, public: false, visibleToAgentIds: [actorId], importance: 1 });
}

function talkToAgent(world: WorldRuntime, { actorId, targetAgentId, message = '', tone = 'direct' }: ActionRequest): EventRecord {
  const actor = world.agents[actorId];
  const target = world.agents[targetAgentId as AgentId];
  const impact = tone === 'friendly' ? { trust: 3, affection: 2 } : tone === 'threatening' ? { fear: 15, trust: -10, suspicion: 8 } : { trust: 1 };
  applyRelationshipImpact(world, targetAgentId as AgentId, actorId, impact, `talk tone: ${tone}`);
  return world.addEvent({ type: 'dialogue', locationId: actor.locationId, actorIds: [actorId, targetAgentId as AgentId], description: `${actor.name} talked to ${target.name}: ${message || '(conversation)'}`, public: false, visibleToAgentIds: [actorId, targetAgentId as AgentId], importance: tone === 'threatening' ? 3 : 2, payload: { tone, message } });
}

function askAboutTopic(world: WorldRuntime, { actorId, targetAgentId, topic = 'delivery', tone = 'direct' }: ActionRequest): EventRecord {
  const target = world.agents[targetAgentId as AgentId];
  if (!targetAgentId) throw new Error('ask_about_topic requires targetAgentId');
  const rel = target.relationships[actorId];
  const topicText = topic.toLowerCase();
  const runeLead = targetAgentId === 'rune' && topicText.includes('nadia');
  const reveals = (topicText.includes('nadia') && (rel.trust > 35 || (rel.fear ?? 0) > 60)) || (runeLead && rel.trust > 0);
  if (targetAgentId === 'rune' && reveals && !world.playerKnowledge.evidenceIds.includes('rune_statement_nadia_workshop')) world.playerKnowledge.evidenceIds.push('rune_statement_nadia_workshop');
  return world.addEvent({ type: 'topic_discussed', locationId: target.locationId, actorIds: [actorId, targetAgentId], description: `${target.name} discussed topic: ${topic}${reveals ? ' and revealed useful evidence.' : '.'}`, public: false, visibleToAgentIds: [actorId, targetAgentId], importance: reveals ? 4 : 2, payload: { topic, tone, evidenceRevealed: reveals } });
}

function offerHelp(world: WorldRuntime, { actorId, targetAgentId, problemId = 'missing_delivery', offer = 'help' }: ActionRequest): EventRecord {
  applyRelationshipImpact(world, targetAgentId as AgentId, actorId, { trust: 10, respect: 5, debt: 5, tags: ['offered_help'] }, `offered help with ${problemId}`);
  const targetAgent = world.agents[targetAgentId as AgentId];
  const safeTargetAgentId = targetAgentId as AgentId;
  return world.addEvent({ type: 'help_offered', locationId: targetAgent.locationId, actorIds: [actorId, safeTargetAgentId], description: `${world.agents[actorId].name} offered help to ${targetAgent.name}: ${offer}`, public: false, visibleToAgentIds: [actorId, safeTargetAgentId], importance: 3, payload: { problemId } });
}

function inspectLocation(world: WorldRuntime, { actorId, targetLocationId, focus = 'general' }: ActionRequest): EventRecord {
  const loc = world.locations[targetLocationId as string];
  let finding = `Inspected ${loc.name}.`;
  if (targetLocationId === 'cafe' && focus === 'stock') finding = 'Sara\u2019s stock is low and delivery crates are missing.';
  return world.addEvent({ type: 'location_inspected', locationId: targetLocationId as string, actorIds: [actorId], description: finding, public: false, visibleToAgentIds: [actorId], importance: targetLocationId === 'cafe' ? 3 : 2, payload: { focus } });
}

function inspectObject(world: WorldRuntime, request: ActionRequest): EventRecord {
  const { actorId, targetObjectId, objectType = 'world_object', interaction = 'inspect', stateBefore = 'unknown', stateAfter = 'inspected' } = request;
  return world.addEvent({
    type: 'world_object_interacted',
    locationId: world.agents[actorId].locationId,
    actorIds: [actorId],
    description: `${world.agents[actorId].name} used ${targetObjectId}: ${interaction}.`,
    public: false,
    visibleToAgentIds: [actorId],
    importance: 2,
    payload: { objectId: targetObjectId, objectType, interaction, stateBefore, stateAfter }
  });
}

function listenForRumors(world: WorldRuntime, { actorId, targetLocationId }: ActionRequest): EventRecord {
  const known = Object.values(world.rumors).filter((r) => r.knownByAgentIds.some((id) => world.agents[id]?.locationId === targetLocationId));
  for (const r of known) {
    syncRumorRuntimeFields(r);
    if (!r.knownByAgentIds.includes(actorId)) {
      r.knownByAgentIds.push(actorId);
      syncRumorRuntimeFields(r);
    }
  }
  if (actorId === 'player') for (const r of known) if (!world.playerKnowledge.knownRumorIds.includes(r.id)) world.playerKnowledge.knownRumorIds.push(r.id);
  return world.addEvent({ type: 'rumors_listened', locationId: targetLocationId as string, actorIds: [actorId], description: `${world.agents[actorId].name} listened for rumors at ${world.locations[targetLocationId as string].name}.`, public: false, visibleToAgentIds: [actorId], importance: known.length ? 3 : 1, payload: { rumorIds: known.map((r) => r.id) } });
}

function spreadRumor(world: WorldRuntime, { actorId, claim, targetAgentIds = [], truthLevel = 50, emotionalTone = 'suspicion' }: ActionRequest): EventRecord {
  const rumor = createRumor(world, { claim: claim as string, sourceAgentId: actorId, targetAgentIds: targetAgentIds as AgentId[], truthLevel, emotionalTone, spreadRate: 55 });
  return world.addEvent({ type: 'rumor_created', locationId: world.agents[actorId].locationId, actorIds: [actorId], description: `${world.agents[actorId].name} started rumor: ${claim}`, public: false, visibleToAgentIds: [actorId], importance: 4, payload: { rumorId: rumor.id } });
}

function payAgent(world: WorldRuntime, { actorId, targetAgentId, amount = 10, reason = 'payment' }: ActionRequest): EventRecord {
  const actor = world.agents[actorId];
  if (!targetAgentId) throw new Error('pay_agent requires targetAgentId');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('pay_agent amount must be a positive number');
  const target = world.agents[targetAgentId];
  if (((actor.stats.money ?? 0) < amount)) throw new Error(`${actor.name} does not have enough money`);
  actor.stats.money = (actor.stats.money ?? 0) - amount;
  target.stats.money = (target.stats.money ?? 0) + amount;
  applyRelationshipImpact(world, targetAgentId, actorId, { trust: 5, debt: -5 }, `paid ${amount} for ${reason}`);
  return world.addEvent({ type: 'payment_made', locationId: target.locationId, actorIds: [actorId, targetAgentId], description: `${actor.name} paid ${target.name} ${amount} for ${reason}.`, public: false, visibleToAgentIds: [actorId, targetAgentId], importance: 3, payload: { amount, reason } });
}

function deliverGoods(world: WorldRuntime, { actorId, fromLocationId = 'workshop', toLocationId = 'cafe', itemIds = ['delivery_crate'] }: ActionRequest): EventRecord {
  const actor = world.agents[actorId];
  if (!Array.isArray(itemIds) || !itemIds.length) throw new Error('deliver_goods requires at least one itemId');
  if (!fromLocationId || !toLocationId) throw new Error('deliver_goods requires fromLocationId and toLocationId');
  const risk = world.agents.malik.relationships.sara.suspicion > 50 ? 4 : 2;
  if (risk > 3 && actorId === 'malik') {
    world.agents.sara.stats.stock = Math.max(0, (world.agents.sara.stats.stock ?? 0) - 8);
    return world.addEvent({ type: 'delivery_failed', locationId: 'workshop', actorIds: [actorId, 'sara'], description: `${actor.name} refused delivery to Sara because trust collapsed.`, public: false, visibleToAgentIds: ['sara', 'malik', 'rune'], importance: 4, payload: { fromLocationId, toLocationId, itemIds } });
  }
  world.agents.sara.stats.stock = Math.min(100, (world.agents.sara.stats.stock ?? 0) + 30);
  return world.addEvent({ type: 'delivery_completed', locationId: toLocationId, actorIds: [actorId, 'sara'], description: `${actor.name} delivered goods to Sara's Caf\u00e9.`, public: true, visibleToAgentIds: Object.keys(world.agents), importance: 4, payload: { fromLocationId, toLocationId, itemIds } });
}

export function helpSaraPeacefully(world: WorldRuntime): EventRecord {
  applyRelationshipImpact(world, 'sara', 'player', { trust: 25, respect: 10, debt: 20, tags: ['trusted', 'saved_me'] }, 'player restored delivery');
  applyRelationshipImpact(world, 'malik', 'player', { trust: 10, respect: 10, suspicion: -10 }, 'player mediated honestly');
  applyRelationshipImpact(world, 'nadia', 'player', { suspicion: 25, respect: 10, affection: -20, tags: ['rival'] }, 'player disrupted manipulation');
  return resolveIncident(world, 'missing_delivery', 'peaceful_mediation', 'player');
}

export function acceptTaskScore(world: WorldRuntime, agentId: AgentId, requesterId: AgentId, options: { taskRisk?: number; reward?: number; taskMatchesGoal?: boolean; factionConflict?: boolean } = {}): number {
  return calculateAcceptance({ agent: world.agents[agentId] as unknown as { relationships: Record<AgentId, import('../contracts/types.ts').Relationship>; personality: { riskTolerance: number; loyalty: number } }, requesterId, ...options });
}
