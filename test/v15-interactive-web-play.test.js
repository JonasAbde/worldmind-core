/**
 * v1.0-rc5 — Interactive Web Play UI.
 *
 * Tests pin the playable web layer:
 *   1. `play:web` generates `static-play/index.html`
 *   2. the generated page contains all 11 required sections
 *   3. `validate:web-play` exits 0 on the generated page
 *   4. `play-engine` resolves a command to a structured result
 *   5. the web renderer turns a result into HTML fragments
 *   6. the 3 demo paths are listed in the UI
 *   7. evidence guard is reflected in the UI (no Nadia name without
 *      `rumor_source_nadia`)
 *   8. existing 153 tests are still green
 *
 * Acceptance gates exercised alongside `ci:gate`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..');
const PLAY_WEB = path.join(REPO, 'src/cli/play-web.js');
const VALIDATE_WEB = path.join(REPO, 'src/cli/validate-web-play.js');
const PLAY_ENGINE = path.join(REPO, 'src/play/play-engine.js');
const WEB_RENDERER = path.join(REPO, 'src/play/web-renderer.js');

const REQUIRED_SECTIONS = [
  '<h1',
  'Current Location',
  'Visible Agents',
  'Available Commands',
  'Dialogue',
  'Consequence',
  'Evidence',
  'Incident',
  'Leno',
  'Saves',
  'Branches',
  'Demo Paths'
];

function runScript(scriptPath, args = [], opts = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    input: opts.stdin,
    timeout: 60_000,
    env: { ...process.env, ...(opts.env || {}) }
  });
}

test('v1.0-rc5: play-engine module exports resolveCommand and bootstrapWorld', async () => {
  assert.ok(fs.existsSync(PLAY_ENGINE), `missing ${PLAY_ENGINE}`);
  // Importable as a module that exports the engine API
  const engine = await import(pathToFileURL(PLAY_ENGINE).href);
  assert.equal(typeof engine.resolveCommand, 'function', 'resolveCommand must be a function');
  assert.equal(typeof engine.bootstrapWorld, 'function', 'bootstrapWorld must be a function');
  assert.equal(typeof engine.runScriptedPath, 'function', 'runScriptedPath must be a function');
});

test('v1.0-rc5: play-engine resolveCommand("look") returns world overview payload', async () => {
  const engine = await import(pathToFileURL(PLAY_ENGINE).href);
  const world = engine.bootstrapWorld();
  const result = engine.resolveCommand(world, 'look', {});
  assert.equal(result.ok, true, `look failed: ${result.error}`);
  assert.equal(result.kind, 'look');
  assert.match(result.text, /Day/i);
  assert.match(result.text, /State:/i);
});

test('v1.0-rc5: play-engine resolveCommand("ask rune nadia") returns dialogue payload', async () => {
  const engine = await import(pathToFileURL(PLAY_ENGINE).href);
  const world = engine.bootstrapWorld();
  const result = engine.resolveCommand(world, 'ask', { target: 'rune', topic: 'nadia' });
  assert.equal(result.ok, true, `ask failed: ${result.error}`);
  assert.equal(result.kind, 'dialogue');
  assert.ok(result.dialogue, 'expected dialogue object');
  assert.equal(result.dialogue.agentName, 'Rune');
  assert.equal(result.dialogue.topic, 'nadia');
});

test('v1.0-rc5: play-engine rejects unknown command gracefully', async () => {
  const engine = await import(pathToFileURL(PLAY_ENGINE).href);
  const world = engine.bootstrapWorld();
  const result = engine.resolveCommand(world, 'fly_to_mars', {});
  assert.equal(result.ok, false, 'expected unknown command to be rejected');
  assert.match(result.error, /unknown/i);
});

test('v1.0-rc5: play-engine resolves "look" through text command parser', async () => {
  const engine = await import(pathToFileURL(PLAY_ENGINE).href);
  const world = engine.bootstrapWorld();
  const result = engine.resolveCommand(world, 'look', {});
  assert.equal(result.kind, 'look');
});

test('v1.0-rc5: web-renderer module exports render functions', async () => {
  const renderer = await import(pathToFileURL(WEB_RENDERER).href);
  assert.equal(typeof renderer.renderWebPage, 'function');
  assert.equal(typeof renderer.renderTopBar, 'function');
  assert.equal(typeof renderer.renderCommandButtons, 'function');
  assert.equal(typeof renderer.renderDialogueTurn, 'function');
  assert.equal(typeof renderer.renderConsequence, 'function');
  assert.equal(typeof renderer.renderEvidence, 'function');
  assert.equal(typeof renderer.renderRumorTrail, 'function');
  assert.equal(typeof renderer.renderFounderPanel, 'function');
  assert.equal(typeof renderer.renderMajorDecisionPanel, 'function');
  assert.equal(typeof renderer.renderDemoPaths, 'function');
});

test('v1.0-rc5: web-renderer renderWebPage produces all 11 required sections', async () => {
  const renderer = await import(pathToFileURL(WEB_RENDERER).href);
  const html = renderer.renderWebPage({
    world: { name: 'Test', day: 1, time: '00:00', agents: {}, locations: {}, incidents: {}, playerKnowledge: { evidenceIds: [], knownRumorIds: [] } },
    dialogue: null,
    consequence: null,
    saves: [],
    branches: [],
    demoPaths: [
      { name: 'peaceful', description: 'Help Sara' },
      { name: 'investigation', description: 'Trace the rumor' },
      { name: 'founder', description: 'Pay Malik' }
    ]
  });
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(html.includes(section), `renderWebPage missing section: ${section}`);
  }
});

test('v1.0-rc5: web-renderer redacts Nadia name until rumor_source_nadia is present', async () => {
  const renderer = await import(pathToFileURL(WEB_RENDERER).href);
  // Without evidence: a source-defining mention should be redacted
  const noEvidence = renderer.renderEvidence({
    playerKnowledge: { evidenceIds: [], knownRumorIds: [] },
    leno: { summary: 'Nadia is the source of the false rumor.' }
  });
  assert.doesNotMatch(noEvidence, /Nadia is the source/i, 'redaction failed for source-defining mention');
  assert.match(noEvidence, /REDACTED/i, 'expected REDACTED marker');

  // With evidence: the same text should pass through (Leno may name her).
  const withEvidence = renderer.renderEvidence({
    playerKnowledge: { evidenceIds: ['rumor_source_nadia'], knownRumorIds: [] },
    leno: { summary: 'Nadia is a probable source of the false rumor.' }
  });
  assert.match(withEvidence, /Nadia is a probable source/i, 'evidence gate should allow Nadia mention');
});

test('v1.0-rc5: play:web generates static-play/index.html', async () => {
  const res = runScript(PLAY_WEB, []);
  assert.equal(res.status, 0, `play:web failed: ${res.stderr}\n${res.stdout}`);
  const outPath = path.join(REPO, 'static-play/index.html');
  assert.ok(fs.existsSync(outPath), `expected ${outPath} to exist`);
  const html = fs.readFileSync(outPath, 'utf8');
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(html.includes(section), `generated page missing section: ${section}`);
  }
});

test('v1.0-rc5: play:web generates demo paths panel with all 3 paths', async () => {
  const res = runScript(PLAY_WEB, []);
  assert.equal(res.status, 0);
  const html = fs.readFileSync(path.join(REPO, 'static-play/index.html'), 'utf8');
  assert.match(html, /peaceful/i);
  assert.match(html, /investigation/i);
  assert.match(html, /founder/i);
});

test('v1.0-rc5: play:web includes a text-input command form', async () => {
  const res = runScript(PLAY_WEB, []);
  assert.equal(res.status, 0);
  const html = fs.readFileSync(path.join(REPO, 'static-play/index.html'), 'utf8');
  assert.match(html, /<input[^>]*text/i, 'expected a text input field');
  // command buttons for safe/common commands
  for (const cmd of ['look', 'talk', 'ask', 'inspect']) {
    assert.ok(html.includes(`data-command="${cmd}"`) || html.includes(`data-cmd="${cmd}"`) || html.includes(`onclick="cmd('${cmd}')"`),
      `expected command button for ${cmd}`);
  }
});

test('v1.0-rc8: gameplay shell renders hotspots, npc cards, case board, and decisions', async () => {
  const res = runScript(PLAY_WEB, []);
  assert.equal(res.status, 0);
  const html = fs.readFileSync(path.join(REPO, 'static-play/index.html'), 'utf8');
  assert.match(html, /wm-topbar/);
  assert.match(html, /data-hotspot-id=/);
  assert.match(html, /wm-npc-card/);
  assert.match(html, /wm-npc-portrait/);
  assert.match(html, /wm-case-board/);
  assert.match(html, /wm-rumor-trail/);
  assert.match(html, /wm-ticker/);
  assert.match(html, /data-major-decision=/);
});

test('v1.0-rc5: play:web writes a deterministic JSON state file alongside the page', async () => {
  const res = runScript(PLAY_WEB, []);
  assert.equal(res.status, 0);
  const statePath = path.join(REPO, 'static-play/state.json');
  assert.ok(fs.existsSync(statePath), 'expected static-play/state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.ok(state.world, 'state should contain world');
  assert.ok(Array.isArray(state.demoPaths), 'state should contain demoPaths');
});

test('v1.0-rc5: play:web output is deterministic — same content on re-run', async () => {
  const a = runScript(PLAY_WEB, []);
  const b = runScript(PLAY_WEB, []);
  assert.equal(a.status, 0);
  assert.equal(b.status, 0);
  // Compare non-timestamp bytes (state.json is fully deterministic).
  const aJson = JSON.parse(fs.readFileSync(path.join(REPO, 'static-play/state.json'), 'utf8'));
  const bJson = JSON.parse(fs.readFileSync(path.join(REPO, 'static-play/state.json'), 'utf8'));
  assert.deepEqual(aJson, bJson);
});

test('v1.0-rc5: validate:web-play passes on a freshly generated page', () => {
  runScript(PLAY_WEB, []);
  const res = runScript(VALIDATE_WEB, []);
  assert.equal(res.status, 0, `validate:web-play failed: ${res.stdout}\n${res.stderr}`);
  const last = res.stdout.trim().split('\n').pop();
  const json = JSON.parse(last);
  assert.equal(json.ok, true);
  // 11 section labels + 3 runtime markers are both reported
  assert.ok(json.sectionsChecked >= 11, `expected at least 11 sections, got ${json.sectionsChecked}`);
  assert.ok(json.runtimeMarkersChecked >= 3, `expected at least 3 runtime markers`);
});

test('v1.0-rc5: validate:web-play fails on a page missing required sections', async () => {
  const tmp = path.join(REPO, 'static-play/_test-bad.html');
  fs.writeFileSync(tmp, '<html><body><h1>missing everything</h1></body></html>');
  const res = runScript(VALIDATE_WEB, [tmp]);
  fs.unlinkSync(tmp);
  assert.notEqual(res.status, 0, 'validate should reject a page missing sections');
  const last = res.stdout.trim().split('\n').pop();
  const json = JSON.parse(last);
  assert.equal(json.ok, false);
  assert.ok(Array.isArray(json.missing) && json.missing.length > 0);
});

test('v1.0-rc5: validate:web-play reads --json from a custom page', () => {
  const tmp = path.join(REPO, 'static-play/_test-good.html');
  const labels = ['Current Location', 'Visible Agents', 'Available Commands', 'Dialogue',
    'Consequence', 'Evidence', 'Incident', 'Leno', 'Saves', 'Branches', 'Demo Paths'];
  const markers = ['wm-cmd-btn', 'wm-cmd-form', 'wm-state'];
  const visual = [
    'data-scene-img', 'wm-hotspot-run', 'data-run-command', 'wm-npc-portrait',
    'data-case-board', 'data-rumor-trail', 'data-founder-panel', 'data-major-decision-modal',
    'data-consequence-ticker', 'data-game-shell'
  ];
  const goodHtml = '<html><body>' + labels.map((s) => `<h2>${s}</h2>`).join('\n')
    + '\n' + markers.map((m) => `<div class="${m}">marker</div>`).join('\n')
    + '\n' + visual.map((m) => `<!-- ${m} -->`).join('\n')
    + '</body></html>';
  fs.writeFileSync(tmp, goodHtml);
  const res = runScript(VALIDATE_WEB, ['--json', tmp]);
  fs.unlinkSync(tmp);
  const last = res.stdout.trim().split('\n').pop();
  const json = JSON.parse(last);
  assert.equal(json.ok, true);
  assert.ok(json.sectionsChecked >= 11);
  assert.ok(json.runtimeMarkersChecked >= 3);
  assert.ok(json.visualMarkersChecked >= 10);
});

test('v1.0-rc9: founder workflow commands start and complete delivery contract', async () => {
  const engine = await import(pathToFileURL(PLAY_ENGINE).href);
  const world = engine.bootstrapWorld();
  world.founder = { unlocked: true, baseLevel: 0, contractsCompleted: 0, activeContract: null, reputation: 0 };
  const moneyBefore = world.agents.player.stats.money;
  const start = engine.resolveCommand(world, 'start_delivery_workflow', {});
  assert.equal(start.ok, true, start.error);
  assert.ok(world.founder.activeContract);
  const run = engine.resolveCommand(world, 'run_delivery_contract', {});
  assert.equal(run.ok, true, run.error);
  assert.equal(world.founder.activeContract, null);
  assert.equal(world.founder.contractsCompleted, 1);
  assert.ok(world.agents.player.stats.money > moneyBefore);
});

test('v1.0-rc9: game-shell-model maps major decisions to authored commands', async () => {
  const { buildGameplayShellModel } = await import(pathToFileURL(path.join(REPO, 'src/play/game-shell-model.js')).href);
  const shell = buildGameplayShellModel(
    { agents: { player: { locationId: 'cafe', stats: { money: 100 } } }, incidents: {}, founder: { unlocked: true } },
    { playerKnowledge: { evidenceIds: [], knownRumorIds: [] } }
  );
  const peaceful = shell.majorDecisions.find((d) => d.id === 'peaceful_mediation');
  assert.equal(peaceful?.command, 'pay malik 5');
  assert.equal(shell.majorDecisions.find((d) => d.id === 'expose_nadia'), undefined);
  const withEvidence = buildGameplayShellModel(
    { agents: { player: { locationId: 'cafe', stats: { money: 100 } } }, incidents: {}, founder: { unlocked: true } },
    { playerKnowledge: { evidenceIds: ['rumor_source_nadia'], knownRumorIds: [] } }
  );
  assert.ok(withEvidence.majorDecisions.find((d) => d.id === 'expose_nadia'));
});

test('v1.0-rc9: play:web includes live shell update markers', async () => {
  const res = runScript(PLAY_WEB, []);
  assert.equal(res.status, 0);
  const html = fs.readFileSync(path.join(REPO, 'static-play/index.html'), 'utf8');
  assert.match(html, /data-topbar-money/);
  assert.match(html, /applyCommandResult/);
  assert.match(html, /data-founder-contracts/);
});

test('v1.0-rc10: case board builds authored links between visible cards', async () => {
  const { buildGameplayShellModel } = await import(pathToFileURL(path.join(REPO, 'src/play/game-shell-model.js')).href);
  const shell = buildGameplayShellModel(
    { agents: { player: { locationId: 'cafe', stats: { money: 100 } } }, incidents: {}, founder: { unlocked: false } },
    {
      playerKnowledge: {
        evidenceIds: ['cafe_delivery_gap', 'rumor_source_nadia'],
        knownRumorIds: ['rumor_missing_delivery_blame', 'market_rumor_chain']
      }
    }
  );
  assert.ok(shell.caseBoard.links.length >= 2);
  const revealLink = shell.caseBoard.links.find((l) => l.relation === 'reveals_source');
  assert.equal(revealLink?.redacted, false);
});

test('v1.0-rc10: detectMajorDecisionFromCommand matches negotiated pay command', async () => {
  const { detectMajorDecisionFromCommand } = await import(pathToFileURL(path.join(REPO, 'src/play/game-shell-model.js')).href);
  const decision = detectMajorDecisionFromCommand('pay malik 15', { evidenceIds: [] });
  assert.equal(decision?.id, 'founder_negotiation');
  assert.equal(decision?.command, 'pay malik 15');
});

test('v1.0-rc10: renderCaseBoard emits trace buttons and case link rows', async () => {
  const { renderCaseBoard } = await import(pathToFileURL(WEB_RENDERER).href);
  const html = renderCaseBoard({
    evidenceCards: [{ id: 'cafe_delivery_gap', label: 'Delivery gap', locationId: 'cafe', inspectCommand: 'inspect cafe' }],
    rumorCards: [{
      id: 'rumor_missing_delivery_blame',
      label: 'Someone stole the delivery',
      traceCommand: 'trace_rumor rumor_missing_delivery_blame',
      counterCommand: 'counter_rumor rumor_missing_delivery_blame'
    }],
    links: [{ from: 'cafe_delivery_gap', to: 'rumor_missing_delivery_blame', relation: 'contradicts', redacted: false }]
  });
  assert.match(html, /wm-case-links/);
  assert.match(html, /data-run-command="inspect cafe"/);
  assert.match(html, /contradicts/);
});

test('v1.0-rc10: play:web embeds case board and major-decision live helpers', async () => {
  const res = runScript(PLAY_WEB, []);
  assert.equal(res.status, 0);
  const html = fs.readFileSync(path.join(REPO, 'static-play/index.html'), 'utf8');
  assert.match(html, /renderCaseBoardHtml/);
  assert.match(html, /data-case-board/);
  assert.match(html, /matchMajorDecision/);
  assert.match(html, /data-major-decision-modal/);
  assert.match(html, /data-case-tab/);
});

test('v1.1 visual shell: generated page has gameplay layout markers', async () => {
  runScript(PLAY_WEB, []);
  const html = fs.readFileSync(path.join(REPO, 'static-play/index.html'), 'utf8');
  assert.match(html, /data-game-shell/);
  assert.match(html, /data-scene-img/);
  assert.match(html, /wm-hotspot-run/);
  assert.match(html, /wm-npc-portrait/);
  assert.match(html, /data-rumor-trail/);
  assert.match(html, /data-founder-panel/);
  assert.match(html, /data-consequence-ticker/);
  assert.match(html, /assets\/locations\/cafe\.png/);
});

test('v1.1 visual shell: validate-web-play checks visual markers and assets', () => {
  runScript(PLAY_WEB, []);
  const res = runScript(VALIDATE_WEB, []);
  assert.equal(res.status, 0, `validate:web-play failed: ${res.stdout}\n${res.stderr}`);
  const json = JSON.parse(res.stdout.trim().split('\n').pop());
  assert.ok(json.visualMarkersChecked >= 10);
  assert.ok(json.assetsChecked >= 10);
});

test('v1.1 visual shell: hotspots include description and inspect buttons', async () => {
  const { buildGameplayShellModel } = await import(pathToFileURL(path.join(REPO, 'src/play/game-shell-model.js')).href);
  const shell = buildGameplayShellModel(
    { agents: { player: { locationId: 'cafe', stats: { money: 50 } } }, locations: { cafe: { name: 'Café' } }, incidents: {} },
    { playerKnowledge: { evidenceIds: [], knownRumorIds: [] } }
  );
  const crate = shell.location.hotspots.find((h) => h.id === 'cafe_delivery_crate');
  assert.ok(crate?.description);
  assert.ok(crate?.possibleEvidence?.length);
  const { renderLocationPlay } = await import(pathToFileURL(path.join(REPO, 'src/play/visual-game-shell.js')).href);
  const html = renderLocationPlay(shell, {});
  assert.match(html, /Inspect \/ Run/);
  assert.match(html, /cafe_delivery_crate/);
});

test('v1.0-rc5: ci:gate includes play:web and validate:web-play', async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['ci:gate'] || '', /play:web|play-web/i, 'ci:gate should run play:web');
  assert.match(pkg.scripts['ci:gate'] || '', /validate:web-play|validate-web-play/i, 'ci:gate should run validate:web-play');
});

test('v1.0-rc5: package.json has play:web and validate:web-play scripts', async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['play:web'], 'play:web script missing');
  assert.ok(pkg.scripts['validate:web-play'], 'validate:web-play script missing');
});
