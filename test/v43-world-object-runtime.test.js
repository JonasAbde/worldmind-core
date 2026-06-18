import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWorld, parseCommandText, resolveCommand } from '../src/play/play-engine.js';
import { build3DVisualCues, validate3DVisualCues } from '../src/play/district-3d-layout.js';
import { worldObjectState } from '../src/play/world-object-runtime.js';

test('v43: use_object parses as a first-class command', () => {
  assert.deepEqual(parseCommandText('use_object apartment_access_panel'), {
    command: 'use_object',
    args: { target: 'apartment_access_panel' }
  });
});

test('v43: world object interaction is permission-scoped and event sourced', () => {
  const world = bootstrapWorld();
  assert.equal(resolveCommand(world, 'move apartment').ok, true);
  assert.equal(worldObjectState(world, 'apartment_access_panel'), 'locked');
  const result = resolveCommand(world, 'use_object apartment_access_panel');
  assert.equal(result.ok, true, result.error);
  assert.equal(result.kind, 'world_object');
  assert.equal(result.worldObject.stateBefore, 'locked');
  assert.equal(result.worldObject.stateAfter, 'authenticated');
  assert.equal(worldObjectState(world, 'apartment_access_panel'), 'authenticated');
  const event = world.events.at(-1);
  assert.equal(event.type, 'world_object_interacted');
  assert.equal(event.payload.objectId, 'apartment_access_panel');
});

test('v43: remote object use is rejected until the player travels there', () => {
  const world = bootstrapWorld();
  const remoteCue = build3DVisualCues(world).props.find((prop) => prop.id === 'apartment_access_panel');
  assert.equal(remoteCue.available, false);
  assert.match(remoteCue.blockedReason, /Travel to/i);
  const blocked = resolveCommand(world, 'use_object apartment_access_panel');
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /requires travel/i);
  assert.equal(resolveCommand(world, 'move apartment').ok, true);
  const used = resolveCommand(world, 'use_object apartment_access_panel');
  assert.equal(used.ok, true, used.error);
  const localCue = build3DVisualCues(world).props.find((prop) => prop.id === 'apartment_access_panel');
  assert.equal(localCue.available, true);
  assert.equal(localCue.blockedReason, null);
});

test('v43: delivery drone diagnostics can grant whitelisted evidence', () => {
  const world = bootstrapWorld();
  const used = resolveCommand(world, 'use_object cafe_delivery_drone');
  assert.equal(used.ok, true, used.error);
  assert.ok(world.playerKnowledge.evidenceIds.includes('cafe_delivery_gap'));
});

test('v43: visualCues exposes current object state and guardrail metadata', () => {
  const world = bootstrapWorld();
  assert.equal(resolveCommand(world, 'move apartment').ok, true);
  resolveCommand(world, 'use_object apartment_access_panel');
  const cues = build3DVisualCues(world);
  const panel = cues.props.find((prop) => prop.id === 'apartment_access_panel');
  assert.equal(panel.state, 'authenticated');
  assert.equal(panel.command, 'use_object apartment_access_panel');
  assert.equal(panel.requiredPermission, 'inspect');
  assert.equal(typeof panel.risk, 'number');
  assert.equal(validate3DVisualCues(cues).ok, true);
});

test('v43: unknown objects cannot create events', () => {
  const world = bootstrapWorld();
  const before = world.events.length;
  const result = resolveCommand(world, 'use_object hidden_admin_console');
  assert.equal(result.ok, false);
  assert.equal(world.events.length, before);
});
