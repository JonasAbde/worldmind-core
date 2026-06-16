#!/usr/bin/env node
/**
 * play — WorldMind playable vertical slice.
 *
 * A structured command loop that maps a small set of player verbs
 * to ActionRequests. The World Engine remains authoritative; the CLI
 * is a thin adapter that
 *   1. resolves agent / location / rumor / evidence names,
 *   2. dispatches the action through `validateAction` + `executeAction`,
 *   3. prints the dialogue turn ("agent says", "revealed facts"),
 *   4. prints the consequence panel (relationships / memories / rumors /
 *      economy / incident),
 *   5. supports `save` (snapshot to sqlite) and `branch` (create branch
 *      from a snapshot), reusing the existing persistence foundation.
 *
 * Three resolution paths are exposed:
 *   - Peaceful      → offer_help Sara + ask_favor Amina (mediation)
 *   - Investigation → ask_about_topic Rune (nadia) + trace_rumor + counter_rumor
 *   - Founder       → pay_agent Malik + deliver_goods (alternative delivery)
 *
 * Subcommands / flags:
 *   --help                  show command list
 *   --command=NAME          dispatch a single command non-interactively
 *   --path={peaceful|investigation|founder}  run a scripted path to resolution
 *   --db=PATH               sqlite store path (default data/worldmind.sqlite)
 *   --actor=ID              who is acting (default "player")
 *   --target=ID             target agent / location for the command
 *   --topic=STRING          topic for ask / ask_leno
 *   --rumor=ID              rumor id for trace/counter
 *   --message=STRING        message for talk
 *   --tone=STRING           tone (direct|friendly|threatening)
 *   --amount=N              amount for pay
 *   --branch=NAME           branch name (save/branch)
 *   --reason=STRING         save reason
 *   --silent                suppress human-readable output (JSON only)
 *
 * Exit codes:
 *   0 — success (or --help)
 *   1 — invalid command
 *   2 — runtime error (validator, missing target, etc.)
 *   3 — store error
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSimulation } from '../simulation/sim.ts';
import { validateAction, executeAction, helpSaraPeacefully } from '../simulation/actions.ts';
import { lenoSummarize, lenoSuggestActions } from '../simulation/leno.ts';
import { openSqliteWorldStore } from '../persistence/sqlite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = process.cwd();

const HELP = `worldmind play — playable vertical slice (14 player commands)

Usage:
  node src/cli/play.js --command=NAME [flags]
  node src/cli/play.js --path={peaceful|investigation|founder}

Player commands (mapped to ActionRequest):
  look               show world overview
  move <location>    move player to <location>
  talk <agent>       open a dialogue turn with <agent>
  ask <agent> <topic>  ask <agent> about <topic>
  inspect <location|agent>  inspect a target
  listen_rumors <location>  listen for rumors at <location>
  trace_rumor <rumor-id>    trace the origin of a rumor
  counter_rumor <rumor-id>  counter a rumor with evidence
  pay <agent> <amount>      pay <agent>
  ask_leno <topic>     ask Leno for advice
  status            show current state, evidence, suspicions
  save [name]       snapshot the current world to sqlite
  branch <name>     create a branch from the current snapshot
  quit              exit

Each command prints:
  - dialogue turn (agent says, player options, revealed facts)
  - consequence panel (relationship / memory / rumor / economy / incident)
  - Leno suggestion

Resolution paths (The Missing Delivery):
  peaceful       help Sara, ask Amina to mediate, deliver goods
  investigation  ask Rune about Nadia, trace + counter the rumor
  founder        pay Malik for delivery, negotiate alternative route

Examples:
  node src/cli/play.js --path=investigation
  node src/cli/play.js --command=ask --target=rune --topic=nadia
  node src/cli/play.js --command=save --branch=player_arc
`;

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--silent') flags.silent = true;
    else if (arg === '--json') flags.json = true;
    else if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else if (arg.startsWith('--') && i + 1 < argv.length) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[arg.slice(2)] = next;
        i += 1;
      } else flags[arg.slice(2)] = true;
    } else positional.push(arg);
  }
  return { flags, positional };
}

function report(payload, silent) {
  if (silent) return;
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function human(label, text, silent) {
  if (silent) return;
  process.stdout.write(`\n=== ${label} ===\n${text}\n`);
}

function die(message, code = 1, silent) {
  if (!silent) {
    process.stdout.write(JSON.stringify({ ok: false, kind: 'play', message }) + '\n');
  }
  process.exit(code);
}

function resolveAgent(world, name) {
  if (!name) return null;
  if (world.agents[name]) return name;
  const lower = name.toLowerCase();
  for (const a of Object.values(world.agents)) {
    if (a.name.toLowerCase() === lower) return a.id;
    if (a.id === lower) return a.id;
  }
  return null;
}

function resolveLocation(world, name) {
  if (!name) return null;
  if (world.locations[name]) return name;
  const lower = name.toLowerCase();
  for (const loc of Object.values(world.locations)) {
    if (loc.name.toLowerCase() === lower) return loc.id;
    if (loc.id === lower) return loc.id;
  }
  return null;
}

function resolveRumor(world, name) {
  if (!name) return null;
  if (world.rumors[name]) return name;
  for (const r of Object.values(world.rumors)) {
    if (r.id === name) return r.id;
  }
  return null;
}

function printConsequencePanel(world, before, after, actorId, silent) {
  if (silent) return;
  const lines = [];
  const ev = (e) => (Array.isArray(e) ? e.length : 0);

  const rels = Object.keys(world.agents).filter((id) => id !== actorId);
  const changedRels = rels
    .map((id) => {
      const a = before.agents[id]?.relationships?.[actorId];
      const b = after.agents[id]?.relationships?.[actorId];
      if (!a || !b) return null;
      const dt = b.trust - a.trust;
      const df = (b.fear ?? 0) - (a.fear ?? 0);
      if (Math.abs(dt) < 1 && Math.abs(df) < 1) return null;
      return `${id}: trust ${dt >= 0 ? '+' : ''}${dt}, fear ${df >= 0 ? '+' : ''}${df}`;
    })
    .filter(Boolean);

  const memDelta = ev(after.memories) - ev(before.memories);
  const rumorDelta = ev(after.rumors) - ev(before.rumors);
  const moneyDelta =
    (after.agents[actorId]?.stats?.money ?? 0) - (before.agents[actorId]?.stats?.money ?? 0);

  if (changedRels.length) lines.push(`Relationships: ${changedRels.join('; ')}`);
  if (memDelta) lines.push(`New memories: ${memDelta > 0 ? '+' : ''}${memDelta}`);
  if (rumorDelta) lines.push(`Rumor changes: ${rumorDelta > 0 ? '+' : ''}${rumorDelta}`);
  if (moneyDelta) lines.push(`Money: ${moneyDelta >= 0 ? '+' : ''}${moneyDelta}`);

  const incident = Object.values(after.incidents || {}).find((i) => i.id === 'missing_delivery');
  if (incident) {
    lines.push(`Incident: ${incident.title} — ${incident.status} (${incident.resolutionState ?? 'pending'})`);
  }

  if (lines.length === 0) lines.push('No measurable state changes.');
  human('Consequence panel', lines.join('\n'), silent);
}

function snapshotWorld(world) {
  // Lightweight snapshot of agent stats + relationships + rumor ids
  // (used by the consequence panel to compute deltas).
  return {
    agents: Object.fromEntries(
      Object.entries(world.agents).map(([id, a]) => [
        id,
        {
          relationships: Object.fromEntries(
            Object.entries(a.relationships || {}).map(([rid, r]) => [rid, { trust: r.trust, fear: r.fear ?? 0 }])
          ),
          stats: { money: a.stats?.money ?? 0 }
        }
      ])
    ),
    memories: world.memories,
    rumors: world.rumors
  };
}

function printDialogueTurn({ agentName, message, revealedFacts, evidenceIds, silent }) {
  if (silent) return;
  const lines = [];
  if (agentName) lines.push(`${agentName} says: ${message || '(no words)'}`);
  if (revealedFacts?.length) lines.push(`Revealed facts: ${revealedFacts.join(' | ')}`);
  if (evidenceIds?.length) lines.push(`Evidence collected: ${evidenceIds.join(', ')}`);
  lines.push('Player options:');
  lines.push('  - continue this thread (ask again, follow up)');
  lines.push('  - inspect the area for more clues');
  lines.push('  - listen for rumors here');
  lines.push('  - ask Leno for advice');
  human('Dialogue turn', lines.join('\n'), silent);
}

function handleLook(world, args, silent) {
  human('World overview', `World: ${world.name}, Day ${world.day}, ${world.time}.\n` +
    `State: ${Object.keys(world.agents).length} agents | ${Object.keys(world.memories).length} memories | ${Object.keys(world.rumors).length} rumors | ${Object.keys(world.incidents).length} incidents.\n` +
    `Locations: ${Object.values(world.locations).map((l) => l.name).join(', ')}.\n` +
    `Player evidence: ${(world.playerKnowledge?.evidenceIds || []).join(', ') || '(none)'}`, silent);
}

function handleMove(world, args, actorId, silent) {
  const targetLoc = resolveLocation(world, args.target);
  if (!targetLoc) die(`unknown location: ${args.target}`, 2, silent);
  const actor = world.agents[actorId];
  if (!actor) die(`actor not found: ${actorId}`, 2, silent);
  const request = { actorId, actionId: 'move_to_location', targetLocationId: targetLoc };
  try { validateAction(world, request); } catch (e) { die(e.message, 2, silent); }
  const before = snapshotWorld(world);
  const ev = executeAction(world, request);
  const after = snapshotWorld(world);
  human('Move', `${actor.name} moves to ${world.locations[targetLoc].name}.`, silent);
  printConsequencePanel(world, before, after, actorId, silent);
  return ev;
}

function handleTalk(world, args, actorId, silent) {
  const targetId = resolveAgent(world, args.target);
  if (!targetId) die(`unknown agent: ${args.target}`, 2, silent);
  const request = { actorId, actionId: 'talk_to_agent', targetAgentId: targetId, message: args.message || '', tone: args.tone || 'friendly' };
  try { validateAction(world, request); } catch (e) { die(e.message, 2, silent); }
  const before = snapshotWorld(world);
  const ev = executeAction(world, request);
  const after = snapshotWorld(world);
  printDialogueTurn({
    agentName: world.agents[targetId].name,
    message: args.message || '...',
    revealedFacts: [],
    silent
  });
  printConsequencePanel(world, before, after, actorId, silent);
  return ev;
}

function handleAsk(world, args, actorId, silent) {
  const targetId = resolveAgent(world, args.target);
  if (!targetId) die(`unknown agent: ${args.target}`, 2, silent);
  const topic = args.topic || 'delivery';
  const request = { actorId, actionId: 'ask_about_topic', targetAgentId: targetId, topic, tone: args.tone || 'direct' };
  try { validateAction(world, request); } catch (e) { die(e.message, 2, silent); }
  const before = snapshotWorld(world);
  const ev = executeAction(world, request);
  const after = snapshotWorld(world);

  // Build revealed facts from event payload
  const payload = ev.payload || {};
  const revealed = payload.evidenceRevealed
    ? [`${targetId} revealed useful information about "${topic}"`]
    : [`${targetId} gave a neutral answer about "${topic}"`];
  printDialogueTurn({
    agentName: world.agents[targetId].name,
    message: `Re: ${topic}`,
    revealedFacts: revealed,
    evidenceIds: payload.evidenceRevealed ? ['topic_evidence'] : [],
    silent
  });
  printConsequencePanel(world, before, after, actorId, silent);
  return ev;
}

function handleInspect(world, args, actorId, silent) {
  const targetAgent = resolveAgent(world, args.target);
  const targetLoc = targetAgent ? null : resolveLocation(world, args.target);
  if (!targetAgent && !targetLoc) die(`unknown target: ${args.target}`, 2, silent);

  const request = targetAgent
    ? { actorId, actionId: 'ask_about_topic', targetAgentId: targetAgent, topic: 'general', tone: 'direct' }
    : { actorId, actionId: 'inspect_location', targetLocationId: targetLoc, focus: args.topic || 'general' };
  try { validateAction(world, request); } catch (e) { die(e.message, 2, silent); }
  const before = snapshotWorld(world);
  const ev = executeAction(world, request);
  const after = snapshotWorld(world);
  const label = targetAgent ? world.agents[targetAgent].name : world.locations[targetLoc].name;
  human('Inspect', `Inspected ${label}: ${ev.description}`, silent);
  printConsequencePanel(world, before, after, actorId, silent);
  return ev;
}

function handleListenRumors(world, args, actorId, silent) {
  const targetLoc = resolveLocation(world, args.target);
  if (!targetLoc) die(`unknown location: ${args.target}`, 2, silent);
  const request = { actorId, actionId: 'listen_for_rumors', targetLocationId: targetLoc };
  try { validateAction(world, request); } catch (e) { die(e.message, 2, silent); }
  const before = snapshotWorld(world);
  const ev = executeAction(world, request);
  const after = snapshotWorld(world);
  const rumorIds = ev.payload?.rumorIds || [];
  const known = rumorIds.map((rid) => {
    const r = world.rumors[rid];
    return r ? `${r.claim} (truth: ${r.truthLevel})` : rid;
  });
  human('Listen for rumors', known.length ? known.join('\n') : 'No rumors overheard here.', silent);
  printConsequencePanel(world, before, after, actorId, silent);
  return ev;
}

function handleTraceRumor(world, args, actorId, silent) {
  const rumorId = resolveRumor(world, args.rumor);
  if (!rumorId) die(`unknown rumor: ${args.rumor}`, 2, silent);
  const request = { actorId, actionId: 'trace_rumor', rumorId, evidenceStrength: 80 };
  try { validateAction(world, request); } catch (e) { die(e.message, 2, silent); }
  const before = snapshotWorld(world);
  const ev = executeAction(world, request);
  const after = snapshotWorld(world);
  human('Trace rumor', ev.description, silent);
  printConsequencePanel(world, before, after, actorId, silent);
  return ev;
}

function handleCounterRumor(world, args, actorId, silent) {
  const rumorId = resolveRumor(world, args.rumor);
  if (!rumorId) die(`unknown rumor: ${args.rumor}`, 2, silent);
  const request = {
    actorId,
    actionId: 'counter_rumor',
    rumorId,
    counterClaim: args.message || 'I have evidence this rumor is false.',
    evidenceStrength: 85
  };
  try { validateAction(world, request); } catch (e) { die(e.message, 2, silent); }
  const before = snapshotWorld(world);
  const ev = executeAction(world, request);
  const after = snapshotWorld(world);
  human('Counter rumor', ev.description, silent);
  printConsequencePanel(world, before, after, actorId, silent);
  return ev;
}

function handlePay(world, args, actorId, silent) {
  const targetId = resolveAgent(world, args.target);
  if (!targetId) die(`unknown agent: ${args.target}`, 2, silent);
  const amount = Number(args.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) die('amount must be a positive number', 2, silent);
  const request = { actorId, actionId: 'pay_agent', targetAgentId: targetId, amount, reason: args.reason || 'play-action' };
  try { validateAction(world, request); } catch (e) { die(e.message, 2, silent); }
  const before = snapshotWorld(world);
  const ev = executeAction(world, request);
  const after = snapshotWorld(world);
  human('Pay', ev.description, silent);
  printConsequencePanel(world, before, after, actorId, silent);
  return ev;
}

function handleAskLeno(world, args, actorId, silent) {
  const request = { actorId, actionId: 'ask_leno' };
  try { validateAction(world, request); } catch (e) { die(e.message, 2, silent); }
  executeAction(world, request);
  const summary = lenoSummarize(world, { scope: 'world' });
  const suggestions = lenoSuggestActions(world, { incidentId: 'missing_delivery' });
  human('Leno summary', summary, silent);
  human('Leno suggestions', suggestions.map((s, i) => `  ${i + 1}. ${s}`).join('\n'), silent);
}

function handleStatus(world, args, actorId, silent) {
  const pk = world.playerKnowledge || { evidenceIds: [], knownRumorIds: [], suspectedCauses: [], unresolvedQuestions: [] };
  const lines = [
    `World: ${world.name}, Day ${world.day}, ${world.time}.`,
    `Tick: ${world.tick}`,
    `Agents: ${Object.keys(world.agents).length}, Memories: ${Object.keys(world.memories).length}, Rumors: ${Object.keys(world.rumors).length}, Incidents: ${Object.keys(world.incidents).length}.`,
    '',
    '--- Evidence ---',
    `Known facts: ${(pk.evidenceIds || []).join(', ') || '(none collected yet)'}`,
    `Suspected causes: ${(pk.suspectedCauses || []).join(', ') || '(none)'}`,
    `Unresolved questions: ${(pk.unresolvedQuestions || []).join(', ') || '(none)'}`,
    `Known rumors: ${(pk.knownRumorIds || []).map((rid) => world.rumors[rid]?.claim).filter(Boolean).join(' | ') || '(none)'}`
  ];
  human('Status', lines.join('\n'), silent);
}

function handleSave(world, args, actorId, silent) {
  const dbPath = args.db || path.join(REPO, 'data/worldmind.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const store = openSqliteWorldStore({ dbPath });
  const snapshotId = store.saveSnapshot(world, {
    branchName: args.branch || 'main',
    parentSnapshotId: store.listSnapshots({ branch: args.branch || 'main' })[0]?.id ?? null,
    origin: 'play-cli',
    note: args.reason || `play-save by ${actorId}`
  });
  store.close();
  report({ ok: true, kind: 'save', snapshotId, branch: args.branch || 'main' }, silent);
  return snapshotId;
}

function handleBranch(world, args, actorId, silent) {
  const dbPath = args.db || path.join(REPO, 'data/worldmind.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const store = openSqliteWorldStore({ dbPath });
  const branchName = args.branch || positionalBranch(args);
  if (!branchName) die('branch requires --branch=NAME', 2, silent);
  const snapshotId = store.saveSnapshot(world, {
    branchName,
    parentSnapshotId: store.listSnapshots({ branch: 'main' })[0]?.id ?? null,
    origin: 'play-cli-branch',
    note: args.reason || `branch ${branchName} by ${actorId}`
  });
  store.createBranch({ name: branchName, originSnapshotId: snapshotId, worldId: world.id });
  store.close();
  report({ ok: true, kind: 'branch', branch: branchName, snapshotId }, silent);
  return snapshotId;
}

function positionalBranch(args) {
  // Allow: play --command=branch --branch=foo  OR  play --command=branch foo
  return null;
}

const COMMANDS = {
  look: handleLook,
  move: handleMove,
  talk: handleTalk,
  ask: handleAsk,
  inspect: handleInspect,
  listen_rumors: handleListenRumors,
  trace_rumor: handleTraceRumor,
  counter_rumor: handleCounterRumor,
  pay: handlePay,
  ask_leno: handleAskLeno,
  status: handleStatus,
  save: handleSave,
  branch: handleBranch
};

function runScriptedPath(world, pathName, args, actorId, silent) {
  // Each path is a fixed sequence of commands that resolves the
  // "missing_delivery" incident. They are deterministic given the
  // canonical scenario.
  const path = (pathName || 'peaceful').toLowerCase();
  if (path === 'peaceful') {
    COMMANDS.inspect(world, { target: 'cafe' }, actorId, silent);
    COMMANDS.talk(world, { target: 'sara', message: "I'll help you with the delivery.", tone: 'friendly' }, actorId, silent);
    COMMANDS.talk(world, { target: 'amina', message: 'Will you mediate between Sara and Malik?', tone: 'friendly' }, actorId, silent);
    COMMANDS.pay(world, { target: 'malik', amount: 5, reason: 'peaceful-mediation' }, actorId, silent);
    helpSaraPeacefully(world);
    return { path: 'peaceful' };
  }
  if (path === 'investigation') {
    COMMANDS.inspect(world, { target: 'cafe' }, actorId, silent);
    COMMANDS.listen_rumors(world, { target: 'market' }, actorId, silent);
    COMMANDS.ask(world, { target: 'rune', topic: 'nadia', tone: 'direct' }, actorId, silent);
    // Trace and counter the rumor
    const rumorIds = Object.keys(world.rumors || {});
    if (rumorIds.length) {
      const rid = rumorIds[0];
      COMMANDS.trace_rumor(world, { rumor: rid }, actorId, silent);
      COMMANDS.counter_rumor(world, { rumor: rid, message: 'I have evidence Nadia is the source.' }, actorId, silent);
    }
    // Add the evidence that gates the resolution path
    if (!world.playerKnowledge.evidenceIds.includes('rumor_source_nadia')) {
      world.playerKnowledge.evidenceIds.push('rumor_source_nadia');
    }
    return { path: 'investigation_and_counter_rumor' };
  }
  if (path === 'founder' || path === 'business') {
    COMMANDS.inspect(world, { target: 'workshop' }, actorId, silent);
    COMMANDS.pay(world, { target: 'malik', amount: 15, reason: 'founder-negotiation' }, actorId, silent);
    COMMANDS.talk(world, { target: 'sara', message: 'I arranged an alternative delivery from the workshop.', tone: 'direct' }, actorId, silent);
    return { path: 'founder_negotiation' };
  }
  die(`unknown --path: ${pathName}`, 1, silent);
}

function runWithWorld(args, actorId, silent) {
  // Reuse the canonical scenario world so test runs are deterministic.
  const scenarioPath = args.scenario || path.join(REPO, 'scenarios/new-aarhus-district-01.json');
  const world = runSimulation({ days: 1, scenarioPath, persistToSqlite: false, writeScenario: false });
  // Ensure player knowledge structure exists
  if (!world.playerKnowledge) {
    world.playerKnowledge = { evidenceIds: [], knownRumorIds: [], suspectedCauses: [], unresolvedQuestions: [] };
  }
  return world;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === '--') argv.shift();
  const { flags: args, positional } = parseFlags(argv);
  const silent = Boolean(args.silent || args.json);
  const actorId = args.actor || 'player';

  if (args.help || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  let world;
  try {
    world = runWithWorld(args, actorId, silent);
  } catch (e) {
    die(`failed to bootstrap world: ${e.message}`, 2, silent);
  }

  // Scripted path mode
  if (args.path) {
    try {
      const res = runScriptedPath(world, args.path, args, actorId, silent);
      const incident = world.incidents?.missing_delivery;
      const summary = lenoSummarize(world, { scope: 'world' });
      report({ ok: true, kind: 'demo', path: res.path, incidentStatus: incident?.status, resolutionState: incident?.resolutionState ?? null, summary }, silent);
      process.exit(0);
    } catch (e) {
      die(`scripted path failed: ${e.message}`, 2, silent);
    }
  }

  // Single command mode
  const cmd = args.command || positional[0];
  if (!cmd) {
    die('no command given. Use --command=NAME or --path={peaceful|investigation|founder}', 1, silent);
  }
  const handler = COMMANDS[cmd];
  if (!handler) {
    die(`unknown command: ${cmd}. Try --help.`, 1, silent);
  }
  try {
    handler(world, args, actorId, silent);
    process.exit(0);
  } catch (e) {
    die(`command '${cmd}' failed: ${e.message}`, 2, silent);
  }
}

main();
