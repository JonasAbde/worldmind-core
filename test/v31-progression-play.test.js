/**
 * v31 — progression wired into live play runtime
 */
import { it } from 'node:test';
import assert from 'node:assert';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';
import { buildGameShell } from '../src/play/play-api-payload.js';
import { hasCapability } from '../src/play/progression.js';

function newWorld() {
  return bootstrapWorld({ scenarioPath: './scenarios/new-aarhus-district-01.json', days: 1 });
}

it('v31.1 — bootstrapWorld seeds progression state', () => {
  const world = newWorld();
  assert.ok(world.progression, 'expected world.progression');
  assert.equal(world.progression.level, 1);
  assert.equal(world.progression.xp, 0);
  assert.deepEqual(world.progression.unlockedSkills, ['observe', 'talk_basic', 'inspect_basic']);
});

it('v31.2 — inspect and talk award XP after successful commands', () => {
  const world = newWorld();
  const inspect = resolveCommand(world, 'inspect', { target: 'cafe' });
  assert.equal(inspect.ok, true);
  assert.ok(inspect.progressionDelta?.xpGained >= 8);
  assert.ok(inspect.progression?.xp >= 8);

  const talk = resolveCommand(world, 'talk', { target: 'sara', message: 'hello' });
  assert.equal(talk.ok, true);
  assert.ok(talk.progressionDelta?.xpGained >= 10);
  assert.ok(talk.progression?.xp >= inspect.progression.xp + 10);
});

it('v31.3 — gameShell exposes progression, nextUnlock, and capabilities', () => {
  const world = newWorld();
  resolveCommand(world, 'inspect', { target: 'cafe' });
  const shell = buildGameShell(world);
  assert.ok(shell.progression);
  assert.equal(typeof shell.progression.level, 'number');
  assert.equal(typeof shell.progression.xp, 'number');
  assert.ok(shell.progression.nextUnlock);
  assert.ok(Array.isArray(shell.progression.capabilities));
  const counter = shell.progression.capabilities.find((c) => c.id === 'counter_rumor');
  assert.ok(counter);
  assert.equal(counter.unlocked, false);
});

it('v31.4 — counter_rumor gated until rumor_trace_basic unlock', () => {
  const world = newWorld();
  const rumorId = Object.keys(world.rumors || {})[0];
  assert.ok(rumorId, 'expected seeded rumor');

  const blocked = resolveCommand(world, 'counter_rumor', { rumor: rumorId });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /counter rumor/i);
  assert.equal(hasCapability(world.progression, 'counter_rumor'), false);

  resolveCommand(world, 'listen_rumors', { target: 'market' });
  assert.equal(hasCapability(world.progression, 'counter_rumor'), true);

  const allowed = resolveCommand(world, 'counter_rumor', { rumor: rumorId, message: 'false claim' });
  assert.equal(allowed.ok, true);
});

it('v31.5 — founder contract awards progression XP', () => {
  const world = newWorld();
  world.incidents = {
    missing_delivery: { id: 'missing_delivery', status: 'resolved', title: 'The Missing Delivery' }
  };
  world.founder = {
    unlocked: true,
    baseLevel: 0,
    reputation: 0,
    contractsCompleted: 0,
    activeContract: null
  };
  world.agents.player.stats.money = 100;

  resolveCommand(world, 'start_delivery_workflow', { contract: 'delivery_sara_emergency' });
  const result = resolveCommand(world, 'run_delivery_contract');
  assert.equal(result.ok, true);
  assert.ok(result.progressionDelta?.xpGained >= 15);
});
