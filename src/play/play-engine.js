/**
 * Shared play engine for WorldMind.
 *
 * Both the CLI (`src/cli/play.js`) and the web UI
 * (`src/play/web-renderer.js`, `src/cli/play-web.js`) consume this
 * module. The engine is intentionally pure: it takes a world
 * object and a command, returns a structured result. No I/O, no
 * process.exit, no console writes. That makes it deterministic
 * and trivially testable.
 *
 * Public API:
 *   bootstrapWorld({ scenarioPath })   — fresh world, deterministic
 *   resolveCommand(world, name, args)  — dispatch one player command
 *   parseCommandText(text)             — "ask rune nadia" -> { command, args }
 *   runScriptedPath(world, pathName)   — peaceful/investigation/founder/all
 *   getDemoPaths()                     — list of { name, description, steps }
 *   summarizeWorld(world)              — text overview for `look`
 *
 * Result envelope (resolveCommand):
 *   { ok, kind, text, world, dialogue?, consequence?, evidence?,
 *     audioCues?, majorDecisionPrompt?, error?, snapshot? }
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSimulation } from '../simulation/sim.ts';
import {
  validateAction,
  executeAction,
  helpSaraPeacefully
} from '../simulation/actions.ts';
import { resolveIncident } from '../simulation/incidents.ts';
import { lenoSummarize, lenoSuggestActions } from '../simulation/leno.ts';
import {
  createActiveFounderContract,
  founderBaseLevelForContracts,
  listFounderContractOffers,
  resolveFounderContractTemplate
} from './founder-contracts.js';
import { buildCommandText, resolveMajorDecisionPrompt } from './game-shell-model.js';
import {
  dialogueEntryFor,
  dialogueUnlocksFor,
  dialogueMinTrust,
  grantEvidence,
  inspectPackRewards,
  syncPackRumorsAtLocation
} from './content-pack-runtime.js';
import { recordQuestStep } from './quest-progress.js';
import {
  awardProgression,
  createInitialProgression,
  hasCapability,
  summarizeProgression
} from './progression.js';
import { buildWalkAnimation } from './walk-path.js';
import { attachAudioCues } from './audio-cues.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = process.cwd();

const DEFAULT_SCENARIO = path.join(REPO, 'scenarios/new-aarhus-district-01.json');

const AGENT_ALIASES = {
  sara: 'sara', malik: 'malik', rune: 'rune',
  amina: 'amina', player: 'player', nadia: 'nadia', omar: 'omar',
  lina: 'lina', yasin: 'yasin', freja: 'freja', elias: 'elias'
};

const LOCATION_ALIASES = {
  cafe: 'cafe', market: 'market', workshop: 'workshop', apartment: 'apartment',
  home: 'apartment'
};

const DEMO_PATHS = [
  {
    name: 'peaceful',
    label: 'Peaceful Mediation',
    description: 'Help Sara, ask Amina to mediate, pay Malik a token.',
    steps: ['inspect cafe', 'talk sara', 'ask amina', 'pay malik 5']
  },
  {
    name: 'investigation',
    label: 'Investigation & Counter-Rumor',
    description: 'Ask Rune about Nadia, trace and counter the false rumor.',
    steps: ['inspect cafe', 'listen_rumors market', 'ask rune nadia', 'trace_rumor', 'counter_rumor']
  },
  {
    name: 'founder',
    label: 'Founder / Business Negotiation',
    description: 'Pay Malik for an alternative delivery, talk to Sara.',
    steps: ['inspect workshop', 'pay malik 15', 'talk sara']
  }
];

export function getDemoPaths() {
  return DEMO_PATHS;
}

function placeAgentAtLocation(world, agentId, locationId) {
  const agent = world.agents?.[agentId];
  if (!agent || !world.locations?.[locationId]) return;
  const oldLocationId = agent.locationId;
  if (oldLocationId && world.locations?.[oldLocationId]?.agentsPresent) {
    world.locations[oldLocationId].agentsPresent = world.locations[oldLocationId].agentsPresent
      .filter((id) => id !== agentId);
  }
  agent.locationId = locationId;
  if (!world.locations[locationId].agentsPresent.includes(agentId)) {
    world.locations[locationId].agentsPresent.push(agentId);
  }
}

function seedPlayableMissingDelivery(world) {
  placeAgentAtLocation(world, 'player', 'cafe');

  world.playerKnowledge = {
    evidenceIds: [],
    knownRumorIds: [],
    suspectedCauses: [],
    unresolvedQuestions: ['What happened to Sara\'s delivery?']
  };

  world.incidents.missing_delivery = {
    id: 'missing_delivery',
    title: 'The Missing Delivery',
    status: 'active',
    visibleProblem: 'Sara\'s cafe is short on supplies after a failed delivery, and a false rumor is damaging trust.',
    hiddenCause: 'Nadia planted a misleading rumor to destabilize Sara and Malik.',
    resolutionState: 'unresolved',
    knownFacts: ['Sara is low on supplies.', 'The market is carrying a rumor about the failed delivery.'],
    involvedAgentIds: ['sara', 'malik', 'nadia', 'rune'],
    createdAtTick: world.tick ?? 0
  };

  if (!Object.values(world.rumors || {}).some((r) => r.sourceAgentId === 'nadia')) {
    executeAction(world, {
      actorId: 'nadia',
      actionId: 'spread_rumor',
      claim: 'Sara may have caused the missing delivery herself.',
      targetAgentIds: ['sara'],
      truthLevel: 65,
      emotionalTone: 'suspicion'
    });
  }

  if (world.agents?.rune?.relationships?.player) {
    world.agents.rune.relationships.player.trust = Math.max(
      world.agents.rune.relationships.player.trust ?? 0,
      5
    );
  }

  world.questProgress = {
    questId: 'quest_missing_delivery',
    completedSteps: [],
    resolvedPathId: null
  };

  world.founder = {
    unlocked: false,
    baseLevel: 0,
    reputation: world.agents?.player?.stats?.reputation ?? 0,
    contractsCompleted: 0,
    activeContract: null
  };

  world.progression = createInitialProgression();

  world.addEvent({
    type: 'incident_detected',
    locationId: 'cafe',
    actorIds: ['player', 'sara'],
    description: 'The Missing Delivery is active: Sara needs supplies, trust is falling, and rumors are spreading.',
    public: true,
    visibleToAgentIds: ['player', 'sara', 'malik', 'rune', 'amina'],
    importance: 5,
    payload: { incidentId: 'missing_delivery' }
  });
}

export function bootstrapWorld({ scenarioPath = DEFAULT_SCENARIO, days = 0, playStart = true, episode = null } = {}) {
  const world = runSimulation({
    days,
    scenarioPath,
    persistToSqlite: false,
    writeScenario: false
  });
  if (!world.playerKnowledge) {
    world.playerKnowledge = {
      evidenceIds: [],
      knownRumorIds: [],
      suspectedCauses: [],
      unresolvedQuestions: []
    };
  }
  if (playStart && days === 0) {
    // Pick the right seed by episode, fall back to default.
    const seedFn = EPISODE_SEEDS[episode] || seedPlayableMissingDelivery;
    seedFn(world);
    world._episode = EPISODE_SEEDS[episode] ? episode : 'the-missing-delivery';
  }

  // Tag the player with a stable locationId so move/inspect/talk work.
  if (world.agents.player && !world.agents.player.locationId) {
    world.agents.player.locationId = 'cafe';
  }

  if (!world.founder) {
    world.founder = {
      unlocked: isFounderUnlockedFromIncidents(world),
      baseLevel: 0,
      reputation: world.agents?.player?.stats?.reputation ?? 0,
      contractsCompleted: 0,
      activeContract: null
    };
  }

  if (!world.progression) {
    world.progression = createInitialProgression();
  }

  return world;
}

// --- Episode seeds ---

const EPISODE_SEEDS = {
  'the-missing-delivery': seedPlayableMissingDelivery,
  'noise-along-the-quay': seedPlayableNoiseComplaint,
  'ownership-dispute': seedPlayableOwnershipDispute
};

function seedPlayableNoiseComplaint(world) {
  placeAgentAtLocation(world, 'player', 'district_square');

  world.playerKnowledge = {
    evidenceIds: [],
    knownRumorIds: [],
    suspectedCauses: [],
    unresolvedQuestions: [
      'What is causing the noise at the quay?',
      'Is there signal interference?'
    ]
  };

  world.incidents.noise_complaint_5561 = {
    id: 'noise_complaint_5561',
    title: 'Noise Complaint #5561',
    status: 'active',
    locationId: 'district_square',
    visibleProblem: 'A persistent noise at the quay is disrupting harbour activity and raising complaints.',
    hiddenCause: 'Audio anomaly captures point to an unregistered signal source masking equipment noise.',
    resolutionState: 'unresolved',
    knownFacts: [
      'Noise levels exceeded safety thresholds at the quay.',
      'Signal interference logged near the south docks.'
    ],
    involvedAgentIds: ['elias', 'omar', 'freja'],
    linkedEvidence: ['audio_anomaly_capture', 'signal_interference_log'],
    createdAtTick: world.tick ?? 0
  };

  if (!Object.values(world.rumors || {}).some((r) => r.sourceAgentId === 'omar')) {
    executeAction(world, {
      actorId: 'omar',
      actionId: 'spread_rumor',
      claim: 'The quay noise is linked to a cover-up after the missing delivery.',
      targetAgentIds: ['elias', 'freja'],
      truthLevel: 45,
      emotionalTone: 'concern'
    });
  }

  world.questProgress = {
    questId: 'quest_noise_complaint',
    completedSteps: [],
    resolvedPathId: null
  };

  world.founder = {
    unlocked: false,
    baseLevel: 0,
    reputation: world.agents?.player?.stats?.reputation ?? 0,
    contractsCompleted: 0,
    activeContract: null
  };

  world.progression = createInitialProgression();

  world.addEvent({
    type: 'incident_detected',
    locationId: 'district_square',
    actorIds: ['player', 'elias'],
    description: 'Noise Complaint #5561 is active: the quay is loud, signal interference logged, a cover-up rumor is spreading.',
    public: true,
    visibleToAgentIds: ['player', 'elias', 'omar', 'freja'],
    importance: 4,
    payload: { incidentId: 'noise_complaint_5561' }
  });
}

function seedPlayableOwnershipDispute(world) {
  placeAgentAtLocation(world, 'player', 'workshop');

  world.playerKnowledge = {
    evidenceIds: [],
    knownRumorIds: [],
    suspectedCauses: [],
    unresolvedQuestions: [
      'Who actually owns the workshop?',
      'Is the 2019 charter still valid?'
    ]
  };

  world.incidents.ownership_dispute_5562 = {
    id: 'ownership_dispute_5562',
    title: 'Ownership Dispute #5562',
    status: 'active',
    locationId: 'workshop',
    visibleProblem: 'A contested ownership claim on the workshop threatens the current operation.',
    hiddenCause: 'A corporate deed supersedes the 2019 charter, but Malik has not been notified.',
    resolutionState: 'unresolved',
    knownFacts: [
      'The workshop has operated under the same charter since 2019.',
      'A corporate ownership deed was filed recently.'
    ],
    involvedAgentIds: ['yasin', 'lina'],
    linkedEvidence: ['workshop_charter_2019', 'corporate_ownership_deed'],
    createdAtTick: world.tick ?? 0
  };

  if (!Object.values(world.rumors || {}).some((r) => r.sourceAgentId === 'yasin')) {
      executeAction(world, {
        actorId: 'yasin',
        actionId: 'spread_rumor',
        claim: 'The old workshop was sold to a private sponsor.',
        targetAgentIds: ['lina'],
        truthLevel: 55,
        emotionalTone: 'concern'
      });
    }

  world.questProgress = {
    questId: 'quest_ownership_dispute',
    completedSteps: [],
    resolvedPathId: null
  };

  world.founder = {
    unlocked: false,
    baseLevel: 0,
    reputation: world.agents?.player?.stats?.reputation ?? 0,
    contractsCompleted: 0,
    activeContract: null
  };

  world.progression = createInitialProgression();

  world.addEvent({
    type: 'incident_detected',
    locationId: 'workshop',
    actorIds: ['player', 'yasin'],
    description: 'Ownership Dispute #5562 is active: a contested deed threatens the workshop, a sale rumor is spreading.',
    public: true,
    visibleToAgentIds: ['player', 'yasin', 'lina'],
    importance: 4,
    payload: { incidentId: 'ownership_dispute_5562' }
  });
}

function isFounderUnlockedFromIncidents(world) {
  const incident = Object.values(world.incidents ?? {}).find((i) => i?.id === 'missing_delivery');
  return Boolean(incident?.status === 'resolved' || incident?.resolutionState === 'founder_negotiation');
}

function syncFounderAvailability(world) {
  if (!world.founder) return;
  if (isFounderUnlockedFromIncidents(world)) world.founder.unlocked = true;
}

export function summarizeWorld(world) {
  return [
    `World: ${world.name}, Day ${world.day}, ${world.time}.`,
    `State: ${Object.keys(world.agents).length} agents | ${Object.keys(world.memories).length} memories | ${Object.keys(world.rumors).length} rumors | ${Object.keys(world.incidents).length} incidents.`,
    `Locations: ${Object.values(world.locations).map((l) => l.name).join(', ')}.`,
    `Player evidence: ${(world.playerKnowledge?.evidenceIds || []).join(', ') || '(none)'}`
  ].join('\n');
}

export function buildSafeWorldSummary(world) {
  const incident = Object.values(world.incidents ?? {}).find((i) => i?.id === 'missing_delivery');
  return {
    world: { name: world.name, day: world.day, time: world.time },
    location: world.agents.player?.locationId ?? null,
    counts: {
      agents: Object.keys(world.agents).length,
      memories: Object.keys(world.memories).length,
      rumors: Object.keys(world.rumors).length,
      incidents: Object.keys(world.incidents).length
    },
    incident: incident ? {
      id: incident.id,
      title: incident.title,
      status: incident.status,
      visibleProblem: incident.visibleProblem ?? null
    } : null,
    evidenceCount: (world.playerKnowledge?.evidenceIds ?? []).length
  };
}

export function summarizeStatus(world) {
  const pk = world.playerKnowledge || {};
  return {
    world: { name: world.name, day: world.day, time: world.time, tick: world.tick },
    counts: {
      agents: Object.keys(world.agents).length,
      memories: Object.keys(world.memories).length,
      rumors: Object.keys(world.rumors).length,
      incidents: Object.keys(world.incidents).length
    },
    evidence: {
      knownFacts: pk.evidenceIds || [],
      suspectedCauses: pk.suspectedCauses || [],
      unresolvedQuestions: pk.unresolvedQuestions || [],
      knownRumorIds: pk.knownRumorIds || []
    },
    location: world.agents.player?.locationId ?? null
  };
}

function resolveAgent(world, name) {
  if (!name) return null;
  const norm = String(name).toLowerCase();
  if (world.agents[norm]) return norm;
  if (AGENT_ALIASES[norm]) return AGENT_ALIASES[norm];
  for (const a of Object.values(world.agents)) {
    if (a.name.toLowerCase() === norm) return a.id;
  }
  return null;
}

function resolveLocation(world, name) {
  if (!name) return null;
  const norm = String(name).toLowerCase();
  if (world.locations[norm]) return norm;
  if (LOCATION_ALIASES[norm]) return LOCATION_ALIASES[norm];
  for (const loc of Object.values(world.locations)) {
    if (loc.name.toLowerCase() === norm) return loc.id;
  }
  return null;
}

function resolveRumor(world, name) {
  const firstKnownRuntimeRumor = () => {
    const known = world.playerKnowledge?.knownRumorIds ?? [];
    return known.find((id) => world.rumors?.[id])
      ?? Object.keys(world.rumors || {})[0]
      ?? null;
  };

  const resolvePackRumorToRuntime = (packRumorId) => {
    const pack = getContentPack();
    const packRumor = pack?.rumors?.find((r) => r.id === packRumorId);
    if (!packRumor?.claim) return null;
    const normalizedClaim = String(packRumor.claim).trim().toLowerCase();
    return Object.values(world.rumors || {}).find((r) =>
      String(r.claim ?? '').trim().toLowerCase() === normalizedClaim
    )?.id ?? null;
  };

  if (!name) return firstKnownRuntimeRumor();
  if (world.rumors[name]) return name;
  const fromPack = resolvePackRumorToRuntime(name);
  if (fromPack) return fromPack;
  for (const r of Object.values(world.rumors)) {
    if (r.id === name) return r.id;
  }
  return null;
}

function diffRelationships(before, after, actorId) {
  const out = [];
  for (const id of Object.keys(after.agents)) {
    if (id === actorId) continue;
    const a = before.agents[id]?.relationships?.[actorId];
    const b = after.agents[id]?.relationships?.[actorId];
    if (!a || !b) continue;
    const dt = (b.trust ?? 0) - (a.trust ?? 0);
    const df = (b.fear ?? 0) - (a.fear ?? 0);
    if (Math.abs(dt) >= 1 || Math.abs(df) >= 1) {
      out.push({ agentId: id, trustDelta: dt, fearDelta: df });
    }
  }
  return out;
}

/**
 * Parse a freeform text command into (command, args).
 * Examples:
 *   "look"                            -> { command: "look", args: {} }
 *   "talk sara"                       -> { command: "talk", args: { target: "sara" } }
 *   "ask rune nadia"                  -> { command: "ask", args: { target: "rune", topic: "nadia" } }
 *   "inspect cafe"                    -> { command: "inspect", args: { target: "cafe" } }
 *   "move workshop"                   -> { command: "move", args: { target: "workshop" } }
 *   "listen_rumors market"            -> { command: "listen_rumors", args: { target: "market" } }
 *   "pay malik 10"                    -> { command: "pay", args: { target: "malik", amount: 10 } }
 *   "trace_rumor"                     -> { command: "trace_rumor", args: {} }
 *   "counter_rumor rumor_00001"       -> { command: "counter_rumor", args: { rumor: "rumor_00001" } }
 *   "save" / "save my_arc"            -> { command: "save", args: { name?: "my_arc" } }
 *   "branch my_branch"                -> { command: "branch", args: { name: "my_branch" } }
 */
