#!/usr/bin/env node
/**
 * validate:state — audit the shape of a WorldState JSON file.
 *
 * Usage:
 *   node src/cli/validate.js state [path-to-state.json]
 *
 * If no path is given, the canonical scenario is used as the default
 * (since scenarios share the same top-level shape as a WorldState).
 * Returns a JSON report listing total keys, missing keys, and any
 * type errors.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStateShape } from '../contracts/state-validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function report(payload) {
  process.stdout.write(JSON.stringify({ ok: true, kind: 'state', ...payload }) + '\n');
}

function fail(payload) {
  process.stdout.write(JSON.stringify({ ok: false, kind: 'state', ...payload }) + '\n');
  process.exit(1);
}

function main() {
  const arg = process.argv[2];
  const target = arg && !arg.startsWith('-') ? arg : 'scenarios/new-aarhus-district-01.json';
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved)) {
    fail({ reason: `state file not found: ${resolved}` });
    return;
  }
  const data = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const result = validateStateShape(data);
  if (!result.ok) {
    fail({ errors: result.errors, totalKeys: result.totalKeys, missingKeys: result.missingKeys, source: resolved });
    return;
  }
  report({ totalKeys: result.totalKeys, missingKeys: [], source: resolved });
}

main();
