/**
 * v22 — Founder Contract Loop v1
 * Verifies: list_contracts, start_delivery_workflow, run_delivery_contract, one-at-a-time.
 */
import { it } from 'node:test';
import assert from 'node:assert';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';

function newWorld() {
  return bootstrapWorld({ scenarioPath: './scenarios/new-aarhus-district-01.json', days: 1 });
}

it('v22.1 — before resolution: start_delivery_workflow returns error', () => {
  const world = newWorld();
  if (world.founder) world.founder.unlocked = false;
  else world.founder = { unlocked: false, baseLevel: 0, reputation: 0, contractsCompleted: 0, activeContract: null };
  const result = resolveCommand(world, 'start_delivery_workflow');
  assert.equal(result.ok, false, 'should be locked');
  assert(result.error?.includes('locked') || result.error?.includes('resolved'));
});

it('v22.2 — before resolution: list_contracts returns error', () => {
  const world = newWorld();
  if (world.founder) world.founder.unlocked = false;
  else world.founder = { unlocked: false, baseLevel: 0, reputation: 0, contractsCompleted: 0, activeContract: null };
  const result = resolveCommand(world, 'list_contracts');
  assert.equal(result.ok, false, 'should be locked');
  assert(result.error?.includes('locked') || result.error?.includes('resolved'));
});

it('v22.3 — after resolution: start_delivery_workflow succeeds', () => {
  const world = newWorld();
  world.incidents = { missing_delivery: { id: 'missing_delivery', status: 'resolved', title: 'The Missing Delivery' } };
  world.founder = { unlocked: true, baseLevel: 0, reputation: 0, contractsCompleted: 0, activeContract: null };
  const result = resolveCommand(world, 'start_delivery_workflow');
  assert.equal(result.ok, true, `should succeed: ${result.error}`);
  assert(result.consequence !== undefined);
});

it('v22.4 — no active contract: run_delivery_contract returns error', () => {
  const world = newWorld();
  if (!world.founder) world.founder = { unlocked: true, baseLevel: 0, reputation: 0, contractsCompleted: 0, activeContract: null };
  else { world.founder.unlocked = true; world.founder.activeContract = null; }
  const result = resolveCommand(world, 'run_delivery_contract');
  assert.equal(result.ok, false);
  assert(result.error?.includes('active') || result.error?.includes('no active'));
});

it('v22.5 — active contract: run_delivery_contract succeeds and pays out', () => {
  const world = newWorld();
  world.incidents = { missing_delivery: { id: 'missing_delivery', status: 'resolved', title: 'The Missing Delivery' } };
  world.founder = { unlocked: true, baseLevel: 0, reputation: 0, contractsCompleted: 0, activeContract: null };
  const moneyBefore = world.agents?.player?.stats?.money ?? 0;
  resolveCommand(world, 'start_delivery_workflow');
  const runResult = resolveCommand(world, 'run_delivery_contract');
  assert.equal(runResult.ok, true, `should succeed: ${runResult.error}`);
  const moneyAfter = world.agents?.player?.stats?.money ?? 0;
  assert.ok(moneyAfter > moneyBefore, 'player should receive payout');
  assert('founderDelta' in (runResult.consequence || {}));
  assert('moneyDelta' in (runResult.consequence || {}));
});

it('v22.6 — one contract at a time', () => {
  const world = newWorld();
  world.incidents = { missing_delivery: { id: 'missing_delivery', status: 'resolved', title: 'The Missing Delivery' } };
  world.founder = { unlocked: true, baseLevel: 0, reputation: 0, contractsCompleted: 0, activeContract: null };
  resolveCommand(world, 'start_delivery_workflow');
  const second = resolveCommand(world, 'start_delivery_workflow');
  assert.equal(second.ok, false);
  assert(second.error?.includes('already') || second.error?.includes('active'));
});

it('v22.7 — founderDelta shape on completion', () => {
  const world = newWorld();
  world.incidents = { missing_delivery: { id: 'missing_delivery', status: 'resolved', title: 'The Missing Delivery' } };
  world.founder = { unlocked: true, baseLevel: 0, reputation: 0, contractsCompleted: 0, activeContract: null };
  resolveCommand(world, 'start_delivery_workflow');
  const result = resolveCommand(world, 'run_delivery_contract');
  const fd = result.consequence?.founderDelta;
  assert(fd !== undefined);
  assert('contractsCompleted' in fd);
  assert('baseLevel' in fd);
  assert('reputation' in fd);
  assert('activeContractChanged' in fd);
});
