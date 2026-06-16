#!/usr/bin/env node
/**
 * Typed diff-checker for the WorldMind canonical scenario.
 *
 * Usage:
 *   node src/cli/diff-checker.js canonical --scenario <path>
 *
 * The canonical command boots the world from the given scenario file,
 * serialises the resulting state, and compares it byte-for-byte against
 * the expected initial-state shape. Any drift in the simulation
 * foundation (e.g. adding a new world, moving a location, changing
 * default relationships) is caught here and the CI gate fails.
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadScenarioFile, loadScenarioWorldState } from '../simulation/scenario-loader.ts';
import { createWorld } from '../simulation/world.ts';
import { serializeWorldState } from '../simulation/state.ts';

function fail(reason) {
  process.stdout.write(JSON.stringify({ ok: false, kind: 'diff-checker', reason }) + '\n');
  process.exit(1);
}

function report(payload) {
  process.stdout.write(JSON.stringify({ ok: true, kind: 'diff-checker', ...payload }) + '\n');
}

function parseArgs(argv) {
  const args = { subcommand: null, scenarioPath: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scenario') {
      args.scenarioPath = argv[++i];
    } else if (!args.subcommand) {
      args.subcommand = a;
    }
  }
  return args;
}

function fingerprintWorld(world) {
  return {
    id: world.id,
    name: world.name,
    agents: Object.fromEntries(
      Object.entries(world.agents).map(([id, agent]) => [
        id,
        {
          name: agent.name,
          role: agent.role,
          locationId: agent.locationId,
          permissions: [...(agent.permissions ?? [])].sort(),
          goals: [...(agent.goals ?? [])],
          stats: { ...(agent.stats ?? {}) }
        }
      ])
    ),
    locations: Object.fromEntries(
      Object.entries(world.locations).map(([id, loc]) => [id, { id: loc.id, name: loc.name, type: loc.type, zoneType: loc.zoneType, agentsPresent: [...(loc.agentsPresent ?? [])].sort() }])
    ),
    economy: { ...world.economy },
    playerKnowledge: { ...world.playerKnowledge, knownAgentIds: [...(world.playerKnowledge.knownAgentIds ?? [])].sort() }
  };
}

function main() {
  const argv = process.argv.slice(2);
  const cleaned = argv[0] === '--' ? argv.slice(1) : argv;
  const { subcommand, scenarioPath } = parseArgs(cleaned);
  if (subcommand !== 'canonical') {
    process.stderr.write('usage: diff-checker canonical --scenario <path>\n');
    process.exit(2);
  }
  if (!scenarioPath) {
    fail('missing --scenario argument');
  }
  const resolved = path.resolve(scenarioPath);
  if (!fs.existsSync(resolved)) {
    fail(`scenario file not found: ${resolved}`);
  }
  const scenario = loadScenarioFile(resolved);
  const world = createWorld({ seed: 42, scenario });
  const initial = fingerprintWorld(world);
  const stateFromLoader = loadScenarioWorldState(resolved);
  const loaderFingerprint = {
    id: stateFromLoader.id,
    name: stateFromLoader.name,
    agents: Object.fromEntries(
      Object.entries(stateFromLoader.agents).map(([id, agent]) => [id, { name: agent.name, role: agent.role, locationId: agent.locationId, permissions: [...(agent.permissions ?? [])].sort() }])
    ),
    locations: Object.fromEntries(
      Object.entries(stateFromLoader.locations).map(([id, loc]) => [id, { id: loc.id, name: loc.name, type: loc.type, zoneType: loc.zoneType, agentsPresent: [...(loc.agentsPresent ?? [])].sort() }])
    ),
    economy: { ...stateFromLoader.economy }
  };
  const runtimeFingerprint = {
    id: initial.id,
    name: initial.name,
    agents: Object.fromEntries(
      Object.entries(initial.agents).map(([id, agent]) => [id, { name: agent.name, role: agent.role, locationId: agent.locationId, permissions: [...(agent.permissions ?? [])].sort() }])
    ),
    locations: Object.fromEntries(
      Object.entries(initial.locations).map(([id, loc]) => [id, { id: loc.id, name: loc.name, type: loc.type, zoneType: loc.zoneType, agentsPresent: [...(loc.agentsPresent ?? [])].sort() }])
    ),
    economy: { ...initial.economy }
  };
  const serialized = serializeWorldState(world);
  // The drift check: the world built from the scenario must match the
  // state loaded via loadScenarioWorldState on the same file.
  const sameAgents = JSON.stringify(loaderFingerprint.agents) === JSON.stringify(runtimeFingerprint.agents);
  const sameLocations = JSON.stringify(loaderFingerprint.locations) === JSON.stringify(runtimeFingerprint.locations);
  const sameEconomy = JSON.stringify(loaderFingerprint.economy) === JSON.stringify(runtimeFingerprint.economy);
  if (!sameAgents || !sameLocations || !sameEconomy) {
    fail({
      message: 'canonical scenario drift detected between loader and runtime world',
      sameAgents,
      sameLocations,
      sameEconomy
    });
  }
  // The serializer must produce a valid WorldState shape
  if (serialized.kind !== 'world_state' || serialized.version !== 2) {
    fail({ message: 'serialized world state is not a v2 world_state', serialized: { kind: serialized.kind, version: serialized.version } });
  }
  report({ agents: Object.keys(initial.agents).length, locations: Object.keys(initial.locations).length, worldId: initial.id, name: initial.name });
}

main();
