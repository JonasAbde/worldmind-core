#!/usr/bin/env node
/**
 * validate:risk — audit action registry risk levels.
 *
 * Usage:
 *   node src/cli/validate.js risk
 *
 * Exits 0 with a JSON report listing total actions, max risk,
 * and any disabled/gated actions that exceed the MVP risk limit.
 */

import { validateActionRisks } from '../contracts/risk-validator.js';

function report(payload) {
  process.stdout.write(JSON.stringify({ ok: true, kind: 'risk', ...payload }) + '\n');
}

function fail(payload) {
  process.stdout.write(JSON.stringify({ ok: false, kind: 'risk', ...payload }) + '\n');
  process.exit(1);
}

function main() {
  const result = validateActionRisks();
  if (!result.ok) {
    fail({ errors: result.errors, totalActions: result.totalActions, maxRisk: result.maxRisk, disabledGated: result.disabledGated });
    return;
  }
  report({ totalActions: result.totalActions, maxRisk: result.maxRisk, disabledGated: result.disabledGated, mvpLimit: 3 });
}

main();
