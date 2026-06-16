#!/usr/bin/env node
/**
 * Canonical validator CLI for WorldMind.
 *
 * Usage:
 *   node src/cli/validate.js scenario <path-to-scenario.json>
 *   node src/cli/validate.js snapshot <path-to-snapshot.json>
 *   node src/cli/validate.js diff <path-to-diff.json>
 *
 * Each subcommand prints a structured report and exits non-zero on
 * any validation error. The CI gate (`npm run ci:gate`) uses the
 * scenario subcommand against the canonical scenario file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseScenario,
  parseSnapshot,
  parseDiff
} from '../contracts/parse.js';
import { diffContracts } from '../contracts/validators.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function main() {
  const argv = process.argv.slice(2);
  // strip leading `--` if caller used `npm run <script> -- <sub> <target>`
  const cleaned = argv[0] === '--' ? argv.slice(1) : argv;
  const [subcommand, ...rest] = cleaned;
  const target = rest[0] ?? process.env.WM_VALIDATE_TARGET ?? null;
  if (!subcommand) {
    process.stderr.write('usage: validate <scenario|snapshot|diff> [path|"-"]\n');
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
    default:
      process.stderr.write(`unknown subcommand: ${subcommand}\n`);
      code = 2;
  }
  process.exit(code);
}

main();