export function parseCommandText(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  let head = tokens[0].toLowerCase();
  const rest = tokens.slice(1);
  switch (head) {
    case 'look':
    case 'status':
    case 'ask_leno':
    case 'leno':
      return { command: head === 'leno' ? 'ask_leno' : head, args: {} };
    case 'move':
    case 'talk':
    case 'ask':
    case 'inspect':
    case 'listen_rumors':
    case 'listen':
    case 'pay':
    case 'trace_rumor':
    case 'counter_rumor':
    case 'save':
    case 'branch': {
      const args = {};
      if (head === 'listen') head = 'listen_rumors';
      if (head === 'leno') head = 'ask_leno';
      if (head === 'move' || head === 'talk' || head === 'ask' || head === 'inspect' || head === 'listen_rumors' || head === 'counter_rumor' || head === 'trace_rumor') {
        args.target = rest[0];
        if (head === 'ask' && rest[1]) args.topic = rest.slice(1).join(' ');
        if (head === 'inspect' && rest[1]) args.focus = rest.slice(1).join(' ');
        if (head === 'talk' && rest[1]) args.message = rest.slice(1).join(' ');
        if (head === 'counter_rumor' && rest[1]) args.message = rest.slice(1).join(' ');
        if (head === 'trace_rumor' && rest[0]) args.rumor = rest[0];
      } else if (head === 'pay') {
        args.target = rest[0];
        args.amount = rest[1] ? Number(rest[1]) : 0;
      } else if (head === 'save' || head === 'branch') {
        args.name = rest[0];
      }
      return { command: head, args };
    }
    case 'quit':
    case 'exit':
      return { command: 'quit', args: {} };
    default:
      return { command: head, args: { _raw: trimmed } };
  }
}

