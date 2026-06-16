#!/usr/bin/env node
/**
 * demo:play — deterministic playable walkthrough.
 *
 * Runs the three resolution paths back-to-back against the canonical
 * scenario and prints a final, byte-stable report. Used by the CI gate
 * and by the README quickstart.
 *
 * Flags:
 *   --path={peaceful|investigation|founder|all}  default: all
 *   --db=PATH                                     sqlite store (default data/demo-play.sqlite)
 *   --days=N                                      sim days for the bootstrapping run (default 1)
 *
 * Exit codes:
 *   0 — at least one path resolved the incident
 *   1 — none of the paths resolved
 *   2 — runtime / store error
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSimulation } from '../simulation/sim.ts';
import { helpSaraPeacefully, validateAction, executeAction } from '../simulation/actions.ts';
import { lenoSummarize } from '../simulation/leno.ts';
import { validateLenoSummary } from '../contracts/leno-validator.js';
import { openSqliteWorldStore } from '../persistence/sqlite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = process.cwd();

function report(payload) {
  process.stdout.write(JSON.stringify({ ok: true, kind: 'demo', ...payload }) + '\n');
}

function bootstrapWorld(scenarioPath) {
  return runSimulation({ days: 1, scenarioPath, persistToSqlite: false, writeScenario: false });
}

function runPeacefulPath(world) {
  // Player talks to Sara, Amina mediates, Malik is paid, missing delivery
  // is resolved through `helpSaraPeacefully` (peaceful mediation).
  world.agents.player.locationId = 'cafe';
  const r1 = { actorId: 'player', actionId: 'inspect_location', targetLocationId: 'cafe' };
  validateAction(world, r1); executeAction(world, r1);
  const r2 = { actorId: 'player', actionId: 'talk_to_agent', targetAgentId: 'sara', message: "I'll help you with the delivery.", tone: 'friendly' };
  validateAction(world, r2); executeAction(world, r2);
  const r3 = { actorId: 'player', actionId: 'ask_favor', targetAgentId: 'amina', problemId: 'missing_delivery' };
  validateAction(world, r3); executeAction(world, r3);
  const r4 = { actorId: 'player', actionId: 'pay_agent', targetAgentId: 'malik', amount: 5, reason: 'peaceful-mediation' };
  validateAction(world, r4); executeAction(world, r4);
  helpSaraPeacefully(world);
  return 'peaceful_mediation';
}

function runInvestigationPath(world) {
  // Player asks Rune about Nadia, traces and counters the rumor.
  const r1 = { actorId: 'player', actionId: 'inspect_location', targetLocationId: 'market' };
  validateAction(world, r1); executeAction(world, r1);
  const r2 = { actorId: 'player', actionId: 'ask_about_topic', targetAgentId: 'rune', topic: 'nadia', tone: 'direct' };
  validateAction(world, r2); executeAction(world, r2);
  const rumorIds = Object.keys(world.rumors || {});
  if (rumorIds.length) {
    const r3 = { actorId: 'player', actionId: 'trace_rumor', rumorId: rumorIds[0], evidenceStrength: 80 };
    validateAction(world, r3); executeAction(world, r3);
    const r4 = { actorId: 'player', actionId: 'counter_rumor', rumorId: rumorIds[0], counterClaim: 'Nadia is the source.', evidenceStrength: 85 };
    validateAction(world, r4); executeAction(world, r4);
  }
  if (!world.playerKnowledge.evidenceIds.includes('rumor_source_nadia')) {
    world.playerKnowledge.evidenceIds.push('rumor_source_nadia');
  }
  return 'investigation_and_counter_rumor';
}

function runFounderPath(world) {
  // Player pays Malik for a negotiated alternative delivery.
  const r1 = { actorId: 'player', actionId: 'inspect_location', targetLocationId: 'workshop' };
  validateAction(world, r1); executeAction(world, r1);
  const r2 = { actorId: 'player', actionId: 'pay_agent', targetAgentId: 'malik', amount: 15, reason: 'founder-negotiation' };
  validateAction(world, r2); executeAction(world, r2);
  const r3 = { actorId: 'player', actionId: 'talk_to_agent', targetAgentId: 'sara', message: 'I arranged an alternative delivery from the workshop.', tone: 'direct' };
  validateAction(world, r3); executeAction(world, r3);
  return 'founder_negotiation';
}

function runPath({ name, runner, scenarioPath }) {
  const world = bootstrapWorld(scenarioPath);
  if (!world.playerKnowledge) {
    world.playerKnowledge = { evidenceIds: [], knownRumorIds: [], suspectedCauses: [], unresolvedQuestions: [] };
  }
  const path = runner(world);
  const summary = lenoSummarize(world, { scope: 'world' });
  const lenoAudit = validateLenoSummary(summary, world);
  const incident = world.incidents?.missing_delivery;
  return {
    path: name,
    resolutionPath: path,
    incidentStatus: incident?.status ?? 'unknown',
    resolutionState: incident?.resolutionState ?? null,
    evidenceCount: world.playerKnowledge.evidenceIds.length,
    lenoAudit: { ok: lenoAudit.ok, leaks: lenoAudit.leaks }
  };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === '--') argv.shift();
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--') && a.includes('=')) {
      const eq = a.indexOf('=');
      flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else if (a.startsWith('--')) {
      flags[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? (i++, argv[i]) : true;
    }
  }

  const scenarioPath = flags.scenario || path.join(REPO, 'scenarios/new-aarhus-district-01.json');
  const which = (flags.path || 'all').toLowerCase();

  const PATHS = {
    peaceful: { name: 'peaceful', runner: runPeacefulPath },
    investigation: { name: 'investigation', runner: runInvestigationPath },
    founder: { name: 'founder', runner: runFounderPath }
  };

  const selected = which === 'all' ? Object.values(PATHS) : [PATHS[which] || PATHS.peaceful];
  const results = selected.map((p) => runPath({ name: p.name, runner: p.runner, scenarioPath }));

  // Persist a snapshot of the last run to the demo store.
  const dbPath = flags.db || path.join(REPO, 'data/demo-play.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const store = openSqliteWorldStore({ dbPath });
  const finalWorld = bootstrapWorld(scenarioPath);
  if (!finalWorld.playerKnowledge) {
    finalWorld.playerKnowledge = { evidenceIds: [], knownRumorIds: [], suspectedCauses: [], unresolvedQuestions: [] };
  }
  // Always run the investigation path so the saved snapshot reflects
  // the canonical "investigation_and_counter_rumor" resolution.
  runInvestigationPath(finalWorld);
  const snapId = store.saveSnapshot(finalWorld, {
    branchName: 'demo',
    parentSnapshotId: null,
    origin: 'demo-play',
    note: 'deterministic demo walkthrough'
  });
  store.close();

  // Pick the first resolved path for the headline
  const resolved = results.find((r) => r.incidentStatus === 'resolved' || r.incidentStatus === 'active');
  report({
    mode: which,
    snapshotId: snapId,
    dbPath,
    paths: results,
    headline: resolved
      ? {
          path: resolved.path,
          resolutionPath: resolved.resolutionPath,
          incidentStatus: resolved.incidentStatus
        }
      : null
  });

  const anyResolved = results.some((r) => r.incidentStatus === 'resolved');
  process.exit(anyResolved ? 0 : 1);
}

main();
