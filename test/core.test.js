import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeScenario, runSimulation, evaluateWorld, tickWorld } from '../src/simulation/sim.ts';
import { executeAction, validateAction } from '../src/simulation/actions.ts';
import { ACTIONS } from '../src/simulation/constants.js';
import { lenoSummarize } from '../src/simulation/leno.ts';
import { generateDialogueReply } from '../src/simulation/dialogue.ts';
import { generateDashboard } from '../src/simulation/dashboard.ts';

test('initial world has MVP agents, locations and secret memories', () => {
  const world = initializeScenario();
  assert.equal(Object.keys(world.agents).length, 11); // 10 NPCs + player
  assert.equal(Object.keys(world.locations).length, 4);
  assert.ok(Object.values(world.memories).some(m => m.agentId === 'nadia' && m.visibility === 'secret'));
});

test('MVP simulation passes acceptance criteria', () => {
  const world = runSimulation({ days: 7, seed: 42 });
  const result = evaluateWorld(world);
  assert.equal(result.incidentDetected, true);
  assert.ok(result.memoryCount >= 20, `memoryCount ${result.memoryCount}`);
  assert.ok(result.relationshipChanges >= 10, `relationshipChanges ${result.relationshipChanges}`);
  assert.ok(result.rumorSpreadCount >= 5, `rumorSpreadCount ${result.rumorSpreadCount}`);
  assert.ok(result.economyChanges >= 3, `economyChanges ${result.economyChanges}`);
  assert.equal(result.passed, true);
});

test('The Missing Delivery is detected and resolved in the canonical 7-day run', () => {
  const world = runSimulation({ days: 7, seed: 42 });
  const incident = world.incidents.missing_delivery;
  assert.ok(incident);
  assert.equal(incident.title, 'The Missing Delivery');
  assert.equal(incident.status, 'resolved');
  assert.equal(incident.resolutionState, 'investigation_and_counter_rumor');
  assert.ok(world.events.some(e => e.type === 'incident_detected'));
  assert.ok(world.events.some(e => e.type === 'delivery_failed'));
  assert.ok(world.events.some(e => e.type === 'delivery_restored'));
});

test('Leno does not reveal hidden truth before evidence', () => {
  const world = initializeScenario();
  for (let i = 0; i < 16; i++) tickWorld(world);
  const summary = lenoSummarize(world);
  assert.match(summary, /not enough proof/i);
  assert.doesNotMatch(summary, /Nadia planted/i);
});

test('malformed or risky actions are blocked by validator', () => {
  const world = initializeScenario();
  assert.throws(() => validateAction(world, { actorId: 'player', actionId: 'steal_cash' }), /Unknown action/);
  assert.throws(() => validateAction(world, { actorId: 'player', actionId: ACTIONS.PAY_AGENT }), /requires targetAgentId/);
  assert.throws(() => executeAction(world, { actorId: 'player', actionId: ACTIONS.PAY_AGENT, targetAgentId: 'rune', amount: 0 }), /positive number/);
});

test('dashboard export includes overview, incidents and timeline sections', () => {
  const world = runSimulation({ days: 7, seed: 42 });
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worldmind-dashboard-'));
  const { htmlPath, dataPath } = generateDashboard(world, outDir);
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(fs.existsSync(htmlPath));
  assert.ok(fs.existsSync(dataPath));
  assert.match(html, /World Overview/);
  assert.match(html, /Incident View/);
  assert.match(html, /Event Log/);
  assert.match(html, /The Missing Delivery/);
});

test('dialogue is relationship and topic aware', () => {
  const world = runSimulation({ days: 1, seed: 42 });
  const reply = generateDialogueReply(world, { speakerId: 'malik', listenerId: 'player', topic: 'sara delivery' });
  assert.ok(reply.reply.length > 10);
  assert.equal(reply.speakerId, 'malik');
});
