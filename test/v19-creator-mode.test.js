import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

// Import GREEN-phase from creator module
import {
  generateAgentTemplate,
  generateLocationTemplate,
  generateIncidentTemplate,
  buildScenarioPack,
  validateCreatorPack,
  loadScenarioPack
} from '../src/cli/creator.js';

// TDD GREEN phase: Tests now use real implementations

test('v1.0-rc9: creator CLI --help shows subcommands', () => {
  const result = execSync('npm run creator -- --help', { encoding: 'utf8' });
  assert.ok(result.includes('agent'), 'help should mention agent subcommand');
  assert.ok(result.includes('location'), 'help should mention location subcommand');
  assert.ok(result.includes('incident'), 'help should mention incident subcommand');
  assert.ok(result.includes('scenario'), 'help should mention scenario subcommand');
  assert.ok(result.includes('validate'), 'help should mention validate subcommand');
  assert.ok(result.includes('export'), 'help should mention export subcommand');
});

test('v1.0-rc9: agent generation produces valid Agent JSON', () => {
  const agent = generateAgentTemplate({
    name: 'Test Agent',
    role: 'merchant',
    personality: 'friendly',
    permissions: ['trade', 'talk'],
    starting_location: 'loc_market'
  });
  assert.equal(agent.name, 'Test Agent');
  assert.equal(agent.role, 'merchant');
  assert.ok(Array.isArray(agent.goals));
  assert.ok(Array.isArray(agent.skills));
  assert.ok(agent.permissions.every(p => p !== 'admin' && p !== 'world_change'));
});

test('v1.0-rc9: location generation produces valid Location JSON', () => {
  const location = generateLocationTemplate({
    name: 'Test Shop',
    zone_type: 'commercial',
    vibe: 'busy',
    owner: null,
    allowed_actions: 'look,talk,trade',
    economy_tags: 'trade,market'
  });
  assert.equal(location.name, 'Test Shop');
  assert.equal(location.zoneType, 'commercial');
  assert.ok(Array.isArray(location.economyTags));
});

test('v1.0-rc9: incident generation produces valid Incident JSON', () => {
  const incident = generateIncidentTemplate({
    title: 'Test Incident',
    visible_problem: 'Someone stole supplies',
    hidden_cause: 'The thief is unknown'
  });
  assert.equal(incident.title, 'Test Incident');
  assert.equal(incident.kind, 'incident');
  // hiddenCause should be in private section, NOT public
  assert.ok(incident.private?.hiddenCause.startsWith('The'));
  assert.ok(!incident?.public?.hiddenCause);
});

test('v1.0-rc9: scenario pack builder combines agents/locations/incidents', () => {
  const pack = buildScenarioPack({
    agents: [{ name: 'A', role: 'NPC', permissions: ['talk'] }],
    locations: [{ name: 'B', zoneType: 'residential' }],
    incidents: [{ title: 'C', visibleProblem: 'test' }]
  });
  assert.equal(pack.agents.length, 1);
  assert.equal(pack.locations.length, 1);
  assert.equal(pack.incidents.length, 1);
  assert.equal(pack.kind, 'scenario');
});

test('v1.0-rc9: validate:creator rejects duplicate IDs', () => {
  const result = validateCreatorPack({
    agents: [{ id: 'dup', name: 'A' }, { id: 'dup', name: 'B' }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('Duplicate')));
});

test('v1.0-rc9: validate:creator rejects unsafe permissions', () => {
  const result = validateCreatorPack({
    agents: [{ id: 'a1', name: 'A', permissions: ['admin'] }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('Unsafe')));
});

test('v1.0-rc9: validate:creator rejects hiddenCause in public fields', () => {
  const result = validateCreatorPack({
    incidents: [{ id: 'i1', public: { hiddenCause: 'secret' } }]
  });
  assert.equal(result.ok, false);
});

test('v1.0-rc9: web creator panel exists in phone UI', () => {
  const html = fs.readFileSync('static-play/index.html', 'utf8');
  assert.ok(html.includes('data-phone-pane="creator"'), 'creator tab should exist');
  assert.ok(html.includes('creator-agent-form') || html.includes('Creator Agent'), 'agent form should render');
});