const KNOWN_COMMANDS = new Set([
  'look', 'status', 'move', 'talk', 'ask', 'inspect', 'listen_rumors',
  'trace_rumor', 'counter_rumor', 'pay', 'ask_leno', 'save', 'branch',
  'start_delivery_workflow', 'run_delivery_contract', 'list_contracts', 'quit'
]);

function attachMajorDecisionPrompt(result, command, effectiveArgs) {
  if (!result?.ok) return result;
  const prompt = resolveMajorDecisionPrompt({
    commandText: buildCommandText(command, effectiveArgs),
    command,
    args: effectiveArgs,
    playerKnowledge: result.world?.playerKnowledge ?? {},
    questProgress: result.world?.questProgress ?? null,
    consequence: result.consequence ?? null
  });
  if (!prompt?.branchSuggested) return result;
  return { ...result, majorDecisionPrompt: prompt };
}

function attachQuestProgress(result, command, effectiveArgs) {
  if (!result?.ok || !result.world) return result;
  const commandText = buildCommandText(command, effectiveArgs);
  const progress = recordQuestStep(result.world, commandText);
  if (!progress.matched && !progress.pathCompleted) return result;

  const next = { ...result };
  if (progress.pathCompleted) {
    const reward = progress.pathCompleted.reward;
    const rewardNote = reward?.badge ? ` Badge: ${reward.badge}.` : '';
    next.text = `${result.text}\n\nQuest resolved: ${progress.pathCompleted.label}.${rewardNote}`;
    next.questResolution = progress.pathCompleted;
    syncFounderAvailability(result.world);
  }
  if (progress.matched && progress.step && !progress.pathCompleted) {
    next.questStepCompleted = progress.step;
  }
  return next;
}

