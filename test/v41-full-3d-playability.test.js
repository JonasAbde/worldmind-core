/**
 * v41 - full 3D playability glue
 *
 * The 3D HUD should be able to send natural player-facing commands without
 * exposing internal runtime rumor ids.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { bootstrapWorld, parseCommandText, resolveCommand } from '../src/play/play-engine.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = join(REPO, 'static-play', '3d-client.js');

function fetchJson(port, urlPath) {
  return fetch(`http://127.0.0.1:${port}${urlPath}`)
    .then(async (res) => ({ status: res.status, json: await res.json() }));
}

async function startServer(port = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/cli/play-server.js', '--port', String(port), '--host', '127.0.0.1'], {
      cwd: REPO,
      env: { ...process.env, WM_DB_PATH: join(REPO, 'data/test-v41-3d-play.sqlite') },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('server timeout'));
    }, 15000);
    child.stdout.on('data', (d) => {
      out += d.toString();
      const match = out.match(/play-server listening on (\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve({ child, port: Number(match[1]) });
      }
    });
    child.on('error', reject);
  });
}

function investigationReadyWorld() {
  const world = bootstrapWorld();
  world.playerKnowledge = {
    evidenceIds: [],
    knownRumorIds: [],
    suspectedCauses: [],
    unresolvedQuestions: []
  };
  world.incidents = {
    missing_delivery: {
      id: 'missing_delivery',
      status: 'active',
      title: 'The Missing Delivery',
      resolutionState: 'unresolved',
      involvedAgentIds: ['sara', 'malik', 'nadia', 'rune']
    }
  };
  world.questProgress = { questId: 'quest_missing_delivery', completedSteps: [], resolvedPathId: null };
  if (world.agents?.rune?.relationships?.player) {
    world.agents.rune.relationships.player.trust = 5;
  }
  return world;
}

test('v41: player-facing rumor commands do not require runtime ids', () => {
  const world = investigationReadyWorld();

  for (const command of ['inspect cafe', 'listen_rumors market', 'ask rune nadia']) {
    const result = resolveCommand(world, command);
    assert.equal(result.ok, true, `${command}: ${result.error}`);
  }

  const trace = resolveCommand(world, 'trace_rumor');
  assert.equal(trace.ok, true, trace.error);
  assert.ok(world.playerKnowledge.evidenceIds.includes('rumor_source_nadia'));

  const counter = resolveCommand(world, 'counter_rumor rumor_missing_delivery_blame');
  assert.equal(counter.ok, true, counter.error);
  assert.equal(world.questProgress.resolvedPathId, 'investigation_and_counter_rumor');
});

test('v41: default play boot starts before The Missing Delivery is solved', () => {
  const world = bootstrapWorld();
  assert.equal(world.day, 1);
  assert.equal(world.tick, 0);
  assert.equal(world.incidents.missing_delivery?.status, 'active');
  assert.equal(world.questProgress?.resolvedPathId, null);
  assert.deepEqual(world.playerKnowledge.evidenceIds, []);
  assert.equal(world.playerKnowledge.knownRumorIds.length, 0);
  assert.ok(Object.values(world.rumors).some((r) => r.sourceAgentId === 'nadia'));
  assert.equal(world.founder?.unlocked, false);
});

test('v41: play-server demo path endpoint resolves named paths', async () => {
  const { child, port } = await startServer(0);
  try {
    const res = await fetchJson(port, '/api/demo/path/investigation');
    assert.equal(res.status, 200);
    assert.equal(res.json.ok, true);
    assert.equal(res.json.path, 'investigation');
    assert.ok(Array.isArray(res.json.steps));
  } finally {
    child.kill();
  }
});

test('v41: listen alias parses without mutating a const binding', () => {
  assert.deepEqual(parseCommandText('listen market'), {
    command: 'listen_rumors',
    args: { target: 'market' }
  });
});

test('v41: static 3D client wires embodied controls, collision, quest HUD, decisions, and audio', () => {
  const src = readFileSync(CLIENT, 'utf8');
  assert.match(src, /LOCOMOTION/);
  assert.match(src, /updateLocalLocomotion/);
  assert.match(src, /collidesWithDistrictBuilding/);
  assert.match(src, /renderQuestHud/);
  assert.match(src, /renderIntelHud/);
  assert.match(src, /renderLenoActions/);
  assert.match(src, /addCommandLog/);
  assert.match(src, /findMajorDecision/);
  assert.match(src, /playAudioCues/);
  assert.match(src, /ambient-new-aarhus/);
});
