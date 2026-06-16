#!/usr/bin/env node
/**
 * demo:guided-play — deterministic end-to-end play walkthrough.
 *
 * Peaceful path resolves the missing-delivery incident, unlocks the founder
 * loop, completes three delivery contracts, and promotes base level to tier 1.
 *
 * Uses play-engine only: bootstrapWorld, resolveCommand, runScriptedPath.
 *
 * Flags:
 *   --scenario=PATH   scenario file (default scenarios/new-aarhus-district-01.json)
 *   --days=N          simulation days for bootstrap (default 1)
 *   --contract=ID     contract template for all three runs (default delivery_sara_emergency)
 *
 * Exit codes:
 *   0 — demo completed successfully
 *   1 — demo did not reach expected end state
 *   2 — runtime error
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bootstrapWorld,
  resolveCommand,
  runScriptedPath
} from '../play/play-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = process.cwd();
const DEFAULT_SCENARIO = path.join(REPO, 'scenarios/new-aarhus-district-01.json');
const DEFAULT_CONTRACT = 'delivery_sara_emergency';
const CONTRACT_COUNT = 3;
const TARGET_BASE_LEVEL = 1;

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--') continue;
    if (a.startsWith('--') && a.includes('=')) {
      const eq = a.indexOf('=');
      flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else if (a.startsWith('--')) {
      flags[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? (argv[++i]) : true;
    }
  }
  return flags;
}

function ensureActiveMissingDelivery(world) {
  const existing = world.incidents?.missing_delivery;
  world.incidents = world.incidents ?? {};
  world.incidents.missing_delivery = {
    id: 'missing_delivery',
    title: existing?.title ?? 'The Missing Delivery',
    status: 'active',
    resolutionState: 'unresolved',
    involvedAgentIds: existing?.involvedAgentIds ?? ['sara', 'malik', 'nadia', 'rune']
  };
  world.founder = {
    unlocked: false,
    baseLevel: 0,
    reputation: world.agents?.player?.stats?.reputation ?? 0,
    contractsCompleted: 0,
    activeContract: null
  };
  return world;
}

function founderSnapshot(world) {
  const founder = world.founder ?? {};
  return {
    unlocked: Boolean(founder.unlocked),
    baseLevel: founder.baseLevel ?? 0,
    contractsCompleted: founder.contractsCompleted ?? 0,
    reputation: founder.reputation ?? 0,
    activeContract: founder.activeContract
      ? { templateId: founder.activeContract.templateId ?? founder.activeContract.id ?? null }
      : null
  };
}

function incidentSnapshot(world) {
  const incident = world.incidents?.missing_delivery;
  if (!incident) return null;
  return {
    id: incident.id,
    status: incident.status,
    resolutionState: incident.resolutionState ?? null
  };
}

/**
 * Run the guided peaceful → founder contract loop. Pure; no I/O.
 */
export function runGuidedPlayDemo({
  scenarioPath = DEFAULT_SCENARIO,
  days = 1,
  contractId = DEFAULT_CONTRACT,
  contractCount = CONTRACT_COUNT
} = {}) {
  const world = ensureActiveMissingDelivery(bootstrapWorld({ scenarioPath, days }));
  const steps = [];

  steps.push({
    phase: 'bootstrap',
    incidentStatus: world.incidents.missing_delivery.status,
    founderUnlocked: world.founder.unlocked
  });

  const pathResults = runScriptedPath(world, 'peaceful');
  const peaceful = pathResults[0] ?? { resolutionPath: null };
  steps.push({
    phase: 'incident_resolution',
    path: 'peaceful',
    resolutionPath: peaceful.resolutionPath ?? null,
    incidentStatus: world.incidents.missing_delivery.status,
    founderUnlocked: world.founder.unlocked
  });

  for (let i = 0; i < contractCount; i += 1) {
    const start = resolveCommand(world, 'start_delivery_workflow', { contract: contractId });
    steps.push({
      phase: 'contract_start',
      index: i + 1,
      contract: contractId,
      ok: start.ok,
      error: start.error ?? null
    });
    if (!start.ok) {
      return buildReport({ ok: false, steps, world, contractId, error: start.error });
    }

    const run = resolveCommand(world, 'run_delivery_contract');
    steps.push({
      phase: 'contract_complete',
      index: i + 1,
      contract: contractId,
      ok: run.ok,
      error: run.error ?? null,
      contractsCompleted: world.founder?.contractsCompleted ?? 0,
      baseLevel: world.founder?.baseLevel ?? 0
    });
    if (!run.ok) {
      return buildReport({ ok: false, steps, world, contractId, error: run.error });
    }
  }

  return buildReport({ ok: true, steps, world, contractId });
}

function buildReport({ ok, steps, world, contractId, error = null }) {
  const founder = founderSnapshot(world);
  const incident = incidentSnapshot(world);
  const success = ok
    && incident?.status === 'resolved'
    && incident?.resolutionState === 'peaceful_mediation'
    && founder.unlocked === true
    && founder.contractsCompleted === CONTRACT_COUNT
    && founder.baseLevel === TARGET_BASE_LEVEL;

  return {
    ok: success,
    kind: 'guided-play-demo',
    path: 'peaceful',
    contractId,
    steps,
    incident,
    founder,
    contractsCompleted: founder.contractsCompleted,
    baseLevel: founder.baseLevel,
    error
  };
}

function report(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function main() {
  try {
    const flags = parseFlags(process.argv.slice(2));
    const scenarioPath = flags.scenario || DEFAULT_SCENARIO;
    const days = Number(flags.days ?? 1);
    const contractId = flags.contract || DEFAULT_CONTRACT;

    const result = runGuidedPlayDemo({ scenarioPath, days, contractId });
    report(result);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    report({
      ok: false,
      kind: 'guided-play-demo',
      error: String(error?.message || error)
    });
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
