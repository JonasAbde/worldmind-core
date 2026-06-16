#!/usr/bin/env node
/**
 * Creator Mode v0.1 — Scenario authoring tools for WorldMind.
 *
 * Usage:
 *   npm run creator -- --help
 *   npm run creator -- agent --name "Test" --role merchant
 *   npm run creator -- location --name "Shop" --zone-type commercial
 *   npm run creator -- incident --title "Theft" --visible-problem "stolen goods"
 *   npm run creator -- validate <path-to-pack>
 *   npm run creator -- export <path-to-pack> --out <file.json>
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const PERMISSIONS_MVP_SAFE = ['talk', 'inspect', 'move', 'listen_rumors', 'ask', 'offer_help', 'ask_favor', 'trade', 'pay', 'negotiate_deal', 'assign_task', 'repair_item', 'deliver_goods', 'trace_rumor', 'counter_rumor', 'observe', 'influence', 'task_assign', 'repair', 'deliver'];

function printHelp() {
  console.log(`
WorldMind Creator Mode v0.1

Usage: npm run creator -- <subcommand> [options]

Subcommands:
  agent       Generate agent template
    --name <string>
    --role <string>        (merchant, worker, citizen, authority)
    --personality <string> (friendly, neutral, guarded, ambitious)
    --starting-location <locId>
    --permissions <perm,...>
    --output <file>

  location    Generate location template
    --name <string>
    --zone-type <string>   (residential, commercial, industrial, civic)
    --vibe <string>
    --owner <agentId|none>
    --allowed-actions <act,...>
    --economy-tags <tag,...>
    --output <file>

  incident    Generate incident template
    --title <string>
    --visible-problem <string>
    --hidden-cause <string> (kept in private section)
    --output <file>

  scenario    Build scenario pack from agent/location/incident JSON
    --agents <file>
    --locations <file>
    --incidents <file>
    --out <pack.json>

  validate    Validate creator pack or scenario pack
    <path-to-json>

  export      Export validated pack to a loadable scenario
    <path-to-pack> --out <file.json>
`);
}

function generateAgentTemplate(args) {
  const id = 'agent_' + Math.random().toString(36).slice(2, 8);
  const agent = {
    id,
    kind: 'agent',
    name: args.name || 'Unnamed Agent',
    role: args.role || 'citizen',
    personality: args.personality || 'neutral',
    goals: [],
    skills: [],
    permissions: args.permissions || ['talk', 'move', 'inspect'],
    relationships: {},
    location: args['starting-location'] || null,
    secret: null
  };
  // Filter unsafe permissions
  agent.permissions = agent.permissions.filter(p => PERMISSIONS_MVP_SAFE.includes(p));
  return agent;
}

function generateLocationTemplate(args) {
  const id = 'loc_' + Math.random().toString(36).slice(2, 6);
  return {
    id,
    kind: 'location',
    name: args.name || 'Unnamed Location',
    zoneType: args['zone-type'] || 'residential',
    vibe: args.vibe || 'quiet',
    owner: args.owner || null,
    allowedActions: args['allowed-actions'] ? args['allowed-actions'].split(',') : ['look', 'talk', 'inspect'],
    restrictedActions: [],
    agentsPresent: [],
    economyTags: args['economy-tags'] ? args['economy-tags'].split(',') : []
  };
}

function generateIncidentTemplate(args) {
  const id = 'incident_' + Math.random().toString(36).slice(2, 6);
  return {
    id,
    kind: 'incident',
    title: args.title || 'Unnamed Incident',
    visibleProblem: args['visible-problem'] || 'Problem description',
    // hiddenCause is NEVER in public section
    evidence: [],
    resolutions: [],
    risks: [],
    private: { hiddenCause: args['hidden-cause'] || 'Hidden cause (kept private)' }
  };
}

function buildScenarioPack(args) {
  const pack = {
    kind: 'scenario',
    id: 'scenario_' + Date.now(),
    name: 'Created Scenario',
    agents: [],
    locations: [],
    incidents: [],
    worldId: null,
    worldName: null
  };
  // Load JSON files and merge
  if (args.agents) {
    const agents = JSON.parse(readFileSync(new URL(args.agents, 'file://' + process.cwd() + '/'), 'utf8'));
    pack.agents = Array.isArray(agents) ? agents : [agents];
  }
  if (args.locations) {
    const locations = JSON.parse(readFileSync(new URL(args.locations, 'file://' + process.cwd() + '/'), 'utf8'));
    pack.locations = Array.isArray(locations) ? locations : [locations];
  }
  if (args.incidents) {
    const incidents = JSON.parse(readFileSync(new URL(args.incidents, 'file://' + process.cwd() + '/'), 'utf8'));
    pack.incidents = Array.isArray(incidents) ? incidents : [incidents];
  }
  return pack;
}

function validateCreatorPack(data) {
  const errors = [];
  // Check duplicate IDs
  const ids = [];
  for (const agent of data.agents || []) {
    if (ids.includes(agent.id)) {
      errors.push('Duplicate ID found: ' + agent.id);
    }
    ids.push(agent.id);
    // Check permissions
    const unsafe = (agent.permissions || []).filter(p => !PERMISSIONS_MVP_SAFE.includes(p));
    if (unsafe.length) {
      errors.push('Unsafe permissions: ' + unsafe.join(', '));
    }
  }
  for (const loc of data.locations || []) {
    if (ids.includes(loc.id)) {
      errors.push('Duplicate ID found: ' + loc.id);
    }
    ids.push(loc.id);
  }
  for (const inc of data.incidents || []) {
    if (ids.includes(inc.id)) {
      errors.push('Duplicate ID found: ' + inc.id);
    }
    ids.push(inc.id);
    // Check hiddenCause not in public
    if (inc.public?.hiddenCause) {
      errors.push('hiddenCause exposed in public field');
    }
  }
  return { ok: errors.length === 0, errors };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === 'help') {
    printHelp();
    exit(0);
  }

  const subcommand = args[0];
  const opts = {};
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, val] = arg.replace('--', '').split('=');
      if (val) {
        opts[key.replace(/-/g, '_')] = val;
      } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
        opts[key.replace(/-/g, '_')] = args[++i];
      }
    }
  }

  let result;
  switch (subcommand) {
    case 'agent':
      result = generateAgentTemplate(opts);
      console.log(JSON.stringify(result, null, 2));
      if (opts.output) {
        writeFileSync(opts.output, JSON.stringify(result, null, 2));
        console.log('Saved to', opts.output);
      }
      break;
    case 'location':
      result = generateLocationTemplate(opts);
      console.log(JSON.stringify(result, null, 2));
      if (opts.output) {
        writeFileSync(opts.output, JSON.stringify(result, null, 2));
        console.log('Saved to', opts.output);
      }
      break;
    case 'incident':
      result = generateIncidentTemplate(opts);
      console.log(JSON.stringify(result, null, 2));
      if (opts.output) {
        writeFileSync(opts.output, JSON.stringify(result, null, 2));
        console.log('Saved to', opts.output);
      }
      break;
    case 'scenario':
      result = buildScenarioPack(opts);
      if (opts.out) {
        writeFileSync(opts.out, JSON.stringify(result, null, 2));
        console.log('Saved to', opts.out);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
      break;
    case 'validate':
      const inputPath = args[1];
      if (!existsSync(inputPath)) {
        console.error('File not found:', inputPath);
        exit(1);
      }
      const data = JSON.parse(readFileSync(inputPath, 'utf8'));
      const v = validateCreatorPack(data);
      if (v.ok) {
        console.log(JSON.stringify({ ok: true, kind: 'creator-validation', checks: [{ name: 'structure', ok: true }] }));
        exit(0);
      } else {
        console.error(JSON.stringify({ ok: false, kind: 'creator-validation', errors: v.errors }, null, 2));
        exit(1);
      }
    case 'export':
      console.log('Export: not yet implemented');
      break;
    default:
      console.error('Unknown subcommand:', subcommand);
      printHelp();
      exit(1);
  }
}

main();

/** Load and validate a scenario pack file */
export function loadScenarioPack(path) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const v = validateCreatorPack(data);
  if (v.ok) {
    return { ok: true, world: data };
  }
  return { ok: false, errors: v.errors };
}

export {
  generateAgentTemplate,
  generateLocationTemplate,
  generateIncidentTemplate,
  buildScenarioPack,
  validateCreatorPack
};