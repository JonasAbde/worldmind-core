#!/usr/bin/env node
/**
 * Canonical validator CLI for WorldMind.
 *
 * Usage:
 *   node src/cli/validate.js scenario <path-to-scenario.json>
 *   node src/cli/validate.js snapshot <path-to-snapshot.json>
 *   node src/cli/validate.js diff <path-to-diff.json>
 *   node src/cli/validate.js branch <path-to-branch.json>
 *   node src/cli/validate.js dashboard <path-to-dashboard-dir>
 *
 * Each subcommand prints a structured report and exits non-zero on
 * any validation error. The CI gate (`npm run ci:gate`) uses the
 * scenario, branch, and dashboard subcommands.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseScenario,
  parseSnapshot,
  parseDiff,
  parseBranch
} from '../contracts/parse.js';
import { diffContracts } from '../contracts/validators.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REQUIRED_DASHBOARD_SECTIONS = [
  '<h1>WorldMind',
  '<h2>World Overview',
  '<h2>Leno Panel',
  '<h2>Save Browser',
  '<h2>Timeline Branches',
  '<h2>Snapshot Details',
  '<h2>Timeline Diff',
  '<h2>Branch-aware Event Log',
  '<h2>Continue from snapshot',
  '<h2>Agent List',
  '<h2>Location View',
  '<h2>Rumor Board',
  '<h2>Relationship Graph',
  '<h2>Incident View',
  '<h2>Eval'
];

function readStdinOrFile(maybePath) {
  if (maybePath === '-' || maybePath === undefined) {
    return fs.readFileSync(0, 'utf8');
  }
  return fs.readFileSync(path.resolve(maybePath), 'utf8');
}

function report(label, payload) {
  process.stdout.write(JSON.stringify({ ok: true, kind: label, ...payload }) + '\n');
}

function fail(label, err) {
  process.stdout.write(
    JSON.stringify({ ok: false, kind: label, message: err.message, errors: err.validationErrors ?? null }) + '\n'
  );
}

function runScenario(maybePath) {
  try {
    const raw = readStdinOrFile(maybePath);
    const data = JSON.parse(raw);
    const parsed = parseScenario(data);
    report('scenario', { id: parsed.id, name: parsed.name });
    return 0;
  } catch (err) {
    fail('scenario', err);
    return 1;
  }
}

function runSnapshot(maybePath) {
  try {
    const raw = readStdinOrFile(maybePath);
    const data = JSON.parse(raw);
    const parsed = parseSnapshot(data);
    report('snapshot', { id: parsed.id, worldId: parsed.worldId, tick: parsed.tick, day: parsed.day, time: parsed.time });
    return 0;
  } catch (err) {
    fail('snapshot', err);
    return 1;
  }
}

function runDiff(maybePath) {
  try {
    const raw = readStdinOrFile(maybePath);
    const data = JSON.parse(raw);
    const parsed = parseDiff(data);
    const renamed = diffContracts(data);
    report('diff', { version: parsed.version, renamedFields: renamed });
    return 0;
  } catch (err) {
    fail('diff', err);
    return 1;
  }
}

function runBranch(maybePath) {
  try {
    const raw = readStdinOrFile(maybePath);
    const data = JSON.parse(raw);
    const parsed = parseBranch(data);
    report('branch', { id: parsed.id, worldId: parsed.worldId, name: parsed.name, originSnapshotId: parsed.originSnapshotId });
    return 0;
  } catch (err) {
    fail('branch', err);
    return 1;
  }
}

function runDashboard(maybePath) {
  try {
    if (!maybePath) {
      throw new Error('dashboard subcommand requires a path to the dashboard output directory');
    }
    const resolved = path.resolve(maybePath);
    const htmlPath = path.join(resolved, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error(`dashboard index.html not found at ${htmlPath}`);
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    const missing = REQUIRED_DASHBOARD_SECTIONS.filter((section) => !html.includes(section));
    if (missing.length > 0) {
      const err = new Error('dashboard is missing required sections: ' + missing.join(', '));
      err.validationErrors = missing;
      throw err;
    }
    report('dashboard', { path: htmlPath, sectionsChecked: REQUIRED_DASHBOARD_SECTIONS.length });
    return 0;
  } catch (err) {
    fail('dashboard', err);
    return 1;
  }
}

function main() {
  const argv = process.argv.slice(2);
  // strip leading `--` if caller used `npm run <script> -- <sub> <target>`
  const cleaned = argv[0] === '--' ? argv.slice(1) : argv;
  const [subcommand, ...rest] = cleaned;
  const target = rest[0] ?? process.env.WM_VALIDATE_TARGET ?? null;
  if (!subcommand) {
    process.stderr.write('usage: validate <scenario|snapshot|diff|branch|dashboard> [path|"-"]\n');
    process.exit(2);
  }
  let code = 0;
  switch (subcommand) {
    case 'scenario':
      code = runScenario(target);
      break;
    case 'snapshot':
      code = runSnapshot(target);
      break;
    case 'diff':
      code = runDiff(target);
      break;
    case 'branch':
      code = runBranch(target);
      break;
    case 'dashboard':
      code = runDashboard(target);
      break;
    default:
      process.stderr.write(`unknown subcommand: ${subcommand}\n`);
      code = 2;
  }
  process.exit(code);
}

main();