function attachProgression(result, command, effectiveArgs) {
  if (!result?.ok || !result.world) return result;
  if (!result.world.progression) {
    result.world.progression = createInitialProgression();
  }
  const commandText = buildCommandText(command, effectiveArgs);
  const { progression, delta } = awardProgression(
    result.world.progression,
    result,
    commandText
  );
  result.world.progression = progression;
  return {
    ...result,
    progression: summarizeProgression(progression),
    progressionDelta: delta
  };
}

function resolveCommandCore(world, command, effectiveArgs) {
  const actorId = 'player';
  syncFounderAvailability(world);

  try {
    switch (command) {
      case 'look': {
        const before = snapshotForDelta(world);
        return {
          ok: true, kind: 'look', command,
          text: summarizeWorld(world),
          safeWorldSummary: buildSafeWorldSummary(world),
          consequence: diffConsequence(world, before, actorId, null),
          world
        };
      }
      case 'status': {
        const before = snapshotForDelta(world);
        return {
          ok: true, kind: 'status', command,
          status: summarizeStatus(world),
          text: JSON.stringify(summarizeStatus(world), null, 2),
          consequence: diffConsequence(world, before, actorId, null),
          world
        };
      }
      case 'move': {
        const targetLoc = resolveLocation(world, effectiveArgs.target);
        if (!targetLoc) return { ok: false, kind: 'error', error: `unknown location: ${effectiveArgs.target}` };
        const fromLocationId = world.agents?.player?.locationId ?? null;
        const before = snapshotForDelta(world);
        const ev = executeAction(world, {
          actorId, actionId: 'move_to_location', targetLocationId: targetLoc
        });
        const toLocationId = world.agents?.player?.locationId ?? null;
        const walkAnimation = buildWalkAnimation(world, fromLocationId, toLocationId);
        const consequence = diffConsequence(world, before, actorId, ev);
        return { ok: true, kind: 'move', command, text: ev.description, consequence, walkAnimation, world };
      }
      case 'talk': {
        const targetId = resolveAgent(world, effectiveArgs.target);
        if (!targetId) return { ok: false, kind: 'error', error: `unknown agent: ${effectiveArgs.target}` };
        const message = effectiveArgs.message || '';
        const before = snapshotForDelta(world);
        const ev = executeAction(world, {
          actorId, actionId: 'talk_to_agent', targetAgentId: targetId,
          message, tone: effectiveArgs.tone || 'friendly'
        });
        return {
          ok: true, kind: 'dialogue', command,
          text: ev.description,
          dialogue: {
            agentName: world.agents[targetId].name,
            topic: null,
            message: message || '(conversation)',
            revealedFacts: [],
            evidenceIds: []
          },
          consequence: diffConsequence(world, before, actorId, ev),
          world
        };
      }
      case 'ask': {
        const targetId = resolveAgent(world, effectiveArgs.target);
        if (!targetId) return { ok: false, kind: 'error', error: `unknown agent: ${effectiveArgs.target}` };
        const topic = effectiveArgs.topic || 'delivery';
        const minTrust = dialogueMinTrust(targetId, topic);
        const trust = world.agents[targetId]?.relationships?.player?.trust ?? 0;
        if (trust < minTrust) {
          return {
            ok: false,
            kind: 'error',
            error: `${world.agents[targetId].name} won't discuss "${topic}" yet (need trust ${minTrust}, have ${trust}).`
          };
        }
        const before = snapshotForDelta(world);
        const ev = executeAction(world, {
          actorId, actionId: 'ask_about_topic', targetAgentId: targetId,
          topic, tone: effectiveArgs.tone || 'direct'
        });
        const packEntry = dialogueEntryFor(targetId, topic);
        const packUnlocks = dialogueUnlocksFor(targetId, topic);
        const granted = grantEvidence(world, packUnlocks);
        const revealed = ev.payload?.evidenceRevealed || granted.length > 0;
        const evidenceIds = granted.length
          ? granted
          : revealed
            ? packUnlocks.length ? packUnlocks : ['topic_evidence']
            : [];
        return {
          ok: true, kind: 'dialogue', command,
          text: ev.description,
          dialogue: {
            agentName: world.agents[targetId].name,
            topic,
            message: packEntry
              ? `Re: ${topic} (${packEntry.tone ?? 'neutral'})`
              : `Re: ${topic}`,
            revealedFacts: [revealed
              ? `${targetId} revealed useful information about "${topic}"`
              : `${targetId} gave a neutral answer about "${topic}"`],
            evidenceIds
          },
          consequence: diffConsequence(world, before, actorId, ev),
          world
        };
      }
      case 'inspect': {
        let targetAgent = resolveAgent(world, effectiveArgs.target);
        if (targetAgent && !world.agents[targetAgent]) targetAgent = null;
        const targetLoc = targetAgent ? null : resolveLocation(world, effectiveArgs.target);
        if (!targetAgent && !targetLoc) return { ok: false, kind: 'error', error: `unknown target: ${effectiveArgs.target}` };
        const before = snapshotForDelta(world);
        const focus = effectiveArgs.focus || effectiveArgs.topic || 'general';
        const request = targetAgent
          ? { actorId, actionId: 'ask_about_topic', targetAgentId: targetAgent, topic: 'general', tone: 'direct' }
          : { actorId, actionId: 'inspect_location', targetLocationId: targetLoc, focus };
        const ev = executeAction(world, request);
        let findingExtra = '';
        if (!targetAgent && targetLoc) {
          const packRewards = inspectPackRewards(targetLoc, focus);
          const granted = grantEvidence(world, packRewards.evidence);
          if (packRewards.findingText) findingExtra = packRewards.findingText;
          else if (granted.length) findingExtra = `Found: ${granted.join(', ')}`;
        }
        const label = targetAgent ? world.agents[targetAgent].name : world.locations[targetLoc].name;
        const detail = findingExtra || ev.description;
        return {
          ok: true, kind: 'inspect', command,
          text: `Inspected ${label}: ${detail}`,
          consequence: diffConsequence(world, before, actorId, ev),
          world
        };
      }
      case 'listen_rumors': {
        const targetLoc = resolveLocation(world, effectiveArgs.target);
        if (!targetLoc) return { ok: false, kind: 'error', error: `unknown location: ${effectiveArgs.target}` };
        const before = snapshotForDelta(world);
        const ev = executeAction(world, {
          actorId, actionId: 'listen_for_rumors', targetLocationId: targetLoc
        });
        const rumorIds = ev.payload?.rumorIds || [];
        if (targetLoc === 'market') {
          grantEvidence(world, ['market_rumor_chain']);
          syncPackRumorsAtLocation(world, 'market');
        }
        const locName = world.locations[targetLoc]?.name ?? effectiveArgs.target;
        return {
          ok: true, kind: 'rumors', command,
          text: ev.description || (rumorIds.length
            ? `Heard ${rumorIds.length} rumor(s) at ${locName}.`
            : `No new rumors at ${locName}.`),
          rumors: rumorIds.map((rid) => {
            const r = world.rumors[rid];
            return r ? { id: r.id, claim: r.claim, truthLevel: r.truthLevel } : { id: rid };
          }),
          consequence: diffConsequence(world, before, actorId, ev),
          world
        };
      }
      case 'trace_rumor': {
        const rumorId = resolveRumor(world, effectiveArgs.rumor);
        if (!rumorId) return { ok: false, kind: 'error', error: `unknown rumor: ${effectiveArgs.rumor}` };
        const before = snapshotForDelta(world);
        const ev = executeAction(world, {
          actorId, actionId: 'trace_rumor', rumorId, evidenceStrength: 80
        });
        const pk = world.playerKnowledge?.evidenceIds ?? [];
        if (pk.includes('market_rumor_chain')) {
          grantEvidence(world, ['rumor_source_nadia']);
        }
        return {
          ok: true, kind: 'rumors', command,
          text: ev.description,
          consequence: diffConsequence(world, before, actorId, ev),
          world
        };
      }
      case 'counter_rumor': {
        if (!hasCapability(world.progression, 'counter_rumor')) {
          return {
            ok: false,
            kind: 'error',
            error: 'Counter rumor unlocks at Street Listener (level 2) or after tracing rumors.'
          };
        }
        const rumorId = resolveRumor(world, effectiveArgs.rumor);
        if (!rumorId) return { ok: false, kind: 'error', error: `unknown rumor: ${effectiveArgs.rumor}` };
        const before = snapshotForDelta(world);
        const ev = executeAction(world, {
          actorId, actionId: 'counter_rumor', rumorId,
          counterClaim: effectiveArgs.message || 'I have evidence this rumor is false.',
          evidenceStrength: Number(effectiveArgs.evidenceStrength ?? 85)
        });
        return {
          ok: true, kind: 'rumors', command,
          text: ev.description,
          consequence: diffConsequence(world, before, actorId, ev),
          world
        };
      }
      case 'pay': {
        const targetId = resolveAgent(world, effectiveArgs.target);
        if (!targetId) return { ok: false, kind: 'error', error: `unknown agent: ${effectiveArgs.target}` };
        const amount = Number(effectiveArgs.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) return { ok: false, kind: 'error', error: 'amount must be a positive number' };
        const before = snapshotForDelta(world);
        const ev = executeAction(world, {
          actorId, actionId: 'pay_agent', targetAgentId: targetId, amount, reason: effectiveArgs.reason || 'play-action'
        });
        return {
          ok: true, kind: 'transaction', command,
          text: ev.description,
          consequence: diffConsequence(world, before, actorId, ev),
          world
        };
      }
      case 'start_delivery_workflow': {
        const before = snapshotForDelta(world);
        const founder = world.founder ?? (world.founder = {
          unlocked: false,
          baseLevel: 0,
          reputation: world.agents?.player?.stats?.reputation ?? 0,
          contractsCompleted: 0,
          activeContract: null
        });
        if (!founder.unlocked) {
          return { ok: false, kind: 'error', error: 'founder loop is locked until Missing Delivery is resolved' };
        }
        if (founder.activeContract) {
          return {
            ok: false,
            kind: 'error',
            command,
            error: 'founder contract already active; run run_delivery_contract first'
          };
        }
        founder.baseLevel = founderBaseLevelForContracts(founder.contractsCompleted ?? 0);
        const template = resolveFounderContractTemplate(effectiveArgs.contract ?? effectiveArgs.id, founder);
        if (!template) {
          return { ok: false, kind: 'error', error: `unknown or locked founder contract: ${effectiveArgs.contract ?? effectiveArgs.id ?? '(none)'}` };
        }
        const playerStats = world.agents?.player?.stats;
        const upfrontCost = template.upfrontCost ?? 0;
        const money = playerStats?.money ?? 0;
        if (upfrontCost > 0 && money < upfrontCost) {
          return {
            ok: false,
            kind: 'error',
            error: `need ${upfrontCost} money to start contract (have ${money})`
          };
        }
        if (upfrontCost > 0 && playerStats) {
          playerStats.money = money - upfrontCost;
        }
        founder.activeContract = createActiveFounderContract(template, world.tick ?? 0);
        return {
          ok: true,
          kind: 'founder',
          command,
          text: `Founder workflow started: ${template.label} for ${template.customer}. Upfront cost: ${upfrontCost}. Deliver with run_delivery_contract.`,
          contract: founder.activeContract,
          consequence: diffConsequence(world, before, actorId, {
            type: 'founder.contract_started',
            description: `Delivery contract started: ${template.id}`,
            importance: 6
          }),
          world
        };
      }
      case 'run_delivery_contract': {
        const before = snapshotForDelta(world);
        const founder = world.founder;
        if (!founder?.activeContract) {
          return { ok: false, kind: 'error', error: 'no active founder contract; run start_delivery_workflow first' };
        }
        const contract = founder.activeContract;
        const prevBaseLevel = founder.baseLevel ?? 0;
        founder.contractsCompleted = (founder.contractsCompleted ?? 0) + 1;
        founder.baseLevel = founderBaseLevelForContracts(founder.contractsCompleted);
        founder.reputation = (founder.reputation ?? 0) + (contract.reputationGain ?? 2);
        founder.activeContract = null;

        if (world.agents?.player?.stats) {
          world.agents.player.stats.money = (world.agents.player.stats.money ?? 0) + (contract.payout ?? 20);
          world.agents.player.stats.reputation = (world.agents.player.stats.reputation ?? 0) + (contract.reputationGain ?? 2);
          world.agents.player.stats.energy = Math.max(0, (world.agents.player.stats.energy ?? 100) - (contract.energyCost ?? 6));
        }
        if (world.economy) {
          world.economy.foodScarcity = Math.max(0, (world.economy.foodScarcity ?? 0) + (contract.stockImpact ?? -3));
          world.economy.trustPressure = Math.max(0, (world.economy.trustPressure ?? 0) - 1);
        }

        const tierUp = founder.baseLevel > prevBaseLevel;
        return {
          ok: true,
          kind: 'founder',
          command,
          text: `Contract delivered (${contract.label ?? contract.templateId ?? contract.id}). +${contract.payout} money, +${contract.reputationGain} reputation.${tierUp ? ` Base level now ${founder.baseLevel}.` : ''}`,
          consequence: diffConsequence(world, before, actorId, {
            type: 'founder.contract_completed',
            description: 'Delivery contract completed',
            importance: tierUp ? 9 : 8
          }),
          world
        };
      }
      case 'list_contracts': {
        const founder = world.founder ?? { unlocked: false };
        if (!founder.unlocked) {
          return { ok: false, kind: 'error', error: 'founder loop is locked until Missing Delivery is resolved' };
        }
        founder.baseLevel = founderBaseLevelForContracts(founder.contractsCompleted ?? 0);
        const contracts = listFounderContractOffers(founder);
        const before = snapshotForDelta(world);
        return {
          ok: true,
          kind: 'founder',
          command,
          text: `Founder contracts (${contracts.filter((c) => c.status === 'available').length} available, base level ${founder.baseLevel}).`,
          contracts,
          consequence: diffConsequence(world, before, actorId, null),
          world
        };
      }
      case 'ask_leno': {
        const before = snapshotForDelta(world);
        executeAction(world, { actorId, actionId: 'ask_leno' });
        return {
          ok: true, kind: 'leno', command,
          leno: {
            summary: lenoSummarize(world, { scope: 'world' }),
            suggestions: lenoSuggestActions(world, { incidentId: 'missing_delivery' })
          },
          text: lenoSummarize(world, { scope: 'world' }),
          consequence: diffConsequence(world, before, actorId, {
            type: 'leno.consulted',
            description: 'Consulted Leno',
            importance: 2
          }),
          world
        };
      }
      case 'save':
      case 'branch':
        // Save/branch are no-ops at the engine level; the CLI/web layer
        // persists via openSqliteWorldStore. We just signal intent.
        return {
          ok: true, kind: 'persistence', command,
          text: `${command}: ${effectiveArgs.name || 'main'} (persisted by caller)`,
          snapshot: { name: effectiveArgs.name || 'main', intent: command },
          world
        };
      case 'quit':
        return { ok: true, kind: 'quit', command, text: 'Goodbye.' };
      default:
        return { ok: false, kind: 'error', error: `unknown command: ${command}` };
    }
  } catch (e) {
    return { ok: false, kind: 'error', command, error: e.message };
  }
}

