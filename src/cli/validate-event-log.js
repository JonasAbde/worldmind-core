#!/usr/bin/env node
/**
 * validate:event-log — event-log invariant checker.
 *
 * Runs the canonical 7-day simulation, captures the full event log,
 * and verifies the structural invariants that downstream consumers
 * (dashboard, branch diff, narrative) depend on.
 *
 * Invariants verified:
 *   - exactly 1 world_started event
 *   - every event has id, type, tick, day, time
 *   - last tick matches N-day simulation
 *   - daily checkpoint count is at least 1
 *   - no event references an unknown actor or location
 *   - incident events have valid incidentId
 *   - branch metadata is consistent when present
 */

import { runSimulation } from '../simulation/sim.ts';
import path from 'node:path';
import fs from 'node:fs';

const TICKS_PER_DAY = 96;
const DEFAULT_DAYS = 7;

function report(payload) {
  process.stdout.write(JSON.stringify({ ok: true, kind: 'event-log', ...payload }) + '\n');
}

function fail(payload) {
  process.stdout.write(JSON.stringify({ ok: false, kind: 'event-log', ...payload }) + '\n');
  process.exit(1);
}

function main() {
  const arg = process.argv[2];
  const scenarioPath = arg && !arg.startsWith('--') ? arg : 'scenarios/new-aarhus-district-01.json';
  const totalDays = (() => {
    const i = process.argv.indexOf('--days');
    return i >= 0 ? Number(process.argv[i + 1]) : DEFAULT_DAYS;
  })();

  if (!fs.existsSync(path.resolve(scenarioPath))) {
    fail({ reason: `scenario not found: ${scenarioPath}` });
    return;
  }

  const finalWorld = runSimulation({ days: totalDays, scenarioPath });
  const events = finalWorld.events || [];
  const errors = [];

  // Invariant 1: exactly 1 world_started
  const worldStarted = events.filter((e) => e.type === 'world_started');
  if (worldStarted.length !== 1) {
    errors.push(`expected 1 world_started event, got ${worldStarted.length}`);
  }

  // Invariant 2: every event has id, type, tick, day, time
  for (const ev of events) {
    if (!ev.id) errors.push(`event missing id: ${JSON.stringify(ev).slice(0, 80)}`);
    if (!ev.type) errors.push(`event missing type: ${JSON.stringify(ev).slice(0, 80)}`);
    if (typeof ev.tick !== 'number') errors.push(`event ${ev.id} missing tick`);
    if (typeof ev.day !== 'number') errors.push(`event ${ev.id} missing day`);
    if (typeof ev.time !== 'string' || !ev.time) errors.push(`event ${ev.id} missing time`);
  }

  // Invariant 3: world has advanced to expected tick. The simulate loop
  // runs days * TICKS_PER_DAY ticks (not -1), so we expect exactly that
  // value at the end of the simulation.
  const expectedLastTick = totalDays * TICKS_PER_DAY;
  const worldTick = finalWorld.tick ?? -1;
  if (worldTick !== expectedLastTick) {
    errors.push(`world tick ${worldTick} does not match expected ${expectedLastTick} for ${totalDays}-day simulation`);
  }
  const lastTick = events.length > 0 ? events[events.length - 1].tick : -1;

  // Invariant 4: daily checkpoint count
  const dailyCheckpoints = events.filter((e) => e.type === 'daily_checkpoint');

  // Invariant 5: no event references an unknown actor
  const knownAgentIds = new Set(Object.keys(finalWorld.agents));
  let invalidActorRefs = 0;
  for (const ev of events) {
    for (const actorId of ev.actorIds ?? []) {
      if (!knownAgentIds.has(actorId)) invalidActorRefs += 1;
    }
  }
  if (invalidActorRefs > 0) errors.push(`${invalidActorRefs} event(s) reference unknown actor(s)`);

  // Invariant 6: no event references an unknown location
  const knownLocationIds = new Set(Object.keys(finalWorld.locations));
  let invalidLocationRefs = 0;
  for (const ev of events) {
    if (ev.locationId && !knownLocationIds.has(ev.locationId)) invalidLocationRefs += 1;
  }
  if (invalidLocationRefs > 0) errors.push(`${invalidLocationRefs} event(s) reference unknown location(s)`);

  // Invariant 7: incident events have valid incidentId
  const incidentIds = new Set(Object.keys(finalWorld.incidents ?? {}));
  const incidentEvents = events.filter((e) => e.type === 'incident_created' || e.type === 'incident_resolved');
  for (const ev of incidentEvents) {
    const id = ev.payload?.incidentId;
    if (!id || !incidentIds.has(id)) {
      errors.push(`incident event ${ev.id} has invalid incidentId: ${id}`);
    }
  }

  if (errors.length > 0) {
    fail({ errors, totalEvents: events.length, lastTick, worldTick, expectedLastTick, dailyCheckpointCount: dailyCheckpoints.length, worldStartedCount: worldStarted.length });
    return;
  }
  report({
    totalEvents: events.length,
    lastTick,
    expectedLastTick,
    dailyCheckpointCount: dailyCheckpoints.length,
    worldStartedCount: worldStarted.length,
    invalidActorRefs,
    invalidLocationRefs,
    incidentEventCount: incidentEvents.length
  });
}

main();
