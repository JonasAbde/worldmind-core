/**
 * v30 — Walk animation paths for 3D district travel
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWorld, resolveCommand } from '../src/play/play-engine.js';
import { buildWalkAnimation, findWalkPath, buildWalkGraphFromCues } from '../src/play/walk-path.js';
import { build3DVisualCues } from '../src/play/district-3d-layout.js';

function buildAdjacency(edges = []) {
  const adj = new Map();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!adj.has(edge.to)) adj.set(edge.to, []);
    adj.get(edge.from).push(edge.to);
    adj.get(edge.to).push(edge.from);
  }
  return adj;
}

test('v30.1 — BFS finds path cafe → market', () => {
  const world = bootstrapWorld();
  const cues = build3DVisualCues(world);
  const adj = buildAdjacency(cues.walkGraph?.edges ?? []);
  const path = findWalkPath(adj, 'cafe', 'market');
  assert.deepEqual(path, ['cafe', 'market']);
});

test('v30.2 — move command returns walkAnimation with waypoints', () => {
  const world = bootstrapWorld();
  world.agents.player.locationId = 'cafe';
  const result = resolveCommand(world, 'move market');
  assert.equal(result.ok, true, result.error);
  assert.ok(result.walkAnimation);
  assert.equal(result.walkAnimation.from, 'cafe');
  assert.equal(result.walkAnimation.to, 'market');
  assert.ok(result.walkAnimation.waypoints.length >= 2);
  assert.ok(result.walkAnimation.durationMs >= 400);
});

test('v30.3 — visualCues v4 includes walkGraph', () => {
  const world = bootstrapWorld();
  const cues = build3DVisualCues(world);
  assert.equal(cues.version, 5);
  assert.ok(cues.walkGraph?.nodes);
  assert.ok(Object.keys(cues.walkGraph.nodes).length >= 4);
  assert.ok((cues.walkGraph?.edges?.length ?? 0) >= 3);
});

test('v30.4 — same-location move has no walkAnimation', () => {
  const world = bootstrapWorld();
  const loc = world.agents.player.locationId;
  const result = resolveCommand(world, `move ${loc}`);
  assert.equal(result.ok, true);
  assert.equal(result.walkAnimation, null);
});

test('v30.5 — buildWalkGraphFromCues matches district nodes', () => {
  const world = bootstrapWorld();
  const cues = build3DVisualCues(world);
  const graph = buildWalkGraphFromCues(cues);
  assert.ok(graph.nodes.cafe);
  assert.ok(graph.nodes.market);
});