/**
 * Dispatch one player command. Pure function — returns a result
 * envelope, mutates `world` in place (so callers can keep using
 * the same world across calls).
 */
export function resolveCommand(world, commandOrText, args = {}) {
  let command = commandOrText;
  let effectiveArgs = args;
  if (KNOWN_COMMANDS.has(String(commandOrText).toLowerCase())) {
    command = String(commandOrText).toLowerCase();
  } else {
    const parsed = parseCommandText(commandOrText);
    if (!parsed) return { ok: false, kind: 'error', error: 'empty command' };
    if (!KNOWN_COMMANDS.has(parsed.command)) {
      return { ok: false, kind: 'error', error: `unknown command: ${parsed.command}` };
    }
    command = parsed.command;
    effectiveArgs = { ...parsed.args, ...args };
  }
  return attachAudioCues(
    attachProgression(
      attachQuestProgress(
        attachMajorDecisionPrompt(
          resolveCommandCore(world, command, effectiveArgs),
          command,
          effectiveArgs
        ),
        command,
        effectiveArgs
      ),
      command,
      effectiveArgs
    ),
    command,
    effectiveArgs
  );
}

function snapshotForDelta(world) {
  return {
    agents: JSON.parse(JSON.stringify(world.agents)),
    memories: world.memories,
    rumors: JSON.parse(JSON.stringify(world.rumors)),
    economy: JSON.parse(JSON.stringify(world.economy ?? {})),
    founder: JSON.parse(JSON.stringify(world.founder ?? {})),
    incidents: JSON.parse(JSON.stringify(world.incidents ?? {})),
    playerKnowledge: JSON.parse(JSON.stringify(world.playerKnowledge ?? { evidenceIds: [], knownRumorIds: [] }))
  };
}

