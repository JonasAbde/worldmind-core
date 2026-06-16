#!/usr/bin/env node
/**
 * validate:leno — Leno evidence-guard auditor (CLI).
 *
 * The pure auditor lives in `src/contracts/leno-validator.js`. This
 * file is just the CLI wrapper: it reads a summary (from a file,
 * stdin, or by bootstrapping the canonical scenario), runs the
 * auditor, and prints a human-readable verdict followed by a
 * structured JSON line.
 *
 * Usage:
 *   node src/cli/validate-leno.js [path-to-summary | -] [--json]
 *   node src/cli/validate-leno.js scenarios/new-aarhus-district-01.json
 *
 * Exit codes:
 *   0 — clean (no leaks)
 *   1 — at least one leak detected
 *   2 — invalid input (missing file, etc.)
 */

import fs from 'node:fs';
import path from 'node:path';
import { runSimulation } from '../simulation/sim.ts';
import { lenoSummarize } from '../simulation/leno.ts';
import { validateLenoSummary } from '../contracts/leno-validator.js';

const REPO = process.cwd();

function isScenarioPath(p) {
  if (!p) return false;
  try {
    if (!p.endsWith('.json') || !fs.existsSync(p)) return false;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Boolean(data.agents);
  } catch {
    return false;
  }
}

function loadWorldIfScenario(p) {
  if (!isScenarioPath(p)) return null;
  return runSimulation({ days: 1, scenarioPath: p, persistToSqlite: false, writeScenario: false });
}

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === '--') argv.shift();
  const jsonOnly = argv.includes('--json');
  let target = argv[argv.length - 1];
  if (target && target.startsWith('--')) target = null;

  let text;
  let world = null;
  if (target && target !== '-') {
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) {
      process.stdout.write(JSON.stringify({ ok: false, kind: 'leno-validator', message: `file not found: ${resolved}` }) + '\n');
      process.exit(2);
    }
    world = loadWorldIfScenario(resolved);
    if (world) {
      text = lenoSummarize(world, { scope: 'world' });
    } else {
      text = fs.readFileSync(resolved, 'utf8');
    }
  } else if (target === '-') {
    text = readStdin();
  } else {
    // default: audit the canonical scenario's current Leno summary
    const scenarioPath = path.join(REPO, 'scenarios/new-aarhus-district-01.json');
    world = runSimulation({ days: 1, scenarioPath, persistToSqlite: false, writeScenario: false });
    text = lenoSummarize(world, { scope: 'world' });
  }

  const result = validateLenoSummary(text, world);
  // Human-readable output FIRST so the JSON line is always the final
  // line on stdout (callers parse the last line).
  if (!jsonOnly) {
    if (result.ok) {
      process.stdout.write('Leno summary: clean (no hidden-truth leaks)\n');
    } else {
      process.stdout.write('Leno summary: LEAKS DETECTED\n');
      for (const f of result.findings.filter((x) => !x.ok)) {
        process.stdout.write(`  - ${f.rule}\n`);
      }
    }
  }
  const payload = { ok: result.ok, kind: 'leno-validator', leaks: result.leaks, findings: result.findings, snippet: text.slice(0, 240) };
  process.stdout.write(JSON.stringify(payload) + '\n');
  process.exit(result.ok ? 0 : 1);
}

main();