function diffRumorTruthChanges(before, after) {
  const changes = [];
  for (const id of Object.keys(after.rumors ?? {})) {
    const prev = before.rumors?.[id];
    const next = after.rumors[id];
    if (!prev || !next) continue;
    const delta = (next.truthLevel ?? 0) - (prev.truthLevel ?? 0);
    if (delta !== 0) changes.push({ rumorId: id, truthLevelDelta: delta });
  }
  return changes;
}

function diffIncidentChanges(before, after) {
  const changes = [];
  for (const id of Object.keys(after.incidents ?? {})) {
    const prev = before.incidents?.[id];
    const next = after.incidents[id];
    if (!prev || !next) continue;
    if (prev.status !== next.status || (prev.resolutionState ?? null) !== (next.resolutionState ?? null)) {
      changes.push({
        incidentId: id,
        beforeStatus: prev.status ?? null,
        afterStatus: next.status ?? null,
        beforeResolutionState: prev.resolutionState ?? null,
        afterResolutionState: next.resolutionState ?? null
      });
    }
  }
  return changes;
}

function diffUnlocks(before, after) {
  const unlocks = [];
  const wasFounder = Boolean(before.founder?.unlocked);
  const nowFounder = Boolean(after.founder?.unlocked);
  if (!wasFounder && nowFounder) unlocks.push('founder_loop');
  const prevTier = before.founder?.baseLevel ?? 0;
  const nextTier = after.founder?.baseLevel ?? 0;
  if (nextTier > prevTier) unlocks.push(`founder_tier_${nextTier}`);
  return unlocks;
}

function diffConsequence(world, before, actorId, ev) {
  const relChanges = diffRelationships(before, world, actorId);
  const memDelta = Object.keys(world.memories).length - Object.keys(before.memories).length;
  const newRumors = Object.keys(world.rumors).length - Object.keys(before.rumors).length;
  const moneyDelta = (world.agents[actorId]?.stats?.money ?? 0) - (before.agents[actorId]?.stats?.money ?? 0);
  const reputationDelta = (world.agents[actorId]?.stats?.reputation ?? 0) - (before.agents[actorId]?.stats?.reputation ?? 0);
  const energyDelta = (world.agents[actorId]?.stats?.energy ?? 0) - (before.agents[actorId]?.stats?.energy ?? 0);
  const evidenceBefore = new Set(before.playerKnowledge?.evidenceIds ?? []);
  const evidenceDelta = (world.playerKnowledge?.evidenceIds ?? []).filter((id) => !evidenceBefore.has(id));
  const rumorDelta = diffRumorTruthChanges(before, world);
  const relationshipDelta = relChanges.length
    ? { trustTotal: relChanges.reduce((sum, r) => sum + (r.trustDelta ?? 0), 0), changes: relChanges }
    : { trustTotal: 0, changes: [] };
  const incidentDelta = diffIncidentChanges(before, world);
  const unlocks = diffUnlocks(before, world);
  const economyDelta = {
    foodScarcity: (world.economy?.foodScarcity ?? 0) - (before.economy?.foodScarcity ?? 0),
    trustPressure: (world.economy?.trustPressure ?? 0) - (before.economy?.trustPressure ?? 0)
  };
  const founderDelta = {
    contractsCompleted: (world.founder?.contractsCompleted ?? 0) - (before.founder?.contractsCompleted ?? 0),
    baseLevel: (world.founder?.baseLevel ?? 0) - (before.founder?.baseLevel ?? 0),
    reputation: (world.founder?.reputation ?? 0) - (before.founder?.reputation ?? 0),
    activeContractChanged: (world.founder?.activeContract?.id ?? null) !== (before.founder?.activeContract?.id ?? null)
  };
  const incident = Object.values(world.incidents || {}).find((i) => i.id === 'missing_delivery');
  return {
    relationships: relChanges,
    newMemories: memDelta,
    newRumors,
    moneyDelta,
    reputationDelta,
    energyDelta,
    evidenceDelta,
    rumorDelta,
    relationshipDelta,
    incidentDelta,
    unlocks,
    factionDelta: { changes: [] },
    economyDelta,
    founderDelta,
    incident: incident ? { title: incident.title, status: incident.status, resolutionState: incident.resolutionState ?? null } : null,
    lastEvent: ev ? { type: ev.type, description: ev.description, importance: ev.importance } : null
  };
}

export function runScriptedPath(world, pathName) {
  const which = (pathName || 'all').toLowerCase();
  const results = [];
  const runners = {
    peaceful: runPeaceful,
    investigation: runInvestigation,
    founder: runFounder
  };
  const list = which === 'all' ? Object.keys(runners) : [which];
  for (const name of list) {
    if (runners[name]) {
      const r = runners[name](world);
      results.push({ path: name, ...r });
    }
  }
  return results;
}

function runPeaceful(world) {
  world.agents.player.locationId = 'cafe';
  resolveCommand(world, 'inspect', { target: 'cafe' });
  resolveCommand(world, 'talk', { target: 'sara', message: "I'll help you with the delivery.", tone: 'friendly' });
  resolveCommand(world, 'ask', { target: 'amina', topic: 'mediation' });
  resolveCommand(world, 'pay', { target: 'malik', amount: 5, reason: 'peaceful-mediation' });
  helpSaraPeacefully(world);
  syncFounderAvailability(world);
  return { resolutionPath: 'peaceful_mediation' };
}

function runInvestigation(world) {
  resolveCommand(world, 'inspect', { target: 'cafe' });
  resolveCommand(world, 'listen_rumors', { target: 'market' });
  resolveCommand(world, 'ask', { target: 'rune', topic: 'nadia' });
  const rumorIds = Object.keys(world.rumors || {});
  if (rumorIds.length) {
    resolveCommand(world, 'trace_rumor', { rumor: rumorIds[0] });
    resolveCommand(world, 'counter_rumor', { rumor: rumorIds[0], message: 'Nadia is the source.' });
  }
  if (!world.playerKnowledge.evidenceIds.includes('rumor_source_nadia')) {
    world.playerKnowledge.evidenceIds.push('rumor_source_nadia');
  }
  if (world.incidents?.missing_delivery?.status === 'active') {
    resolveIncident(world, 'missing_delivery', 'investigation_and_counter_rumor', 'player');
  }
  syncFounderAvailability(world);
  return { resolutionPath: 'investigation_and_counter_rumor' };
}

function runFounder(world) {
  resolveCommand(world, 'inspect', { target: 'workshop' });
  resolveCommand(world, 'pay', { target: 'malik', amount: 15, reason: 'founder-negotiation' });
  resolveCommand(world, 'talk', { target: 'sara', message: 'I arranged an alternative delivery from the workshop.' });
  if (world.incidents?.missing_delivery?.status === 'active') {
    resolveIncident(world, 'missing_delivery', 'founder_negotiation', 'player');
  }
  syncFounderAvailability(world);
  return { resolutionPath: 'founder_negotiation' };
}
